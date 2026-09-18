import { dialog, ipcMain } from 'electron'
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, normalize } from 'node:path'
import type { FileFilter } from '../shared/api'
import type { GetWindow } from './index'

const FILE_FILTERS: FileFilter[] = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'txt'] },
  { name: 'All Files', extensions: ['*'] }
]

export function registerFilesIpc(getWindow: GetWindow): void {
  ipcMain.handle('dialog:openFile', async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: FILE_FILTERS
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const content = await readFile(filePath, 'utf-8')
    return { filePath, content }
  })

  ipcMain.handle(
    'dialog:saveFile',
    async (_e, defaultPath?: string, filters?: FileFilter[]) => {
      const win = getWindow()
      if (!win) return null
      const result = await dialog.showSaveDialog(win, {
        defaultPath,
        filters: filters && filters.length > 0 ? filters : FILE_FILTERS
      })
      if (result.canceled || !result.filePath) return null
      return result.filePath
    }
  )

  ipcMain.handle('dialog:openFolder', async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return { folderPath: result.filePaths[0] }
  })

  ipcMain.handle('file:read', async (_e, filePath: string) => {
    return readFile(filePath, 'utf-8')
  })

  ipcMain.handle('file:write', async (_e, filePath: string, content: string) => {
    await writeFile(filePath, content, 'utf-8')
    return true
  })

  // P16: binary-safe sibling of file:write (Mermaid PNG export sends the
  // base64 payload only — the renderer strips any data: prefix).
  ipcMain.handle('file:writeBase64', async (_e, filePath: string, base64: string) => {
    await writeFile(filePath, Buffer.from(base64, 'base64'))
    return true
  })

  // ---- tree file operations -------------------------------------------------

  ipcMain.handle('file:create', async (_e, filePath: string) => {
    // 'wx' fails if the path exists — never clobber an existing file.
    await writeFile(filePath, '', { encoding: 'utf-8', flag: 'wx' })
    return true
  })

  ipcMain.handle('file:mkdir', async (_e, dirPath: string) => {
    // Reject first: mkdir without recursive never clobbers, but a clear error
    // beats EEXIST's raw message (parity with file:create).
    await stat(dirPath).then(
      () => {
        throw new Error(`"${basename(dirPath)}" already exists`)
      },
      () => undefined // target free
    )
    await mkdir(dirPath)
    return true
  })

  ipcMain.handle('file:delete', async (_e, targetPath: string) => {
    await rm(targetPath, { recursive: true, force: false })
    return true
  })

  ipcMain.handle('file:rename', async (_e, oldPath: string, newPath: string) => {
    if (oldPath === newPath) return true
    await stat(newPath).then(
      () => {
        throw new Error(`"${basename(newPath)}" already exists`)
      },
      () => undefined // target free
    )
    await rename(oldPath, newPath)
    return true
  })

  // P07: drag-drop move. The renderer rejects own-subtree drops too; the check
  // is repeated here so a stray call can't destroy the source tree.
  ipcMain.handle('path:move', async (_e, srcPath: string, destDir: string): Promise<string> => {
    const sep = process.platform === 'win32' ? '\\' : '/'
    if (destDir === srcPath || destDir.startsWith(srcPath + sep)) {
      throw new Error('Cannot move a folder into itself')
    }
    const newPath = join(destDir, basename(srcPath))
    if (newPath === srcPath) return srcPath
    await stat(newPath).then(
      () => {
        throw new Error(`"${basename(newPath)}" already exists`)
      },
      () => undefined // target free
    )
    try {
      await rename(srcPath, newPath)
    } catch (err) {
      // Cross-device move: copy + delete instead of failing outright.
      if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
        await cp(srcPath, newPath, { recursive: true })
        await rm(srcPath, { recursive: true, force: false })
      } else {
        throw err
      }
    }
    return newPath
  })

  // Existence probe for the recent-files menu (P03) — missing paths render greyed.
  ipcMain.handle('file:pathExists', async (_e, filePath: string) => {
    try {
      await stat(filePath)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('file:resolveImageSrc', async (_e, dir: string, src: string) => {
    if (/^(https?:|data:|mdres:)/i.test(src)) return { src, mtime: null, absPath: null }
    const abs = normalize(isAbsolute(src) ? src : join(dir || '.', src))
    let mtime: number | null = null
    try {
      mtime = (await stat(abs)).mtimeMs
    } catch {
      // missing file — the renderer shows the broken-image placeholder
    }
    // The v= query busts Chromium's mdres cache when the file changes on disk;
    // the handler in main.ts only reads `path` and ignores it.
    const version = mtime != null ? `&v=${Math.floor(mtime)}` : ''
    return { src: `mdres://image?path=${encodeURIComponent(abs)}${version}`, mtime, absPath: abs }
  })
}
