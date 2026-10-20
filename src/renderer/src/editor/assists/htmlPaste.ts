import type { EditorView } from '@codemirror/view'
import { getPreferences } from '../../preferences/store'
import { transformPaste } from './paste'
import { getEditingAssists } from './config'
import { collectImageSrcs, htmlToMarkdown } from './htmlToMd'
import { insertClipboardImage } from '../images'
import { getLivePreviewConfig } from '../livePreview'


const FILE_URI_RE = /^file:\/\/(.+)$/i
const REMOTE_RE = /^https?:\/\//i
const LOCAL_PATH_RE = /^(?:[A-Za-z]:[\\/]|\/|\\\\)\S+$/

type FallbackNotice = (messageKey: string) => void
let onConvertFallback: FallbackNotice | null = null
export function setHtmlPasteFallbackNotice(fn: FallbackNotice | null): void {
  onConvertFallback = fn
}

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
    }
  }
  if (resolved.size === 0) return markdown
  return markdown.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt: string, src: string) => {
    const next = resolved.get(src)
    return next ? `![${alt}](${next})` : m
  })
}

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

export function htmlPasteEventHandler(event: ClipboardEvent, view: EditorView): boolean {
  const cfg = getEditingAssists(view.state)
  if (!cfg.enabled || !cfg.pasteHtmlToMd) return false
  const html = event.clipboardData?.getData('text/html')
  if (!html || !html.trim()) return false
  const { md, threw } = convertHtml(html)
  if (md == null || md === '') {
    if (threw) onConvertFallback?.('toast.pasteHtmlFallback')
    return false
  }
  event.preventDefault()
  void applyHtmlPaste(view, html)
  return true
}

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
    }
  }
  const text = await window.api.clipboardRead()
  if (!text) return
  const changes = transformPaste(view.state, text)
  if (changes) view.dispatch({ changes, userEvent: 'input.paste', scrollIntoView: true })
  else view.dispatch(view.state.replaceSelection(text))
}
