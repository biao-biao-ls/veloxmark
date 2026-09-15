import { contextBridge, ipcRenderer } from 'electron'

export interface OpenFileResult {
  filePath: string
  content: string
}

const api = {
  platform: process.platform,
  openFile: (): Promise<OpenFileResult | null> => ipcRenderer.invoke('dialog:openFile'),
  showSaveDialog: (
    defaultPath?: string,
    filters?: { name: string; extensions: string[] }[]
  ): Promise<string | null> => ipcRenderer.invoke('dialog:saveFile', defaultPath, filters),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('file:write', filePath, content),
  setAppState: (state: { filePath: string | null; dirty: boolean }): Promise<void> =>
    ipcRenderer.invoke('app:setState', state),
  resolveImageSrc: (dir: string, src: string): Promise<string> =>
    ipcRenderer.invoke('file:resolveImageSrc', dir, src),
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
  onFullScreen: (callback: (fullScreen: boolean) => void): (() => void) => {
    const listener = (_e: unknown, fullScreen: boolean): void => callback(fullScreen)
    ipcRenderer.on('app:fullScreen', listener)
    return () => ipcRenderer.removeListener('app:fullScreen', listener)
  },
  onMenu: (channel: string, callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
