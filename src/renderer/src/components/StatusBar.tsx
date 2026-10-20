import { t } from '../i18n'
import { dialog } from './Dialog'
import type { Preferences } from '../preferences/store'
import { EMPTY_STATS, computeDocStats, type DocStats } from '../statusbar/stats'
import type { FormatWarning } from '../editor/format'

export { EMPTY_STATS, computeDocStats }
export type { DocStats }


interface Props {
  stats: DocStats
  prefs: Preferences
  autoSaveAt: number | null
  autoSaveError?: string | null
  exporting?: boolean
  hideSavedAt?: boolean
  formatWarnings?: FormatWarning[]
  onShowFormatWarnings?: () => void
}

export default function StatusBar({
  stats,
  prefs,
  autoSaveAt,
  autoSaveError,
  exporting,
  hideSavedAt,
  formatWarnings,
  onShowFormatWarnings
}: Props): React.JSX.Element {
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
