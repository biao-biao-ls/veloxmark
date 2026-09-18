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

export interface DocStats {
  /** 1-based cursor line. */
  line: number
  /** 1-based cursor column (display). */
  col: number
  /** Selection length in characters (0 = caret only). */
  selChars: number
  /** CJK chars + western words. */
  words: number
  /** Document length in characters (CodeMirror doc.length). */
  chars: number
  lines: number
  paragraphs: number
}

export const EMPTY_STATS: DocStats = {
  line: 1,
  col: 1,
  selChars: 0,
  words: 0,
  chars: 0,
  lines: 1,
  paragraphs: 0
}

/**
 * Full-document statistics. `text` is the CodeMirror doc string.
 * Exported for the App debounce bridge + e2e口径 verification.
 */
/** CJK ideographs (incl. extension A + compatibility) — each counts as one word. */
const CJK_RE = /[㐀-䶿一-鿿豈-﫿]/g

export function computeDocStats(text: string): Omit<DocStats, 'line' | 'col' | 'selChars'> {
  const lines = text.length === 0 ? 1 : text.split('\n').length
  const paragraphs = text.split('\n').filter((ln) => ln.trim() !== '').length
  const cjk = text.match(CJK_RE)?.length ?? 0
  const rest = text.replace(CJK_RE, ' ')
  const words =
    cjk +
    rest
      .split(/\s+/)
      .filter((tok) => tok.length > 0 && /[\p{L}\p{N}]/u.test(tok)).length
  return { words, chars: text.length, lines, paragraphs }
}

interface Props {
  stats: DocStats
  prefs: Preferences
  /** P12 autosave timestamp (ms) — mirrored into the right-side slot. */
  autoSaveAt: number | null
}

export default function StatusBar({ stats, prefs, autoSaveAt }: Props): React.JSX.Element {
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
