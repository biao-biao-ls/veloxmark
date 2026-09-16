import { syntaxTree } from '@codemirror/language'
import { StateField } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import { buildDecorations } from './build'
import { getLivePreviewConfig } from './config'

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
    if (tr.docChanged || tr.selection || treeChanged || configChanged) {
      return buildDecorations(tr.state, getLivePreviewConfig(tr.state))
    }
    return value.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f)
})
