import type { BrowserWindow } from 'electron'

/** Lazy access to the main window — it is created/destroyed across the app lifetime.
 *  Leaf module so ipc/* and menu/* can share the type without import cycles. */
export type GetWindow = () => BrowserWindow | null
