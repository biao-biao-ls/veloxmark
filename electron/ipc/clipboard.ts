import { clipboard, ipcMain, nativeImage } from 'electron'
import { IpcChannels } from '../shared/api'

export function registerClipboardIpc(): void {
  ipcMain.handle(IpcChannels.clipboardRead, () => clipboard.readText())
  ipcMain.handle(IpcChannels.clipboardWrite, (_e, text: string) => clipboard.writeText(text))
  ipcMain.handle(IpcChannels.clipboardReadHtml, () => clipboard.readHTML())
  ipcMain.handle(IpcChannels.clipboardWriteHtml, (_e, html: string, text: string) => {
    clipboard.write({ text: String(text ?? ''), html: String(html ?? '') })
  })
  ipcMain.handle(IpcChannels.clipboardHasImage, () => !clipboard.readImage().isEmpty())
  ipcMain.handle(IpcChannels.clipboardWriteImage, (_e, dataUrl: string) => {
    const img = nativeImage.createFromDataURL(dataUrl)
    if (!img.isEmpty()) clipboard.write({ image: img })
  })
}
