import { ipcMain, shell } from 'electron'
import { IpcChannels } from '../shared/api'

/** Shell domain IPC — OS integration (reveal in file manager, external links). */
export function registerShellIpc(): void {
  // P17: external links — http/https only (mailto: & friends stay in-app tips).
  ipcMain.handle(IpcChannels.shellOpenExternal, (_e, url: string) => {
    if (!/^https?:\/\//i.test(String(url ?? ''))) return false
    void shell.openExternal(url)
    return true
  })

  ipcMain.handle(IpcChannels.shellShowItemInFolder, (_e, filePath: string) => {
    shell.showItemInFolder(filePath)
  })
}
