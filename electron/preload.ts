import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppWindowState,
  DirNode,
  FileFilter,
  OpenFileResult,
  PdfExportOptions,
  RecentFileItem,
  RendererApi
} from './shared/api'

const api: RendererApi = {
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
  pathExists: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('file:pathExists', filePath),
  onFolderTree: (callback: (tree: DirNode[]) => void): (() => void) => {
    const listener = (_e: unknown, tree: DirNode[]): void => callback(tree)
    ipcRenderer.on('folder:tree', listener)
    return () => ipcRenderer.removeListener('folder:tree', listener)
  },
  showSaveDialog: (defaultPath?: string, filters?: FileFilter[]): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveFile', defaultPath, filters),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('file:write', filePath, content),
  setAppState: (state: AppWindowState): Promise<void> =>
    ipcRenderer.invoke('app:setState', state),
  setRecentFiles: (files: RecentFileItem[]): Promise<void> =>
    ipcRenderer.invoke('app:setRecentFiles', files),
  resolveImageSrc: (dir: string, src: string): Promise<string> =>
    ipcRenderer.invoke('file:resolveImageSrc', dir, src),
  exportHtml: (targetPath: string, html: string): Promise<boolean> =>
    ipcRenderer.invoke('export:html', targetPath, html),
  exportPdf: (targetPath: string, html: string, options: PdfExportOptions): Promise<boolean> =>
    ipcRenderer.invoke('export:pdf', targetPath, html, options),
  readImageAsDataUrl: (dir: string, src: string): Promise<string> =>
    ipcRenderer.invoke('export:readImageAsDataUrl', dir, src),
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
  onMenu: (channel: string, callback: (...args: string[]) => void): (() => void) => {
    const listener = (_e: unknown, ...args: string[]): void => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = RendererApi
