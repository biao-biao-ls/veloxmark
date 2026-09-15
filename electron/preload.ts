import { contextBridge, ipcRenderer } from 'electron'

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

const api = {
  platform: process.platform,
  openFile: (): Promise<OpenFileResult | null> => ipcRenderer.invoke('dialog:openFile'),
  openFolder: (): Promise<{ folderPath: string } | null> =>
    ipcRenderer.invoke('dialog:openFolder'),
  listDirectory: (dirPath: string): Promise<DirNode[]> =>
    ipcRenderer.invoke('folder:list', dirPath),
  watchFolder: (dirPath: string): Promise<boolean> =>
    ipcRenderer.invoke('folder:watch', dirPath),
  unwatchFolder: (): Promise<boolean> => ipcRenderer.invoke('folder:unwatch'),
  createFile: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('file:create', filePath),
  deletePath: (targetPath: string): Promise<boolean> =>
    ipcRenderer.invoke('file:delete', targetPath),
  renamePath: (oldPath: string, newPath: string): Promise<boolean> =>
    ipcRenderer.invoke('file:rename', oldPath, newPath),
  onFolderTree: (callback: (tree: DirNode[]) => void): (() => void) => {
    const listener = (_e: unknown, tree: DirNode[]): void => callback(tree)
    ipcRenderer.on('folder:tree', listener)
    return () => ipcRenderer.removeListener('folder:tree', listener)
  },
  showSaveDialog: (
    defaultPath?: string,
    filters?: { name: string; extensions: string[] }[]
  ): Promise<string | null> => ipcRenderer.invoke('dialog:saveFile', defaultPath, filters),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, content: string, opts?: { force?: boolean }): Promise<WriteResult> =>
    ipcRenderer.invoke('file:write', filePath, content, opts),
  setAppState: (state: { filePath: string | null; dirty: boolean }): Promise<void> =>
    ipcRenderer.invoke('app:setState', state),
  resolveImageSrc: (dir: string, src: string): Promise<string> =>
    ipcRenderer.invoke('file:resolveImageSrc', dir, src),
  windowMinimize: (): void => ipcRenderer.send('window:minimize'),
  windowMaximizeRestore: (): void => ipcRenderer.send('window:maximize-restore'),
  windowClose: (): void => ipcRenderer.send('window:close'),
  windowToggleDevTools: (): void => ipcRenderer.send('window:toggleDevTools'),
  windowZoom: (action: 'in' | 'out' | 'reset'): void =>
    ipcRenderer.send('window:zoom', action),
  clipboardRead: (): Promise<string> => ipcRenderer.invoke('clipboard:read'),
  clipboardWrite: (text: string): Promise<void> =>
    ipcRenderer.invoke('clipboard:write', text),
  // Tell main the editor is mounted so queued system open-file paths are sent.
  rendererReady: (): void => ipcRenderer.send('app:rendererReady'),
  // macOS Finder "Open With" / double-clicking a registered .md file.
  onOpenPath: (callback: (filePath: string) => void): (() => void) => {
    const listener = (_e: unknown, filePath: string): void => callback(filePath)
    ipcRenderer.on('app:openPath', listener)
    return () => ipcRenderer.removeListener('app:openPath', listener)
  },
  // macOS Finder "Open" on a folder (or open-file event with a directory).
  onOpenFolder: (callback: (folderPath: string) => void): (() => void) => {
    const listener = (_e: unknown, folderPath: string): void => callback(folderPath)
    ipcRenderer.on('app:openFolder', listener)
    return () => ipcRenderer.removeListener('app:openFolder', listener)
  },
  onFullScreen: (callback: (fullScreen: boolean) => void): (() => void) => {
    const listener = (_e: unknown, fullScreen: boolean): void => callback(fullScreen)
    ipcRenderer.on('app:fullScreen', listener)
    return () => ipcRenderer.removeListener('app:fullScreen', listener)
  },
  onMenu: (channel: string, callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  // Main asks the renderer to save the buffer, then report success/failure
  // so the close flow can continue (or abort on a cancelled Save As).
  onRequestSaveThenClose: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('app:requestSaveThenClose', listener)
    return () => ipcRenderer.removeListener('app:requestSaveThenClose', listener)
  },
  saveThenCloseResult: (ok: boolean): void =>
    ipcRenderer.send('app:saveThenCloseResult', ok)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
