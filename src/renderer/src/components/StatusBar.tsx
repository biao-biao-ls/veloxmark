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

export { EMPTY_STATS, computeDocStats }
export type { DocStats }


interface Props {
  stats: DocStats
  prefs: Preferences
  /** P12 autosave timestamp (ms) — mirrored into the right-side slot. */
  autoSaveAt: number | null
  /** P20 transient command feedback ("已复制为富文本"); null hides the chip. */
  toast: string | null
}

export default function StatusBar({ stats, prefs, autoSaveAt, toast }: Props): React.JSX.Element {
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
    void dialog.alert({
      title: t('status.detailTitle'),
      message: t('status.detailMsg', {
        paragraphs: stats.paragraphs,
        words: stats.words,
        chars: stats.chars,
        charsNoSpace
      })
    })
  }

  const savedLabel =
    autoSaveAt != null
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
      </div>
      <div className="sb-right">
        {savedLabel && <span className="sb-autosave">{savedLabel}</span>}
        {prefs.focusMode && <span className="sb-lamp sb-lamp-focus">{t('status.focus')}</span>}
        {prefs.typewriterMode && (
          <span className="sb-lamp sb-lamp-typewriter">{t('status.typewriter')}</span>
        )}
        {prefs.sourceMode && <span className="sb-lamp sb-lamp-source">{t('status.source')}</span>}
        <button className="sb-stat sb-stat-btn" onClick={showDetail} title={t('status.detailTitle')}>
          {t('status.words', { n: stats.words })}
        </button>
        <span className="sb-stat">{t('status.chars', { n: stats.chars })}</span>
        <span className="sb-stat">{t('status.lines', { n: stats.lines })}</span>
      </div>
    </div>
  )
}
