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
  SearchRunPayload
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
  setUiLanguage: (lang: 'zh' | 'en'): Promise<void> =>
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
  // P12 close intercept: verdict back to main's close handler.
  closeResponse: (allow: boolean): void => ipcRenderer.send(IpcChannels.appCloseResponse, allow),
  onQueryClose: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(IpcChannels.appQueryClose, listener)
    return () => ipcRenderer.removeListener(IpcChannels.appQueryClose, listener)
  },
  // P12 crash-recovery drafts (main-process storage under userData/drafts).
  draftWrite: (path: string | null, content: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.draftWrite, path, content),
  draftDiscard: (path: string | null): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.draftDiscard, path),
  draftList: (): Promise<DraftListItem[]> => ipcRenderer.invoke(IpcChannels.draftList),
  // P13 folder-wide search/replace (streaming results on search:results).
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
  /** P19: HTML flavor of the clipboard (empty string when absent). */
  clipboardReadHtml: (): Promise<string> => ipcRenderer.invoke(IpcChannels.clipboardReadHtml),
  /** P19/P20: write plain text + HTML flavors in one clipboard write. */
  clipboardWriteHtml: (html: string, text: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.clipboardWriteHtml, html, text),
  clipboardHasImage: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.clipboardHasImage),
  clipboardWriteImage: (dataUrl: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.clipboardWriteImage, dataUrl),
  // Tell main the editor is mounted so queued system open-file paths are sent.
  rendererReady: (): void => ipcRenderer.send(IpcChannels.appRendererReady),
  // macOS Finder "Open With" / double-clicking a registered .md file.
  onOpenPath: (callback: (filePath: string) => void): (() => void) => {
    const listener = (_e: unknown, filePath: string): void => callback(filePath)
    ipcRenderer.on(IpcChannels.appOpenPath, listener)
    return () => ipcRenderer.removeListener(IpcChannels.appOpenPath, listener)
  },
  // macOS Finder "Open" on a folder (or open-file event with a directory).
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
  onMenu: (id: string, callback: (...args: string[]) => void): (() => void) => {
    const channel = menuChannel(id)
    const listener = (_e: unknown, ...args: string[]): void => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = RendererApi
