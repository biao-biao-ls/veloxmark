import { clipboard, ipcMain, net } from 'electron'
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, relative, sep } from 'node:path'
import { IpcChannels, type ImageSaveOptions, type SaveClipboardImageResult } from '../shared/api'
import type { GetWindow } from './getWindow'


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

function timestampName(ext: string): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `img-${stamp}${ext}`
}

async function ensureAssetsDir(baseDir: string, assetsDirName: string): Promise<string> {
  const dir = join(baseDir, assetsDirName)
  await mkdir(dir, { recursive: true })
  return dir
}

async function uniquePath(dir: string, name: string): Promise<string> {
  const ext = extname(name)
  const stem = basename(name, ext)
  let candidate = join(dir, name)
  for (let i = 1; ; i++) {
    try {
      await stat(candidate)
    } catch {
      return candidate
    }
    candidate = join(dir, `${stem}-${i}${ext}`)
  }
}

function toMarkdownRel(fromDir: string, target: string): string {
  return relative(fromDir, target).split(sep).join('/')
}

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
    IpcChannels.imageSaveClipboard,
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
    IpcChannels.imageImportLocalFile,
    async (_e, baseDir: string, filePath: string, options: ImageSaveOptions): Promise<string> => {
      if (isInside(baseDir, filePath)) return toMarkdownRel(baseDir, filePath)
      if (!options.copyExternal) return filePath
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
    IpcChannels.imageDownloadRemote,
    async (_e, baseDir: string, url: string, options: ImageSaveOptions): Promise<string> => {
      try {
        const res = await net.fetch(url)
        if (!res.ok) return url
        const buf = Buffer.from(await res.arrayBuffer())
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
        return url
      }
    }
  )
}


const pendingImageChanges = new Set<string>()
let imageFlushTimer: NodeJS.Timeout | null = null

export function queueImageChange(getWindow: GetWindow, absPath: string): void {
  pendingImageChanges.add(absPath)
  if (imageFlushTimer) return
  imageFlushTimer = setTimeout(() => {
    imageFlushTimer = null
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      for (const p of pendingImageChanges) win.webContents.send(IpcChannels.imageChanged, p)
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
