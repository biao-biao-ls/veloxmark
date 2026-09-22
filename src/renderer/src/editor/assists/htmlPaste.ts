import type { EditorView } from '@codemirror/view'
import { getPreferences } from '../../preferences/store'
import { transformPaste } from './paste'
import { getEditingAssists } from './config'
import { collectImageSrcs, htmlToMarkdown } from './htmlToMd'
import { insertClipboardImage } from '../images'
import { getLivePreviewConfig } from '../livePreview'

/**
 * P19 HTML→Markdown paste pipeline.
 *
 * Priority: clipboard bitmap (P05 images.ts, Prec.high) → text/html with
 * `pasteHtmlToMd` on → assists text transform (P01 URL rules) → default.
 * Transform failures return false so the browser's plain-text paste runs —
 * never insert half-converted garbage. Gate must run BEFORE preventDefault:
 * an empty conversion or a converter throw claiming the event would drop the
 * plain-text flavor (UX-P19-F2, wave⑥-4).
 *
 * Feedback policy (wave⑥-4 decision, Typora parity): successful conversion is
 * silent. Only a converter throw gets one restrained status notice — the
 * content still lands as plain text, the toast says so once.
 *
 * Image second pass mirrors P05 settings: file:// / local paths import via
 * importLocalImage when a document folder is open; http(s) srcs download
 * only when `downloadRemoteImages` is on and a folder exists — otherwise the
 * URL is kept and the live preview renders from remote.
 */

const FILE_URI_RE = /^file:\/\/(.+)$/i
const REMOTE_RE = /^https?:\/\//i
const LOCAL_PATH_RE = /^(?:[A-Za-z]:[\\/]|\/|\\\\)\S+$/

/** wave⑥-4: App wires showToast(t(key)) here; null keeps the pipeline silent. */
type FallbackNotice = (messageKey: string) => void
let onConvertFallback: FallbackNotice | null = null
export function setHtmlPasteFallbackNotice(fn: FallbackNotice | null): void {
  onConvertFallback = fn
}

/**
 * Convert with throw discrimination: `threw` marks the converter-exception
 * path (notice-worthy) separately from the silent empty/null fall-through.
 */
function convertHtml(html: string): { md: string | null; threw: boolean } {
  try {
    return { md: htmlToMarkdown(html), threw: false }
  } catch {
    return { md: null, threw: true }
  }
}

function isImageSrc(src: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)(\?\S*)?$/i.test(src)
}

/** Rewrite pasted `![](src)` per P05 prefs; original markdown on any miss. */
async function resolvePastedImages(markdown: string, baseDir: string): Promise<string> {
  if (!baseDir) return markdown
  const prefs = getPreferences()
  const srcs = collectImageSrcs(markdown)
  if (srcs.length === 0) return markdown
  const resolved = new Map<string, string>()
  for (const src of srcs) {
    if (resolved.has(src)) continue
    try {
      if (FILE_URI_RE.test(src) && isImageSrc(src)) {
        const filePath = decodeURIComponent(FILE_URI_RE.exec(src)![1])
        const next = await window.api.importLocalImage(baseDir, filePath, {
          assetsDirName: prefs.attachmentDirName,
          renameMode: prefs.imageRenameMode,
          copyExternal: prefs.copyExternalImages
        })
        if (next) resolved.set(src, next)
      } else if (LOCAL_PATH_RE.test(src) && isImageSrc(src)) {
        const next = await window.api.importLocalImage(baseDir, src, {
          assetsDirName: prefs.attachmentDirName,
          renameMode: prefs.imageRenameMode,
          copyExternal: prefs.copyExternalImages
        })
        if (next) resolved.set(src, next)
      } else if (REMOTE_RE.test(src) && prefs.downloadRemoteImages && isImageSrc(src)) {
        const next = await window.api.downloadRemoteImage(baseDir, src, {
          assetsDirName: prefs.attachmentDirName,
          renameMode: prefs.imageRenameMode,
          copyExternal: prefs.copyExternalImages
        })
        if (next) resolved.set(src, next)
      }
    } catch {
      // Keep the original src — preview can still render a remote URL.
    }
  }
  if (resolved.size === 0) return markdown
  return markdown.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt: string, src: string) => {
    const next = resolved.get(src)
    return next ? `![${alt}](${next})` : m
  })
}

/**
 * Convert + insert one HTML payload. Returns false when the payload should
 * fall through to plain-text paste (switch off, empty conversion, or parse
 * failure — the "不丢内容" contract, hard-verified in UX-P19 wave⑥-4).
 */
export async function applyHtmlPaste(view: EditorView, html: string): Promise<boolean> {
  const cfg = getEditingAssists(view.state)
  if (!cfg.enabled || !cfg.pasteHtmlToMd) return false
  const { md, threw } = convertHtml(html)
  if (md == null || md === '') {
    if (threw) onConvertFallback?.('toast.pasteHtmlFallback')
    return false
  }
  const baseDir = getLivePreviewConfig(view.state).baseDir
  const final = await resolvePastedImages(md, baseDir).catch(() => md)
  view.dispatch({
    ...view.state.replaceSelection(final),
    userEvent: 'input.paste',
    scrollIntoView: true
  })
  return true
}

/**
 * DOM `paste` branch for text/html. Registered before the P01 text transform
 * and after (never above) the P05 bitmap handler. Returns true when claimed.
 */
export function htmlPasteEventHandler(event: ClipboardEvent, view: EditorView): boolean {
  const cfg = getEditingAssists(view.state)
  if (!cfg.enabled || !cfg.pasteHtmlToMd) return false
  const html = event.clipboardData?.getData('text/html')
  if (!html || !html.trim()) return false
  // Gate BEFORE preventDefault — empty conversion AND converter throw must
  // fall through untouched so the plain-text flavor still lands (P19-F2).
  const { md, threw } = convertHtml(html)
  if (md == null || md === '') {
    if (threw) onConvertFallback?.('toast.pasteHtmlFallback')
    return false
  }
  event.preventDefault()
  // md already validated non-empty; applyHtmlPaste re-converts deterministically.
  void applyHtmlPaste(view, html)
  return true
}

/**
 * Menu Edit>Paste body — the single implementation commands.ts and the e2e
 * hook both call, so the menu path and Ctrl+V cannot drift apart.
 * Order: P05 bitmap → P19 HTML → P01 text transform → default insert.
 */
export async function runMenuPaste(
  view: EditorView,
  ensureSaved: () => Promise<boolean>
): Promise<void> {
  const handled = await insertClipboardImage(view, ensureSaved)
  if (handled) return
  const cfg = getEditingAssists(view.state)
  if (cfg.enabled && cfg.pasteHtmlToMd) {
    try {
      const html = await window.api.clipboardReadHtml()
      if (html && html.trim() && (await applyHtmlPaste(view, html))) return
    } catch {
      // IPC/parse miss — fall through to plain text.
    }
  }
  const text = await window.api.clipboardRead()
  if (!text) return
  const changes = transformPaste(view.state, text)
  if (changes) view.dispatch({ changes, userEvent: 'input.paste', scrollIntoView: true })
  else view.dispatch(view.state.replaceSelection(text))
}
