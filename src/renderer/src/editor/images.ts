import { Prec, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { getPreferences, type ImageRenameMode } from '../preferences/store'
import { getLivePreviewConfig } from './livePreview'
import { closeAllImageSelections } from './widgets'

/**
 * Paste / drop image insertion (P05).
 *
 * Three sources, one pipeline: each resolves to a markdown image src
 * (relative path inside the document directory, a copied assets path, or a
 * kept remote URL), then `insertImages` writes `![](src)` into the document.
 *
 * The handlers live outside the typing-assists compartment — pasting an image
 * is core behavior and must work with assists disabled.
 */

const REMOTE_IMAGE_URL_RE = /^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)(\?\S*)?$/i
const LOCAL_IMAGE_PATH_RE = /^(?:[A-Za-z]:[\\/]|\/|\\\\)\S+\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i
const FILE_URI_RE = /^file:\/\/\S+\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)(\?\S*)?$/i

/** True when the clipboard payload carries an image file/bitmap (sync check). */
export function clipboardHasImage(data: DataTransfer | null): boolean {
  if (!data) return false
  for (const item of data.items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return true
  }
  for (const file of data.files) {
    if (file.type.startsWith('image/')) return true
  }
  return false
}

function saveOptions(): {
  assetsDirName: string
  renameMode: ImageRenameMode
  copyExternal: boolean
} {
  const prefs = getPreferences()
  return {
    assetsDirName: prefs.attachmentDirName,
    renameMode: prefs.imageRenameMode,
    copyExternal: prefs.copyExternalImages
  }
}

function baseDirOf(view: EditorView): string {
  return getLivePreviewConfig(view.state).baseDir
}

/** `![](src)` inserted at pos (drop) or the selection (paste). */
function insertImages(view: EditorView, srcs: string[], pos?: number): void {
  if (srcs.length === 0) return
  const markdown = srcs.map((src) => `![](${src})`).join('\n')
  if (pos == null) {
    view.dispatch(view.state.replaceSelection(markdown))
    return
  }
  // Dropping mid-line: keep the surrounding text intact by breaking the line.
  const line = view.state.doc.lineAt(pos)
  const before = pos > line.from && !/\s/.test(view.state.doc.sliceString(pos - 1, pos))
  const after = pos < line.to && !/\s/.test(view.state.doc.sliceString(pos, pos + 1))
  const insert = `${before ? '\n' : ''}${markdown}${after ? '\n' : ''}`
  view.dispatch({
    changes: { from: pos, to: pos, insert },
    selection: { anchor: pos + insert.length },
    userEvent: 'input.paste'
  })
}

/**
 * Resolve a document base directory, prompting Save As when the document is
 * still untitled (assets must live next to the file). Returns null on cancel.
 */
async function requireBaseDir(
  view: EditorView,
  ensureSaved: () => Promise<boolean>
): Promise<string | null> {
  const existing = baseDirOf(view)
  if (existing) return existing
  if (!(await ensureSaved())) return null
  return baseDirOf(view) || null
}

// ---- paste -------------------------------------------------------------------

/** Clipboard bitmap → PNG under assets (main process reads the bitmap). */
export async function insertClipboardImage(
  view: EditorView,
  ensureSaved: () => Promise<boolean>,
  pos?: number
): Promise<boolean> {
  // Probe first: an untitled document must not prompt Save As for a plain
  // text paste on the menu path (no DOM clipboardData available there).
  if (!(await window.api.clipboardHasImage())) return false
  const baseDir = await requireBaseDir(view, ensureSaved)
  if (baseDir == null) return true // handled: user cancelled Save As
  const result = await window.api.saveClipboardImage(baseDir, saveOptions())
  if (!result) return false // raced to an empty clipboard — fall back to text
  insertImages(view, [result.relPath], pos)
  return true
}

/** Local image file path → relative path, or copy/absolute per preferences. */
export async function insertLocalImagePath(
  view: EditorView,
  filePath: string,
  ensureSaved: () => Promise<boolean>,
  pos?: number
): Promise<void> {
  const baseDir = await requireBaseDir(view, ensureSaved)
  if (baseDir == null) return
  const src = await window.api.importLocalImage(baseDir, filePath, saveOptions())
  insertImages(view, [src], pos)
}

/** Remote image URL → download into assets, or keep the URL per preferences. */
export async function insertRemoteImageUrl(
  view: EditorView,
  url: string,
  ensureSaved: () => Promise<boolean>,
  pos?: number
): Promise<void> {
  if (!getPreferences().downloadRemoteImages) {
    insertImages(view, [url], pos)
    return
  }
  const baseDir = await requireBaseDir(view, ensureSaved)
  if (baseDir == null) return
  const src = await window.api.downloadRemoteImage(baseDir, url, saveOptions())
  insertImages(view, [src], pos)
}

