import { ipcMain } from 'electron'
import { IpcChannels } from '../shared/api'
import type { GetWindow } from './getWindow'

/** Zoom helper — also used by the macOS native menu (menu/darwin.ts). */
export function zoomBy(getWindow: GetWindow, delta: number | 'reset'): void {
  const contents = getWindow()?.webContents
  if (!contents) return
  contents.setZoomLevel(delta === 'reset' ? 0 : contents.getZoomLevel() + delta)
}

/** Window domain IPC — window chrome controls. */
export function registerWindowIpc(getWindow: GetWindow): void {
  ipcMain.on(IpcChannels.windowMinimize, () => getWindow()?.minimize())
  ipcMain.on(IpcChannels.windowMaximizeRestore, () => {
    const win = getWindow()
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.on(IpcChannels.windowClose, () => getWindow()?.close())
  ipcMain.on(IpcChannels.windowToggleDevTools, () => getWindow()?.webContents.toggleDevTools())
  ipcMain.on(IpcChannels.windowZoom, (_e, action: 'in' | 'out' | 'reset') => {
    if (action === 'reset') zoomBy(getWindow, 'reset')
    else zoomBy(getWindow, action === 'in' ? 0.5 : -0.5)
  })
}
