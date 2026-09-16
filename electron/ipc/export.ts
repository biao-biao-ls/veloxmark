import { BrowserWindow, app, ipcMain } from 'electron'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { extname, isAbsolute, join, normalize } from 'node:path'
import type { PdfExportOptions } from '../shared/api'

/**
 * Export domain IPC (P04).
 *
 * - `export:html` — write the renderer-assembled self-contained HTML to disk.
 * - `export:pdf` — load that same HTML into a hidden window and printToPDF.
 * - `export:readImageAsDataUrl` — inline a relative-path image for the
 *   renderer's export pipeline (renderer cannot read local files directly,
 *   and fetching mdres:// from the renderer would need CORS headers).
 */

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon'
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function registerExportIpc(): void {
  ipcMain.handle('export:html', async (_e, targetPath: string, html: string) => {
    await writeFile(targetPath, html, 'utf-8')
    return true
  })

  ipcMain.handle(
    'export:pdf',
    async (_e, targetPath: string, html: string, options: PdfExportOptions) => {
      // Hidden window: printToPDF acts on a webContents, and a data: URL would
      // hit Chromium's URL size limits on large documents — use a temp file.
      const win = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: true, contextIsolation: true }
      })
      const tmpPath = join(app.getPath('temp'), `veloxmark-export-${Date.now()}.html`)
      try {
        await writeFile(tmpPath, html, 'utf-8')
        await win.loadFile(tmpPath)
        // Wait for fonts + images so KaTeX and embedded pictures are laid out.
        await win.webContents.executeJavaScript(
          `(async () => {
            await document.fonts.ready
            const imgs = [...document.images]
            await Promise.all(imgs.map((img) =>
              img.complete ? null : new Promise((r) => { img.onload = img.onerror = r })
            ))
            return true
          })()`
        )
        const pdf = await win.webContents.printToPDF({
          pageSize: options.pageSize,
          printBackground: true,
          displayHeaderFooter: options.headerFooter,
          headerTemplate: options.headerFooter
            ? `<div style="font-size:8px;width:100%;text-align:center;color:#888;">${escapeHtml(options.title)}</div>`
            : '',
          footerTemplate: options.headerFooter
            ? '<div style="font-size:8px;width:100%;text-align:center;color:#888;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
            : '',
          margins:
            options.margins === 'narrow'
              ? // inches; ~6 mm — noticeably tighter than Chromium's 1 cm default
                { marginType: 'custom', top: 0.25, bottom: 0.25, left: 0.25, right: 0.25 }
              : { marginType: 'default' }
        })
        await writeFile(targetPath, pdf)
        return true
      } finally {
        win.destroy()
        await rm(tmpPath, { force: true })
      }
    }
  )

  ipcMain.handle('export:readImageAsDataUrl', async (_e, dir: string, src: string) => {
    const abs = normalize(isAbsolute(src) ? src : join(dir || '.', src))
    const mime = MIME_BY_EXT[extname(abs).toLowerCase()] ?? 'application/octet-stream'
    const buf = await readFile(abs)
    return `data:${mime};base64,${buf.toString('base64')}`
  })
}