/**
 * DOM `paste` handler (runs at Prec.high, before the assists' text transforms).
 * Returns true when the paste was claimed as an image.
 */
export function imagePasteEventHandler(
  event: ClipboardEvent,
  view: EditorView,
  ensureSaved: () => Promise<boolean>
): boolean {
  const data = event.clipboardData
  if (clipboardHasImage(data)) {
    event.preventDefault()
    void insertClipboardImage(view, ensureSaved)
    return true
  }
  const text = data?.getData('text/plain').trim()
  if (text) {
    if (LOCAL_IMAGE_PATH_RE.test(text)) {
      event.preventDefault()
      void insertLocalImagePath(view, text, ensureSaved)
      return true
    }
    if (REMOTE_IMAGE_URL_RE.test(text)) {
      event.preventDefault()
      void insertRemoteImageUrl(view, text, ensureSaved)
      return true
    }
  }
  return false
}

// ---- drop --------------------------------------------------------------------

function decodeFileUri(uri: string): string {
  try {
    return decodeURIComponent(new URL(uri).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  } catch {
    return uri
  }
}

/**
 * DOM `drop` handler: image files and image URLs dropped anywhere in the
 * editor insert at the drop point. Non-image payloads fall through to the
 * default text drop.
 */
export function imageDropEventHandler(
  event: DragEvent,
  view: EditorView,
  ensureSaved: () => Promise<boolean>
): boolean {
  const data = event.dataTransfer
  if (!data) return false
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
  const files = [...data.files].filter((f) => f.type.startsWith('image/'))
  if (files.length > 0) {
    event.preventDefault()
    void (async () => {
      const baseDir = await requireBaseDir(view, ensureSaved)
      if (baseDir == null) return
      const srcs: string[] = []
      for (const file of files) {
        // Electron ≥32: File.path is gone; preload bridges webUtils.
        const filePath = window.api.getPathForFile(file)
        if (!filePath) continue
        srcs.push(await window.api.importLocalImage(baseDir, filePath, saveOptions()))
      }
      insertImages(view, srcs, pos ?? undefined)
    })()
    return true
  }
  const uriList = data.getData('text/uri-list')
  const text = uriList || data.getData('text/plain')
  const uris = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'))
  const imageUris = uris.filter((s) => FILE_URI_RE.test(s) || REMOTE_IMAGE_URL_RE.test(s))
  if (imageUris.length > 0) {
    event.preventDefault()
    void (async () => {
      const needsDisk = imageUris.some(
        (uri) => FILE_URI_RE.test(uri) || getPreferences().downloadRemoteImages
      )
      let baseDir: string | null = null
      if (needsDisk) {
        baseDir = await requireBaseDir(view, ensureSaved)
        if (baseDir == null) return
      }
      const srcs: string[] = []
      for (const uri of imageUris) {
        if (REMOTE_IMAGE_URL_RE.test(uri)) {
          if (!getPreferences().downloadRemoteImages) {
            srcs.push(uri)
            continue
          }
          srcs.push(await window.api.downloadRemoteImage(baseDir!, uri, saveOptions()))
        } else {
          srcs.push(
            await window.api.importLocalImage(baseDir!, decodeFileUri(uri), saveOptions())
          )
        }
      }
      insertImages(view, srcs, pos ?? undefined)
    })()
    return true
  }
  return false
}

/** Allow the drop event for file payloads (Chromium requires this). */
export function imageDragOverEventHandler(event: DragEvent): boolean {
  const types = event.dataTransfer?.types
  if (types && [...types].includes('Files')) {
    event.preventDefault()
    return true
  }
  return false
}

// ---- extension ---------------------------------------------------------------

/**
 * Always-on image paste/drop handlers. Registered in setup.ts (not in the
 * assists compartment) so image insertion works with typing assists disabled.
 */
export function imageInputExtension(ensureSaved: () => Promise<boolean>): Extension {
  return Prec.high(
    EditorView.domEventHandlers({
      paste: (event, view) => imagePasteEventHandler(event, view, ensureSaved),
      dragover: (event) => imageDragOverEventHandler(event),
      drop: (event, view) => imageDropEventHandler(event, view, ensureSaved),
      mousedown: (event) => {
        // Clicking outside the image chrome closes any open zoom toolbar.
        // Clicks on the image itself are stopped inside the widget.
        const target = event.target as HTMLElement | null
        if (target && !target.closest('.cm-md-image-wrap')) closeAllImageSelections()
        return false
      }
    })
  )
}
