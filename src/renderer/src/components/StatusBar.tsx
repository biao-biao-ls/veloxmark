/**
 * P14 status bar — 24px strip under the editor column.
 *
 * Left: cursor line:col, selection size while a range is selected.
 * Right: word/char/line counts (debounced upstream), writing-mode lamps,
 * autosave slot. Word口径 (Typora-aligned, recorded in P14 docs):
 * CJK char = 1 word; western tokens split on whitespace count 1 each
 * (token must contain a letter or digit — pure punctuation skipped).
 */
import { t } from '../i18n'
import { dialog } from './Dialog'
import type { Preferences } from '../preferences/store'
// P15: pure stats module so vitest (node) can test the word-count口径 without
// pulling React/DOM. Re-exported here — App.tsx and e2e import from this path.
import { EMPTY_STATS, computeDocStats, type DocStats } from '../statusbar/stats'
import type { FormatWarning } from '../editor/format'

export { EMPTY_STATS, computeDocStats }
export type { DocStats }


interface Props {
  stats: DocStats
  prefs: Preferences
  /** P12 autosave timestamp (ms) — mirrored into the right-side slot. */
  autoSaveAt: number | null
  /** UX-P12 F3: sticky "Auto-save failed HH:MM" label; overrides the saved slot. */
  autoSaveError?: string | null
  /** UX-P04 F2: export run-in-progress lamp (`.sb-exporting`). */
  exporting?: boolean
  /** P20 transient command feedback ("已复制为富文本"); null hides the chip. */
  toast: string | null
  /** UX-P12: dirty doc + autosave off — stale "Saved HH:MM" would mislead. */
  hideSavedAt?: boolean
  /** UX-P23 wave⑥-6 F1: last format run's warnings — chip opens detail dialog. */
  formatWarnings?: FormatWarning[]
  onShowFormatWarnings?: () => void
}

export default function StatusBar({
  stats,
  prefs,
  autoSaveAt,
  autoSaveError,
  exporting,
  toast,
  hideSavedAt,
  formatWarnings,
  onShowFormatWarnings
}: Props): React.JSX.Element {
  // Spaces re-derived from the live doc when the detail dialog opens.
  const countSpaces = (): number => {
    const view = window.__veloxEditor?.view
    if (!view) return 0
    const text = view.state.doc.toString()
    let n = 0
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (ch === ' ' || ch === '\n' || ch === '\t') n++
    }
    return n
  }

  const showDetail = (): void => {
    const charsNoSpace = stats.chars - countSpaces()
    // UX-P14 F6: key-based copy — DialogHost resolves at render, so an open
    // detail dialog live-relabels when the UI language switches (wave④ contract).
    void dialog.alert({
      titleKey: 'status.detailTitle',
      messageKey: 'status.detailMsg',
      messageParams: {
        paragraphs: stats.paragraphs,
        words: stats.words,
        chars: stats.chars,
        charsNoSpace
      }
    })
  }

  // UX-P12 residual: when the doc is dirty and autosave is off, the old
  // "Saved HH:MM" is a false-positive trust cue — suppress it and lamp unsaved.
  const savedLabel =
    autoSaveError != null
      ? autoSaveError
      : hideSavedAt
        ? null
        : autoSaveAt != null
          ? t('status.savedAt', {
              time: new Date(autoSaveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            })
          : null

  return (
    <div className="status-bar">
      <div className="sb-left">
        <span className="sb-cursor">{t('status.lineCol', { line: stats.line, col: stats.col })}</span>
        {stats.selChars > 0 && (
          <span className="sb-sel">{t('status.selected', { n: stats.selChars })}</span>
        )}
        {toast != null && <span className="sb-toast">{toast}</span>}
        {(formatWarnings?.length ?? 0) > 0 && (
          <button
            className="sb-stat sb-warn-btn"
            onClick={() => onShowFormatWarnings?.()}
            title={t('format.warningsTitle')}
          >
            ⚠ {formatWarnings!.length}
          </button>
        )}
      </div>
      <div className="sb-right">
        {exporting && <span className="sb-lamp sb-exporting">{t('status.exporting')}</span>}
        {hideSavedAt && !savedLabel && (
          <span className="sb-autosave sb-autosave-dirty">{t('status.unsavedLamp')}</span>
        )}
        {savedLabel && (
          <span className={autoSaveError != null ? 'sb-autosave sb-autosave-error' : 'sb-autosave'}>
            {savedLabel}
          </span>
        )}
        {prefs.focusMode && <span className="sb-lamp sb-lamp-focus">{t('status.focus')}</span>}
        {prefs.typewriterMode && (
          <span className="sb-lamp sb-lamp-typewriter">{t('status.typewriter')}</span>
        )}
        {prefs.sourceMode && <span className="sb-lamp sb-lamp-source">{t('status.source')}</span>}
        {/* UX-P14 F2/F3/F4: all stat slots are one affordance — click any,
            open the same detail dialog; buttons are tabbable and ≥22px. */}
        <button className="sb-stat sb-stat-btn" onClick={showDetail} title={t('status.detailTitle')}>
          {t('status.words', { n: stats.words })}
        </button>
        <button className="sb-stat sb-stat-btn" onClick={showDetail} title={t('status.detailTitle')}>
          {t('status.chars', { n: stats.chars })}
        </button>
        <button className="sb-stat sb-stat-btn" onClick={showDetail} title={t('status.detailTitle')}>
          {t('status.lines', { n: stats.lines })}
        </button>
      </div>
    </div>
  )
}
