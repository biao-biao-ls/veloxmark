import { ipcMain, shell } from 'electron'
import { IpcChannels } from '../shared/api'

export function registerShellIpc(): void {
  ipcMain.handle(IpcChannels.shellOpenExternal, (_e, url: string) => {
    if (!/^https?:\/\//i.test(String(url ?? ''))) return false
    void shell.openExternal(url)
    return true
  })

  ipcMain.handle(IpcChannels.shellShowItemInFolder, (_e, filePath: string) => {
    shell.showItemInFolder(filePath)
  })
}
