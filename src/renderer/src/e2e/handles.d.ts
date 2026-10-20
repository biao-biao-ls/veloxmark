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
    __veloxP12: {
      queryClose: () => Promise<boolean>
      confirmDiscard: () => Promise<boolean>
      saveFile: () => Promise<boolean>
      loadDoc: (content: string, path: string | null) => void
      getFilePath: () => string | null
      getDirty: () => boolean
      draftList: () => Promise<Awaited<ReturnType<typeof window.api.draftList>>>
      draftWrite: (path: string | null, content: string, slot?: string) => Promise<void>
      draftDiscard: (path: string | null, slot?: string) => Promise<void>
      runDraftCheck: () => Promise<void>
      getLastAutoSaveAt: () => number | null
    } | null
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
    __veloxP14: {
      setLanguage: (pref: 'system' | 'zh' | 'en') => void
      getLang: () => string
      getStats: () => DocStats
      t: (key: string, params?: Record<string, string | number>) => string
      loadDoc: (text: string, path: string) => void
    } | null
    __veloxP15: {
      bench: (
        lines: number,
        formulas: number,
        samples?: number
      ) => { lines: number; formulas: number; samples: number; avg: number; p95: number; max: number }
    } | null
    __veloxP16: {
      templates: () => string[]
      insertTemplate: (id: string) => void
      openInsertDialog: () => void
      getDialogOpen: () => boolean
      isCursorInMermaidFence: () => boolean
      setExportIo: (io: Parameters<typeof setMermaidExportIo>[0]) => void
    } | null
    __veloxP17: {
      resolve: (href: string, baseDir?: string) => Promise<LinkResolveResult>
      navigate: (href: string) => Promise<void>
      revalidate: () => Promise<void>
      getBrokenHrefs: () => string[]
      getLinkEpoch: () => number
      setExternalConfirm: (v: boolean) => void
      setOpenExternalImpl: (fn: ((url: string) => Promise<boolean>) | null) => void
    } | null
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
    __veloxP19: {
      transform: (html: string) => string | null
      pasteHtmlEvent: (html: string, plain?: string) => boolean
      pasteFromClipboard: () => Promise<boolean>
      faultNextTransform: () => void
      setPasteHtmlToMd: (v: boolean) => void
      writeClipboardHtml: (html: string, text: string) => Promise<void>
      getDoc: () => string
    } | null
    __veloxP20: {
      copyRichText: () => Promise<boolean>
      copyAsHtml: () => Promise<boolean>
      exportSelectionTo: (target: string) => Promise<boolean>
      getClipboard: () => Promise<{ html: string; text: string }>
      getToast: () => string | null
      setThemePref: (mode: 'light' | 'dark') => void
    } | null
    __veloxP21: {
      getDoc: () => string
      setSelection: (pos: number) => void
      openCalloutInsert: () => void
      getCalloutDialogOpen: () => boolean
      insertCallout: (type: string) => void
      renderExportHtml: () => Promise<string>
      pressEnter: () => boolean
      getCalloutFoldOverrides: () => Array<[string, boolean]>
    } | null
    __veloxP22: {
      getDoc: () => string
      setSelection: (from: number, to?: number) => void
      openDialog: (mode: 'insert' | 'convert') => void
      getDialogMode: () => string | null
      setDialogForm: (patch: Partial<TableInsertForm>) => void
      getDialogForm: () => TableInsertForm
      confirm: () => void
    } | null
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
    __veloxP26: {
      getDoc: () => string
      loadDoc: (text: string, path: string | null) => void
      openPath: (path: string) => Promise<boolean>
      tabs: () => Array<{ id: string; path: string | null; name: string; isWelcome?: boolean; dirty: boolean; active: boolean }>
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
        panelLeft: number | null
        styles: {
          bg: string
          borderLeft: string
          borderTop: string
          radius: string
          opacity: string
        } | null
      } | null
      themeToken: (name: string) => string
    } | null
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
        panelSpanColor: (text: string) => string | null
        distinctColors: string[]
        widgetKeywordColor: string | null
      } | null
      themeToken: (name: string) => string
    } | null
  }
}
