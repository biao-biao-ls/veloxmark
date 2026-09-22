import { Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { editingAssistsConfigFacet, type EditingAssistsConfig } from './config'
import { exitEmptyListItem, insertHorizontalRule } from './enter'
import { upgradeHeading } from './heading'
import { indentListItem } from './lists'
import { htmlPasteEventHandler } from './htmlPaste'
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
        // UX-P01 F2: empty-item exit must outrank hr + list-continue.
        { key: 'Enter', run: exitEmptyListItem },
        { key: 'Enter', run: insertHorizontalRule },
        { key: 'Mod-b', run: (view) => wrapSelectionWith(view, '**'), preventDefault: true },
        { key: 'Mod-i', run: (view) => wrapSelectionWith(view, '*'), preventDefault: true },
        { key: 'Mod-e', run: (view) => wrapSelectionWith(view, '`'), preventDefault: true },
        { key: 'Tab', run: (view) => indentListItem(view, 1) },
        { key: 'Shift-Tab', run: (view) => indentListItem(view, -1) },
        { key: '#', run: upgradeHeading }
      ])
    ),
    // P19 before P01: a text/html payload claims the paste when `pasteHtmlToMd`
    // is on; both handlers fall through on a null transform, so plain-text URL
    // rules still apply to pure-text clipboards.
    EditorView.domEventHandlers({
      paste: (event, view) => htmlPasteEventHandler(event, view) || pasteEventHandler(event, view)
    })
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
export {
  applyHtmlPaste,
  htmlPasteEventHandler,
  runMenuPaste,
  setHtmlPasteFallbackNotice
} from './htmlPaste'
export {
  collectImageSrcs,
  faultNextHtmlTransformOnce,
  htmlToMarkdown,
  htmlToMarkdownSafe
} from './htmlToMd'
export { transformPaste } from './paste'
export { wrapSelectionWith } from './wrap'
