import { useEffect, useRef, useState } from 'react'
import type { ExportFormat, ExportOptions, ExportThemeOption } from '../hooks/useExport'
import { t } from '../i18n'

/**
 * Export options dialog (P04). Reuses the P02 dialog CSS classes like the
 * Preferences panel does; a controlled component — the App owns open/close
 * and receives the chosen options via onConfirm.
 */

interface Props {
  format: ExportFormat | null
  defaults: ExportOptions
  /** UX-P04 F2: run-in-progress — Export… disables + "Exporting…" label. */
  exporting?: boolean
  onClose: () => void
  onConfirm: (format: ExportFormat, options: ExportOptions) => void
}

export default function ExportDialog({
  format,
  defaults,
  exporting = false,
  onClose,
  onConfirm
}: Props): React.JSX.Element | null {
  const [options, setOptions] = useState<ExportOptions>(defaults)
  const exportBtnRef = useRef<HTMLButtonElement | null>(null)

  // Reset to the remembered options each time the dialog opens.
  useEffect(() => {
    if (format) {
      setOptions(defaults)
      exportBtnRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format])

  if (!format) return null

  const patch = (p: Partial<ExportOptions>): void => setOptions((o) => ({ ...o, ...p }))
  const isMac = window.api.platform === 'darwin'

  const onKeyDown = (e: React.KeyboardEvent): void => {
    e.stopPropagation()
    // While exporting, Esc/overlay dismissal stay armed only for real cancels —
    // the run owns the dialog until success/failure closes it.
    if (e.key === 'Escape' && !exporting) {
      e.preventDefault()
      onClose()
    }
  }

  const isPdf = format === 'pdf'

  return (
    <div className="dialog-overlay" onKeyDown={onKeyDown} onMouseDown={() => { if (!exporting) onClose() }}>
      <div
        className="dialog prefs-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={isPdf ? t('export.pdfTitle') : t('export.htmlTitle')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="dialog-title">{isPdf ? t('export.pdfTitle') : t('export.htmlTitle')}</div>

        <label className="prefs-row">
          <span className="prefs-label">{t('export.theme')}</span>
          <select
            className="prefs-input"
            value={options.theme}
            onChange={(e) => patch({ theme: e.target.value as ExportThemeOption })}
          >
            <option value="current">{t('export.themeCurrent')}</option>
            <option value="light">{t('export.themeLight')}</option>
          </select>
        </label>

        {isPdf ? (
          <>
            <label className="prefs-row">
              <span className="prefs-label">{t('export.paper')}</span>
              <select
                className="prefs-input"
                value={options.pageSize}
                onChange={(e) => patch({ pageSize: e.target.value as 'A4' | 'Letter' })}
              >
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
              </select>
            </label>
            <label className="prefs-row">
              <span className="prefs-label">{t('export.margins')}</span>
              <select
                className="prefs-input"
                value={options.margins}
                onChange={(e) => patch({ margins: e.target.value as 'normal' | 'narrow' })}
              >
                <option value="normal">{t('export.marginsNormal')}</option>
                <option value="narrow">{t('export.marginsNarrow')}</option>
              </select>
            </label>
            <label className="prefs-row prefs-check">
              <input
                type="checkbox"
                checked={options.headerFooter}
                onChange={(e) => patch({ headerFooter: e.target.checked })}
              />
              <span>{t('export.headerFooter')}</span>
            </label>
          </>
        ) : (
          <>
            <label className="prefs-row">
              <span className="prefs-label">{t('export.images')}</span>
              <select
                className="prefs-input"
                value={options.imageMode}
                onChange={(e) => patch({ imageMode: e.target.value as 'embed' | 'relative' })}
              >
                <option value="embed">{t('export.imageEmbed')}</option>
                <option value="relative">{t('export.imageRelative')}</option>
              </select>
            </label>
            <label className="prefs-row">
              <span className="prefs-label">{t('export.katexFonts')}</span>
              <select
                className="prefs-input"
                value={options.katexFonts}
                onChange={(e) => patch({ katexFonts: e.target.value as 'embed' | 'cdn' })}
              >
                <option value="embed">{t('export.katexEmbed')}</option>
                <option value="cdn">{t('export.katexCdn')}</option>
              </select>
            </label>
          </>
        )}

        <div className="dialog-buttons">
          {/* macOS puts the confirming action rightmost (P02 parity).
              UX-P04 F2: Export… disables + relabels while the run is live. */}
          {isMac ? (
            <>
              <button className="dialog-btn" onClick={onClose} disabled={exporting}>
                {t('dialog.cancel')}
              </button>
              <button
                ref={exportBtnRef}
                className="dialog-btn dialog-btn-primary"
                disabled={exporting}
                onClick={() => onConfirm(format, options)}
              >
                {exporting ? t('export.inProgress') : t('export.exportBtn')}
              </button>
            </>
          ) : (
            <>
              <button
                ref={exportBtnRef}
                className="dialog-btn dialog-btn-primary"
                disabled={exporting}
                onClick={() => onConfirm(format, options)}
              >
                {exporting ? t('export.inProgress') : t('export.exportBtn')}
              </button>
              <button className="dialog-btn" onClick={onClose} disabled={exporting}>
                {t('dialog.cancel')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
