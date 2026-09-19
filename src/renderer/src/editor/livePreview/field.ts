import { syntaxTree } from '@codemirror/language'
import { StateField } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import { tableEditField } from '../table/state'
import { buildDecorations } from './build'
import { getLivePreviewConfig } from './config'
import { foldField } from './fold'
import { calloutFoldField } from './calloutFold'

/**
 * Live-preview decorations.
 *
 * NOTE: CodeMirror only allows block widgets and multi-line replace decorations
 * from state fields (not view plugins), which is why this is a StateField.
 *
 * Rebuilds on doc/selection changes, on async syntax-tree advances, and when
 * the config facet changes (theme/baseDir reconfigure) — the latter replaces
 * the old forceRefresh effect.
 */
export const livePreviewField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state, getLivePreviewConfig(state))
  },
  update(value, tr) {
    // The markdown parser works asynchronously in chunks and announces new
    // trees via a transaction without doc/selection changes — rebuild then too.
    const treeChanged = syntaxTree(tr.startState) !== syntaxTree(tr.state)
    const configChanged =
      getLivePreviewConfig(tr.startState) !== getLivePreviewConfig(tr.state)
    // P10: activating/moving/clearing a table cell editor changes no doc text
    // or CM selection — rebuild when the table-edit state field changes.
    // Optional field access: DOM-less snapshot states may omit tableEditField.
    const tableEditChanged =
      tr.state.field(tableEditField, false) !== tr.startState.field(tableEditField, false)
    // P18: fold toggles arrive as effect-only transactions (no doc/selection
    // change) — rebuild whenever the fold set identity changes.
    const foldChanged = tr.state.field(foldField, false) !== tr.startState.field(foldField, false)
    // P21: callout fold overrides — same effect-only identity signal.
    const calloutFoldChanged =
      tr.state.field(calloutFoldField, false) !== tr.startState.field(calloutFoldField, false)
    if (
      tr.docChanged ||
      tr.selection ||
      treeChanged ||
      configChanged ||
      tableEditChanged ||
      foldChanged ||
      calloutFoldChanged
    ) {
      return buildDecorations(tr.state, getLivePreviewConfig(tr.state))
    }
    return value.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f)
})
