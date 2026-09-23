/**
 * e2e/CDP probe handle types (task 1A split — see docs/specs/1A-split-app).
 *
 * The `window.__velox*` shapes below are the probe contract (`scripts/cdp-*.mjs`
 * drivers): they moved verbatim out of `App.tsx`, so handle names and member
 * signatures are compile-locked here. Nothing in the product reads these
 * handles — they exist only for external smoke/bench drivers.
 *
 * Runtime wiring lives in `e2e/seams/` (via `useE2eSeams` in App); the P12
 * handle is installed from the close-query effect in App (its subscription is
 * product behavior). `__veloxEditor` is assigned by the create-editor effect
 * in App (editor lifecycle, not a seam).
 */
import type { EditorView } from '@codemirror/view'
import type { updateLivePreviewConfig } from '../editor/setup'
import type { setMermaidExportIo } from '../editor/mermaid'
import type { DocStats } from '../components/StatusBar'
import type { FormatWarning } from '../editor/format'
import type { TableInsertForm } from '../components/TableInsertDialog'
import type {
  LinkResolveResult,
  SearchOptions,
  SearchReplaceRequest,
  SearchReplaceResult
} from '../../../../electron/shared/api'

declare global {
  interface Window {
    __veloxEditor: {
      view: EditorView
      applyLivePreviewConfig: typeof updateLivePreviewConfig
    } | null
    /** P12 e2e handle: close-query / drafts / autosave inspection. */
    __veloxP12: {
      queryClose: () => Promise<boolean>
      confirmDiscard: () => Promise<boolean>
      saveFile: () => Promise<boolean>
      loadDoc: (content: string, path: string | null) => void
      getFilePath: () => string | null
      getDirty: () => boolean
      draftList: () => Promise<Awaited<ReturnType<typeof window.api.draftList>>>
      draftWrite: (path: string | null, content: string) => Promise<void>
      draftDiscard: (path: string | null) => Promise<void>
      runDraftCheck: () => Promise<void>
      getLastAutoSaveAt: () => number | null
    } | null
    /** P13 e2e handle: folder search / replace / jump-to-result. */
    __veloxP13: {
      openFolder: (path: string) => Promise<void>
      openSearch: () => void
      getSidebarMode: () => string
      searchRun: (
        root: string,
        pattern: string,
        options: SearchOptions
      ) => Promise<{ searchId: number; error?: string }>
      searchReplace: (req: SearchReplaceRequest) => Promise<SearchReplaceResult>
      openAt: (path: string, line: number, col: number) => Promise<void>
      getDoc: () => string
      getFilePath: () => string | null
    } | null
    /** P14 e2e handle: i18n + status-bar stats. */
    __veloxP14: {
      setLanguage: (pref: 'system' | 'zh' | 'en') => void
      getLang: () => string
      getStats: () => DocStats
      t: (key: string, params?: Record<string, string | number>) => string
      loadDoc: (text: string, path: string) => void
    } | null
    /** P15 bench handle: buildDecorations timing over synthetic docs. */
    __veloxP15: {
      bench: (
        lines: number,
        formulas: number,
        samples?: number
      ) => { lines: number; formulas: number; samples: number; avg: number; p95: number; max: number }
    } | null
    /** P16 e2e handle: mermaid template insert + fence probe + export IO seam. */
    __veloxP16: {
      templates: () => string[]
      insertTemplate: (id: string) => void
      openInsertDialog: () => void
      getDialogOpen: () => boolean
      isCursorInMermaidFence: () => boolean
      setExportIo: (io: Parameters<typeof setMermaidExportIo>[0]) => void
    } | null
    /** P17 e2e handle: link resolve / navigate / revalidate / openExternal seam. */
    __veloxP17: {
      resolve: (href: string, baseDir?: string) => Promise<LinkResolveResult>
      navigate: (href: string) => Promise<void>
      revalidate: () => Promise<void>
      getBrokenHrefs: () => string[]
      getLinkEpoch: () => number
      setExternalConfirm: (v: boolean) => void
      setOpenExternalImpl: (fn: ((url: string) => Promise<boolean>) | null) => void
    } | null
    /** P18 e2e handle: heading folds — keys, ranges, restore, bench. */
    __veloxP18: {
      getFoldedKeys: () => string[]
      toggleKey: (key: string) => void
      getRanges: () => { key: string; from: number; to: number; lines: number }[]
      getHeadingKeys: () => string[]
      restoreFromSession: () => void
      restoreKeys: (keys: string[]) => void
      getSessionFolds: () => string[]
      benchToggle: (key: string, n?: number) => { ms: number; avg: number }
    } | null
    /** P19 e2e handle: HTML→Markdown paste — transform probe, DOM-event + menu paths. */
    __veloxP19: {
      transform: (html: string) => string | null
      /** Synthesize a ClipboardEvent paste on the editor; returns defaultPrevented. */
      pasteHtmlEvent: (html: string, plain?: string) => boolean
      /** Menu Edit>Paste through the shared runMenuPaste; true when doc changed. */
      pasteFromClipboard: () => Promise<boolean>
      /** wave⑥-4 F2 seam: next htmlToMarkdown throws once — verify plain fallback. */
      faultNextTransform: () => void
      setPasteHtmlToMd: (v: boolean) => void
      writeClipboardHtml: (html: string, text: string) => Promise<void>
      getDoc: () => string
    } | null
    /** P20 e2e handle: rich-text clipboard commands + flavor read-back. */
    __veloxP20: {
      copyRichText: () => Promise<boolean>
      copyAsHtml: () => Promise<boolean>
      /** Render current selection/doc → standalone HTML written to `target`. */
      exportSelectionTo: (target: string) => Promise<boolean>
      getClipboard: () => Promise<{ html: string; text: string }>
      getToast: () => string | null
      setThemePref: (mode: 'light' | 'dark') => void
    } | null
    /** P21 e2e handle: callout probe + insert dialog + export/quote seams. */
    __veloxP21: {
      getDoc: () => string
      setSelection: (pos: number) => void
      openCalloutInsert: () => void
      getCalloutDialogOpen: () => boolean
      insertCallout: (type: string) => void
      /** Full-doc (or selection) standalone export HTML via P04 renderer. */
      renderExportHtml: () => Promise<string>
      /** lang-markdown Enter continuation — quote/callout line prefixes. */
      pressEnter: () => boolean
      getCalloutFoldOverrides: () => Array<[string, boolean]>
    } | null
    /** P22 e2e handle: table insert dialog + convert flow. */
    __veloxP22: {
      getDoc: () => string
      setSelection: (from: number, to?: number) => void
      openDialog: (mode: 'insert' | 'convert') => void
      getDialogMode: () => string | null
      setDialogForm: (patch: Partial<TableInsertForm>) => void
      getDialogForm: () => TableInsertForm
      confirm: () => void
    } | null
    /** P23 e2e handle: format command + format-on-save seams. */
    __veloxP23: {
      getDoc: () => string
      setSelection: (from: number, to?: number) => void
      loadDoc: (text: string, path: string | null) => void
      format: () => { changed: number; warnings: FormatWarning[] }
      undo: () => boolean
      getToast: () => string | null
      setFormatOnSave: (v: boolean) => void
      getFormatOnSave: () => boolean
      saveFile: () => Promise<boolean>
      getFilePath: () => string | null
      getFormatWarnings: () => FormatWarning[]
      openFormatWarnings: () => void
      faultNextFormat: () => void
    } | null
    /** P24 e2e handle: code-block collapse / line numbers / wrap seams. */
    __veloxP24: {
      getDoc: () => string
      loadDoc: (text: string, path: string | null) => void
      setPrefs: (patch: Record<string, unknown>) => void
      getPrefs: () => {
        codeBlockCollapseLines: number
        codeBlockShowLineNumbers: boolean
        codeBlockWrap: boolean
      }
      getExpandedKeys: () => string[]
      codeBlockInfo: () => {
        count: number
        collapsedCount: number
        expanderText: string | null
        hasFoldBtn: boolean
        lineNoCount: number
        wrapCount: number
        renderedCodeLines: number
        hasCollapsedClass: boolean
      } | null
      clickExpander: () => boolean
      clickFold: () => boolean
      clearExpanded: () => void
    } | null
    /** P25 e2e handle: mermaid source live-preview panel seams. */
    __veloxP25: {
      getDoc: () => string
      loadDoc: (text: string, path: string | null) => void
      setCursor: (pos: number) => void
      insertText: (pos: number, text: string) => void
      undo: () => boolean
      panel: () => {
        visible: boolean
        hasSvg?: boolean
        errorText?: string | null
        pinOn?: boolean
        editableCount?: number
        svgText?: string
        height?: number
      }
      clickPin: () => boolean
      setPrefs: (patch: Record<string, unknown>) => void
      getPrefs: () => { mermaidPreviewHeight: number }
      getPinSession: () => boolean
      probeNow: () => void
    } | null
    /** P26 e2e handle: multi-document tab seams. */
    __veloxP26: {
      getDoc: () => string
      loadDoc: (text: string, path: string | null) => void
      openPath: (path: string) => Promise<boolean>
      tabs: () => Array<{ id: string; path: string | null; name: string; dirty: boolean; active: boolean }>
      activeIndex: () => number
      activate: (id: string) => void
      activateIndex: (i: number) => void
      closeActive: (opts?: { force?: boolean }) => Promise<boolean>
      closeId: (id: string, opts?: { force?: boolean }) => Promise<boolean>
      resetWelcome: () => void
      nextTab: () => void
      reopenClosed: () => Promise<void>
      hasClosedTabs: () => boolean
      reorder: (dragId: string, targetId: string) => void
      getFilePath: () => string | null
      getDirty: () => boolean
      insertText: (pos: number, text: string) => void
      setCursor: (pos: number) => void
      getCursor: () => number
      undo: () => boolean
      getBaseDir: () => string
      getToast: () => string | null
      persistTabs: () => void
      getSessionTabs: () => { openTabs: string[]; activePath: string | null }
      saveAllDirty: () => Promise<void>
      newUntitled: () => void
      closeOthers: (id: string) => void
      closeRight: (id: string) => void
      queryClose: () => Promise<boolean>
      dialogOpen: () => boolean
      setPrefs: (patch: Record<string, unknown>) => void
      getScrollTop: () => number
    } | null
    /** P28 e2e handle: focused code-block panel (source-edit chrome) seams. */
    __veloxP28: {
      getDoc: () => string
      loadDoc: (text: string, path: string | null) => void
      setCursor: (pos: number) => void
      getCursor: () => number
      insertText: (pos: number, text: string) => void
      undo: () => boolean
      panelInfo: () => {
        panelLineCount: number
        hasFirst: boolean
        hasLast: boolean
        bodyCount: number
        chipCount: number
        chipText: string | null
        fenceTextVisible: boolean
        openLineHasFence: boolean
        widgetCount: number
        mermaidWidgetCount: number
        focusModeOn: boolean
        activeLineCount: number
        previewPanelVisible: boolean
        panelLeft: number | null
        styles: {
          bg: string
          borderLeft: string
          borderTop: string
          radius: string
          opacity: string
        } | null
      } | null
      /** Resolve a CSS custom property under the app theme host (.app). */
      themeToken: (name: string) => string
    } | null
    /** P29 e2e handle: focused-panel syntax highlight (hljs token marks). */
    __veloxP29: {
      getDoc: () => string
      loadDoc: (text: string, path: string | null) => void
      setCursor: (pos: number) => void
      getCursor: () => number
      insertText: (pos: number, text: string) => void
      undo: () => boolean
      tokenInfo: () => {
        panelLineCount: number
        chipText: string | null
        fenceTextVisible: boolean
        widgetCount: number
        /** DOM count of [class*="hljs-"] spans inside panel lines. */
        spanCount: number
        classes: string[]
        keywordTexts: string[]
        /** Computed color of the first .hljs-keyword in panel lines. */
        panelKeywordColor: string | null
        /** Computed color of .hljs-keyword inside the rendered widget (null while focused). */
        widgetKeywordColor: string | null
      } | null
      themeToken: (name: string) => string
    } | null
  }
}
