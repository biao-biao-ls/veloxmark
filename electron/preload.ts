import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type DirNode,
  type MenuChannel,
  type OpenFileResult,
  type RendererApi,
  type WriteResult
} from '@shared/ipc'

// Renderer-facing bridge. The shape is fixed by the shared contract; keep
// this file free of logic beyond channel wiring and listener teardown.
const api: RendererApi = {
  platform: process.platform,
  openFile: (): Promise<OpenFileResult | null> => ipcRenderer.invoke(IPC.dialogOpenFile),
  openFolder: (): Promise<{ folderPath: string } | null> =>
    ipcRenderer.invoke(IPC.dialogOpenFolder),
  listDirectory: (dirPath: string): Promise<DirNode[]> =>
    ipcRenderer.invoke(IPC.folderList, dirPath),
  watchFolder: (dirPath: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.folderWatch, dirPath),
  unwatchFolder: (): Promise<boolean> => ipcRenderer.invoke(IPC.folderUnwatch),
  createFile: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.fileCreate, filePath),
  deletePath: (targetPath: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.fileDelete, targetPath),
  renamePath: (oldPath: string, newPath: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.fileRename, oldPath, newPath),
  onFolderTree: (callback: (tree: DirNode[]) => void): (() => void) => {
    const listener = (_e: unknown, tree: DirNode[]): void => callback(tree)
    ipcRenderer.on(IPC.folderTree, listener)
    return () => ipcRenderer.removeListener(IPC.folderTree, listener)
  },
  showSaveDialog: (
    defaultPath?: string,
    filters?: { name: string; extensions: string[] }[]
  ): Promise<string | null> => ipcRenderer.invoke(IPC.dialogSaveFile, defaultPath, filters),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke(IPC.fileRead, filePath),
  writeFile: (filePath: string, content: string, opts?: { force?: boolean }): Promise<WriteResult> =>
    ipcRenderer.invoke(IPC.fileWrite, filePath, content, opts),
  setAppState: (state: { filePath: string | null; dirty: boolean }): Promise<void> =>
    ipcRenderer.invoke(IPC.appSetState, state),
  resolveImageSrc: (dir: string, src: string): Promise<string> =>
    ipcRenderer.invoke(IPC.fileResolveImageSrc, dir, src),
  windowMinimize: (): void => ipcRenderer.send(IPC.windowMinimize),
  windowMaximizeRestore: (): void => ipcRenderer.send(IPC.windowMaximizeRestore),
  windowClose: (): void => ipcRenderer.send(IPC.windowClose),
  windowToggleDevTools: (): void => ipcRenderer.send(IPC.windowToggleDevTools),
  windowZoom: (action: 'in' | 'out' | 'reset'): void =>
    ipcRenderer.send(IPC.windowZoom, action),
  clipboardRead: (): Promise<string> => ipcRenderer.invoke(IPC.clipboardRead),
  clipboardWrite: (text: string): Promise<void> =>
    ipcRenderer.invoke(IPC.clipboardWrite, text),
  rendererReady: (): void => ipcRenderer.send(IPC.appRendererReady),
  onOpenPath: (callback: (filePath: string) => void): (() => void) => {
    const listener = (_e: unknown, filePath: string): void => callback(filePath)
    ipcRenderer.on(IPC.appOpenPath, listener)
    return () => ipcRenderer.removeListener(IPC.appOpenPath, listener)
  },
  onOpenFolder: (callback: (folderPath: string) => void): (() => void) => {
    const listener = (_e: unknown, folderPath: string): void => callback(folderPath)
    ipcRenderer.on(IPC.appOpenFolder, listener)
    return () => ipcRenderer.removeListener(IPC.appOpenFolder, listener)
  },
  onFullScreen: (callback: (fullScreen: boolean) => void): (() => void) => {
    const listener = (_e: unknown, fullScreen: boolean): void => callback(fullScreen)
    ipcRenderer.on(IPC.appFullScreen, listener)
    return () => ipcRenderer.removeListener(IPC.appFullScreen, listener)
  },
  onMenu: (channel: MenuChannel, callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  onRequestSaveThenClose: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.appRequestSaveThenClose, listener)
    return () => ipcRenderer.removeListener(IPC.appRequestSaveThenClose, listener)
  },
  saveThenCloseResult: (ok: boolean): void =>
    ipcRenderer.send(IPC.appSaveThenCloseResult, ok)
}

contextBridge.exposeInMainWorld('api', api)
