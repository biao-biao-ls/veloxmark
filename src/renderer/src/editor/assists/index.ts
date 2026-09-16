import { Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { editingAssistsConfigFacet, type EditingAssistsConfig } from './config'
import { insertHorizontalRule } from './enter'
import { upgradeHeading } from './heading'
import { indentListItem } from './lists'
import { pasteEventHandler } from './paste'
import { wrapSelectionWith } from './wrap'

/**
 * Assemble the editing-assists extension for one config.
 *
 * The config facet is always present (so getEditingAssists keeps working);
 * the behavior extensions are dropped entirely when `enabled` is false,
 * restoring plain CM6 behavior. Handlers also re-check the facet at run
 * time as a double gate.
 */
export function editingAssistsExtension(config: EditingAssistsConfig): Extension {
  const behavior: Extension = [
    // Must outrank lang-markdown's Prec.high Enter (insertNewlineContinueMarkup).
    Prec.highest(
      keymap.of([
        { key: 'Enter', run: insertHorizontalRule },
        { key: 'Mod-b', run: (view) => wrapSelectionWith(view, '**'), preventDefault: true },
        { key: 'Mod-i', run: (view) => wrapSelectionWith(view, '*'), preventDefault: true },
        { key: 'Mod-e', run: (view) => wrapSelectionWith(view, '`'), preventDefault: true },
        { key: 'Tab', run: (view) => indentListItem(view, 1) },
        { key: 'Shift-Tab', run: (view) => indentListItem(view, -1) },
        { key: '#', run: upgradeHeading }
      ])
    ),
    EditorView.domEventHandlers({ paste: pasteEventHandler })
  ]
  return [editingAssistsConfigFacet.of(config), ...(config.enabled ? [behavior] : [])]
}

export {
  DEFAULT_EDITING_ASSISTS_CONFIG,
  editingAssistsCompartment,
  editingAssistsConfigFacet,
  getEditingAssists,
  persistEditingAssistsConfig,
  readEditingAssistsConfig,
  type EditingAssistsConfig
} from './config'
export { transformPaste } from './paste'
export { wrapSelectionWith } from './wrap'
