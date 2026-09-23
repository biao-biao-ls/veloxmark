import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import { GFM } from '@lezer/markdown'
import { search, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState, Extension } from '@codemirror/state'
import { closeBrackets } from '@codemirror/autocomplete'
import { EditorView, highlightActiveLine, keymap, lineNumbers, drawSelection } from '@codemirror/view'
import {
  editingAssistsCompartment,
  editingAssistsExtension,
  getEditingAssists,
  persistEditingAssistsConfig,
  type EditingAssistsConfig
} from './assists'
import { imageInputExtension } from './images'
import { imageSizeMarkdown } from './markdown-image-ext'
import { foldField, foldGutterExtension, foldPlaceholderClickExtension, getFoldedKeys, toggleFold, restoreFolds, expandFolds } from './livePreview/fold'
import './contextMenu/opsBlocks'
import { calloutClickExtension, calloutFoldField } from './livePreview/calloutFold'
import { codeBlockUiField } from './livePreview/codeBlockUi'
import { linkNavExtension } from './livePreview/linkNav'
import { modeClassesExtension, typewriterExtension } from './modes'
import { getPreferences } from '../preferences/store'
import {
  getLivePreviewConfig,
  livePreviewConfigCompartment,
  livePreviewConfigExtension,
  livePreviewConfigFacet,
  livePreviewField,
  type LivePreviewConfig
} from './livePreview'
import { tableEditField } from './table/state'
import { tableEditLifecycle } from './table/lifecycle'
import { setNestedPreviewField } from './table/widget'
import { getCtxRuntime, handleEditorContextMenu } from './contextMenu/registry'
import { compartmentThemes, ThemeName } from './theme'

export const themeCompartment = new Compartment()
/** Holds markdown() so addKeymap/pasteURLAsLink can follow the assists toggle. */
export const markdownCompartment = new Compartment()
/** Holds lineNumbers() so the P03 preferences toggle can swap it live. */
export const gutterCompartment = new Compartment()

export interface EditorCallbacks {
  onChange: (doc: string) => void
  onSelectionChanged: () => void
  /** Fired when the syntax tree advanced (async parse chunks completing). */
  onTreeChanged: () => void
  /** P18: fold set changed via toggle/restore/expand effects. */
  onFoldChanged?: () => void
  /**
   * P05: assets need a document directory — resolves true once the document
   * has a path (Save As ran), false when the user cancelled.
   */
  ensureSaved: () => Promise<boolean>
}

