import { clipboard, ipcMain, nativeImage } from 'electron'
import { IpcChannels } from '../shared/api'

/** Clipboard domain IPC — os-clipboard reads/writes (P19/P20/P16 payloads). */
export function registerClipboardIpc(): void {
  ipcMain.handle(IpcChannels.clipboardRead, () => clipboard.readText())
  ipcMain.handle(IpcChannels.clipboardWrite, (_e, text: string) => clipboard.writeText(text))
  // P19: menu Edit>Paste needs the HTML flavor (browsers put both on the clipboard).
  ipcMain.handle(IpcChannels.clipboardReadHtml, () => clipboard.readHTML())
  // P19 e2e + P20 rich copy: place an HTML flavor alongside plain text.
  ipcMain.handle(IpcChannels.clipboardWriteHtml, (_e, html: string, text: string) => {
    clipboard.write({ text: String(text ?? ''), html: String(html ?? '') })
  })
  // P05: cheap bitmap probe so the menu Paste path can skip the image flow
  // (and any Save As prompt) when the clipboard only holds text.
  ipcMain.handle(IpcChannels.clipboardHasImage, () => !clipboard.readImage().isEmpty())
  // P16: Mermaid "Copy Image" — data-URL bitmap onto the OS clipboard.
  ipcMain.handle(IpcChannels.clipboardWriteImage, (_e, dataUrl: string) => {
    const img = nativeImage.createFromDataURL(dataUrl)
    if (!img.isEmpty()) clipboard.write({ image: img })
  })
}
