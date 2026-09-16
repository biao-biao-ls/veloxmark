import { dialog, ipcMain } from 'electron'
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
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

  // ---- tree file operations -------------------------------------------------

  ipcMain.handle('file:create', async (_e, filePath: string) => {
    // 'wx' fails if the path exists — never clobber an existing file.
    await writeFile(filePath, '', { encoding: 'utf-8', flag: 'wx' })
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

  // Existence probe for the recent-files menu (P03) — missing paths render greyed.
  ipcMain.handle('file:pathExists', async (_e, filePath: string) => {
    try {
      await stat(filePath)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('file:resolveImageSrc', (_e, dir: string, src: string) => {
    if (/^(https?:|data:|mdres:)/i.test(src)) return src
    const abs = normalize(isAbsolute(src) ? src : join(dir || '.', src))
    return `mdres://image?path=${encodeURIComponent(abs)}`
  })
}
