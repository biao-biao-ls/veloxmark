/**
 * Single source of truth for the preload bridge, IPC payload types and IPC
 * channel names. Consumed by electron/preload.ts, electron/ipc/* and the
 * renderer's env.d.ts — do not redeclare these shapes (or channel strings)
 * anywhere else.
 */

export interface DirNode {
  name: string
  path: string
  isDir: boolean
  children?: DirNode[]
  /** 6E: last-modified (ms) for sort-by-mtime; optional (stat 失败时缺省). */
  mtimeMs?: number
  /** 6E: creation time (ms) for sort-by-birthtime; optional (同上). */
  birthtimeMs?: number
}

export interface OpenFileResult {
  filePath: string
  content: string
}

export interface AppWindowState {
  filePath: string | null
  dirty: boolean
}

export interface FileFilter {
  name: string
  extensions: string[]
}

/** Recent-files entry synced to the macOS native menu (P03). */
export interface RecentFileItem {
  path: string
  exists: boolean
}

/** Where pasted/dropped images land, from the renderer's preferences (P05). */
export interface ImageSaveOptions {
  /** Attachment subdirectory under the document directory (e.g. "assets"). */
  assetsDirName: string
  /** External files: timestamped rename into assets, or keep the original name. */
  renameMode: 'timestamp' | 'keep'
  /** Copy files outside the document directory into assets; false = keep absolute path. */
  copyExternal: boolean
}

/** Result of saving a clipboard bitmap to disk (P05). */
export interface SaveClipboardImageResult {
  absPath: string
  /** Relative to the document directory, `/`-separated for markdown. */
  relPath: string
}

/** Resolved image src plus mtime so the renderer cache can detect staleness (P05). */
export interface ResolvedImageSrc {
  src: string
  /** ms since epoch; null when the target is not a local file (or is missing). */
  mtime: number | null
  /** Absolute local path (for "show in file manager"); null for remote/data srcs. */
  absPath: string | null
}

/** Folder-tree scan options pushed from the renderer's preferences (P07). */
export interface FolderScanOptions {
  /** Entry names excluded from the tree; supports `*` / `?` wildcards. */
  ignoreNames: string[]
  /** Include `.`-prefixed files/dirs (still subject to ignoreNames). */
  showHiddenFiles: boolean
}

/** Options for printToPDF-based export (P04). */
export interface PdfExportOptions {
  pageSize: 'A4' | 'Letter'
  margins: 'normal' | 'narrow'
  /** Header (title) + footer (page numbers) via Chromium print templates. */
  headerFooter: boolean
  /** Document title shown in the header when headerFooter is on. */
  title: string
}

/** P12: crash-recovery draft stored in userData/drafts/<sha1>.json. */
export interface DraftRecord {
  /** Document path the draft belongs to; null = Untitled buffer. */
  path: string | null
  content: string
  /** ms since epoch when the draft was written. */
  mtime: number
}

/** Draft listed at startup, with its storage key (sha1 of path/untitled). */
export interface DraftListItem extends DraftRecord {
  key: string
}

/** P13: folder-wide search options (renderer preferences + toggles). */
export interface SearchOptions {
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
  /** Per-file match list cap; main hard-caps at 200. */
  maxPerFile?: number
  /** Lowercase extensions without dot; default md/markdown/mdown/txt. */
  exts?: string[]
  /** P07 folder scan rules — reuse the tree's ignore/hidden settings. */
  scanOptions?: FolderScanOptions
}

/** One line hit inside a file. */
export interface SearchMatch {
  /** 1-based line number. */
  line: number
  /** 0-based match offset within the original line (replace-one anchor). */
  col: number
  /** Matched length on the original line. */
  length: number
  /** Windowed snippet shown in the panel (may trim long lines). */
  lineText: string
  /** Match offset within `lineText` (highlight anchor). */
  snippetCol: number
}

/** Matches of one file; the list is capped, `matchCount` is the true total. */
export interface SearchFileResult {
  path: string
  /** Relative to rootPath, `/`-separated. */
  relPath: string
  matches: SearchMatch[]
  matchCount: number
}

/** Batched stream event on `search:results`; `done` marks the final batch. */
export interface SearchRunPayload {
  searchId: number
  files: SearchFileResult[]
  done: boolean
  totalMatches?: number
  error?: string
}

/** P13 replace request; scope one/file require `path` (+ line/col for one). */
export interface SearchReplaceRequest {
  rootPath: string
  pattern: string
  options: SearchOptions
  replace: string
  scope: 'one' | 'file' | 'all'
  path?: string
  line?: number
  col?: number
  /** Paths the renderer holds open+dirty — main skips writing these. */
  skipPaths?: string[]
}

export interface SearchReplaceResult {
  /** Number of matches actually replaced. */
  replaced: number
  /** Skip-listed paths (open + dirty in the editor). */
  skipped: string[]
  /** Files written to disk. */
  written: string[]
  error?: string
}

