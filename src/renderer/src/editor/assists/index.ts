import { Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { editingAssistsConfigFacet, type EditingAssistsConfig } from './config'
import { htmlPasteEventHandler } from './htmlPaste'
import { assembleAssistsKeymap } from './keymap'
import { pasteEventHandler } from './paste'

export function editingAssistsExtension(config: EditingAssistsConfig): Extension {
  return [
    editingAssistsConfigFacet.of(config),
    Prec.highest(keymap.of(assembleAssistsKeymap(config))),
    ...(config.enabled
      ? [
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
