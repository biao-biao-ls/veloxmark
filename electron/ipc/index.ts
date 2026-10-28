import { registerAppIpc, type AppIpcDeps } from './app'
import { registerClipboardIpc } from './clipboard'
import { registerDraftsIpc } from './drafts'
import { registerExportIpc } from './export'
import { registerFilesIpc } from './files'
import { registerFileWatchIpc } from './fileWatch'
import { registerFolderIpc } from './folder'
import type { GetWindow } from './getWindow'
import { registerImageIpc } from './image'
import { registerSearchIpc } from './search'
import { registerShellIpc } from './shell'
import { registerWindowIpc } from './window'
import { registerUpdaterIpc } from '../updater'

export type { GetWindow } from './getWindow'
export type { AppIpcDeps } from './app'

export function registerAllIpc(getWindow: GetWindow, appDeps: AppIpcDeps): void {
  registerWindowIpc(getWindow)
  registerFilesIpc(getWindow)
  registerFileWatchIpc(getWindow)
  registerFolderIpc(getWindow)
  registerExportIpc()
  registerImageIpc()
  registerDraftsIpc()
  registerSearchIpc()
  registerClipboardIpc()
  registerShellIpc()
  registerAppIpc(getWindow, appDeps)
  registerUpdaterIpc(getWindow)
}