/** markdown() configured for the current assists state. */
function markdownSupport(assists: EditingAssistsConfig): Extension {
  return markdown({
    // imageSizeMarkdown (P05) claims ![a](src =WxH) before the built-in link
    // scan, which would otherwise collapse the node to a broken stub.
    extensions: [GFM, imageSizeMarkdown],
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
  assists: EditingAssistsConfig,
  showLineNumbers: boolean
): Extension[] {
  // 1D cycle break: nested table-cell editors share the live-preview field.
  // Wired here (not imported inside table/widget) so the import chain
  // build → handlers → table/widget never points back into livePreview/field.
  setNestedPreviewField(livePreviewField)
  return [
    // F06: fold gutter renders LEFT of the line numbers so the number column
    // sits flush against the content box — the fold arrows no longer eat the
    // number→prose dead zone (see layer-a F06 batch).
    foldGutterExtension,
    gutterCompartment.of(showLineNumbers ? lineNumbers() : []),
    // P18 heading folds: placeholder-click reopen. lineNumbers toggles
    // independently via its own compartment above.
    foldPlaceholderClickExtension,
    // P21 callouts: head-line/`⋯ N 行` chip click toggles the body fold.
    calloutClickExtension,
    history(),
    drawSelection(),
    highlightActiveLine(),
    search({ top: true }),
    markdownCompartment.of(markdownSupport(assists)),
    EditorState.allowMultipleSelections.of(true),
    EditorView.lineWrapping,
    livePreviewField,
    // P18: folded heading keys (`level:text`) — the field the gutter, fold
    // decorations and session restore all read/write.
    foldField,
    // P21: callout fold overrides (Map key = `lineFrom|TYPE`); defaults still
    // parse from the source `+/-` markers at build time.
    calloutFoldField,
    // P10: active table cell / session column widths — drives enterTable.
    tableEditField,
    // UX-P28: table focus lifecycle — auto-exit on selection-leave + Escape exit.
    tableEditLifecycle,
    // P24: code-block expand memory (content-hash keyed, session-only).
    codeBlockUiField,
    // P08 mode flags are read from the store (not the args): this runs once at
    // editor creation, and the App effect keeps them in sync afterwards.
    livePreviewConfigExtension({
      theme,
      baseDir: '',
      imageEpoch: 0,
      linkEpoch: 0,
      mode: getPreferences().sourceMode ? 'source' : 'live',
      focusMode: getPreferences().focusMode,
      typewriterMode: getPreferences().typewriterMode,
      codeBlockCollapseLines: getPreferences().codeBlockCollapseLines,
      codeBlockShowLineNumbers: getPreferences().codeBlockShowLineNumbers,
      codeBlockWrap: getPreferences().codeBlockWrap
    }),
    modeClassesExtension,
    typewriterExtension(),
    editingAssistsCompartment.of(editingAssistsExtension(assists)),
    // P17: modifier-click navigation + hover tooltip for rendered links.
    linkNavExtension,
    // Image paste/drop is core behavior — always on (Prec.high inside).
    imageInputExtension(callbacks.ensureSaved),
    themeCompartment.of(compartmentThemes[theme]),
    // UX-P01 F6 (Typora parity): auto-pair brackets/quotes. The installed
    // @codemirror/autocomplete exposes closeBrackets() with no args — bracket
    // lists are steered through language data when narrowing becomes necessary;
    // the engine itself skips closing before word chars (apostrophe-safe).
    closeBrackets(),
    keymap.of([...searchKeymap, ...historyKeymap, ...defaultKeymap, indentWithTab]),
    // P27: unified editor context menu — editor surface only. Chrome panels,
    // existing float menus and the table widget's own cell handler own their
    // contextmenu paths; this handler never swallows theirs.
    EditorView.domEventHandlers({
      contextmenu(e, view) {
        const target = e.target
        if (!(target instanceof HTMLElement)) return false
        if (
          target.closest(
            '.menubar, .titlebar, .tabs, .sidebar, .tree-panel, .prefs-overlay, .dialog-overlay, .velox-ctx-menu, .editor-context-menu, .tree-menu, .tab-context-menu, .cm-md-table, .cm-md-image-toolbar, .cm-md-block-toolbar'
          )
        ) {
          return false
        }
        if (!target.closest('.cm-editor')) return false
        if (!getCtxRuntime()) return false
        handleEditorContextMenu(view, e)
        return true
      }
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) callbacks.onChange(update.state.doc.toString())
      if (update.selectionSet) callbacks.onSelectionChanged()
      if (syntaxTree(update.startState) !== syntaxTree(update.state)) {
        callbacks.onTreeChanged()
      }
      // P18: fold set changes — effect-driven toggles/restores (no doc or
      // selection change) plus identity flips from auto-expand (selection
      // jumps) and the docChanged key-drop filter, which emit no effects.
      const foldTouched =
        update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(toggleFold) || e.is(restoreFolds) || e.is(expandFolds))
        ) || getFoldedKeys(update.startState) !== getFoldedKeys(update.state)
      if (foldTouched) callbacks.onFoldChanged?.()
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
 * P05: force a decoration rebuild so ImageWidgets re-resolve their srcs.
 * Call after clearing the image cache (file watcher / window focus).
 */
export function bumpImageEpoch(view: EditorView): void {
  const config = getLivePreviewConfig(view.state)
  view.dispatch({
    effects: livePreviewConfigCompartment.reconfigure(
      livePreviewConfigFacet.of({ ...config, imageEpoch: config.imageEpoch + 1 })
    )
  })
}

/**
 * P17: force a decoration rebuild after link-existence cache updates
 * (folder watcher / save / window focus — 仿 bumpImageEpoch).
 */
export function bumpLinkEpoch(view: EditorView): void {
  const config = getLivePreviewConfig(view.state)
  view.dispatch({
    effects: livePreviewConfigCompartment.reconfigure(
      livePreviewConfigFacet.of({ ...config, linkEpoch: config.linkEpoch + 1 })
    )
  })
}

/**
 * wave④/P18-F6: force a decoration rebuild after a language flip so widgets
 * whose DOM embeds t() strings (fold/callout chips, table toolbar chrome)
 * re-render — their eq() carries lang/i18nEpoch, otherwise CM6 reuses the
 * stale DOM across the facet bump.
 */
export function bumpI18nEpoch(view: EditorView): void {
  const config = getLivePreviewConfig(view.state)
  view.dispatch({
    effects: livePreviewConfigCompartment.reconfigure(
      livePreviewConfigFacet.of({ ...config, i18nEpoch: (config.i18nEpoch ?? 0) + 1 })
    )
  })
}

/** Toggle the line-number gutter (P03 preferences). */
export function updateShowLineNumbers(view: EditorView, show: boolean): void {
  view.dispatch({ effects: gutterCompartment.reconfigure(show ? lineNumbers() : []) })
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
