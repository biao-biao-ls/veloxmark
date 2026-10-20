import type { EditorView, KeyBinding } from '@codemirror/view'
import type { EditingAssistsConfig } from './config'
import { exitEmptyListItem, insertHorizontalRule } from './enter'
import { upgradeHeading } from './heading'
import { indentListItem } from './lists'
import { wrapSelectionWith } from './wrap'

export interface FormatChord {
  key: string
  mark: string
}

export const FORMAT_CHORDS: readonly FormatChord[] = [
  { key: 'Mod-b', mark: '**' },
  { key: 'Mod-i', mark: '*' },
  { key: 'Mod-e', mark: '`' }
]

export function formatKeyBindings(): KeyBinding[] {
  return FORMAT_CHORDS.map(({ key, mark }) => ({
    key,
    run: (view: EditorView) => wrapSelectionWith(view, mark),
    preventDefault: true
  }))
}

export function typingAssistKeyBindings(): KeyBinding[] {
  return [
    { key: 'Enter', run: exitEmptyListItem },
    { key: 'Enter', run: insertHorizontalRule },
    { key: 'Tab', run: (view) => indentListItem(view, 1) },
    { key: 'Shift-Tab', run: (view) => indentListItem(view, -1) },
    { key: '#', run: upgradeHeading }
  ]
}

export function assembleAssistsKeymap(config: EditingAssistsConfig): KeyBinding[] {
  return [...formatKeyBindings(), ...(config.enabled ? typingAssistKeyBindings() : [])]
}
