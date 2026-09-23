import { useCallback, useRef, useState, type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import { getLivePreviewConfig } from '../editor/livePreview'
import { buildExportHtml, type KatexFontMode } from '../export/buildDocument'
import { setSaveDialogAuto, showSaveDialog, takeSaveDialogCalls } from '../export/e2eSaveDialog'
import type { ImageMode } from '../export/renderDoc'
import { dialog } from '../components/Dialog'
import { t } from '../i18n'
import { baseNameOf } from '../pathUtil'

/**
 * Export orchestration (P04): owns the export dialog state, remembers the
 * last-used options for the session, and runs render → save dialog → IPC.
 * PDF always embeds images (the hidden window must not depend on mdres://).
 *
 * UX-P04 feedback contract (professional bar):
 *  - in progress: ExportDialog stays open, Export… disables with
 *    "Exporting…" label, statusbar shows `.sb-exporting` lamp;
 *  - success: statusbar toast carrying the落盘 path (toast.exportSuccess),
 *    dialog closes;
 *  - cancel (save dialog): quiet close — no export call, no toast;
 *  - failure: localized alert (export.failedTitle + reason) — the export
 *    dialog closes first so the alert is unambiguous; re-open to retry.
 *  - e2e: save dialog + export IPC are drivable via __veloxP04 seams
 *    (window.api is frozen by contextBridge — see export/e2eSaveDialog.ts).
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

/** e2e stub for export IPC (frozen on window.api — see file header). */
interface ExportStub {
  html?: (target: string, html: string) => Promise<unknown>
  pdf?: (target: string, html: string, options: unknown) => Promise<unknown>
}

let exportStub: ExportStub | null = null

interface Args {
  viewRef: RefObject<EditorView | null>
  filePath: string | null
  /** UX-P04 F1: success feedback channel (App → statusbar sb-toast). */
  onExported?: (message: string) => void
}

export function useExport({ viewRef, filePath, onExported }: Args) {
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null)
  const [exporting, setExporting] = useState(false)
  // Session memory of last-used options (not persisted to preferences store).
  const optionsRef = useRef<ExportOptions>(DEFAULT_OPTIONS)
  // UX-P04 F4b: focus return target — the menubar trigger that opened the dialog.
  const triggerRef = useRef<HTMLElement | null>(null)
  const exportingRef = useRef(false)
  exportingRef.current = exporting
  const onExportedRef = useRef(onExported)
  onExportedRef.current = onExported
  const filePathRef = useRef(filePath)
  filePathRef.current = filePath

  const openExport = useCallback((format: ExportFormat) => {
    // UX-P04 F4b: remember who opened the dialog so closeExport can return
    // focus. Prefer the menubar label when invoked from the in-app menu —
    // but on macOS that bar is display:none (native menu owns File/Edit/…),
    // and focusing a hidden node is a no-op, so only capture visible nodes.
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
      // Verify the transfer stuck — hidden triggers (macOS native-menu path)
      // silently ignore focus(); fall back to the editor surface.
      if (document.activeElement === el) return
    }
    ;(document.querySelector('.cm-content') as HTMLElement | null)?.focus()
  }, [])

  const runExport = useCallback(
    async (format: ExportFormat, options: ExportOptions) => {
      const view = viewRef.current
      if (!view) return
      optionsRef.current = options
      // UX-P04 F2: the dialog stays open while the export runs — Export… is
      // disabled + labeled "Exporting…" and the statusbar lamp lights up.
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
          // Cancel = quiet bail; close the options dialog too (reopen to retry).
          setExportFormat(null)
          return
        }

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
        // UX-P04 F1/F6: same completion language as P20 selection export —
        // statusbar toast, and the full-doc path carries the落盘 path.
        onExportedRef.current?.(t('toast.exportSuccess', { path: target }))
        setExportFormat(null)
      } catch (err) {
        // UX-P04 F3: localized title + reason; dialog already closed so the
        // alert is the only modal (unambiguous DOM for probes + AT).
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

  // e2e handle (scripts/cdp-ux-p04.mjs). Seam APIs mirror the Dialog.tsx
  // auto-response pattern; exportStub intercepts the frozen window.api IPC.
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
