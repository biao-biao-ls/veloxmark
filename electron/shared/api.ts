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
  resolveImageSrc(dir: string, src: string): Promise<string>
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
  rendererReady(): void
  onOpenPath(callback: (filePath: string) => void): () => void
  onOpenFolder(callback: (folderPath: string) => void): () => void
  onFullScreen(callback: (fullScreen: boolean) => void): () => void
  /** Menu dispatch; payload args are channel-specific (e.g. openRecent path). */
  onMenu(channel: string, callback: (...args: string[]) => void): () => void
}