/** P17: result of classifying a markdown link href (link:resolve IPC). */
export interface LinkResolveResult {
  /** file/dir = local target that exists; anchor = in-doc #frag;
   *  external = URL or other scheme; broken = local target missing. */
  kind: 'file' | 'dir' | 'anchor' | 'external' | 'broken'
  /** Absolute local path (file/dir/broken) or the URL (external). */
  absPath?: string
  exists?: boolean
  /** Fragment without '#', present whenever the href carried one. */
  anchor?: string
}

// ---- IPC channel names (2.20) ------------------------------------------------
// The only place channel strings live — preload and ipc/* take values from
// here, so renaming a channel is a one-line change both processes pick up.
// Keys are `domainAction` camelCase derived from the `domain:action` value.
// Push channels (main → renderer) are marked; everything else is
// invoke (handle) or send (on). Menu dispatch is dynamic (`menu:<id>`) — use
// menuChannel(id) instead of a table entry.

export const IpcChannels = {
  // dialog:
  dialogOpenFile: 'dialog:openFile',
  dialogOpenFolder: 'dialog:openFolder',
  dialogSaveFile: 'dialog:saveFile',
  // file:
  fileCreate: 'file:create',
  fileMkdir: 'file:mkdir',
  fileDelete: 'file:delete',
  fileRename: 'file:rename',
  filePathExists: 'file:pathExists',
  fileRead: 'file:read',
  fileWrite: 'file:write',
  fileWriteBase64: 'file:writeBase64',
  fileResolveImageSrc: 'file:resolveImageSrc',
  // path:
  pathMove: 'path:move',
  // link:
  linkResolve: 'link:resolve',
  // folder:
  folderList: 'folder:list',
  folderWatch: 'folder:watch',
  folderUnwatch: 'folder:unwatch',
  folderSetOptions: 'folder:setOptions',
  /** push */
  folderTree: 'folder:tree',
  // shell:
  shellShowItemInFolder: 'shell:showItemInFolder',
  shellOpenExternal: 'shell:openExternal',
  // export:
  exportHtml: 'export:html',
  exportPdf: 'export:pdf',
  exportReadImageAsDataUrl: 'export:readImageAsDataUrl',
  // image:
  imageSaveClipboard: 'image:saveClipboard',
  imageImportLocalFile: 'image:importLocalFile',
  imageDownloadRemote: 'image:downloadRemote',
  /** push */
  imageChanged: 'image:changed',
  // draft:
  draftWrite: 'draft:write',
  draftDiscard: 'draft:discard',
  draftList: 'draft:list',
  // search:
  searchRun: 'search:run',
  searchReplace: 'search:replace',
  /** push */
  searchResults: 'search:results',
  // clipboard:
  clipboardRead: 'clipboard:read',
  clipboardWrite: 'clipboard:write',
  clipboardReadHtml: 'clipboard:readHtml',
  clipboardWriteHtml: 'clipboard:writeHtml',
  clipboardHasImage: 'clipboard:hasImage',
  clipboardWriteImage: 'clipboard:writeImage',
  // window:
  windowMinimize: 'window:minimize',
  windowMaximizeRestore: 'window:maximize-restore',
  windowClose: 'window:close',
  windowToggleDevTools: 'window:toggleDevTools',
  windowZoom: 'window:zoom',
  // app:
  appSetState: 'app:setState',
  appSetRecentFiles: 'app:setRecentFiles',
  appSetMenuCheckedIds: 'app:setMenuCheckedIds',
  appSetLanguage: 'app:setLanguage',
  appCloseResponse: 'app:closeResponse',
  appRendererReady: 'app:rendererReady',
  /** push */
  appQueryClose: 'app:queryClose',
  /** push */
  appOpenPath: 'app:openPath',
  /** push */
  appOpenFolder: 'app:openFolder',
  /** push */
  appFullScreen: 'app:fullScreen'
} as const

/** Menu dispatch channel for a command id or fixed menu id: `menu:<id>`. */
export function menuChannel(id: string): string {
  return `menu:${id}`
}

