import { useCallback, useRef, useState, type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import { getLivePreviewConfig } from '../editor/livePreview'
import { buildExportHtml, type KatexFontMode } from '../export/buildDocument'
import { setSaveDialogAuto, showSaveDialog, takeSaveDialogCalls } from '../export/e2eSaveDialog'
import type { ImageMode } from '../export/renderDoc'
import { dialog } from '../components/Dialog'
import { t } from '../i18n'
import { baseNameOf } from '../pathUtil'


export type ExportFormat = 'pdf' | 'html'
export type ExportThemeOption = 'current' | 'light'

export interface ExportOptions {
  pageSize: 'A4' | 'Letter'
  margins: 'normal' | 'narrow'
  headerFooter: boolean
  theme: ExportThemeOption
  imageMode: ImageMode
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

interface ExportStub {
  html?: (target: string, html: string) => Promise<unknown>
  pdf?: (target: string, html: string, options: unknown) => Promise<unknown>
}

let exportStub: ExportStub | null = null

interface Args {
  viewRef: RefObject<EditorView | null>
  filePath: string | null
  onExported?: (message: string) => void
}

export function useExport({ viewRef, filePath, onExported }: Args) {
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null)
  const [exporting, setExporting] = useState(false)
  const optionsRef = useRef<ExportOptions>(DEFAULT_OPTIONS)
  const triggerRef = useRef<HTMLElement | null>(null)
  const exportingRef = useRef(false)
  exportingRef.current = exporting
  const onExportedRef = useRef(onExported)
  onExportedRef.current = onExported
  const filePathRef = useRef(filePath)
  filePathRef.current = filePath

  const openExport = useCallback((format: ExportFormat) => {
    const active = document.activeElement as HTMLElement | null
    const isVisible = (n: HTMLElement | null): boolean =>
      !!n && !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length)
    const menubarLabel = active?.closest?.('.menubar')?.querySelector('.menubar-label') as HTMLElement | null
    triggerRef.current =
      isVisible(menubarLabel) ? menubarLabel : isVisible(active) && active !== document.body ? active : null
    setExportFormat(format)
  }, [])

  const closeExport = useCallback(() => {
    setExportFormat(null)
    const el = triggerRef.current
    if (el && document.contains(el) && typeof el.focus === 'function') {
      el.focus()
      if (document.activeElement === el) return
    }
    ;(document.querySelector('.cm-content') as HTMLElement | null)?.focus()
  }, [])

  const runExport = useCallback(
    async (format: ExportFormat, options: ExportOptions) => {
      const view = viewRef.current
      if (!view) return
      optionsRef.current = options
      setExporting(true)
      try {
        const markdown = view.state.doc.toString()
        const lp = getLivePreviewConfig(view.state)
        const fp = filePathRef.current
        const title = fp ? baseNameOf(fp).replace(/\.[^.]*$/, '') : 'Untitled'
        const ext = format === 'pdf' ? 'pdf' : 'html'
        const target = await showSaveDialog(`${title}.${ext}`, [
          { name: format === 'pdf' ? 'PDF' : 'HTML', extensions: [ext] },
          { name: 'All Files', extensions: ['*'] }
        ])
        if (!target) {
          setExportFormat(null)
          return
        }

        const theme = options.theme === 'light' ? 'light' : lp.theme
        const html = await buildExportHtml(markdown, {
          title,
          baseDir: lp.baseDir,
          theme,
          imageMode: format === 'pdf' ? 'embed' : options.imageMode,
          katexFonts: format === 'pdf' ? 'embed' : options.katexFonts
        })
        if (format === 'pdf') {
          const pdfOpts = {
            pageSize: options.pageSize,
            margins: options.margins,
            headerFooter: options.headerFooter,
            title
          }
          if (exportStub?.pdf) await exportStub.pdf(target, html, pdfOpts)
          else await window.api.exportPdf(target, html, pdfOpts)
        } else if (exportStub?.html) {
          await exportStub.html(target, html)
        } else {
          await window.api.exportHtml(target, html)
        }
        onExportedRef.current?.(t('toast.exportSuccess', { path: target }))
        setExportFormat(null)
      } catch (err) {
        setExportFormat(null)
        await dialog.alert({
          title: t('export.failedTitle'),
          message: err instanceof Error ? err.message : String(err)
        })
      } finally {
        setExporting(false)
      }
    },
    [viewRef]
  )

  ;(window as Window).__veloxP04 = {
    setSaveTarget: (target: string | null | undefined) => setSaveDialogAuto(target),
    setExportStub: (stub: ExportStub | null) => {
      exportStub = stub
    },
    saveCalls: () => takeSaveDialogCalls(),
    getExporting: () => exportingRef.current,
    runExport: (format: ExportFormat, options?: Partial<ExportOptions>) =>
      runExport(format, { ...DEFAULT_OPTIONS, ...(options ?? {}) })
  }

  return {
    exportFormat,
    exportOptions: optionsRef.current,
    exporting,
    openExport,
    closeExport,
    runExport
  }
}

declare global {
  interface Window {
    __veloxExport: {
      renderHtml: (
        markdown: string,
        opts: { baseDir?: string; theme?: 'light' | 'dark'; imageMode?: 'embed' | 'relative'; katexFonts?: 'embed' | 'cdn' }
      ) => Promise<string>
    }
    __veloxP04: {
      setSaveTarget: (target: string | null | undefined) => void
      setExportStub: (stub: ExportStub | null) => void
      saveCalls: () => { defaultPath: string; filters?: unknown }[]
      getExporting: () => boolean
      runExport: (format: ExportFormat, options?: Partial<ExportOptions>) => Promise<void>
    } | null
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
