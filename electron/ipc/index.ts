import { registerAppIpc, type AppIpcDeps } from './app'
import { registerClipboardIpc } from './clipboard'
import { registerDraftsIpc } from './drafts'
import { registerExportIpc } from './export'
import { registerFilesIpc } from './files'
import { registerFolderIpc } from './folder'
import type { GetWindow } from './getWindow'
import { registerImageIpc } from './image'
import { registerSearchIpc } from './search'
import { registerShellIpc } from './shell'
import { registerWindowIpc } from './window'

// Re-export for compatibility — the type's home is the leaf module getWindow.ts.
export type { GetWindow } from './getWindow'
export type { AppIpcDeps } from './app'

/** Register every ipcMain handler, grouped by domain. Channel names are stable
 *  (values from shared/api.ts IpcChannels). `appDeps` wires the app: domain to
 *  main's lifecycle/menu sync without ipc/* importing menu/*. */
export function registerAllIpc(getWindow: GetWindow, appDeps: AppIpcDeps): void {
  registerWindowIpc(getWindow)
  registerFilesIpc(getWindow)
  registerFolderIpc(getWindow)
  registerExportIpc()
  registerImageIpc()
  registerDraftsIpc()
  registerSearchIpc()
  registerClipboardIpc()
  registerShellIpc()
  registerAppIpc(getWindow, appDeps)
}
