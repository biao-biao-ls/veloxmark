import type { EditorView, KeyBinding } from '@codemirror/view'
import type { EditingAssistsConfig } from './config'
import { exitEmptyListItem, insertHorizontalRule } from './enter'
import { upgradeHeading } from './heading'
import { indentListItem } from './lists'
import { wrapSelectionWith } from './wrap'

/**
 * Inline-format chords (Mod-b/i/e) — NOT typing-assist behavior.
 *
 * fix-biz IT-02/PATH-01: these three keys are the only keyboard channel behind
 * the menu echo Ctrl+B/I/E (menuLayout derives it unconditionally), so they are
 * mounted regardless of `typingAssistsEnabled` and must never sit behind the
 * `config.enabled` gate.
 */
export interface FormatChord {
  key: string
  /** Wrap mark passed to wrapSelectionWith (e.g. `**` for bold). */
  mark: string
}

export const FORMAT_CHORDS: readonly FormatChord[] = [
  { key: 'Mod-b', mark: '**' },
  { key: 'Mod-i', mark: '*' },
  { key: 'Mod-e', mark: '`' }
]

/** Always-mounted format keymap entries. */
export function formatKeyBindings(): KeyBinding[] {
  return FORMAT_CHORDS.map(({ key, mark }) => ({
    key,
    run: (view: EditorView) => wrapSelectionWith(view, mark),
    preventDefault: true
  }))
}

/**
 * Typing-assist entries — mounted only while `config.enabled` (handlers also
 * re-check the facet at run time as a double gate).
 */
export function typingAssistKeyBindings(): KeyBinding[] {
  return [
    // Must outrank lang-markdown's Prec.high Enter (insertNewlineContinueMarkup).
    // UX-P01 F2: empty-item exit must outrank hr + list-continue.
    { key: 'Enter', run: exitEmptyListItem },
    { key: 'Enter', run: insertHorizontalRule },
    { key: 'Tab', run: (view) => indentListItem(view, 1) },
    { key: 'Shift-Tab', run: (view) => indentListItem(view, -1) },
    { key: '#', run: upgradeHeading }
  ]
}

/**
 * Pure keymap assembly: format chords always; typing-assist keys only when
 * assists are enabled. (Handler-level gates stay as the second fence.)
 */
export function assembleAssistsKeymap(config: EditingAssistsConfig): KeyBinding[] {
  return [...formatKeyBindings(), ...(config.enabled ? typingAssistKeyBindings() : [])]
}
