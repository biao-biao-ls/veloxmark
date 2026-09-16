/**
 * Single source of truth for the preload bridge and IPC payload types.
 * Consumed by electron/preload.ts, electron/ipc/* and the renderer's
 * env.d.ts — do not redeclare these shapes anywhere else.
 */

export interface DirNode {
  name: string
  path: string
  isDir: boolean
  children?: DirNode[]
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

/** Options for printToPDF-based export (P04). */
export interface PdfExportOptions {
  pageSize: 'A4' | 'Letter'
  margins: 'normal' | 'narrow'
  /** Header (title) + footer (page numbers) via Chromium print templates. */
  headerFooter: boolean
  /** Document title shown in the header when headerFooter is on. */
  title: string
}

/** Shape of the object preload exposes as `window.api`. */
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
  pathExists(filePath: string): Promise<boolean>
  onFolderTree(callback: (tree: DirNode[]) => void): () => void
  showSaveDialog(defaultPath?: string, filters?: FileFilter[]): Promise<string | null>
  readFile(filePath: string): Promise<string>
  writeFile(filePath: string, content: string): Promise<boolean>
  setAppState(state: AppWindowState): Promise<void>
  /** Push the recent-files list so the macOS native menu can rebuild (P03). */
  setRecentFiles(files: RecentFileItem[]): Promise<void>
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
  clipboardRead(): Promise<string>
  clipboardWrite(text: string): Promise<void>
  /** P05: true when the clipboard holds a bitmap (screenshot / copied image). */
  clipboardHasImage(): Promise<boolean>
  rendererReady(): void
  onOpenPath(callback: (filePath: string) => void): () => void
  onOpenFolder(callback: (folderPath: string) => void): () => void
  onFullScreen(callback: (fullScreen: boolean) => void): () => void
  /** Menu dispatch; payload args are channel-specific (e.g. openRecent path). */
  onMenu(channel: string, callback: (...args: string[]) => void): () => void
}
