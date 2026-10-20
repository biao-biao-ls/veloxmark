
export interface DirNode {
  name: string
  path: string
  isDir: boolean
  children?: DirNode[]
  mtimeMs?: number
  birthtimeMs?: number
}

export interface OpenFileResult {
  filePath: string
  content: string
}

export interface AppWindowState {
  filePath: string | null
  dirty: boolean
  name: string
}

export interface FileFilter {
  name: string
  extensions: string[]
}

export interface RecentFileItem {
  path: string
  exists: boolean
}

export interface ImageSaveOptions {
  assetsDirName: string
  renameMode: 'timestamp' | 'keep'
  copyExternal: boolean
}

export interface SaveClipboardImageResult {
  absPath: string
  relPath: string
}

export interface ResolvedImageSrc {
  src: string
  mtime: number | null
  absPath: string | null
}

export interface FolderScanOptions {
  ignoreNames: string[]
  showHiddenFiles: boolean
}

export interface PdfExportOptions {
  pageSize: 'A4' | 'Letter'
  margins: 'normal' | 'narrow'
  headerFooter: boolean
  title: string
}

export interface DraftRecord {
  path: string | null
  content: string
  mtime: number
  slot?: string
}

export interface DraftListItem extends DraftRecord {
  key: string
}

export interface SearchOptions {
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
  maxPerFile?: number
  exts?: string[]
  scanOptions?: FolderScanOptions
}

export interface SearchMatch {
  line: number
  col: number
  length: number
  lineText: string
  snippetCol: number
}

export interface SearchFileResult {
  path: string
  relPath: string
  matches: SearchMatch[]
  matchCount: number
}

export interface SearchRunPayload {
  searchId: number
  files: SearchFileResult[]
  done: boolean
  totalMatches?: number
  error?: string
}

export interface SearchReplaceRequest {
  rootPath: string
  pattern: string
  options: SearchOptions
  replace: string
  scope: 'one' | 'file' | 'all'
  path?: string
  line?: number
  col?: number
  skipPaths?: string[]
}

export interface SearchReplaceResult {
  replaced: number
  skipped: string[]
  written: string[]
  error?: string
}

export interface LinkResolveResult {
  kind: 'file' | 'dir' | 'anchor' | 'external' | 'broken'
  absPath?: string
  exists?: boolean
  anchor?: string
}

export type UpdaterPhase =
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

/** auto: full electron-updater flow (nsis/AppImage/mac); manual: notify only and open the releases page */
export type UpdaterMode = 'auto' | 'manual'

export interface UpdaterStatus {
  phase: UpdaterPhase
  mode: UpdaterMode
  version?: string
  error?: string
}


export const IpcChannels = {
  dialogOpenFile: 'dialog:openFile',
  dialogOpenFolder: 'dialog:openFolder',
  dialogSaveFile: 'dialog:saveFile',
  fileCreate: 'file:create',
  fileMkdir: 'file:mkdir',
  fileDelete: 'file:delete',
  fileRename: 'file:rename',
  filePathExists: 'file:pathExists',
  fileIsWritable: 'file:isWritable',
  fileRead: 'file:read',
  fileWrite: 'file:write',
  fileWriteBase64: 'file:writeBase64',
  fileResolveImageSrc: 'file:resolveImageSrc',
  pathMove: 'path:move',
  linkResolve: 'link:resolve',
  folderList: 'folder:list',
  folderWatch: 'folder:watch',
  folderUnwatch: 'folder:unwatch',
  folderSetOptions: 'folder:setOptions',
  folderTree: 'folder:tree',
  shellShowItemInFolder: 'shell:showItemInFolder',
  shellOpenExternal: 'shell:openExternal',
  exportHtml: 'export:html',
  exportPdf: 'export:pdf',
  exportReadImageAsDataUrl: 'export:readImageAsDataUrl',
  imageSaveClipboard: 'image:saveClipboard',
  imageImportLocalFile: 'image:importLocalFile',
  imageDownloadRemote: 'image:downloadRemote',
  imageChanged: 'image:changed',
  draftWrite: 'draft:write',
  draftDiscard: 'draft:discard',
  draftList: 'draft:list',
  searchRun: 'search:run',
  searchReplace: 'search:replace',
  searchResults: 'search:results',
  clipboardRead: 'clipboard:read',
  clipboardWrite: 'clipboard:write',
  clipboardReadHtml: 'clipboard:readHtml',
  clipboardWriteHtml: 'clipboard:writeHtml',
  clipboardHasImage: 'clipboard:hasImage',
  clipboardWriteImage: 'clipboard:writeImage',
  windowMinimize: 'window:minimize',
  windowMaximizeRestore: 'window:maximize-restore',
  windowClose: 'window:close',
  windowToggleDevTools: 'window:toggleDevTools',
  windowZoom: 'window:zoom',
  windowGetZoomPercent: 'window:getZoomPercent',
  windowSetZoomPercent: 'window:setZoomPercent',
  appSetState: 'app:setState',
  appSetRecentFiles: 'app:setRecentFiles',
  appSetMenuCheckedIds: 'app:setMenuCheckedIds',
  appSetLanguage: 'app:setLanguage',
  appCloseResponse: 'app:closeResponse',
  appRendererReady: 'app:rendererReady',
  appQueryClose: 'app:queryClose',
  appOpenPath: 'app:openPath',
  appOpenFolder: 'app:openFolder',
  appFullScreen: 'app:fullScreen',
  appZoomPercent: 'app:zoomPercent',
  appGetVersion: 'app:getVersion',
  updaterCheck: 'updater:check',
  updaterDownload: 'updater:download',
  updaterInstall: 'updater:install',
  updaterStatus: 'updater:status'
} as const

