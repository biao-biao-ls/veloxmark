import { ipcMain } from 'electron'
import { basename } from 'node:path'
import { IpcChannels, type AppWindowState, type RecentFileItem } from '../shared/api'
import { isUiLang, type UiLang } from '../shared/lang'
import type { GetWindow } from './getWindow'

export interface AppIpcDeps {
  onRendererReady(): void
  approveClose(): void
  setRecentFiles(files: RecentFileItem[]): void
  setMenuCheckedIds(ids: string[]): void
  setUiLanguage(lang: UiLang): void
}

export function registerAppIpc(getWindow: GetWindow, deps: AppIpcDeps): void {
  ipcMain.on(IpcChannels.appRendererReady, () => deps.onRendererReady())

  ipcMain.handle(IpcChannels.appSetRecentFiles, (_e, files: RecentFileItem[]) => {
    deps.setRecentFiles(files)
  })

  ipcMain.handle(IpcChannels.appSetMenuCheckedIds, (_e, ids: string[]) => {
    deps.setMenuCheckedIds(ids)
  })

  ipcMain.handle(IpcChannels.appSetLanguage, (_e, lang: string) => {
    deps.setUiLanguage(isUiLang(lang) ? lang : 'en')
    return true
  })

  ipcMain.on(IpcChannels.appCloseResponse, (_e, allow: boolean) => {
    if (!allow) return
    deps.approveClose()
  })

  ipcMain.handle(IpcChannels.appSetState, (_e, state: AppWindowState) => {
    const win = getWindow()
    if (win) {
      const name = state.filePath ? basename(state.filePath) : (state.name || 'Untitled')
      win.setTitle(`${state.dirty ? '• ' : ''}${name} - VeloxMark`)
    }
  })
}
