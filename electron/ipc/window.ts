import { clipboard, ipcMain, type BrowserWindow } from 'electron'
import { basename } from 'node:path'
import type { AppWindowState } from '../shared/api'
import type { GetWindow } from './index'

export function zoomBy(getWindow: GetWindow, delta: number | 'reset'): void {
  const contents = getWindow()?.webContents
  if (!contents) return
  contents.setZoomLevel(delta === 'reset' ? 0 : contents.getZoomLevel() + delta)
}

export function registerWindowIpc(getWindow: GetWindow): void {
  ipcMain.on('window:minimize', () => getWindow()?.minimize())
  ipcMain.on('window:maximize-restore', () => {
    const win = getWindow()
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.on('window:close', () => getWindow()?.close())
  ipcMain.on('window:toggleDevTools', () => getWindow()?.webContents.toggleDevTools())
  ipcMain.on('window:zoom', (_e, action: 'in' | 'out' | 'reset') => {
    if (action === 'reset') zoomBy(getWindow, 'reset')
    else zoomBy(getWindow, action === 'in' ? 0.5 : -0.5)
  })

  ipcMain.handle('clipboard:read', () => clipboard.readText())
  ipcMain.handle('clipboard:write', (_e, text: string) => clipboard.writeText(text))
  // P05: cheap bitmap probe so the menu Paste path can skip the image flow
  // (and any Save As prompt) when the clipboard only holds text.
  ipcMain.handle('clipboard:hasImage', () => !clipboard.readImage().isEmpty())

  // Renderer -> main state sync so the OS window title tracks the document.
  ipcMain.handle('app:setState', (_e, state: AppWindowState) => {
    const win = getWindow()
    if (win) {
      const name = state.filePath ? basename(state.filePath) : 'Untitled'
      win.setTitle(`${state.dirty ? '• ' : ''}${name} - VeloxMark`)
    }
  })
}
