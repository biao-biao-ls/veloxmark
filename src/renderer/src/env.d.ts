/// <reference types="vite/client" />

interface OpenFileResult {
  filePath: string
  content: string
}

interface DirNode {
  name: string
  path: string
  isDir: boolean
  children?: DirNode[]
}

interface WriteResult {
  ok: boolean
  /** The file changed on disk since it was opened; pass force to overwrite. */
  conflict?: boolean
  error?: string
}

interface RendererApi {
  platform: string
  openFile(): Promise<OpenFileResult | null>
  openFolder(): Promise<{ folderPath: string } | null>
  listDirectory(dirPath: string): Promise<DirNode[]>
  watchFolder(dirPath: string): Promise<boolean>
  unwatchFolder(): Promise<boolean>
  createFile(filePath: string): Promise<boolean>
  deletePath(targetPath: string): Promise<boolean>
  renamePath(oldPath: string, newPath: string): Promise<boolean>
  onFolderTree(callback: (tree: DirNode[]) => void): () => void
  showSaveDialog(
    defaultPath?: string,
    filters?: { name: string; extensions: string[] }[]
  ): Promise<string | null>
  readFile(filePath: string): Promise<string>
  writeFile(filePath: string, content: string, opts?: { force?: boolean }): Promise<WriteResult>
  setAppState(state: { filePath: string | null; dirty: boolean }): Promise<void>
  resolveImageSrc(dir: string, src: string): Promise<string>
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
  onMenu(channel: string, callback: () => void): () => void
  onRequestSaveThenClose(callback: () => void): () => void
  saveThenCloseResult(ok: boolean): void
}

interface Window {
  api: RendererApi
}