/** Shape of the object preload exposes as `window.api`. */
export interface RendererApi {
  platform: string
  openFile(): Promise<OpenFileResult | null>
  openFolder(): Promise<{ folderPath: string } | null>
  listDirectory(dirPath: string): Promise<DirNode[]>
  /** options, when given, replace the current scan options before watching. */
  watchFolder(dirPath: string, options?: FolderScanOptions): Promise<boolean>
  unwatchFolder(): Promise<boolean>
  /** P07: update ignore/hidden rules; re-pushes the tree when watching. */
  setFolderOptions(options: FolderScanOptions): Promise<void>
  createFile(filePath: string): Promise<boolean>
  /** P07: create a directory; fails when the path already exists. */
  mkdirPath(dirPath: string): Promise<boolean>
  deletePath(targetPath: string): Promise<boolean>
  renamePath(oldPath: string, newPath: string): Promise<boolean>
  /** P07: move a file/dir into destDir; resolves with the new full path. */
  movePath(srcPath: string, destDir: string): Promise<string>
  pathExists(filePath: string): Promise<boolean>
  onFolderTree(callback: (tree: DirNode[]) => void): () => void
  /** P17: classify a markdown link target against a document baseDir. */
  resolveLink(baseDir: string, href: string): Promise<LinkResolveResult>
  /** P17: open an external URL in the system browser (http/https only). */
  openExternal(url: string): Promise<boolean>
  showSaveDialog(defaultPath?: string, filters?: FileFilter[]): Promise<string | null>
  readFile(filePath: string): Promise<string>
  writeFile(filePath: string, content: string): Promise<boolean>
  /** P16: write raw bytes (base64 payload, no data: prefix) — PNG export. */
  writeFileBase64(filePath: string, base64: string): Promise<boolean>
  setAppState(state: AppWindowState): Promise<void>
  /** Push the recent-files list so the macOS native menu can rebuild (P03). */
  setRecentFiles(files: RecentFileItem[]): Promise<void>
  /** P14: persist UI language in userData + rebuild the macOS native menu. */
  setUiLanguage(lang: 'zh' | 'en'): Promise<void>
  /** UX-P01-F8/P08: push toggle command ids that are currently ON so the
   *  macOS native menu can render checkbox state (in-app MenuBar reads
   *  checked() live; the native menu needs an explicit sync). */
  setMenuCheckedIds(ids: string[]): Promise<void>
  resolveImageSrc(dir: string, src: string): Promise<ResolvedImageSrc>
  /** P05: save the clipboard bitmap into the document's assets dir. */
  saveClipboardImage(
    baseDir: string,
    options: ImageSaveOptions
  ): Promise<SaveClipboardImageResult | null>
  /** P05: turn a local file into a markdown image src (relative or copied). */
  importLocalImage(baseDir: string, filePath: string, options: ImageSaveOptions): Promise<string>
  /** P05: download a remote image into assets; falls back to the URL on failure. */
  downloadRemoteImage(baseDir: string, url: string, options: ImageSaveOptions): Promise<string>
  /** P05: folder watcher broadcast when an image file changed on disk. */
  onImageChanged(callback: (filePath: string) => void): () => void
  /** P05: reveal the image in the OS file manager. */
  showItemInFolder(filePath: string): void
  /** P05: absolute path of a dropped/pasted File (webUtils, Electron ≥32). */
  getPathForFile(file: File): string
  /** P04: write a renderer-assembled self-contained HTML document. */
  exportHtml(targetPath: string, html: string): Promise<boolean>
  /** P04: print the assembled HTML to PDF via a hidden window. */
  exportPdf(targetPath: string, html: string, options: PdfExportOptions): Promise<boolean>
  /** P04: read a relative-path image as a data URL for export embedding. */
  readImageAsDataUrl(dir: string, src: string): Promise<string>
  windowMinimize(): void
  windowMaximizeRestore(): void
  windowClose(): void
  windowToggleDevTools(): void
  windowZoom(action: 'in' | 'out' | 'reset'): void
  /** P12: renderer → main close-query verdict (true = allow the close). */
  closeResponse(allow: boolean): void
  /** P12: main → renderer close request (traffic light / Cmd+Q / window ×). */
  onQueryClose(callback: () => void): () => void
  /** P12: write/refresh the crash-recovery draft for a document (null = Untitled). */
  draftWrite(path: string | null, content: string): Promise<void>
  /** P12: delete the draft after a successful save or explicit discard. */
  draftDiscard(path: string | null): Promise<void>
  /** P12: all stored drafts (startup recovery scan). */
  draftList(): Promise<DraftListItem[]>
  /** P13: start a folder-wide search; results stream via onSearchResults. */
  searchRun(
    rootPath: string,
    pattern: string,
    options: SearchOptions
  ): Promise<{ searchId: number; error?: string }>
  /** P13: batched search results (filter by searchId to drop stale streams). */
  onSearchResults(callback: (payload: SearchRunPayload) => void): () => void
  /** P13: replace one match / one file / everything under rootPath. */
  searchReplace(req: SearchReplaceRequest): Promise<SearchReplaceResult>
  clipboardRead(): Promise<string>
  clipboardWrite(text: string): Promise<void>
  /** P19: HTML flavor of the clipboard (empty string when absent). */
  clipboardReadHtml(): Promise<string>
  /** P19/P20: write plain text + HTML flavors in one clipboard write. */
  clipboardWriteHtml(html: string, text: string): Promise<void>
  /** P05: true when the clipboard holds a bitmap (screenshot / copied image). */
  clipboardHasImage(): Promise<boolean>
  /** P16: place a data-URL bitmap on the OS clipboard (Mermaid Copy Image). */
  clipboardWriteImage(dataUrl: string): Promise<void>
  rendererReady(): void
  onOpenPath(callback: (filePath: string) => void): () => void
  onOpenFolder(callback: (folderPath: string) => void): () => void
  onFullScreen(callback: (fullScreen: boolean) => void): () => void
  /** Menu dispatch for a command id or fixed menu id (subscribes to `menu:<id>`
   *  via menuChannel); payload args are channel-specific (e.g. openRecent path). */
  onMenu(id: string, callback: (...args: string[]) => void): () => void
}
