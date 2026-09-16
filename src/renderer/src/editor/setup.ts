import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import { GFM } from '@lezer/markdown'
import { search, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState, Extension } from '@codemirror/state'
import { EditorView, highlightActiveLine, keymap, lineNumbers, drawSelection } from '@codemirror/view'
import {
  editingAssistsCompartment,
  editingAssistsExtension,
  getEditingAssists,
  persistEditingAssistsConfig,
  type EditingAssistsConfig
} from './assists'
import {
  getLivePreviewConfig,
  livePreviewConfigCompartment,
  livePreviewConfigExtension,
  livePreviewConfigFacet,
  livePreviewField,
  type LivePreviewConfig
} from './livePreview'
import { compartmentThemes, ThemeName } from './theme'

export const themeCompartment = new Compartment()
/** Holds markdown() so addKeymap/pasteURLAsLink can follow the assists toggle. */
export const markdownCompartment = new Compartment()

export interface EditorCallbacks {
  onChange: (doc: string) => void
  onSelectionChanged: () => void
  /** Fired when the syntax tree advanced (async parse chunks completing). */
  onTreeChanged: () => void
}

/** markdown() configured for the current assists state. */
function markdownSupport(assists: EditingAssistsConfig): Extension {
  return markdown({
    extensions: [GFM],
    // When assists are off, drop lang-markdown's Enter list-continuation and
    // paste-URL-as-link so behavior reverts to plain CM6.
    addKeymap: assists.enabled,
    // Selection+URL paste is handled by our own transformPaste (gated).
    pasteURLAsLink: false
  })
}

export function createExtensions(
  callbacks: EditorCallbacks,
  theme: ThemeName,
  assists: EditingAssistsConfig
): Extension[] {
  return [
    lineNumbers(),
    history(),
    drawSelection(),
    highlightActiveLine(),
    search({ top: true }),
    markdownCompartment.of(markdownSupport(assists)),
    EditorState.allowMultipleSelections.of(true),
    EditorView.lineWrapping,
    livePreviewField,
    livePreviewConfigExtension({ theme, baseDir: '' }),
    editingAssistsCompartment.of(editingAssistsExtension(assists)),
    themeCompartment.of(compartmentThemes[theme]),
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

/** Patch the live-preview config (theme/baseDir); decorations rebuild via the facet. */
export function updateLivePreviewConfig(
  view: EditorView,
  patch: Partial<LivePreviewConfig>
): void {
  const next = { ...getLivePreviewConfig(view.state), ...patch }
  view.dispatch({
    effects: livePreviewConfigCompartment.reconfigure(livePreviewConfigFacet.of(next))
  })
}

/** Switch the editor theme: highlight compartment + live-preview config facet. */
export function reconfigureTheme(view: EditorView, theme: ThemeName): void {
  view.dispatch({
    effects: [
      themeCompartment.reconfigure(compartmentThemes[theme]),
      livePreviewConfigCompartment.reconfigure(
        livePreviewConfigFacet.of({ ...getLivePreviewConfig(view.state), theme })
      )
    ]
  })
}

/**
 * Patch the editing-assists config, persist it, and reconfigure both the
 * assists compartment and markdown() keymap support.
 */
export function updateEditingAssists(
  view: EditorView,
  patch: Partial<EditingAssistsConfig>
): void {
  const next = { ...getEditingAssists(view.state), ...patch }
  persistEditingAssistsConfig(patch)
  view.dispatch({
    effects: [
      editingAssistsCompartment.reconfigure(editingAssistsExtension(next)),
      markdownCompartment.reconfigure(markdownSupport(next))
    ]
  })
}
