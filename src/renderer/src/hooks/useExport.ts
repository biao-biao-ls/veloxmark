import { useCallback, useRef, useState, type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import { getLivePreviewConfig } from '../editor/livePreview'
import { buildExportHtml, type KatexFontMode } from '../export/buildDocument'
import type { ImageMode } from '../export/renderDoc'
import { dialog } from '../components/Dialog'

/**
 * Export orchestration (P04): owns the export dialog state, remembers the
 * last-used options for the session, and runs render → save dialog → IPC.
 * PDF always embeds images (the hidden window must not depend on mdres://).
 */

export type ExportFormat = 'pdf' | 'html'
export type ExportThemeOption = 'current' | 'light'

export interface ExportOptions {
  pageSize: 'A4' | 'Letter'
  margins: 'normal' | 'narrow'
  headerFooter: boolean
  theme: ExportThemeOption
  /** HTML only; PDF forces 'embed'. */
  imageMode: ImageMode
  /** HTML only; PDF always embeds (hidden window has no network in offline use). */
  katexFonts: KatexFontMode
}

const DEFAULT_OPTIONS: ExportOptions = {
  pageSize: 'A4',
  margins: 'normal',
  headerFooter: true,
  theme: 'current',
  imageMode: 'embed',
  katexFonts: 'embed'
}

interface Args {
  viewRef: RefObject<EditorView | null>
  filePath: string | null
}

export function useExport({ viewRef, filePath }: Args) {
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null)
  const [exporting, setExporting] = useState(false)
  // Session memory of last-used options (not persisted to preferences store).
  const optionsRef = useRef<ExportOptions>(DEFAULT_OPTIONS)

  const openExport = useCallback((format: ExportFormat) => setExportFormat(format), [])
  const closeExport = useCallback(() => setExportFormat(null), [])

  const runExport = useCallback(
    async (format: ExportFormat, options: ExportOptions) => {
      const view = viewRef.current
      if (!view) return
      optionsRef.current = options
      setExportFormat(null)

      const markdown = view.state.doc.toString()
      const lp = getLivePreviewConfig(view.state)
      const title = filePath ? filePath.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '') : 'Untitled'
      const ext = format === 'pdf' ? 'pdf' : 'html'
      const target = await window.api.showSaveDialog(`${title}.${ext}`, [
        { name: format === 'pdf' ? 'PDF' : 'HTML', extensions: [ext] },
        { name: 'All Files', extensions: ['*'] }
      ])
      if (!target) return

      setExporting(true)
      try {
        const theme = options.theme === 'light' ? 'light' : lp.theme
        const html = await buildExportHtml(markdown, {
          title,
          baseDir: lp.baseDir,
          theme,
          imageMode: format === 'pdf' ? 'embed' : options.imageMode,
          // PDF's hidden window renders this same HTML — always embed fonts
          // there so printing needs no network. HTML honors the CDN toggle.
          katexFonts: format === 'pdf' ? 'embed' : options.katexFonts
        })
        if (format === 'pdf') {
          await window.api.exportPdf(target, html, {
            pageSize: options.pageSize,
            margins: options.margins,
            headerFooter: options.headerFooter,
            title
          })
        } else {
          await window.api.exportHtml(target, html)
        }
      } catch (err) {
        await dialog.alert({
          title: 'Export Failed',
          message: err instanceof Error ? err.message : String(err)
        })
      } finally {
        setExporting(false)
      }
    },
    [viewRef, filePath]
  )

  return {
    exportFormat,
    exportOptions: optionsRef.current,
    exporting,
    openExport,
    closeExport,
    runExport
  }
}

// Handle for CDP smoke tests (scripts/cdp-p04.mjs) — no other runtime consumers.
// Exposes the pure render/build pipeline without the save dialog.
declare global {
  interface Window {
    __veloxExport: {
      renderHtml: (
        markdown: string,
        opts: { baseDir?: string; theme?: 'light' | 'dark'; imageMode?: 'embed' | 'relative'; katexFonts?: 'embed' | 'cdn' }
      ) => Promise<string>
    }
  }
}
window.__veloxExport = {
  renderHtml: (markdown, opts) =>
    buildExportHtml(markdown, {
      title: 'test',
      baseDir: opts.baseDir ?? '',
      theme: opts.theme ?? 'light',
      imageMode: opts.imageMode ?? 'embed',
      katexFonts: opts.katexFonts ?? 'embed'
    })
}
