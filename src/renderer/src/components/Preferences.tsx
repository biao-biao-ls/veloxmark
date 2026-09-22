import { useEffect, useRef, useState } from 'react'
import {
  clearRecentFiles,
  setPreferences,
  DEFAULT_PREFERENCES,
  type AutoSaveMode,
  type LanguagePref,
  type ImageRenameMode,
  type ThemeMode
} from '../preferences/store'
import { usePreferences } from '../preferences/useStore'
import { dialog } from './Dialog'
import { t } from '../i18n'

/**
 * Preferences panel (P03). Modal, grouped Appearance / Editing / Behavior.
 * Every control writes straight to the preferences store — changes apply
 * immediately (CSS variables / editor compartments), no confirm step.
 */
interface Props {
  open: boolean
  onClose: () => void
}

export default function Preferences({ open, onClose }: Props): React.JSX.Element | null {
  const prefs = usePreferences()
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)
  // P07: the ignore list is edited line-by-line; a local draft keeps the
  // in-progress trailing newline out of the store (sanitize drops empty
  // entries, which would yank the cursor mid-edit).
  const [ignoreDraft, setIgnoreDraft] = useState(() => prefs.folderIgnoreNames.join('\n'))

  // UX-P03: capture the trigger element on open and restore it on close —
  // same settle-focus contract as Dialog.tsx (UX-P02-F1 root).
  useEffect(() => {
    if (open) {
      prevFocusRef.current = (document.activeElement as HTMLElement | null) ?? null
      wasOpenRef.current = true
      closeRef.current?.focus()
      setIgnoreDraft(prefs.folderIgnoreNames.join('\n'))
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false
      const prev = prevFocusRef.current
      prevFocusRef.current = null
      // Menubar-opened panels capture <body> — that is not a restore target.
      const meaningful =
        prev != null &&
        prev.isConnected &&
        prev !== document.body &&
        prev !== document.documentElement &&
        typeof prev.focus === 'function'
      if (meaningful) {
        prev!.focus()
      } else {
        document.querySelector<HTMLElement>('.cm-content')?.focus()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  // Keep keystrokes inside the panel (global shortcuts / the editor below).
  const onKeyDown = (e: React.KeyboardEvent): void => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  // F07: every numeric input advertises its range via placeholder + title
  // (language-neutral digits) so the accepted band is visible even when the
  // field holds a value.
  const num = (
    value: number,
    onChange: (v: number) => void,
    min: number,
    max: number,
    step = 1,
    disabled = false
  ) => (
    <input
      className="prefs-input prefs-input-num"
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      placeholder={`${min}–${max}`}
      title={`${min}–${max}`}
      onChange={(e) => {
        const v = Number(e.target.value)
        if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)))
      }}
    />
  )

  // F07: Tab traversal keeps the focused control inside the scroll viewport
  // (.prefs-dialog is the 76vh scroll container — sections are direct children).
  const onFocusScroll = (e: React.FocusEvent): void => {
    const el = e.target as HTMLElement
    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
  }

  return (
    <div className="dialog-overlay prefs-overlay" onKeyDown={onKeyDown} onMouseDown={onClose}>
      <div
        className="dialog prefs-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('prefs.title')}
        onMouseDown={(e) => e.stopPropagation()}
        onFocus={onFocusScroll}
      >
        <div className="prefs-header">
          <div className="dialog-title">{t('prefs.title')}</div>
          <button ref={closeRef} className="dialog-btn" onClick={onClose}>
            {t('prefs.close')}
          </button>
        </div>

        <div className="prefs-section">
          <div className="prefs-section-title">{t('prefs.appearance')}</div>
          <label className="prefs-row">
            <span className="prefs-label">{t('prefs.theme')}</span>
            <select
              className="prefs-input"
              value={prefs.theme}
              onChange={(e) => setPreferences({ theme: e.target.value as ThemeMode })}
            >
              <option value="light">{t('prefs.light')}</option>
              <option value="dark">{t('prefs.dark')}</option>
              <option value="system">{t('prefs.system')}</option>
            </select>
          </label>
          <label className="prefs-row">
            <span className="prefs-label">{t('prefs.editorFont')}</span>
            <input
              className="prefs-input"
              type="text"
              value={prefs.editorFontFamily}
              spellCheck={false}
              title={prefs.editorFontFamily}
              onChange={(e) => setPreferences({ editorFontFamily: e.target.value })}
            />
            {/* F07: full value stays readable even when the input ellipsizes —
                small mono mirror + title tooltip on both surfaces. */}
            <span className="prefs-hint prefs-mono" title={prefs.editorFontFamily}>
              {prefs.editorFontFamily}
            </span>
          </label>
          <label className="prefs-row">
            <span className="prefs-label">{t('prefs.fontSize')}</span>
            {num(
              prefs.editorFontSize,
              (v) => setPreferences({ editorFontSize: v }),
              8,
              48
            )}
            <span className="prefs-unit">px</span>
          </label>
          <label className="prefs-row">
            <span className="prefs-label">{t('prefs.lineHeight')}</span>
            {num(
              prefs.editorLineHeight,
              (v) => setPreferences({ editorLineHeight: v }),
              1,
              3,
              0.1
            )}
            <span className="prefs-unit">{t('prefs.lineHeightUnit')}</span>
          </label>
          <label className="prefs-row">
            <span className="prefs-label">{t('prefs.contentWidth')}</span>
            {num(
              prefs.editorMaxWidth,
              (v) => setPreferences({ editorMaxWidth: v }),
              0,
              4000,
              20
            )}
            <span className="prefs-unit">{t('prefs.widthUnit')}</span>
          </label>
        </div>

        <div className="prefs-section">
          <div className="prefs-section-title">{t('prefs.editing')}</div>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.typingAssistsEnabled}
              onChange={(e) => setPreferences({ typingAssistsEnabled: e.target.checked })}
            />
            <span>{t('prefs.typingAssists')}</span>
          </label>
          <label className={`prefs-row prefs-check prefs-sub${prefs.typingAssistsEnabled ? '' : ' prefs-disabled'}`}>
            <input
              type="checkbox"
              disabled={!prefs.typingAssistsEnabled}
              checked={prefs.wrapBareUrlOnPaste}
              onChange={(e) => setPreferences({ wrapBareUrlOnPaste: e.target.checked })}
            />
            <span>{t('prefs.wrapUrl')}</span>
          </label>
          <label className={`prefs-row prefs-check prefs-sub${prefs.typingAssistsEnabled ? '' : ' prefs-disabled'}`}>
            <input
              type="checkbox"
              disabled={!prefs.typingAssistsEnabled}
              checked={prefs.pasteHtmlToMd}
              onChange={(e) => setPreferences({ pasteHtmlToMd: e.target.checked })}
            />
            <span>{t('prefs.pasteHtmlToMd')}</span>
          </label>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.showLineNumbers}
              onChange={(e) => setPreferences({ showLineNumbers: e.target.checked })}
            />
            <span>{t('prefs.showLineNumbers')}</span>
          </label>
          <label className="prefs-row">
            <span className="prefs-label">{t('prefs.codeBlockCollapse')}</span>
            {num(
              prefs.codeBlockCollapseLines,
              (v) => setPreferences({ codeBlockCollapseLines: v }),
              0,
              500
            )}
            <span className="prefs-unit">{t('prefs.codeBlockCollapseUnit')}</span>
          </label>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.codeBlockShowLineNumbers}
              onChange={(e) => setPreferences({ codeBlockShowLineNumbers: e.target.checked })}
            />
            <span>{t('prefs.codeBlockLineNumbers')}</span>
          </label>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.codeBlockWrap}
              onChange={(e) => setPreferences({ codeBlockWrap: e.target.checked })}
            />
            <span>{t('prefs.codeBlockWrap')}</span>
          </label>
        </div>

        <div className="prefs-section">
          <div className="prefs-section-title">{t('prefs.images')}</div>
          <label className="prefs-row">
            <span className="prefs-label">{t('prefs.attachmentDir')}</span>
            <input
              className="prefs-input"
              type="text"
              value={prefs.attachmentDirName}
              spellCheck={false}
              onChange={(e) => setPreferences({ attachmentDirName: e.target.value })}
            />
          </label>
          <label className="prefs-row">
            <span className="prefs-label">{t('prefs.fileNaming')}</span>
            <select
              className="prefs-input"
              value={prefs.imageRenameMode}
              onChange={(e) =>
                setPreferences({ imageRenameMode: e.target.value as ImageRenameMode })
              }
            >
              <option value="timestamp">{t('prefs.namingTimestamp')}</option>
              <option value="keep">{t('prefs.namingKeep')}</option>
            </select>
          </label>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.copyExternalImages}
              onChange={(e) => setPreferences({ copyExternalImages: e.target.checked })}
            />
            <span>{t('prefs.copyExternal')}</span>
          </label>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.downloadRemoteImages}
              onChange={(e) => setPreferences({ downloadRemoteImages: e.target.checked })}
            />
            <span>{t('prefs.downloadRemote')}</span>
          </label>
        </div>

        <div className="prefs-section">
          <div className="prefs-section-title">{t('prefs.workspace')}</div>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.showHiddenFiles}
              onChange={(e) => setPreferences({ showHiddenFiles: e.target.checked })}
            />
            <span>{t('prefs.showHidden')}</span>
          </label>
          <div className="prefs-row prefs-row-stack">
            <span className="prefs-label">{t('prefs.ignoredNames')}</span>
            <textarea
              className="prefs-input prefs-textarea"
              rows={4}
              spellCheck={false}
              value={ignoreDraft}
              onChange={(e) => {
                setIgnoreDraft(e.target.value)
                setPreferences({
                  folderIgnoreNames: e.target.value
                    .split(/\r?\n/)
                    .map((n) => n.trim())
                    .filter((n) => n !== '')
                })
              }}
            />
            <span className="prefs-hint">{t('prefs.ignoredHint')}</span>
          </div>
        </div>

        <div className="prefs-section">
          <div className="prefs-section-title">{t('prefs.autosave')}</div>
          <label className="prefs-row">
            <span className="prefs-label">{t('prefs.autoSave')}</span>
            <select
              className="prefs-input"
              value={prefs.autoSaveMode}
              onChange={(e) =>
                setPreferences({ autoSaveMode: e.target.value as AutoSaveMode })
              }
            >
              <option value="off">{t('prefs.asOff')}</option>
              <option value="debounce">{t('prefs.asDebounce')}</option>
              <option value="interval">{t('prefs.asInterval')}</option>
            </select>
          </label>
          {/* UX-P03 F5: behavior prefs take effect on next input/timer — say so. */}
          <div className="prefs-hint" data-testid="prefs-autosave-hint">
            {t('prefs.autoSaveHint')}
          </div>
          <label
            className={`prefs-row${prefs.autoSaveMode === 'debounce' ? '' : ' prefs-disabled'}`}
          >
            <span className="prefs-label">{t('prefs.debounceDelay')}</span>
            {/* UX-P03-F6: store-clamped on every keystroke (was: raw Number() until
                next-boot sanitize). */}
            {num(
              prefs.autoSaveDelaySec,
              (v) => setPreferences({ autoSaveDelaySec: v }),
              1,
              60,
              1,
              prefs.autoSaveMode !== 'debounce'
            )}
            <span className="prefs-unit">{t('prefs.secondsAfter')}</span>
          </label>
          <label
            className={`prefs-row${prefs.autoSaveMode === 'interval' ? '' : ' prefs-disabled'}`}
          >
            <span className="prefs-label">{t('prefs.interval')}</span>
            {num(
              prefs.autoSaveIntervalMin,
              (v) => setPreferences({ autoSaveIntervalMin: v }),
              1,
              60,
              1,
              prefs.autoSaveMode !== 'interval'
            )}
            <span className="prefs-unit">{t('prefs.minutesBetween')}</span>
          </label>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.crashRecoveryEnabled}
              onChange={(e) => setPreferences({ crashRecoveryEnabled: e.target.checked })}
            />
            <span>{t('prefs.crashRecovery')}</span>
          </label>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.formatOnSave}
              onChange={(e) => setPreferences({ formatOnSave: e.target.checked })}
            />
            <span>{t('prefs.formatOnSave')}</span>
          </label>
        </div>

        <div className="prefs-section">
          <div className="prefs-section-title">{t('prefs.behavior')}</div>
          <label className="prefs-row">
            <span className="prefs-label">{t('prefs.language')}</span>
            <select
              className="prefs-input"
              value={prefs.language}
              onChange={(e) => setPreferences({ language: e.target.value as LanguagePref })}
            >
              <option value="system">{t('prefs.langSystem')}</option>
              <option value="zh">{t('prefs.langZh')}</option>
              <option value="en">{t('prefs.langEn')}</option>
            </select>
          </label>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.showStatusBar}
              onChange={(e) => setPreferences({ showStatusBar: e.target.checked })}
            />
            <span>{t('prefs.showStatusBar')}</span>
          </label>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.externalLinkConfirm}
              onChange={(e) => setPreferences({ externalLinkConfirm: e.target.checked })}
            />
            <span>{t('prefs.externalLinkConfirm')}</span>
          </label>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.restoreLastSession}
              onChange={(e) => setPreferences({ restoreLastSession: e.target.checked })}
            />
            <span>{t('prefs.restoreSession')}</span>
          </label>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.sidebarDefaultOpen}
              onChange={(e) => setPreferences({ sidebarDefaultOpen: e.target.checked })}
            />
            <span>{t('prefs.sidebarDefault')}</span>
          </label>
          <div className="prefs-row prefs-row-actions">
            <button
              className="dialog-btn"
              onClick={() => {
                void clearRecentFiles()
              }}
            >
              {t('prefs.clearRecent')}
            </button>
            {/* UX-P03-F1: settings reset to DEFAULT_PREFERENCES after a danger
                confirm. Session state (recents, tabs, folds) is untouched. */}
            <button
              className="dialog-btn"
              onClick={() => {
                void (async () => {
                  const ok = await dialog.confirm({
                    title: t('prefs.resetDefaults'),
                    message: t('prefs.resetDefaultsMessage'),
                    confirmLabel: t('prefs.resetDefaults'),
                    danger: true
                  })
                  if (ok) setPreferences({ ...DEFAULT_PREFERENCES })
                })()
              }}
            >
              {t('prefs.resetDefaults')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
