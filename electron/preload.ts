import { contextBridge, ipcRenderer } from 'electron'

export interface OpenFileResult {
  filePath: string
  content: string
}

const api = {
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
  onMenu: (channel: string, callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
