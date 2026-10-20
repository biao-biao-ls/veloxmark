import { ipcMain, type BrowserWindow } from 'electron'
import { IpcChannels } from '../shared/api'
import {
  clampZoomLevel,
  clampZoomPercent,
  percentToZoomLevel,
  zoomLevelToPercent
} from '../shared/zoom'
import type { GetWindow } from './getWindow'
import { saveWindowStateNow } from './window-state'

function applyZoom(win: BrowserWindow, level: number): void {
  const clamped = clampZoomLevel(level)
  win.webContents.setZoomLevel(clamped)
  saveWindowStateNow(win)
  win.webContents.send(IpcChannels.appZoomPercent, Math.round(zoomLevelToPercent(clamped)))
}

export function zoomBy(getWindow: GetWindow, delta: number | 'reset'): void {
  const win = getWindow()
  if (!win || win.isDestroyed()) return
  applyZoom(win, delta === 'reset' ? 0 : win.webContents.getZoomLevel() + delta)
}

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
  ipcMain.handle(IpcChannels.windowGetZoomPercent, () => {
    const win = getWindow()
    if (!win || win.isDestroyed()) return 100
    return Math.round(zoomLevelToPercent(clampZoomLevel(win.webContents.getZoomLevel())))
  })
  ipcMain.on(IpcChannels.windowSetZoomPercent, (_e, percent: number) => {
    if (!Number.isFinite(percent)) return
    const win = getWindow()
    if (!win || win.isDestroyed()) return
    applyZoom(win, percentToZoomLevel(clampZoomPercent(Math.round(percent))))
  })
}
