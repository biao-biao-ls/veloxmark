import { useEffect, useRef, useState } from 'react'
import {
  clearRecentFiles,
  setPreferences,
  type ImageRenameMode,
  type ThemeMode
} from '../preferences/store'
import { usePreferences } from '../preferences/useStore'

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
  // P07: the ignore list is edited line-by-line; a local draft keeps the
  // in-progress trailing newline out of the store (sanitize drops empty
  // entries, which would yank the cursor mid-edit).
  const [ignoreDraft, setIgnoreDraft] = useState(() => prefs.folderIgnoreNames.join('\n'))

  useEffect(() => {
    if (open) {
      closeRef.current?.focus()
      setIgnoreDraft(prefs.folderIgnoreNames.join('\n'))
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

  const num = (value: number, onChange: (v: number) => void, min: number, max: number, step = 1) => (
    <input
      className="prefs-input prefs-input-num"
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = Number(e.target.value)
        if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)))
      }}
    />
  )

  return (
    <div className="dialog-overlay prefs-overlay" onKeyDown={onKeyDown} onMouseDown={onClose}>
      <div
        className="dialog prefs-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Preferences"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="prefs-header">
          <div className="dialog-title">Preferences</div>
          <button ref={closeRef} className="dialog-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="prefs-section">
          <div className="prefs-section-title">Appearance</div>
          <label className="prefs-row">
            <span className="prefs-label">Theme</span>
            <select
              className="prefs-input"
              value={prefs.theme}
              onChange={(e) => setPreferences({ theme: e.target.value as ThemeMode })}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
          <label className="prefs-row">
            <span className="prefs-label">Editor font</span>
            <input
              className="prefs-input"
              type="text"
              value={prefs.editorFontFamily}
              spellCheck={false}
              onChange={(e) => setPreferences({ editorFontFamily: e.target.value })}
            />
          </label>
          <label className="prefs-row">
            <span className="prefs-label">Font size</span>
            {num(
              prefs.editorFontSize,
              (v) => setPreferences({ editorFontSize: v }),
              8,
              48
            )}
            <span className="prefs-unit">px</span>
          </label>
          <label className="prefs-row">
            <span className="prefs-label">Line height</span>
            {num(
              prefs.editorLineHeight,
              (v) => setPreferences({ editorLineHeight: v }),
              1,
              3,
              0.1
            )}
          </label>
          <label className="prefs-row">
            <span className="prefs-label">Content width</span>
            {num(
              prefs.editorMaxWidth,
              (v) => setPreferences({ editorMaxWidth: v }),
              0,
              4000,
              20
            )}
            <span className="prefs-unit">px (0 = full width)</span>
          </label>
        </div>

        <div className="prefs-section">
          <div className="prefs-section-title">Editing</div>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.typingAssistsEnabled}
              onChange={(e) => setPreferences({ typingAssistsEnabled: e.target.checked })}
            />
            <span>Typing assists (lists, headings, paste transforms)</span>
          </label>
          <label className={`prefs-row prefs-check prefs-sub${prefs.typingAssistsEnabled ? '' : ' prefs-disabled'}`}>
            <input
              type="checkbox"
              disabled={!prefs.typingAssistsEnabled}
              checked={prefs.wrapBareUrlOnPaste}
              onChange={(e) => setPreferences({ wrapBareUrlOnPaste: e.target.checked })}
            />
            <span>Wrap pasted URLs as &lt;url&gt;</span>
          </label>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.showLineNumbers}
              onChange={(e) => setPreferences({ showLineNumbers: e.target.checked })}
            />
            <span>Show line numbers</span>
          </label>
        </div>

        <div className="prefs-section">
          <div className="prefs-section-title">Images</div>
          <label className="prefs-row">
            <span className="prefs-label">Attachment folder</span>
            <input
              className="prefs-input"
              type="text"
              value={prefs.attachmentDirName}
              spellCheck={false}
              onChange={(e) => setPreferences({ attachmentDirName: e.target.value })}
            />
          </label>
          <label className="prefs-row">
            <span className="prefs-label">File naming</span>
            <select
              className="prefs-input"
              value={prefs.imageRenameMode}
              onChange={(e) =>
                setPreferences({ imageRenameMode: e.target.value as ImageRenameMode })
              }
            >
              <option value="timestamp">Timestamp (img-20260917-142530.png)</option>
              <option value="keep">Keep original name</option>
            </select>
          </label>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.copyExternalImages}
              onChange={(e) => setPreferences({ copyExternalImages: e.target.checked })}
            />
            <span>Copy images from outside the document folder into attachments</span>
          </label>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.downloadRemoteImages}
              onChange={(e) => setPreferences({ downloadRemoteImages: e.target.checked })}
            />
            <span>Download pasted/dropped remote image URLs into attachments</span>
          </label>
        </div>

        <div className="prefs-section">
          <div className="prefs-section-title">Workspace</div>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.showHiddenFiles}
              onChange={(e) => setPreferences({ showHiddenFiles: e.target.checked })}
            />
            <span>Show hidden files (dot-prefixed) in the file tree</span>
          </label>
          <div className="prefs-row prefs-row-stack">
            <span className="prefs-label">Ignored names</span>
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
            <span className="prefs-hint">
              One entry per line, matched against file/folder names; supports * and ?
              wildcards. Changes apply to the tree immediately.
            </span>
          </div>
        </div>

        <div className="prefs-section">
          <div className="prefs-section-title">Behavior</div>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.restoreLastSession}
              onChange={(e) => setPreferences({ restoreLastSession: e.target.checked })}
            />
            <span>Restore last opened file and folder on startup</span>
          </label>
          <label className="prefs-row prefs-check">
            <input
              type="checkbox"
              checked={prefs.sidebarDefaultOpen}
              onChange={(e) => setPreferences({ sidebarDefaultOpen: e.target.checked })}
            />
            <span>Sidebar open by default (when no session is remembered)</span>
          </label>
          <div className="prefs-row">
            <button
              className="dialog-btn"
              onClick={() => {
                void clearRecentFiles()
              }}
            >
              Clear Recent Files
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
