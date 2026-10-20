import { syntaxTree } from '@codemirror/language'
import { StateField } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import { tableEditField } from '../table/state'
import { buildDecorations } from './build'
import { getLivePreviewConfig } from './config'
import { foldField } from './fold'
import { calloutFoldField } from './calloutFold'
import { quoteFoldField } from './quoteFold'
import { codeBlockUiField } from './codeBlockUi'

export const livePreviewField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state, getLivePreviewConfig(state))
  },
  update(value, tr) {
    const treeChanged = syntaxTree(tr.startState) !== syntaxTree(tr.state)
    const configChanged =
      getLivePreviewConfig(tr.startState) !== getLivePreviewConfig(tr.state)
    const tableEditChanged =
      tr.state.field(tableEditField, false) !== tr.startState.field(tableEditField, false)
    const foldChanged = tr.state.field(foldField, false) !== tr.startState.field(foldField, false)
    const calloutFoldChanged =
      tr.state.field(calloutFoldField, false) !== tr.startState.field(calloutFoldField, false)
    const quoteFoldChanged =
      tr.state.field(quoteFoldField, false) !== tr.startState.field(quoteFoldField, false)
    const codeBlockUiChanged =
      tr.state.field(codeBlockUiField, false) !== tr.startState.field(codeBlockUiField, false)
    if (
      tr.docChanged ||
      tr.selection ||
      treeChanged ||
      configChanged ||
      tableEditChanged ||
      foldChanged ||
      calloutFoldChanged ||
      quoteFoldChanged ||
      codeBlockUiChanged
    ) {
      return buildDecorations(tr.state, getLivePreviewConfig(tr.state))
    }
    return value.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f)
})
