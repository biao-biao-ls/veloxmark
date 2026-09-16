import { clipboard, ipcMain, net, shell } from 'electron'
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, relative, sep } from 'node:path'
import type { ImageSaveOptions, SaveClipboardImageResult } from '../shared/api'
import type { GetWindow } from './index'

/**
 * Image domain IPC (P05).
 *
 * - `image:saveClipboard` — clipboard bitmap → PNG under <baseDir>/<assets>/.
 * - `image:importLocalFile` — local file → relative path (inside the document
 *   directory) or a copy under assets (outside it).
 * - `image:downloadRemote` — remote URL → file under assets; falls back to the
 *   URL so a network failure never blocks the paste.
 * - `shell:showItemInFolder` — reveal an image in the OS file manager.
 *
 * The renderer owns the policy decisions (rename mode, whether outside files
 * are copied at all); this module only executes them and keeps the on-disk
 * layout consistent.
 */

export const IMAGE_FILE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i

const MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/avif': '.avif',
  'image/x-icon': '.ico'
}

/** `img-20260917-142530.png` — sortable and collision-safe via uniquePath. */
function timestampName(ext: string): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `img-${stamp}${ext}`
}

/** Join <baseDir>/<assetsDirName>, creating the directory on demand. */
async function ensureAssetsDir(baseDir: string, assetsDirName: string): Promise<string> {
  const dir = join(baseDir, assetsDirName)
  await mkdir(dir, { recursive: true })
  return dir
}

/** Pick a non-colliding path inside dir (`name.png`, `name-1.png`, …). */
async function uniquePath(dir: string, name: string): Promise<string> {
  const ext = extname(name)
  const stem = basename(name, ext)
  let candidate = join(dir, name)
  for (let i = 1; ; i++) {
    try {
      await stat(candidate)
    } catch {
      return candidate // free
    }
    candidate = join(dir, `${stem}-${i}${ext}`)
  }
}

/** Relative path with `/` separators — the markdown convention on all platforms. */
function toMarkdownRel(fromDir: string, target: string): string {
  return relative(fromDir, target).split(sep).join('/')
}

/** True when target lives inside baseDir (and is not baseDir itself). */
function isInside(baseDir: string, target: string): boolean {
  if (!baseDir) return false
  const rel = relative(baseDir, target)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

function extFromContentType(contentType: string | null): string {
  if (!contentType) return ''
  return MIME_EXT[contentType.split(';')[0].trim()] ?? ''
}

export function registerImageIpc(): void {
  ipcMain.handle(
    'image:saveClipboard',
    async (_e, baseDir: string, options: ImageSaveOptions): Promise<SaveClipboardImageResult | null> => {
      const image = clipboard.readImage()
      if (image.isEmpty()) return null
      const assetsDir = await ensureAssetsDir(baseDir, options.assetsDirName)
      const target = await uniquePath(assetsDir, timestampName('.png'))
      await writeFile(target, image.toPNG())
      return { absPath: target, relPath: toMarkdownRel(baseDir, target) }
    }
  )

  ipcMain.handle(
    'image:importLocalFile',
    async (_e, baseDir: string, filePath: string, options: ImageSaveOptions): Promise<string> => {
      if (isInside(baseDir, filePath)) return toMarkdownRel(baseDir, filePath)
      if (!options.copyExternal) return filePath // reference in place
      const ext = extname(filePath)
      const name =
        options.renameMode === 'timestamp'
          ? timestampName(IMAGE_FILE_EXT.test(ext) ? ext : '.png')
          : basename(filePath)
      const assetsDir = await ensureAssetsDir(baseDir, options.assetsDirName)
      const target = await uniquePath(assetsDir, name)
      await copyFile(filePath, target)
      return toMarkdownRel(baseDir, target)
    }
  )

  ipcMain.handle(
    'image:downloadRemote',
    async (_e, baseDir: string, url: string, options: ImageSaveOptions): Promise<string> => {
      try {
        const res = await net.fetch(url)
        if (!res.ok) return url
        const buf = Buffer.from(await res.arrayBuffer())
        // Prefer the URL's own extension; fall back to Content-Type; last
        // resort .png (most pasted bitmaps are PNG).
        const urlExt = extname(new URL(url).pathname)
        const ext = IMAGE_FILE_EXT.test(urlExt)
          ? urlExt
          : extFromContentType(res.headers.get('content-type')) || '.png'
        const assetsDir = await ensureAssetsDir(baseDir, options.assetsDirName)
        const stem = basename(new URL(url).pathname) || 'image'
        const name =
          options.renameMode === 'timestamp' ? timestampName(ext) : `${stem.replace(/\.[^.]*$/, '')}${ext}`
        const target = await uniquePath(assetsDir, name)
        await writeFile(target, buf)
        return toMarkdownRel(baseDir, target)
      } catch {
        return url // offline / CORS — keep the remote reference
      }
    }
  )

  ipcMain.handle('shell:showItemInFolder', (_e, filePath: string) => {
    shell.showItemInFolder(filePath)
  })
}

// ---- image change broadcast --------------------------------------------------
// The folder watcher (P07 infra, electron/ipc/folder.ts) sees every fs event;
// image files are invisible to the markdown-tree rescan, so they get their own
// debounced broadcast the renderer uses to invalidate ImageWidget.cache.

const pendingImageChanges = new Set<string>()
let imageFlushTimer: NodeJS.Timeout | null = null

export function queueImageChange(getWindow: GetWindow, absPath: string): void {
  pendingImageChanges.add(absPath)
  if (imageFlushTimer) return
  imageFlushTimer = setTimeout(() => {
    imageFlushTimer = null
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      for (const p of pendingImageChanges) win.webContents.send('image:changed', p)
    }
    pendingImageChanges.clear()
  }, 200)
}

export function stopImageChangeBroadcast(): void {
  if (imageFlushTimer) {
    clearTimeout(imageFlushTimer)
    imageFlushTimer = null
  }
  pendingImageChanges.clear()
}
