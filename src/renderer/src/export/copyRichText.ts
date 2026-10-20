import type { EditorView } from '@codemirror/view'
import { getLivePreviewConfig } from '../editor/livePreview'
import { showSaveDialog } from './e2eSaveDialog'
import { buildExportHtml } from './buildDocument'
import { EXPORT_DOC_CSS } from './exportCss'
import { inlineStyleFragment, wrapFragment } from './inlineStyles'
import { paletteFor } from './palette'
import { renderDoc } from './renderDoc'


export function selectionMarkdown(view: EditorView): string {
  const { from, to } = view.state.selection.main
  return from !== to ? view.state.sliceDoc(from, to) : view.state.doc.toString()
}

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

export async function copyRichTextToClipboard(view: EditorView): Promise<boolean> {
  const md = selectionMarkdown(view)
  if (!md.trim()) return false
  await writeRichText(view, md)
  return true
}

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
