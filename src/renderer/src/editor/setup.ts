import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import { GFM } from '@lezer/markdown'
import { search, searchKeymap } from '@codemirror/search'
import { Compartment, EditorSelection, EditorState, Extension } from '@codemirror/state'
import {
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
  drawSelection
} from '@codemirror/view'
import { livePreviewField, forceRefresh } from './livePreview'
import { compartmentThemes, ThemeName } from './theme'

export const themeCompartment = new Compartment()

export interface EditorCallbacks {
  onChange: (doc: string) => void
  onSelectionChanged: () => void
  /** Fired when the syntax tree advanced (async parse chunks completing). */
  onTreeChanged: () => void
}

/** Wrap the current selection with `mark`, e.g. ** for bold. */
function wrapSelectionWith(view: EditorView, mark: string): boolean {
  const { state } = view
  const changes = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to)
    const insert = `${mark}${selected}${mark}`
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(
        range.from + mark.length,
        range.from + mark.length + selected.length
      )
    }
  })
  view.dispatch(changes, { scrollIntoView: true })
  return true
}

const markdownEditingKeymap = keymap.of([
  {
    key: 'Mod-b',
    run: (view) => wrapSelectionWith(view, '**'),
    preventDefault: true
  },
  {
    key: 'Mod-i',
    run: (view) => wrapSelectionWith(view, '*'),
    preventDefault: true
  },
  {
    key: 'Mod-e',
    run: (view) => wrapSelectionWith(view, '`'),
    preventDefault: true
  }
])

export function createExtensions(callbacks: EditorCallbacks, theme: ThemeName): Extension[] {
  return [
    lineNumbers(),
    history(),
    drawSelection(),
    highlightActiveLine(),
    search({ top: true }),
    markdown({
      extensions: [GFM],
      addKeymap: true
    }),
    EditorState.allowMultipleSelections.of(true),
    EditorView.lineWrapping,
    livePreviewField,
    themeCompartment.of(compartmentThemes[theme]),
    markdownEditingKeymap,
    keymap.of([...searchKeymap, ...historyKeymap, ...defaultKeymap, indentWithTab]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) callbacks.onChange(update.state.doc.toString())
      if (update.selectionSet) callbacks.onSelectionChanged()
      if (syntaxTree(update.startState) !== syntaxTree(update.state)) {
        callbacks.onTreeChanged()
      }
    })
  ]
}

export function refreshLivePreview(view: EditorView): void {
  view.dispatch({ effects: forceRefresh.of(null) })
}

export function reconfigureTheme(view: EditorView, theme: ThemeName): void {
  view.dispatch({
    effects: [
      themeCompartment.reconfigure(compartmentThemes[theme]),
      forceRefresh.of(null)
    ]
  })
}
