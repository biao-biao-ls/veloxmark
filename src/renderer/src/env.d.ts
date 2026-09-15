/// <reference types="vite/client" />

interface OpenFileResult {
  filePath: string
  content: string
}

interface RendererApi {
  platform: string
  openFile(): Promise<OpenFileResult | null>
  showSaveDialog(
    defaultPath?: string,
    filters?: { name: string; extensions: string[] }[]
  ): Promise<string | null>
  readFile(filePath: string): Promise<string>
  writeFile(filePath: string, content: string): Promise<boolean>
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
  onFullScreen(callback: (fullScreen: boolean) => void): () => void
  onMenu(channel: string, callback: () => void): () => void
}

interface Window {
  api: RendererApi
}
