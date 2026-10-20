import { dialog, ipcMain } from 'electron'
import { constants } from 'node:fs'
import { access, cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, normalize } from 'node:path'
import { IpcChannels, type FileFilter, type LinkResolveResult } from '../shared/api'
import type { GetWindow } from './getWindow'

const FILE_FILTERS: FileFilter[] = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'txt'] },
  { name: 'All Files', extensions: ['*'] }
]

export function registerFilesIpc(getWindow: GetWindow): void {
  ipcMain.handle(IpcChannels.dialogOpenFile, async () => {
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
    IpcChannels.dialogSaveFile,
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

  ipcMain.handle(IpcChannels.dialogOpenFolder, async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return { folderPath: result.filePaths[0] }
  })

  ipcMain.handle(IpcChannels.fileRead, async (_e, filePath: string) => {
    return readFile(filePath, 'utf-8')
  })

  ipcMain.handle(IpcChannels.fileWrite, async (_e, filePath: string, content: string) => {
    await writeFile(filePath, content, 'utf-8')
    return true
  })

  ipcMain.handle(IpcChannels.fileWriteBase64, async (_e, filePath: string, base64: string) => {
    await writeFile(filePath, Buffer.from(base64, 'base64'))
    return true
  })


  ipcMain.handle(IpcChannels.fileCreate, async (_e, filePath: string) => {
    await stat(filePath).then(
      () => {
        throw new Error(`"${basename(filePath)}" already exists`)
      },
      () => undefined
    )
    await writeFile(filePath, '', { encoding: 'utf-8', flag: 'wx' })
    return true
  })

  ipcMain.handle(IpcChannels.fileMkdir, async (_e, dirPath: string) => {
    await stat(dirPath).then(
      () => {
        throw new Error(`"${basename(dirPath)}" already exists`)
      },
      () => undefined
    )
    await mkdir(dirPath)
    return true
  })

  ipcMain.handle(IpcChannels.fileDelete, async (_e, targetPath: string) => {
    await rm(targetPath, { recursive: true, force: false })
    return true
  })

  ipcMain.handle(IpcChannels.fileRename, async (_e, oldPath: string, newPath: string) => {
    if (oldPath === newPath) return true
    await stat(newPath).then(
      () => {
        throw new Error(`"${basename(newPath)}" already exists`)
      },
      () => undefined
    )
    await rename(oldPath, newPath)
    return true
  })

  ipcMain.handle(IpcChannels.pathMove, async (_e, srcPath: string, destDir: string): Promise<string> => {
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
      () => undefined
    )
    try {
      await rename(srcPath, newPath)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
        await cp(srcPath, newPath, { recursive: true })
        await rm(srcPath, { recursive: true, force: false })
      } else {
        throw err
      }
    }
    return newPath
  })

  ipcMain.handle(IpcChannels.filePathExists, async (_e, filePath: string) => {
    try {
      await stat(filePath)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle(IpcChannels.fileIsWritable, async (_e, filePath: string) => {
    try {
      await access(filePath, constants.W_OK)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle(IpcChannels.linkResolve, async (_e, baseDir: string, href: string): Promise<LinkResolveResult> => {
    try {
      let target = String(href ?? '').trim().replace(/^<|>$/g, '')
      if (!target) return { kind: 'broken' }
      if (/^https?:\/\//i.test(target)) return { kind: 'external', absPath: target }
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target)) return { kind: 'external', absPath: target }
      try {
        target = decodeURIComponent(target)
      } catch {
      }
      let anchor: string | undefined
      const hash = target.indexOf('#')
      if (hash >= 0) {
        anchor = target.slice(hash + 1)
        target = target.slice(0, hash)
      }
      if (!target) return { kind: 'anchor', anchor: anchor ?? '' }
      if (!baseDir && !isAbsolute(target)) return { kind: 'broken', exists: false, anchor }
      const abs = normalize(isAbsolute(target) ? target : join(baseDir, target))
      try {
        const st = await stat(abs)
        if (st.isDirectory()) return { kind: 'dir', absPath: abs, exists: true, anchor }
        return { kind: 'file', absPath: abs, exists: true, anchor }
      } catch {
        return { kind: 'broken', absPath: abs, exists: false, anchor }
      }
    } catch {
      return { kind: 'broken' }
    }
  })

  ipcMain.handle(IpcChannels.fileResolveImageSrc, async (_e, dir: string, src: string) => {
    if (/^(https?:|data:|mdres:)/i.test(src)) return { src, mtime: null, absPath: null }
    const abs = normalize(isAbsolute(src) ? src : join(dir || '.', src))
    let mtime: number | null = null
    try {
      mtime = (await stat(abs)).mtimeMs
    } catch {
    }
    const version = mtime != null ? `&v=${Math.floor(mtime)}` : ''
    return { src: `mdres://image?path=${encodeURIComponent(abs)}${version}`, mtime, absPath: abs }
  })
}
