import { Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { editingAssistsConfigFacet, type EditingAssistsConfig } from './config'
import { htmlPasteEventHandler } from './htmlPaste'
import { assembleAssistsKeymap } from './keymap'
import { pasteEventHandler } from './paste'

/**
 * Assemble the editing-assists extension for one config.
 *
 * The config facet is always present (so getEditingAssists keeps working).
 * The keymap always carries the Mod-b/i/e format chords (they are not typing
 * assists — the menu echo Ctrl+B/I/E must keep its keyboard channel even when
 * `typingAssistsEnabled` is off); typing-assist keys and the paste transforms
 * are dropped when `enabled` is false, restoring plain CM6 behavior. Handlers
 * also re-check the facet at run time as a double gate.
 */
export function editingAssistsExtension(config: EditingAssistsConfig): Extension {
  return [
    editingAssistsConfigFacet.of(config),
    // Must outrank lang-markdown's Prec.high Enter (insertNewlineContinueMarkup).
    Prec.highest(keymap.of(assembleAssistsKeymap(config))),
    // Typing-assist paste transforms stay gated by `enabled`.
    ...(config.enabled
      ? [
          // P19 before P01: a text/html payload claims the paste when `pasteHtmlToMd`
          // is on; both handlers fall through on a null transform, so plain-text URL
          // rules still apply to pure-text clipboards.
          EditorView.domEventHandlers({
            paste: (event, view) => htmlPasteEventHandler(event, view) || pasteEventHandler(event, view)
          })
        ]
      : [])
  ]
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
