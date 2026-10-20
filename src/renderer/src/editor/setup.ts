import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { bracketMatching, indentOnInput, syntaxTree } from '@codemirror/language'
import { toggleComment } from '@codemirror/commands'
import { GFM } from '@lezer/markdown'
import { search, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState, Extension } from '@codemirror/state'
import { autocompletion, closeBrackets } from '@codemirror/autocomplete'
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
import { foldField, foldClickExtension, getFoldedKeys, toggleFold, restoreFolds, expandFolds } from './livePreview/fold'
import './contextMenu/opsBlocks'
import { calloutClickExtension, calloutFoldField } from './livePreview/calloutFold'
import {
  getQuoteFoldedKeys,
  quoteFoldClickExtension,
  quoteFoldField,
  restoreQuoteFolds,
  toggleQuoteFold
} from './livePreview/quoteFold'
import { codeBlockUiField } from './livePreview/codeBlockUi'
import { mermaidLastGoodRemap } from './mermaid/errMemory'
import { linkNavExtension } from './livePreview/linkNav'
import { hoverZonesExtension } from './livePreview/hoverZones'
import { modeClassesExtension, typewriterExtension } from './modes'
import { undoWithAck } from '../hooks/useToast'
import { getPreferences, setPreferences } from '../preferences/store'
import {
  getLivePreviewConfig,
  livePreviewConfigCompartment,
  livePreviewConfigExtension,
  livePreviewConfigFacet,
  livePreviewField,
  type LivePreviewConfig
} from './livePreview'
import {
  getTableEdit,
  restoreColWidths,
  setColWidth,
  tableEditField,
  colWidthHistory,
  activationHistory
} from './table/state'
import { tableEditLifecycle } from './table/lifecycle'
import { setNestedPreviewField, tableStructBindings, tableMenuBindings } from './table/widget'
import { mathEditExitBindings } from './mathEdit'
import { codeEditExitBindings, findFenceBlockAt } from './codeEdit'
import { indentGuides } from './codeIndentGuides'
import { codeLanguageList } from './codeLangs'
import { katexCompletionSource } from './math/katexCompletion'
import { getCtxRuntime, handleEditorContextMenu } from './contextMenu/registry'
import { compartmentThemes, ThemeName } from './theme'

export const themeCompartment = new Compartment()
export const markdownCompartment = new Compartment()
export const gutterCompartment = new Compartment()

export interface EditorCallbacks {
  onChange: (doc: string) => void
  onSelectionChanged: () => void
  onTreeChanged: () => void
  onFoldChanged?: () => void
  onQuoteFoldChanged?: () => void
  onColWidthsChanged?: () => void
  ensureSaved: () => Promise<boolean>
}

function markdownSupport(assists: EditingAssistsConfig): Extension {
  return markdown({
    extensions: [GFM, imageSizeMarkdown],
    addKeymap: assists.enabled,
    pasteURLAsLink: false,
    codeLanguages: codeLanguageList
  })
}

export function createExtensions(
  callbacks: EditorCallbacks,
  theme: ThemeName,
  assists: EditingAssistsConfig,
  showLineNumbers: boolean
): Extension[] {
  setNestedPreviewField(livePreviewField)
  return [
    gutterCompartment.of(showLineNumbers ? lineNumbers() : []),
    foldClickExtension,
    calloutClickExtension,
    quoteFoldClickExtension,
    history(),
    colWidthHistory,
    activationHistory,
    drawSelection(),
    highlightActiveLine(),
    search({ top: true }),
    markdownCompartment.of(markdownSupport(assists)),
    EditorState.languageData.of(() => [{ autocomplete: katexCompletionSource }]),
    EditorState.allowMultipleSelections.of(true),
    EditorView.lineWrapping,
    livePreviewField,
    foldField,
    calloutFoldField,
    quoteFoldField,
    tableEditField,
    tableEditLifecycle,
    codeBlockUiField,
    mermaidLastGoodRemap,
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
    linkNavExtension,
    hoverZonesExtension,
    indentGuides(),
    imageInputExtension(callbacks.ensureSaved),
    themeCompartment.of(compartmentThemes[theme]),
    bracketMatching(),
    indentOnInput(),
    autocompletion(),
    closeBrackets(),
    keymap.of([
      ...tableStructBindings,
      ...tableMenuBindings,
      ...searchKeymap,
      ...mathEditExitBindings,
      ...codeEditExitBindings,
      {
        key: 'Mod-z',
        run: undoWithAck
      },
      ...historyKeymap,
      {
        key: 'Mod-/',
        run: (v) => {
          const sel = v.state.selection.main
          const text = v.state.sliceDoc(0, v.state.doc.length)
          if (!findFenceBlockAt(text, sel.from)) {
            setPreferences({ sourceMode: !getPreferences().sourceMode })
            return true
          }
          const [tokens] = v.state.languageDataAt<{ open: string; close?: string }>(
            'commentTokens',
            sel.from
          )
          if (!tokens || tokens.open === '<!--') return true
          return toggleComment(v)
        }
      },
      ...defaultKeymap,
      indentWithTab
    ]),
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
      const foldTouched =
        update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(toggleFold) || e.is(restoreFolds) || e.is(expandFolds))
        ) || getFoldedKeys(update.startState) !== getFoldedKeys(update.state)
      if (foldTouched) callbacks.onFoldChanged?.()
      const quoteFoldTouched =
        update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(toggleQuoteFold) || e.is(restoreQuoteFolds))
        ) || getQuoteFoldedKeys(update.startState) !== getQuoteFoldedKeys(update.state)
      if (quoteFoldTouched) callbacks.onQuoteFoldChanged?.()
      const widthTouched =
        update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(setColWidth) || e.is(restoreColWidths))
        ) || getTableEdit(update.startState).colWidths !== getTableEdit(update.state).colWidths
      if (widthTouched) callbacks.onColWidthsChanged?.()
    })
  ]
}

export function updateLivePreviewConfig(
  view: EditorView,
  patch: Partial<LivePreviewConfig>
): void {
  const next = { ...getLivePreviewConfig(view.state), ...patch }
  view.dispatch({
    effects: livePreviewConfigCompartment.reconfigure(livePreviewConfigFacet.of(next))
  })
}

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

export function bumpImageEpoch(view: EditorView): void {
  const config = getLivePreviewConfig(view.state)
  view.dispatch({
    effects: livePreviewConfigCompartment.reconfigure(
      livePreviewConfigFacet.of({ ...config, imageEpoch: config.imageEpoch + 1 })
    )
  })
}

export function bumpLinkEpoch(view: EditorView): void {
  const config = getLivePreviewConfig(view.state)
  view.dispatch({
    effects: livePreviewConfigCompartment.reconfigure(
      livePreviewConfigFacet.of({ ...config, linkEpoch: config.linkEpoch + 1 })
    )
  })
}

export function bumpI18nEpoch(view: EditorView): void {
  const config = getLivePreviewConfig(view.state)
  view.dispatch({
    effects: livePreviewConfigCompartment.reconfigure(
      livePreviewConfigFacet.of({ ...config, i18nEpoch: (config.i18nEpoch ?? 0) + 1 })
    )
  })
}

export function updateShowLineNumbers(view: EditorView, show: boolean): void {
  view.dispatch({ effects: gutterCompartment.reconfigure(show ? lineNumbers() : []) })
}

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
