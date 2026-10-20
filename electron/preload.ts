import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AppWindowState,
  DirNode,
  DraftListItem,
  FileFilter,
  FolderScanOptions,
  ImageSaveOptions,
  LinkResolveResult,
  OpenFileResult,
  PdfExportOptions,
  RecentFileItem,
  RendererApi,
  ResolvedImageSrc,
  SaveClipboardImageResult,
  SearchOptions,
  SearchReplaceRequest,
  SearchReplaceResult,
  SearchRunPayload,
  UiLang,
  UpdaterStatus
} from './shared/api'
import { IpcChannels, menuChannel } from './shared/api'

const api: RendererApi = {
  platform: process.platform,
  openFile: (): Promise<OpenFileResult | null> => ipcRenderer.invoke(IpcChannels.dialogOpenFile),
  openFolder: (): Promise<{ folderPath: string } | null> =>
    ipcRenderer.invoke(IpcChannels.dialogOpenFolder),
  listDirectory: (dirPath: string): Promise<DirNode[]> =>
    ipcRenderer.invoke(IpcChannels.folderList, dirPath),
  watchFolder: (dirPath: string, options?: FolderScanOptions): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.folderWatch, dirPath, options),
  unwatchFolder: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.folderUnwatch),
  setFolderOptions: (options: FolderScanOptions): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.folderSetOptions, options),
  createFile: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.fileCreate, filePath),
  mkdirPath: (dirPath: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.fileMkdir, dirPath),
  deletePath: (targetPath: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.fileDelete, targetPath),
  renamePath: (oldPath: string, newPath: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.fileRename, oldPath, newPath),
  movePath: (srcPath: string, destDir: string): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.pathMove, srcPath, destDir),
  pathExists: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.filePathExists, filePath),
  isWritable: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.fileIsWritable, filePath),
  resolveLink: (baseDir: string, href: string): Promise<LinkResolveResult> =>
    ipcRenderer.invoke(IpcChannels.linkResolve, baseDir, href),
  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.shellOpenExternal, url),
  onFolderTree: (callback: (tree: DirNode[]) => void): (() => void) => {
    const listener = (_e: unknown, tree: DirNode[]): void => callback(tree)
    ipcRenderer.on(IpcChannels.folderTree, listener)
    return () => ipcRenderer.removeListener(IpcChannels.folderTree, listener)
  },
  showSaveDialog: (defaultPath?: string, filters?: FileFilter[]): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.dialogSaveFile, defaultPath, filters),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke(IpcChannels.fileRead, filePath),
  writeFile: (filePath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.fileWrite, filePath, content),
  writeFileBase64: (filePath: string, base64: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.fileWriteBase64, filePath, base64),
  setAppState: (state: AppWindowState): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.appSetState, state),
  setRecentFiles: (files: RecentFileItem[]): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.appSetRecentFiles, files),
  setUiLanguage: (lang: UiLang): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.appSetLanguage, lang),
  setMenuCheckedIds: (ids: string[]): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.appSetMenuCheckedIds, ids),
  resolveImageSrc: (dir: string, src: string): Promise<ResolvedImageSrc> =>
    ipcRenderer.invoke(IpcChannels.fileResolveImageSrc, dir, src),
  saveClipboardImage: (
    baseDir: string,
    options: ImageSaveOptions
  ): Promise<SaveClipboardImageResult | null> =>
    ipcRenderer.invoke(IpcChannels.imageSaveClipboard, baseDir, options),
  importLocalImage: (baseDir: string, filePath: string, options: ImageSaveOptions): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.imageImportLocalFile, baseDir, filePath, options),
  downloadRemoteImage: (baseDir: string, url: string, options: ImageSaveOptions): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.imageDownloadRemote, baseDir, url, options),
  onImageChanged: (callback: (filePath: string) => void): (() => void) => {
    const listener = (_e: unknown, filePath: string): void => callback(filePath)
    ipcRenderer.on(IpcChannels.imageChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.imageChanged, listener)
  },
  showItemInFolder: (filePath: string): void => {
    void ipcRenderer.invoke(IpcChannels.shellShowItemInFolder, filePath)
  },
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  exportHtml: (targetPath: string, html: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.exportHtml, targetPath, html),
  exportPdf: (targetPath: string, html: string, options: PdfExportOptions): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.exportPdf, targetPath, html, options),
  readImageAsDataUrl: (dir: string, src: string): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.exportReadImageAsDataUrl, dir, src),
  windowMinimize: (): void => ipcRenderer.send(IpcChannels.windowMinimize),
  windowMaximizeRestore: (): void => ipcRenderer.send(IpcChannels.windowMaximizeRestore),
  windowClose: (): void => ipcRenderer.send(IpcChannels.windowClose),
  windowToggleDevTools: (): void => ipcRenderer.send(IpcChannels.windowToggleDevTools),
  windowZoom: (action: 'in' | 'out' | 'reset'): void =>
    ipcRenderer.send(IpcChannels.windowZoom, action),
  windowGetZoomPercent: (): Promise<number> =>
    ipcRenderer.invoke(IpcChannels.windowGetZoomPercent),
  windowSetZoomPercent: (percent: number): void =>
    ipcRenderer.send(IpcChannels.windowSetZoomPercent, percent),
  closeResponse: (allow: boolean): void => ipcRenderer.send(IpcChannels.appCloseResponse, allow),
  onQueryClose: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(IpcChannels.appQueryClose, listener)
    return () => ipcRenderer.removeListener(IpcChannels.appQueryClose, listener)
  },
  draftWrite: (path: string | null, content: string, slot?: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.draftWrite, path, content, slot),
  draftDiscard: (path: string | null, slot?: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.draftDiscard, path, slot),
  draftList: (): Promise<DraftListItem[]> => ipcRenderer.invoke(IpcChannels.draftList),
  searchRun: (
    rootPath: string,
    pattern: string,
    options: SearchOptions
  ): Promise<{ searchId: number; error?: string }> =>
    ipcRenderer.invoke(IpcChannels.searchRun, rootPath, pattern, options),
  onSearchResults: (callback: (payload: SearchRunPayload) => void): (() => void) => {
    const listener = (_e: unknown, payload: SearchRunPayload): void => callback(payload)
    ipcRenderer.on(IpcChannels.searchResults, listener)
    return () => ipcRenderer.removeListener(IpcChannels.searchResults, listener)
  },
  searchReplace: (req: SearchReplaceRequest): Promise<SearchReplaceResult> =>
    ipcRenderer.invoke(IpcChannels.searchReplace, req),
  clipboardRead: (): Promise<string> => ipcRenderer.invoke(IpcChannels.clipboardRead),
  clipboardWrite: (text: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.clipboardWrite, text),
  clipboardReadHtml: (): Promise<string> => ipcRenderer.invoke(IpcChannels.clipboardReadHtml),
  clipboardWriteHtml: (html: string, text: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.clipboardWriteHtml, html, text),
  clipboardHasImage: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.clipboardHasImage),
  clipboardWriteImage: (dataUrl: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.clipboardWriteImage, dataUrl),
  rendererReady: (): void => ipcRenderer.send(IpcChannels.appRendererReady),
  onOpenPath: (callback: (filePath: string) => void): (() => void) => {
    const listener = (_e: unknown, filePath: string): void => callback(filePath)
    ipcRenderer.on(IpcChannels.appOpenPath, listener)
    return () => ipcRenderer.removeListener(IpcChannels.appOpenPath, listener)
  },
  onOpenFolder: (callback: (folderPath: string) => void): (() => void) => {
    const listener = (_e: unknown, folderPath: string): void => callback(folderPath)
    ipcRenderer.on(IpcChannels.appOpenFolder, listener)
    return () => ipcRenderer.removeListener(IpcChannels.appOpenFolder, listener)
  },
  onFullScreen: (callback: (fullScreen: boolean) => void): (() => void) => {
    const listener = (_e: unknown, fullScreen: boolean): void => callback(fullScreen)
    ipcRenderer.on(IpcChannels.appFullScreen, listener)
    return () => ipcRenderer.removeListener(IpcChannels.appFullScreen, listener)
  },
  onZoomPercent: (callback: (percent: number) => void): (() => void) => {
    const listener = (_e: unknown, percent: number): void => callback(percent)
    ipcRenderer.on(IpcChannels.appZoomPercent, listener)
    return () => ipcRenderer.removeListener(IpcChannels.appZoomPercent, listener)
  },
  onMenu: (id: string, callback: (...args: string[]) => void): (() => void) => {
    const channel = menuChannel(id)
    const listener = (_e: unknown, ...args: string[]): void => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  getAppVersion: (): Promise<string> => ipcRenderer.invoke(IpcChannels.appGetVersion),
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke(IpcChannels.updaterCheck),
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke(IpcChannels.updaterDownload),
  installUpdate: (): void => {
    void ipcRenderer.invoke(IpcChannels.updaterInstall)
  },
  onUpdaterStatus: (callback: (status: UpdaterStatus) => void): (() => void) => {
    const listener = (_e: unknown, status: UpdaterStatus): void => callback(status)
    ipcRenderer.on(IpcChannels.updaterStatus, listener)
    return () => ipcRenderer.removeListener(IpcChannels.updaterStatus, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = RendererApi
