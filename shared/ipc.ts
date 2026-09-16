/**
 * Single source of truth for the main <-> renderer IPC contract.
 *
 * Imported by electron/main.ts (handlers), electron/preload.ts (bridge
 * implementation) and renderer modules (via the exposed `window.api`).
 * This file must stay free of electron/node imports — it is inlined into
 * all three bundles.
 */

// ---- payload types ---------------------------------------------------------

export interface OpenFileResult {
  filePath: string
  content: string
}

export interface DirNode {
  name: string
  path: string
  isDir: boolean
  children?: DirNode[]
}

export interface WriteResult {
  ok: boolean
  /** The file changed on disk since it was opened; pass force to overwrite. */
  conflict?: boolean
  error?: string
}

export interface AppState {
  filePath: string | null
  dirty: boolean
}

export type ZoomAction = 'in' | 'out' | 'reset'

// ---- channel names ---------------------------------------------------------
// Grouped by direction. invoke = renderer awaits a handler; send = one-way.

export const IPC = {
  // renderer -> main (invoke)
  dialogOpenFile: 'dialog:openFile',
  dialogOpenFolder: 'dialog:openFolder',
  dialogSaveFile: 'dialog:saveFile',
  fileRead: 'file:read',
  fileWrite: 'file:write',
  fileCreate: 'file:create',
  fileDelete: 'file:delete',
  fileRename: 'file:rename',
  fileResolveImageSrc: 'file:resolveImageSrc',
  folderList: 'folder:list',
  folderWatch: 'folder:watch',
  folderUnwatch: 'folder:unwatch',
  clipboardRead: 'clipboard:read',
  clipboardWrite: 'clipboard:write',
  appSetState: 'app:setState',
  // renderer -> main (send)
  windowMinimize: 'window:minimize',
  windowMaximizeRestore: 'window:maximize-restore',
  windowClose: 'window:close',
  windowToggleDevTools: 'window:toggleDevTools',
  windowZoom: 'window:zoom',
  appRendererReady: 'app:rendererReady',
  appSaveThenCloseResult: 'app:saveThenCloseResult',
  // main -> renderer (send)
  appOpenPath: 'app:openPath',
  appOpenFolder: 'app:openFolder',
  appFullScreen: 'app:fullScreen',
  appRequestSaveThenClose: 'app:requestSaveThenClose',
  folderTree: 'folder:tree'
} as const

/**
 * Menu action channels. The macOS native menu (main) forwards clicks on these;
 * the renderer subscribes via `api.onMenu`. Value + type share the name on
 * purpose (`MenuChannel.newFile` is the constant, `MenuChannel` the union).
 */
export const MenuChannel = {
  newFile: 'menu:newFile',
  openFile: 'menu:openFile',
  openFolder: 'menu:openFolder',
  saveFile: 'menu:saveFile',
  saveFileAs: 'menu:saveFileAs',
  toggleOutline: 'menu:toggleOutline',
  toggleTheme: 'menu:toggleTheme',
  find: 'menu:find',
  showHelp: 'menu:showHelp'
} as const

export type MenuChannel = (typeof MenuChannel)[keyof typeof MenuChannel]

// ---- renderer-facing API ---------------------------------------------------
// Implemented once by electron/preload.ts; exposed as window.api.

export interface RendererApi {
  platform: string
  openFile(): Promise<OpenFileResult | null>
  openFolder(): Promise<{ folderPath: string } | null>
  listDirectory(dirPath: string): Promise<DirNode[]>
  watchFolder(dirPath: string): Promise<boolean>
  unwatchFolder(): Promise<boolean>
  createFile(filePath: string): Promise<boolean>
  deletePath(targetPath: string): Promise<boolean>
  renamePath(oldPath: string, newPath: string): Promise<boolean>
  onFolderTree(callback: (tree: DirNode[]) => void): () => void
  showSaveDialog(
    defaultPath?: string,
    filters?: { name: string; extensions: string[] }[]
  ): Promise<string | null>
  readFile(filePath: string): Promise<string>
  writeFile(filePath: string, content: string, opts?: { force?: boolean }): Promise<WriteResult>
  setAppState(state: AppState): Promise<void>
  resolveImageSrc(dir: string, src: string): Promise<string>
  windowMinimize(): void
  windowMaximizeRestore(): void
  windowClose(): void
  windowToggleDevTools(): void
  windowZoom(action: ZoomAction): void
  clipboardRead(): Promise<string>
  clipboardWrite(text: string): Promise<void>
  /** Tell main the editor is mounted so queued system open-file paths are sent. */
  rendererReady(): void
  /** macOS Finder "Open With" / double-clicking a registered .md file. */
  onOpenPath(callback: (filePath: string) => void): () => void
  /** macOS Finder "Open" on a folder (or open-file event with a directory). */
  onOpenFolder(callback: (folderPath: string) => void): () => void
  onFullScreen(callback: (fullScreen: boolean) => void): () => void
  onMenu(channel: MenuChannel, callback: () => void): () => void
  /** Main intercepted a dirty window close; save then report via saveThenCloseResult. */
  onRequestSaveThenClose(callback: () => void): () => void
  saveThenCloseResult(ok: boolean): void
}
