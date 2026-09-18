import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AppWindowState,
  DirNode,
  DraftListItem,
  FileFilter,
  FolderScanOptions,
  ImageSaveOptions,
  OpenFileResult,
  PdfExportOptions,
  RecentFileItem,
  RendererApi,
  ResolvedImageSrc,
  SaveClipboardImageResult,
  SearchOptions,
  SearchReplaceRequest,
  SearchReplaceResult,
  SearchRunPayload
} from './shared/api'

const api: RendererApi = {
  platform: process.platform,
  openFile: (): Promise<OpenFileResult | null> => ipcRenderer.invoke('dialog:openFile'),
  openFolder: (): Promise<{ folderPath: string } | null> =>
    ipcRenderer.invoke('dialog:openFolder'),
  listDirectory: (dirPath: string): Promise<DirNode[]> =>
    ipcRenderer.invoke('folder:list', dirPath),
  watchFolder: (dirPath: string, options?: FolderScanOptions): Promise<boolean> =>
    ipcRenderer.invoke('folder:watch', dirPath, options),
  unwatchFolder: (): Promise<boolean> => ipcRenderer.invoke('folder:unwatch'),
  setFolderOptions: (options: FolderScanOptions): Promise<void> =>
    ipcRenderer.invoke('folder:setOptions', options),
  createFile: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('file:create', filePath),
  mkdirPath: (dirPath: string): Promise<boolean> =>
    ipcRenderer.invoke('file:mkdir', dirPath),
  deletePath: (targetPath: string): Promise<boolean> =>
    ipcRenderer.invoke('file:delete', targetPath),
  renamePath: (oldPath: string, newPath: string): Promise<boolean> =>
    ipcRenderer.invoke('file:rename', oldPath, newPath),
  movePath: (srcPath: string, destDir: string): Promise<string> =>
    ipcRenderer.invoke('path:move', srcPath, destDir),
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
  resolveImageSrc: (dir: string, src: string): Promise<ResolvedImageSrc> =>
    ipcRenderer.invoke('file:resolveImageSrc', dir, src),
  saveClipboardImage: (
    baseDir: string,
    options: ImageSaveOptions
  ): Promise<SaveClipboardImageResult | null> =>
    ipcRenderer.invoke('image:saveClipboard', baseDir, options),
  importLocalImage: (baseDir: string, filePath: string, options: ImageSaveOptions): Promise<string> =>
    ipcRenderer.invoke('image:importLocalFile', baseDir, filePath, options),
  downloadRemoteImage: (baseDir: string, url: string, options: ImageSaveOptions): Promise<string> =>
    ipcRenderer.invoke('image:downloadRemote', baseDir, url, options),
  onImageChanged: (callback: (filePath: string) => void): (() => void) => {
    const listener = (_e: unknown, filePath: string): void => callback(filePath)
    ipcRenderer.on('image:changed', listener)
    return () => ipcRenderer.removeListener('image:changed', listener)
  },
  showItemInFolder: (filePath: string): void => {
    void ipcRenderer.invoke('shell:showItemInFolder', filePath)
  },
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
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
  // P12 close intercept: verdict back to main's close handler.
  closeResponse: (allow: boolean): void => ipcRenderer.send('app:closeResponse', allow),
  onQueryClose: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('app:queryClose', listener)
    return () => ipcRenderer.removeListener('app:queryClose', listener)
  },
  // P12 crash-recovery drafts (main-process storage under userData/drafts).
  draftWrite: (path: string | null, content: string): Promise<void> =>
    ipcRenderer.invoke('draft:write', path, content),
  draftDiscard: (path: string | null): Promise<void> =>
    ipcRenderer.invoke('draft:discard', path),
  draftList: (): Promise<DraftListItem[]> => ipcRenderer.invoke('draft:list'),
  // P13 folder-wide search/replace (streaming results on search:results).
  searchRun: (
    rootPath: string,
    pattern: string,
    options: SearchOptions
  ): Promise<{ searchId: number; error?: string }> =>
    ipcRenderer.invoke('search:run', rootPath, pattern, options),
  onSearchResults: (callback: (payload: SearchRunPayload) => void): (() => void) => {
    const listener = (_e: unknown, payload: SearchRunPayload): void => callback(payload)
    ipcRenderer.on('search:results', listener)
    return () => ipcRenderer.removeListener('search:results', listener)
  },
  searchReplace: (req: SearchReplaceRequest): Promise<SearchReplaceResult> =>
    ipcRenderer.invoke('search:replace', req),
  clipboardRead: (): Promise<string> => ipcRenderer.invoke('clipboard:read'),
  clipboardWrite: (text: string): Promise<void> =>
    ipcRenderer.invoke('clipboard:write', text),
  clipboardHasImage: (): Promise<boolean> => ipcRenderer.invoke('clipboard:hasImage'),
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
