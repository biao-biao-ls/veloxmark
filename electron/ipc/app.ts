import { ipcMain } from 'electron'
import { basename } from 'node:path'
import { IpcChannels, type AppWindowState, type RecentFileItem } from '../shared/api'
import type { GetWindow } from './getWindow'

/**
 * App domain IPC — lifecycle signals and native-menu state sync (2.19/2.21).
 *
 * Pure channel wiring: behaviors live behind AppIpcDeps so this module never
 * depends on menu/* or main's window lifecycle (deps are injected from main).
 */
export interface AppIpcDeps {
  /** Renderer pings once the editor is mounted — flush queued system opens. */
  onRendererReady(): void
  /** P12: close query approved — re-run close with the intercept flag set. */
  approveClose(): void
  /** P03: recent-files list changed — sync the native Open Recent submenu. */
  setRecentFiles(files: RecentFileItem[]): void
  /** UX-P01-F8/P08: ON-set of preference-backed toggles (checkbox state). */
  setMenuCheckedIds(ids: string[]): void
  /** P14: UI language changed — persist + rebuild the native menu. */
  setUiLanguage(lang: 'zh' | 'en'): void
}

export function registerAppIpc(getWindow: GetWindow, deps: AppIpcDeps): void {
  ipcMain.on(IpcChannels.appRendererReady, () => deps.onRendererReady())

  // P03: renderer pushes the recent-files list (with existence flags) so the
  // native Open Recent submenu can rebuild; clearMenu flows back the other way.
  ipcMain.handle(IpcChannels.appSetRecentFiles, (_e, files: RecentFileItem[]) => {
    deps.setRecentFiles(files)
  })

  // UX-P01-F8/P08: renderer pushes the ON-set of preference-backed toggles so
  // the native View menu can render checkbox state.
  ipcMain.handle(IpcChannels.appSetMenuCheckedIds, (_e, ids: string[]) => {
    deps.setMenuCheckedIds(ids)
  })

  // P14: renderer resolved the language pref — persist + rebuild native menu.
  ipcMain.handle(IpcChannels.appSetLanguage, (_e, lang: string) => {
    deps.setUiLanguage(lang === 'zh' ? 'zh' : 'en')
    return true
  })

  // P12: renderer verdict for the close query — allow re-runs close with the
  // intercept flag set; deny is a no-op (the renderer already showed Cancel).
  ipcMain.on(IpcChannels.appCloseResponse, (_e, allow: boolean) => {
    if (!allow) return
    deps.approveClose()
  })

  // Renderer -> main state sync so the OS window title tracks the document.
  ipcMain.handle(IpcChannels.appSetState, (_e, state: AppWindowState) => {
    const win = getWindow()
    if (win) {
      const name = state.filePath ? basename(state.filePath) : 'Untitled'
      win.setTitle(`${state.dirty ? '• ' : ''}${name} - VeloxMark`)
    }
  })
}