export function menuChannel(id: string): string {
  return `menu:${id}`
}

export interface RendererApi {
  platform: string
  openFile(): Promise<OpenFileResult | null>
  openFolder(): Promise<{ folderPath: string } | null>
  listDirectory(dirPath: string): Promise<DirNode[]>
  watchFolder(dirPath: string, options?: FolderScanOptions): Promise<boolean>
  unwatchFolder(): Promise<boolean>
  setFolderOptions(options: FolderScanOptions): Promise<void>
  createFile(filePath: string): Promise<boolean>
  mkdirPath(dirPath: string): Promise<boolean>
  deletePath(targetPath: string): Promise<boolean>
  renamePath(oldPath: string, newPath: string): Promise<boolean>
  movePath(srcPath: string, destDir: string): Promise<string>
  pathExists(filePath: string): Promise<boolean>
  isWritable(filePath: string): Promise<boolean>
  onFolderTree(callback: (tree: DirNode[]) => void): () => void
  resolveLink(baseDir: string, href: string): Promise<LinkResolveResult>
  openExternal(url: string): Promise<boolean>
  showSaveDialog(defaultPath?: string, filters?: FileFilter[]): Promise<string | null>
  readFile(filePath: string): Promise<string>
  writeFile(filePath: string, content: string): Promise<boolean>
  writeFileBase64(filePath: string, base64: string): Promise<boolean>
  setAppState(state: AppWindowState): Promise<void>
  setRecentFiles(files: RecentFileItem[]): Promise<void>
  setUiLanguage(lang: 'zh' | 'en'): Promise<void>
  setMenuCheckedIds(ids: string[]): Promise<void>
  resolveImageSrc(dir: string, src: string): Promise<ResolvedImageSrc>
  saveClipboardImage(
    baseDir: string,
    options: ImageSaveOptions
  ): Promise<SaveClipboardImageResult | null>
  importLocalImage(baseDir: string, filePath: string, options: ImageSaveOptions): Promise<string>
  downloadRemoteImage(baseDir: string, url: string, options: ImageSaveOptions): Promise<string>
  onImageChanged(callback: (filePath: string) => void): () => void
  showItemInFolder(filePath: string): void
  getPathForFile(file: File): string
  exportHtml(targetPath: string, html: string): Promise<boolean>
  exportPdf(targetPath: string, html: string, options: PdfExportOptions): Promise<boolean>
  readImageAsDataUrl(dir: string, src: string): Promise<string>
  windowMinimize(): void
  windowMaximizeRestore(): void
  windowClose(): void
  windowToggleDevTools(): void
  windowZoom(action: 'in' | 'out' | 'reset'): void
  windowGetZoomPercent(): Promise<number>
  windowSetZoomPercent(percent: number): void
  closeResponse(allow: boolean): void
  onQueryClose(callback: () => void): () => void
  draftWrite(path: string | null, content: string, slot?: string): Promise<void>
  draftDiscard(path: string | null, slot?: string): Promise<void>
  draftList(): Promise<DraftListItem[]>
  searchRun(
    rootPath: string,
    pattern: string,
    options: SearchOptions
  ): Promise<{ searchId: number; error?: string }>
  onSearchResults(callback: (payload: SearchRunPayload) => void): () => void
  searchReplace(req: SearchReplaceRequest): Promise<SearchReplaceResult>
  clipboardRead(): Promise<string>
  clipboardWrite(text: string): Promise<void>
  clipboardReadHtml(): Promise<string>
  clipboardWriteHtml(html: string, text: string): Promise<void>
  clipboardHasImage(): Promise<boolean>
  clipboardWriteImage(dataUrl: string): Promise<void>
  rendererReady(): void
  onOpenPath(callback: (filePath: string) => void): () => void
  onOpenFolder(callback: (folderPath: string) => void): () => void
  onFullScreen(callback: (fullScreen: boolean) => void): () => void
  onZoomPercent(callback: (percent: number) => void): () => void
  onMenu(id: string, callback: (...args: string[]) => void): () => void
  getAppVersion(): Promise<string>
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  installUpdate(): void
  onUpdaterStatus(callback: (status: UpdaterStatus) => void): () => void
}
