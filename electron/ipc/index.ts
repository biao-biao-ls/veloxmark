import type { BrowserWindow } from 'electron'
import { registerExportIpc } from './export'
import { registerFilesIpc } from './files'
import { registerFolderIpc } from './folder'
import { registerImageIpc } from './image'
import { registerWindowIpc } from './window'

/** Lazy access to the main window — it is created/destroyed across the app lifetime. */
export type GetWindow = () => BrowserWindow | null

/** Register every ipcMain handler, grouped by domain. Channel names are stable. */
export function registerAllIpc(getWindow: GetWindow): void {
  registerWindowIpc(getWindow)
  registerFilesIpc(getWindow)
  registerFolderIpc(getWindow)
  registerExportIpc()
  registerImageIpc()
}
