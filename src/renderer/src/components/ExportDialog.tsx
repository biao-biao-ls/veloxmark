import { useEffect, useRef, useState } from 'react'
import type { ExportFormat, ExportOptions, ExportThemeOption } from '../hooks/useExport'

/**
 * Export options dialog (P04). Reuses the P02 dialog CSS classes like the
 * Preferences panel does; a controlled component — the App owns open/close
 * and receives the chosen options via onConfirm.
 */

interface Props {
  format: ExportFormat | null
  defaults: ExportOptions
  onClose: () => void
  onConfirm: (format: ExportFormat, options: ExportOptions) => void
}

export default function ExportDialog({
  format,
  defaults,
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
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const isPdf = format === 'pdf'

  return (
    <div className="dialog-overlay" onKeyDown={onKeyDown} onMouseDown={onClose}>
      <div
        className="dialog prefs-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={isPdf ? 'Export PDF' : 'Export HTML'}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="dialog-title">{isPdf ? 'Export PDF' : 'Export HTML'}</div>

        <label className="prefs-row">
          <span className="prefs-label">Theme</span>
          <select
            className="prefs-input"
            value={options.theme}
            onChange={(e) => patch({ theme: e.target.value as ExportThemeOption })}
          >
            <option value="current">Follow current theme</option>
            <option value="light">Force light</option>
          </select>
        </label>

        {isPdf ? (
          <>
            <label className="prefs-row">
              <span className="prefs-label">Paper size</span>
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
              <span className="prefs-label">Margins</span>
              <select
                className="prefs-input"
                value={options.margins}
                onChange={(e) => patch({ margins: e.target.value as 'normal' | 'narrow' })}
              >
                <option value="normal">Normal</option>
                <option value="narrow">Narrow</option>
              </select>
            </label>
            <label className="prefs-row prefs-check">
              <input
                type="checkbox"
                checked={options.headerFooter}
                onChange={(e) => patch({ headerFooter: e.target.checked })}
              />
              <span>Header (file name) and footer (page numbers)</span>
            </label>
          </>
        ) : (
          <>
            <label className="prefs-row">
              <span className="prefs-label">Images</span>
              <select
                className="prefs-input"
                value={options.imageMode}
                onChange={(e) => patch({ imageMode: e.target.value as 'embed' | 'relative' })}
              >
                <option value="embed">Embed as base64</option>
                <option value="relative">Keep relative paths</option>
              </select>
            </label>
            <label className="prefs-row">
              <span className="prefs-label">KaTeX fonts</span>
              <select
                className="prefs-input"
                value={options.katexFonts}
                onChange={(e) => patch({ katexFonts: e.target.value as 'embed' | 'cdn' })}
              >
                <option value="embed">Embed (offline-ready)</option>
                <option value="cdn">CDN fallback (smaller file)</option>
              </select>
            </label>
          </>
        )}

        <div className="dialog-buttons">
          {/* macOS puts the confirming action rightmost (P02 parity). */}
          {isMac ? (
            <>
              <button className="dialog-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                ref={exportBtnRef}
                className="dialog-btn dialog-btn-primary"
                onClick={() => onConfirm(format, options)}
              >
                Export…
              </button>
            </>
          ) : (
            <>
              <button
                ref={exportBtnRef}
                className="dialog-btn dialog-btn-primary"
                onClick={() => onConfirm(format, options)}
              >
                Export…
              </button>
              <button className="dialog-btn" onClick={onClose}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
