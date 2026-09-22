import type { EditorView } from '@codemirror/view'
import { getLivePreviewConfig } from '../editor/livePreview'
import { showSaveDialog } from './e2eSaveDialog'
import { buildExportHtml } from './buildDocument'
import { EXPORT_DOC_CSS } from './exportCss'
import { inlineStyleFragment, wrapFragment } from './inlineStyles'
import { paletteFor } from './palette'
import { renderDoc } from './renderDoc'

/**
 * P20 Copy as Rich Text — render the selection (or whole doc) through the
 * P04 renderDoc pipeline and write BOTH clipboard flavors:
 *   text/html  — theme-inlined fragment (WeChat-safe style= attributes)
 *   text/plain — the Markdown source that was rendered
 *
 * Menu command and the e2e hook share these functions, so the clipboard
 * payloads the tests assert are exactly what the command writes.
 */

/** Markdown that the command renders: selection if any, else whole doc. */
export function selectionMarkdown(view: EditorView): string {
  const { from, to } = view.state.selection.main
  return from !== to ? view.state.sliceDoc(from, to) : view.state.doc.toString()
}

/** Core: render md → inlined HTML flavor + plain flavor; write clipboard. */
export async function writeRichText(view: EditorView, markdown: string): Promise<void> {
  const lp = getLivePreviewConfig(view.state)
  const fragment = await renderDoc(markdown, {
    baseDir: lp.baseDir,
    theme: lp.theme,
    imageMode: 'embed'
  })
  const html = wrapFragment(inlineStyleFragment(fragment, lp.theme), lp.theme)
  await window.api.clipboardWriteHtml(html, markdown)
}

/** Command body — Edit > Copy as Rich Text. Returns false when nothing to copy. */
export async function copyRichTextToClipboard(view: EditorView): Promise<boolean> {
  const md = selectionMarkdown(view)
  if (!md.trim()) return false
  await writeRichText(view, md)
  return true
}

/**
 * Low-pri companion: Copy as HTML — text/html only, class names + <style>
 * block instead of inline styles (for HTML-literate targets / pasting into
 * sources that keep classes).
 */
export async function copyHtmlToClipboard(view: EditorView): Promise<boolean> {
  const md = selectionMarkdown(view)
  if (!md.trim()) return false
  const lp = getLivePreviewConfig(view.state)
  const fragment = await renderDoc(md, {
    baseDir: lp.baseDir,
    theme: lp.theme,
    imageMode: 'embed'
  })
  const themeClass = lp.theme === 'dark' ? 'export-theme-dark' : 'export-theme-light'
  const html =
    `<style>${EXPORT_DOC_CSS}</style>` +
    `<article class="export-doc ${themeClass}" style="background:${paletteFor(lp.theme).bg};padding:12px;">` +
    fragment +
    `</article>`
  await window.api.clipboardWriteHtml(html, md)
  return true
}

/** Core: selection (or full doc) → standalone HTML document string. */
export async function renderSelectionHtmlDocument(view: EditorView): Promise<string> {
  const md = selectionMarkdown(view)
  const lp = getLivePreviewConfig(view.state)
  return buildExportHtml(md || ' ', {
    title: 'selection',
    baseDir: lp.baseDir,
    theme: lp.theme,
    imageMode: 'embed',
    katexFonts: 'cdn'
  })
}

/** Low-pri: Export Selection… — save dialog + P04 exportHtml IPC. */
export async function exportSelectionHtmlFile(view: EditorView): Promise<boolean> {
  const md = selectionMarkdown(view)
  if (!md.trim()) return false
  const html = await renderSelectionHtmlDocument(view)
  const target = await showSaveDialog('selection.html', [
    { name: 'HTML', extensions: ['html'] }
  ])
  if (!target) return false
  return window.api.exportHtml(target, html)
}
