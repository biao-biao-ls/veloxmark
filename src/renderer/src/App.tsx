import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { getLivePreviewConfig } from './editor/livePreview/config'
import { collectFoldSections, toggleFold } from './editor/livePreview/fold'
import {
  collectLinkHrefs,
  invalidateLinkTipCache,
  isSkippableHref,
  rememberLinkStatus,
  setLinkNavHandler,
  setLinkTipResolver
} from './editor/livePreview/linkNav'
import Outline from './components/Outline'
import FileTree from './components/FileTree'
import TreeMenu from './components/TreeMenu'
import Titlebar from './components/Titlebar'
import Preferences from './components/Preferences'
import ExportDialog from './components/ExportDialog'
import QuickOpen from './components/QuickOpen'
import SearchPanel from './components/SearchPanel'
import ListPickDialog from './components/ListPickDialog'
import {
  TableInsertDialog,
  defaultTableForm,
  type TableDialogMode,
  type TableInsertForm
} from './components/TableInsertDialog'
import { insertTableAtCursor, convertSelectionAtCursor, buildTableMarkdown } from './editor/table/insert'
import { sniffDelimiter } from './editor/table/ops'
import { TabsBar } from './components/TabsBar'
import MermaidLightbox from './components/MermaidLightbox'
import { DialogHost, dialog } from './components/Dialog'
import { ToastHost } from './components/ToastHost'
import UpdaterBridge from './components/UpdaterBridge'
import { toast as showToast } from './hooks/useToast'
import { EditorContextMenuHost } from './components/EditorContextMenu'
import { RenderFloatHost } from './components/RenderFloat'
import './components/ImageEditFloat'
import './components/LinkHoverFloat'
import './components/ListDragHandle'
import SidebarOpsPanel from './components/SidebarOpsPanel'
import { openSidebarOps } from './components/sidebarOpsBus'
import { CloseIcon, ListIcon, MoreVerticalIcon, TreeIcon } from './components/Icons'
import { createExtensions, updateEditingAssists, updateShowLineNumbers, bumpImageEpoch, bumpLinkEpoch, bumpI18nEpoch, updateLivePreviewConfig } from './editor/setup'
import { syncPureSelectionChrome } from './editor/clickSemantics'
import { invalidateImageCache } from './editor/image-widget'
import { readEditingAssistsConfig, setHtmlPasteFallbackNotice } from './editor/assists'
import { formatMarkdown, type FormatWarning } from './editor/format'
import { extractOutline, findHeadingBySlug, type OutlineItem } from './outline/extract'
import { getMermaidTemplates, isCursorInMermaidFence } from './editor/mermaidTemplates'
import { CALLOUT_TYPES } from './editor/livePreview/callout'
import { getWelcomeMd, WELCOME_MD_EN, WELCOME_MD_ZH } from './content'
import { displayTabName } from './hooks/docTabs'
import { getLang, resolveLang, setLang, t, useTranslation } from './i18n'
import StatusBar, { EMPTY_STATS, computeDocStats, type DocStats } from './components/StatusBar'
import { useFileOps } from './hooks/useFileOps'
import { baseNameOf } from './pathUtil'
import { useAutoSave } from './hooks/useAutoSave'
import { useWorkspaceTree } from './hooks/useWorkspaceTree'
import { useAppTheme, resolveThemeMode } from './hooks/useAppTheme'
import { useExport } from './hooks/useExport'
import { useMenus } from './hooks/useMenus'
import { useFoldSync } from './hooks/useFoldSync'
import { useQuoteFold } from './hooks/useQuoteFold'
import { useOutlineNav } from './hooks/useOutlineNav'
import { useHushLayer } from './hooks/useHushLayer'
import { useTableWidthSync } from './hooks/useTableWidthSync'
import { useSessionPersist } from './hooks/useSessionPersist'
import { usePreferences, useSession } from './preferences/useStore'
import {
  clearRecentFiles,
  getPreferences,
  getSession,
  patchSession,
  setPreferences
} from './preferences/store'
import type { SidebarMode } from './preferences/store'
import type { LinkResolveResult } from '../../../electron/shared/api'
import { createCommandCache, type CommandOps } from './commands'
import { linkAtPos } from './editor/contextMenu/detect'
import { setCtxRuntime } from './editor/contextMenu/registry'
import { useE2eSeams } from './e2e/seams'
import { installP12Handle } from './e2e/seams/p12'

export default function App(): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [sessionSynced, setSessionSynced] = useState(false)

  const isMac = window.api.platform === 'darwin'

  const { theme, toggleTheme } = useAppTheme(viewRef)
  const prefs = usePreferences()
  const { lang } = useTranslation()
  const [stats, setStats] = useState<DocStats>(EMPTY_STATS)
  const session = useSession()
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [foldableKeys, setFoldableKeys] = useState<ReadonlySet<string>>(() => new Set())
  const [showSidebar, setShowSidebar] = useState(
    () => getSession().sidebarVisible ?? getPreferences().sidebarDefaultOpen
  )
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(
    () => getSession().sidebarMode ?? 'outline'
  )
  const [sidebarWidth, setSidebarWidth] = useState(() => getSession().sidebarWidth ?? 240)
  const [sidebarResizing, setSidebarResizing] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [showQuickOpen, setShowQuickOpen] = useState(false)
  const [searchFocusToken, setSearchFocusToken] = useState(0)

  const updateOutline = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    setOutline(extractOutline(view.state))
    setFoldableKeys(new Set(collectFoldSections(view.state).map((r) => r.key)))
  }, [])

  const { activePos, jumpToHeading, updateActiveHeading } = useOutlineNav({ viewRef })
  useHushLayer()

  const fileOps = useFileOps({
    viewRef,
    updateOutline,
    onSaveFailed: showToast,
    onFormatOnSaveFailed: () => showToast(t('format.onSaveFailed'))
  })
  const { dirty, setDirty, filePath, filePathRef, syncAppState } = fileOps

  const { foldedKeys, syncFoldedKeysRef, restoreFoldsForRef } = useFoldSync({
    viewRef,
    filePathRef,
    suppressDirtyRef: fileOps.suppressDirtyRef,
    filePath
  })

  const { syncColWidthsRef } = useTableWidthSync({
    viewRef,
    filePathRef,
    suppressDirtyRef: fileOps.suppressDirtyRef,
    filePath
  })

  const { syncQuoteFoldsRef } = useQuoteFold({
    viewRef,
    filePathRef,
    suppressDirtyRef: fileOps.suppressDirtyRef,
    filePath
  })

  const autoSave = useAutoSave({
    viewRef,
    filePathRef,
    dirtyRef: fileOps.dirtyRef,
    draftSlot: () => fileOps.getDraftSlot(),
    mode: prefs.autoSaveMode,
    delaySec: prefs.autoSaveDelaySec,
    intervalMin: prefs.autoSaveIntervalMin,
    crashRecoveryEnabled: prefs.crashRecoveryEnabled,
    saveFile: () => fileOps.saveFile({ notifyFailure: false }),
    saveAllDirtyTabs: fileOps.saveAllDirtyTabs,
    onAutoSaveFailed: showToast
  })
  const autoSaveNotifyRef = useRef(autoSave.notifyChange)
  autoSaveNotifyRef.current = autoSave.notifyChange

  const exportOps = useExport({ viewRef, filePath, onExported: showToast })

  const workspace = useWorkspaceTree({
    activePath: filePath,
    filePathRef,
    dirty,
    confirmDiscard: fileOps.confirmDiscard,
    loadContent: fileOps.loadContent,
    openDocPath: fileOps.openDocPath,
    setBaseDir: fileOps.setBaseDir,
    setFilePath: fileOps.setFilePath,
    syncAppState,
    setSidebarMode,
    setShowSidebar
  })

  const { recentItems } = useSessionPersist({
    sessionSynced,
    showSidebar,
    sidebarMode,
    sidebarWidth,
    persistTabsSession: fileOps.persistTabsSession,
    tabInfos: fileOps.tabInfos,
    recentFiles: session.recentFiles
  })

  useEffect(() => {
    const offOpen = window.api.onMenu('openRecent', (path?: string) => {
      if (path) void fileOps.openRecentFile(path)
    })
    const offClear = window.api.onMenu('clearRecent', () => clearRecentFiles())
    const offCloseOrWindow = window.api.onMenu('closeTabOrWindow', () => {
      if (fileOps.getTabCount() > 1) {
        void fileOps.closeTab(fileOps.getActiveTabId())
      } else {
        void fileOps.queryClose().then((allow) => {
          if (allow) window.api.windowClose()
        })
      }
    })
    const offCheckUpdates = window.api.onMenu('checkForUpdates', () => {
      void window.api.checkForUpdates()
    })
    return () => {
      offOpen()
      offClear()
      offCloseOrWindow()
      offCheckUpdates()
    }
  }, [
    fileOps.openRecentFile,
    fileOps.closeTab,
    fileOps.getActiveTabId,
    fileOps.getTabCount,
    fileOps.queryClose
  ])

  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    if (!getPreferences().restoreLastSession) {
      setSessionSynced(true)
      return
    }
    const saved = getSession()
    void (async () => {
      try {
        const openTabs =
          saved.openTabs && saved.openTabs.length > 0
            ? saved.openTabs
            : saved.lastFilePath
              ? [saved.lastFilePath]
              : []
        const missingNames: string[] = []
        for (const p of openTabs) {
          if (await window.api.pathExists(p)) {
            await fileOps.openDocPath(p, { activate: false })
          } else {
            missingNames.push(p.split('/').pop() || p)
          }
        }
        if (saved.activePath && (await window.api.pathExists(saved.activePath))) {
          await fileOps.openDocPath(saved.activePath)
        } else if (openTabs.length > 0) {
          for (const p of openTabs) {
            if (await window.api.pathExists(p)) {
              await fileOps.openDocPath(p)
              break
            }
          }
        }
        if (missingNames.length > 0) {
          const shown = missingNames.slice(0, 3).join(', ')
          const overflow = missingNames.length > 3 ? ` +${missingNames.length - 3}` : ''
          showToast(t('tabs.missingRestoredList', { names: shown + overflow }))
        }
        {
          const view = viewRef.current
          const cursor = saved.lastCursor
          if (view && cursor != null && cursor > 0 && cursor <= view.state.doc.length) {
            view.dispatch({ selection: { anchor: cursor } })
          }
        }
        if (saved.sidebarMode) setSidebarMode(saved.sidebarMode)
      } catch {
      } finally {
        setSessionSynced(true)
      }
    })()
  }, [])

  const checkDrafts = useCallback(async (): Promise<void> => {
    const drafts = (await window.api.draftList()).slice().sort((a, b) => {
      return (a.path != null ? 0 : 1) - (b.path != null ? 0 : 1)
    })
    const fmtDraftTime = (mtime: number | undefined): string =>
      new Date(typeof mtime === 'number' && mtime > 0 ? mtime : Date.now()).toLocaleString([], {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    for (const d of drafts) {
      if (!d.content) {
        void window.api.draftDiscard(d.path, d.slot)
        continue
      }
      if (d.path == null) {
        const choice = await dialog.choose({
          title: t('dialog.recoverTitle'),
          message: t('dialog.recoverUntitled', { time: fmtDraftTime(d.mtime) }),
          confirmLabel: t('dialog.restoreDraft'),
          discardLabel: t('dialog.discardDraft'),
          cancelLabel: t('dialog.later')
        })
        if (choice === 'confirm') {
          fileOps.openUntitledContent(d.content, d.slot)
          if (!d.slot) void window.api.draftDiscard(null)
        } else if (choice === 'discard') {
          void window.api.draftDiscard(null, d.slot)
        }
        continue
      }
      const exists = await window.api.pathExists(d.path)
      const disk = exists ? await window.api.readFile(d.path) : ''
      if (disk === d.content) {
        void window.api.draftDiscard(d.path)
        continue
      }
      const choice = await dialog.choose({
        title: t('dialog.recoverTitle'),
        message: t('dialog.recoverPath', { path: d.path ?? '', time: fmtDraftTime(d.mtime) }),
        confirmLabel: t('dialog.restoreDraft'),
        discardLabel: t('dialog.discardDraft'),
        cancelLabel: t('dialog.later')
      })
      if (choice === 'confirm') {
        fileOps.loadContent(d.content, d.path)
        fileOps.setSavedBaseline(disk)
        const isDirty = d.content !== disk
        fileOps.setDirty(isDirty)
        fileOps.syncAppState(d.path, isDirty)
      } else if (choice === 'discard') {
        void window.api.draftDiscard(d.path)
      }
    }
  }, [fileOps.openUntitledContent, fileOps.loadContent, fileOps.setSavedBaseline, fileOps.setDirty, fileOps.syncAppState])

  useEffect(() => {
    if (!sessionSynced) return
    if (!getPreferences().crashRecoveryEnabled) return
    void checkDrafts()
  }, [sessionSynced, checkDrafts])

  const queryClose = fileOps.queryClose
  const lastAutoSaveAtRef = useRef<number | null>(null)
  lastAutoSaveAtRef.current = autoSave.lastAutoSaveAt
  useEffect(() => {
    installP12Handle({ queryClose, fileOps, filePathRef, checkDrafts, lastAutoSaveAtRef })
    return window.api.onQueryClose(() => {
      void queryClose().then((allow) => window.api.closeResponse(allow))
    })
  }, [queryClose, checkDrafts])

  useEffect(() => {
    void window.api.setFolderOptions({
      ignoreNames: prefs.folderIgnoreNames,
      showHiddenFiles: prefs.showHiddenFiles
    })
  }, [prefs.folderIgnoreNames, prefs.showHiddenFiles])

  useEffect(() => {
    const view = viewRef.current
    if (view) updateShowLineNumbers(view, prefs.showLineNumbers)
  }, [prefs.showLineNumbers])

  useEffect(() => {
    const view = viewRef.current
    if (view) {
      updateEditingAssists(view, {
        enabled: prefs.typingAssistsEnabled,
        wrapBareUrlOnPaste: prefs.wrapBareUrlOnPaste,
        pasteHtmlToMd: prefs.pasteHtmlToMd
      })
    }
  }, [prefs.typingAssistsEnabled, prefs.wrapBareUrlOnPaste, prefs.pasteHtmlToMd])

  const prevSourceModeRef = useRef(prefs.sourceMode)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    updateLivePreviewConfig(view, {
      mode: prefs.sourceMode ? 'source' : 'live',
      focusMode: prefs.focusMode,
      typewriterMode: prefs.typewriterMode,
      codeBlockCollapseLines: prefs.codeBlockCollapseLines,
      codeBlockShowLineNumbers: prefs.codeBlockShowLineNumbers,
      codeBlockWrap: prefs.codeBlockWrap
    })
    if (prevSourceModeRef.current !== prefs.sourceMode) {
      prevSourceModeRef.current = prefs.sourceMode
      const head = view.state.selection.main.head
      view.dispatch({ effects: EditorView.scrollIntoView(head) })
    }
  }, [
    prefs.sourceMode,
    prefs.focusMode,
    prefs.typewriterMode,
    prefs.codeBlockCollapseLines,
    prefs.codeBlockShowLineNumbers,
    prefs.codeBlockWrap
  ])

  const startSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setSidebarResizing(true)
    const onMove = (ev: MouseEvent): void =>
      setSidebarWidth(Math.min(480, Math.max(160, ev.clientX)))
    const onUp = (): void => {
      setSidebarResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  useEffect(() => {
    if (!hostRef.current || viewRef.current) return
    let cursorPersistTimer: ReturnType<typeof setTimeout> | undefined

    const extensions = createExtensions(
          {
            onChange: () => {
              if (!fileOps.suppressDirtyRef.current && !fileOps.dirtyRef.current) {
                setDirty(true)
                syncAppState(filePathRef.current, true)
              }
              updateOutline()
              syncFoldedKeysRef.current()
              autoSaveNotifyRef.current()
              updateCursorStatsRef.current()
              scheduleDocStatsRef.current()
            },
            onSelectionChanged: () => {
              syncPureSelectionChrome(view)
              updateActiveHeading()
              updateCursorStatsRef.current()
              syncFoldedKeysRef.current()
              const head = view.state.selection.main.head
              clearTimeout(cursorPersistTimer)
              cursorPersistTimer = setTimeout(() => patchSession({ lastCursor: head }), 500)
            },
            onTreeChanged: () => {
              updateOutline()
              updateActiveHeading()
              syncFoldedKeysRef.current()
              scheduleDocStatsRef.current()
            },
            onFoldChanged: () => {
              syncFoldedKeysRef.current()
            },
            onQuoteFoldChanged: () => {
              syncQuoteFoldsRef.current()
            },
            onColWidthsChanged: () => {
              syncColWidthsRef.current()
            },
            ensureSaved: async () => {
              if (filePathRef.current) return true
              return fileOps.saveFileAs()
            }
          },
          resolveThemeMode(getPreferences().theme),
          readEditingAssistsConfig(),
          getPreferences().showLineNumbers
    )
    const view = new EditorView({
      state: EditorState.create({
        doc: getWelcomeMd(getLang()),
        extensions
      }),
      parent: hostRef.current
    })
    viewRef.current = view
    fileOps.initTabs(extensions, view.state.doc.toString())
    window.__veloxEditor = { view, applyLivePreviewConfig: updateLivePreviewConfig }
    updateOutline()
    updateCursorStatsRef.current()
    scheduleDocStatsRef.current()

    window.api.rendererReady()

    return () => {
      clearTimeout(cursorPersistTimer)
      view.destroy()
      viewRef.current = null
    }
  }, [])

  const refreshImages = useCallback(() => {
    invalidateImageCache()
    const view = viewRef.current
    if (view) bumpImageEpoch(view)
  }, [])

  useEffect(() => window.api.onImageChanged(() => refreshImages()), [refreshImages])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onFocus = (): void => {
      clearTimeout(timer)
      timer = setTimeout(refreshImages, 300)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearTimeout(timer)
    }
  }, [refreshImages])

  const goToHeading = jumpToHeading

  const toggleSidebar = useCallback(() => setShowSidebar((v) => !v), [])

  useEffect(() => {
    const resolved = resolveLang(prefs.language)
    setLang(resolved)
    void window.api.setUiLanguage(resolved).catch(() => {})
    const view = viewRef.current
    if (view) bumpI18nEpoch(view)
  }, [prefs.language])

  useEffect(() => {
    const ids = [
      prefs.focusMode && 'toggleFocusMode',
      prefs.typewriterMode && 'toggleTypewriterMode',
      prefs.sourceMode && 'toggleSourceMode',
      prefs.typingAssistsEnabled && 'toggleTypingAssists',
      prefs.wrapBareUrlOnPaste && 'toggleWrapBareUrlOnPaste',
      prefs.pasteHtmlToMd && 'togglePasteHtmlToMd'
    ].filter(Boolean) as string[]
    void window.api.setMenuCheckedIds(ids).catch(() => {})
  }, [
    prefs.focusMode,
    prefs.typewriterMode,
    prefs.sourceMode,
    prefs.typingAssistsEnabled,
    prefs.wrapBareUrlOnPaste,
    prefs.pasteHtmlToMd
  ])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (filePathRef.current != null) return
    const doc = view.state.doc.toString()
    if (doc !== WELCOME_MD_EN && doc !== WELCOME_MD_ZH) return
    const next = getWelcomeMd(lang)
    if (doc === next) return
    fileOps.loadContent(next, null)
  }, [lang])

  useEffect(() => {
    fileOps.syncAppState(fileOps.filePathRef.current, fileOps.dirtyRef.current)
  }, [lang])

  const statsTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const updateCursorStats = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const { state } = view
    const head = state.selection.main.head
    const lineObj = state.doc.lineAt(head)
    setStats((s) => ({
      ...s,
      line: lineObj.number,
      col: head - lineObj.from + 1,
      selChars: state.selection.main.to - state.selection.main.from
    }))
  }, [])
  const scheduleDocStats = useCallback(() => {
    clearTimeout(statsTimerRef.current)
    statsTimerRef.current = setTimeout(() => {
      const view = viewRef.current
      if (!view) return
      const text = view.state.doc.toString()
      const base = computeDocStats(text)
      const { state } = view
      const head = state.selection.main.head
      const lineObj = state.doc.lineAt(head)
      setStats({
        ...base,
        line: lineObj.number,
        col: head - lineObj.from + 1,
        selChars: state.selection.main.to - state.selection.main.from
      })
    }, 300)
  }, [])
  const updateCursorStatsRef = useRef(updateCursorStats)
  updateCursorStatsRef.current = updateCursorStats
  const scheduleDocStatsRef = useRef(scheduleDocStats)
  scheduleDocStatsRef.current = scheduleDocStats

  const switchSidebarMode = useCallback((mode: SidebarMode) => {
    setSidebarMode(mode)
  }, [])

  const openGlobalSearch = useCallback(() => {
    setShowSidebar(true)
    switchSidebarMode('search')
    setSearchFocusToken((t) => t + 1)
  }, [switchSidebarMode])

  const openSearchResult = useCallback(
    async (path: string, line: number, col: number) => {
      const ok = await fileOps.openFileByPath(path)
      if (!ok) return
      const view = viewRef.current
      if (!view) return
      const doc = view.state.doc
      const lineObj = doc.line(Math.min(Math.max(line, 1), doc.lines))
      const anchor = Math.min(lineObj.from + Math.max(col, 0), lineObj.to)
      view.dispatch({
        selection: { anchor },
        effects: EditorView.scrollIntoView(anchor, { y: 'center' }),
        scrollIntoView: true
      })
      view.focus()
    },
    [fileOps, viewRef]
  )

  const reloadOpenFile = useCallback(
    async (path: string) => {
      await fileOps.reloadTabFromDisk(path)
    },
    [fileOps]
  )

  const sidebarModeRef = useRef<SidebarMode>(sidebarMode)
  sidebarModeRef.current = sidebarMode

  const [showMermaidInsert, setShowMermaidInsert] = useState(false)

  const openMermaidInsert = useCallback(() => {
    const view = viewRef.current
    if (view && isCursorInMermaidFence(view.state)) return
    setShowMermaidInsert(true)
  }, [viewRef])

  const insertMermaidTemplate = useCallback(
    (id: string) => {
      setShowMermaidInsert(false)
      const tpl = getMermaidTemplates().find((x) => x.id === id)
      const view = viewRef.current
      if (!tpl || !view) return
      const { state } = view
      const { from, to } = state.selection.main
      let insert = tpl.code
      let lead = 0
      if (from > 0 && state.doc.sliceString(from - 1, from) !== '\n') {
        insert = `\n\n${insert}`
        lead = 2
      }
      if (to < state.doc.length && state.doc.sliceString(to, to + 1) !== '\n') {
        insert = `${insert}\n`
      }
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + lead + tpl.cursorOffset },
        scrollIntoView: true
      })
      view.focus()
    },
    [viewRef]
  )

  const [showCalloutInsert, setShowCalloutInsert] = useState(false)

  const openCalloutInsert = useCallback(() => setShowCalloutInsert(true), [])

  const insertCalloutTemplate = useCallback(
    (id: string) => {
      setShowCalloutInsert(false)
      const view = viewRef.current
      if (!view) return
      const type = id.toUpperCase()
      let text = `> [!${type}] \n> \n`
      let lead = 0
      const { from, to } = view.state.selection.main
      if (from > 0 && view.state.doc.sliceString(from - 1, from) !== '\n') {
        text = `\n\n${text}`
        lead = 2
      }
      if (to < view.state.doc.length && view.state.doc.sliceString(to, to + 1) !== '\n') {
        text = `${text}\n`
      }
      const cursor = from + lead + `> [!${type}] `.length
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: cursor },
        scrollIntoView: true
      })
      view.focus()
    },
    [viewRef]
  )

  const [tableDialog, setTableDialog] = useState<TableDialogMode | null>(null)
  const [tableForm, setTableFormState] = useState<TableInsertForm>(defaultTableForm)
  const [tableSelText, setTableSelText] = useState('')
  const tableDialogRef = useRef<TableDialogMode | null>(null)
  tableDialogRef.current = tableDialog
  const tableFormRef = useRef(tableForm)
  tableFormRef.current = tableForm

  const patchTableForm = useCallback((patch: Partial<TableInsertForm>) => {
    setTableFormState((f) => ({ ...f, ...patch }))
  }, [])

  const openTableInsert = useCallback(
    (mode: 'insert' | 'convert') => {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection.main
      const selText = from === to ? '' : view.state.doc.sliceString(from, to)
      if (mode === 'convert' && selText.trim() === '') {
        showToast(t('tableInsert.noSelection'))
        return
      }
      setTableSelText(selText)
      setTableFormState((f) => ({
        ...defaultTableForm(),
        align: f.align,
        headerPrefix: f.headerPrefix
      }))
      setTableDialog(mode)
    },
    [showToast]
  )

  const confirmTableDialog = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const mode = tableDialogRef.current
    const form = tableFormRef.current
    setTableDialog(null)
    if (!mode) return
    if (mode === 'insert') {
      const md = buildTableMarkdown(form.rows, form.cols, form.align, form.headerPrefix)
      const res = insertTableAtCursor(view, md)
      if (res.movedAfterBlock) showToast(t('tableInsert.movedAfterBlock'))
      view.focus()
      return
    }
    const { from, to } = view.state.selection.main
    const text = from === to ? tableSelText : view.state.doc.sliceString(from, to)
    const delim = form.delim ?? sniffDelimiter(text)
    const res = convertSelectionAtCursor(view, text, delim)
    if (!res.ok && res.reason === 'in-block') showToast(t('tableInsert.noConvertInBlock'))
    else if (!res.ok) showToast(t('tableInsert.noSelection'))
    view.focus()
  }, [showToast, tableSelText])

  const lastFormatRef = useRef<{ changed: number; warnings: FormatWarning[] }>({
    changed: 0,
    warnings: []
  })
  const formatWarningsRef = useRef<FormatWarning[]>([])
  const [formatWarnings, setFormatWarnings] = useState<FormatWarning[]>([])
  formatWarningsRef.current = formatWarnings

  const formatDocument = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const before = view.state.doc.toString()
    const { text, warnings, changed } = formatMarkdown(before)
    lastFormatRef.current = { changed, warnings }
    setFormatWarnings(warnings)
    if (text === before) return
    const oldLine = view.state.doc.lineAt(view.state.selection.main.from).number
    const newLines = text.split('\n')
    const targetLine = Math.min(oldLine, Math.max(1, newLines.length))
    let pos = 0
    for (let i = 0; i < targetLine - 1 && i < newLines.length; i++) pos += newLines[i].length + 1
    pos = Math.min(pos, text.length)
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      selection: { anchor: pos },
      userEvent: 'format',
      scrollIntoView: true
    })
    if (warnings.length > 0) {
      showToast(t('format.changedWarn', { n: changed, w: warnings.length }))
    } else {
      showToast(t('format.changed', { n: changed }))
    }
  }, [showToast])

  const showFormatWarnings = useCallback(() => {
    const list = formatWarningsRef.current
    if (list.length === 0) return
    const lines = list
      .map((w) => t('format.warnUnclosedFence', { line: w.line }))
      .join('\n')
    void dialog.alert({
      titleKey: 'format.warningsTitle',
      messageKey: 'format.warningsMsg',
      messageParams: { list: lines }
    })
  }, [])


  const openExternalImplRef = useRef<((url: string) => Promise<boolean>) | null>(null)

  const jumpToAnchor = useCallback(
    (anchor: string): boolean => {
      const view = viewRef.current
      if (!view || !anchor) return false
      ensureSyntaxTree(view.state, view.state.doc.length, 5000)
      const hit = findHeadingBySlug(extractOutline(view.state), anchor)
      if (!hit) return false
      goToHeading(hit.pos)
      return true
    },
    [goToHeading, viewRef]
  )

  const resolveAndNavigate = useCallback(
    async (href: string) => {
      const view = viewRef.current
      if (!view) return
      const baseDir = getLivePreviewConfig(view.state).baseDir
      let res: LinkResolveResult
      try {
        res = await window.api.resolveLink(baseDir, href)
      } catch {
        return
      }
      if (baseDir && !isSkippableHref(href)) {
        if (rememberLinkStatus(baseDir, href, res.kind !== 'broken')) {
          invalidateLinkTipCache()
          bumpLinkEpoch(view)
        }
      }
      if (res.kind === 'anchor') {
        jumpToAnchor(res.anchor ?? href.replace(/^#/, ''))
        return
      }
      if (res.kind === 'file') {
        const ok = await fileOps.openFileByPath(res.absPath ?? href)
        if (!ok) return
        if (res.anchor) jumpToAnchor(res.anchor)
        return
      }
      if (res.kind === 'external') {
        const url = res.absPath ?? href
        if (!/^https?:\/\//i.test(url)) {
          await dialog.alert({ messageKey: 'link.otherProtocol' })
          return
        }
        if (getPreferences().externalLinkConfirm) {
          const yes = await dialog.confirm({
            titleKey: 'link.openExternalTitle',
            messageKey: 'link.openExternalMsg',
            messageParams: { url }
          })
          if (!yes) return
        }
        const impl = openExternalImplRef.current
        if (impl) await impl(url)
        else await window.api.openExternal(url)
        return
      }
      if (res.kind === 'broken') {
        await dialog.alert({ messageKey: 'link.brokenTip' })
        return
      }
    },
    [fileOps, jumpToAnchor, viewRef]
  )

  const revalidateLinks = useCallback(async () => {
    const view = viewRef.current
    if (!view) return
    const baseDir = getLivePreviewConfig(view.state).baseDir
    if (!baseDir) return
    const hrefs = collectLinkHrefs(view.state).filter((h) => !isSkippableHref(h))
    let changed = false
    await Promise.all(
      hrefs.map(async (href) => {
        try {
          const res = await window.api.resolveLink(baseDir, href)
          if (rememberLinkStatus(baseDir, href, res.kind !== 'broken')) changed = true
        } catch {
        }
      })
    )
    if (changed) {
      invalidateLinkTipCache()
      bumpLinkEpoch(view)
    }
  }, [viewRef])

  const revalidateTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const scheduleRevalidate = useCallback(() => {
    clearTimeout(revalidateTimerRef.current)
    revalidateTimerRef.current = setTimeout(() => {
      void revalidateLinks()
    }, 200)
  }, [revalidateLinks])

  useEffect(() => {
    setLinkNavHandler((href) => {
      void resolveAndNavigate(href)
    })
    return () => setLinkNavHandler(null)
  }, [resolveAndNavigate])

  useEffect(() => {
    setLinkTipResolver(async (href, baseDir) => {
      try {
        const res = await window.api.resolveLink(baseDir, href)
        if (res.kind === 'external') return res.absPath ?? href
        if (res.kind === 'broken') return t('link.brokenTip')
        if (res.kind === 'anchor') {
          const view = viewRef.current
          if (!view) return `#${res.anchor ?? ''}`
          ensureSyntaxTree(view.state, view.state.doc.length, 5000)
          const hit = findHeadingBySlug(extractOutline(view.state), res.anchor ?? '')
          return hit ? `#${res.anchor} — ${hit.text}` : `#${res.anchor ?? ''}`
        }
        if (res.kind === 'file' || res.kind === 'dir') {
          let text = res.absPath ?? href
          if (res.anchor) {
            text += ` #${res.anchor}`
            try {
              const content = await window.api.readFile(res.absPath ?? '')
              const state = EditorState.create({ doc: content, extensions: [markdown()] })
              ensureSyntaxTree(state, state.doc.length, 5000)
              const hit = findHeadingBySlug(extractOutline(state), res.anchor)
              if (hit) text += ` — ${hit.text}`
            } catch {
            }
          }
          return text
        }
      } catch {
      }
      return href
    })
    return () => setLinkTipResolver(null)
  }, [viewRef])

  useEffect(() => {
    scheduleRevalidate()
  }, [filePath, scheduleRevalidate])
  useEffect(() => window.api.onFolderTree(() => scheduleRevalidate()), [scheduleRevalidate])
  useEffect(() => {
    if (autoSave.lastAutoSaveAt) scheduleRevalidate()
  }, [autoSave.lastAutoSaveAt, scheduleRevalidate])
  useEffect(() => {
    const onFocus = (): void => scheduleRevalidate()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [scheduleRevalidate])

  useEffect(() => {
    setHtmlPasteFallbackNotice((key) => showToast(t(key)))
    return () => setHtmlPasteFallbackNotice(null)
  }, [showToast])

  useE2eSeams({
    workspace,
    openGlobalSearch,
    openSearchResult,
    sidebarModeRef,
    stats,
    insertMermaidTemplate,
    openMermaidInsert,
    dialogOpen: showMermaidInsert,
    resolveAndNavigate,
    revalidateLinks,
    openExternalImplRef,
    restoreFoldsForRef,
    insertCalloutTemplate,
    setShowCalloutInsert,
    calloutDialogOpen: showCalloutInsert,
    openTableInsert,
    tableDialogRef,
    tableFormRef,
    patchTableForm,
    confirmTableDialog,
    formatDocument,
    showFormatWarnings,
    lastFormatRef,
    formatWarningsRef,
    viewRef,
    fileOps,
    filePathRef
  })

  const commandOps: CommandOps = {
    viewRef,
    newFile: fileOps.newFile,
    openFile: fileOps.openFile,
    openFolder: workspace.openFolder,
    saveFile: async () => {
      await fileOps.saveFile()
    },
    saveFileAs: () => fileOps.saveFileAs(),
    toggleTheme,
    loadContent: fileOps.loadContent,
    toggleSidebar,
    openGlobalSearch,
    openPreferences: () => setShowPreferences(true),
    openRecentFile: fileOps.openRecentFile,
    clearRecentFiles,
    exportDocument: exportOps.openExport,
    openQuickOpen: () => setShowQuickOpen(true),
    openMermaidInsert,
    openCalloutInsert,
    openTableInsert,
    formatDocument,
    nextTab: () => fileOps.nextTab(),
    closeTab: () => {
      void fileOps.closeTab(fileOps.getActiveTabId())
    },
    reopenClosedTab: () => {
      void fileOps.reopenClosedTab()
    },
    getTabCount: () => fileOps.getTabCount(),
    hasClosedTabs: () => fileOps.hasClosedTabs(),
    hasSelection: () => {
      const v = viewRef.current
      return !!v && v.state.selection.main.from !== v.state.selection.main.to
    },
    showToast,
    openLinkAtCursor: () => {
      const v = viewRef.current
      if (!v) return
      const info = linkAtPos(v.state, v.state.selection.main.head)
      if (!info) {
        showToast(t('ctx.noLink'))
        return
      }
      void resolveAndNavigate(info.href)
    },
    copyLinkAddressAtCursor: () => {
      const v = viewRef.current
      if (!v) return
      const info = linkAtPos(v.state, v.state.selection.main.head)
      if (!info) {
        showToast(t('ctx.noLink'))
        return
      }
      void window.api.clipboardWrite(info.href).then(() => showToast(t('toast.copiedLink')))
    }
  }
  const commandOpsRef = useRef(commandOps)
  commandOpsRef.current = commandOps
  const cmdCache = useRef(createCommandCache(() => commandOpsRef.current)).current

  useEffect(() => {
    setCtxRuntime({
      runCommand: (id) => {
        cmdCache.get(id)?.run()
      },
      isCommandDisabled: (id) => {
        return cmdCache.get(id)?.isDisabled?.() ?? false
      },
      getBaseDir: () => {
        const p = filePathRef.current
        return p ? p.replace(/[^/\\]+$/, '') : ''
      },
      getActiveFilePath: () => filePathRef.current,
      toast: showToast,
      clipboardWrite: (text) => window.api.clipboardWrite(text),
      openLink: (href) => {
        void resolveAndNavigate(href)
      },
      confirm: (opts) => dialog.confirm(opts)
    })
    return () => setCtxRuntime(null)
  }, [showToast, resolveAndNavigate])

  const { menus } = useMenus({
    isMac,
    recentItems,
    ...commandOps
  })

  useEffect(() => {
    return window.api.onFullScreen((full) => setIsFullScreen(full))
  }, [])

  const activeTab = fileOps.tabInfos.find((x) => x.active)
  const fileName = activeTab ? displayTabName(activeTab) : filePath ? baseNameOf(filePath) : 'Untitled'
  const folderName = workspace.folderPath
    ? baseNameOf(workspace.folderPath) || workspace.folderPath
    : null

  const openOpsPanel = (e: React.MouseEvent<HTMLElement>): void => {
    workspace.setTreeMenu(null)
    openSidebarOps(e.currentTarget.getBoundingClientRect())
  }

  return (
    <div
      className={`app theme-${theme}${isMac ? ' platform-mac' : ''}${
        isFullScreen ? ' is-fullscreen' : ''
      }`}
    >
      <Titlebar
        menus={menus}
        fileName={fileName}
        dirty={dirty}
        autoSaveAt={autoSave.lastAutoSaveAt}
        autoSaveError={autoSave.lastAutoSaveError}
        hideSavedAt={dirty && prefs.autoSaveMode === 'off'}
      />

      <div className="main">
        {showSidebar && (
          <aside className="sidebar" style={{ width: sidebarWidth }}>
            <div className="sidebar-tabs" role="tablist" aria-label={t('sidebar.tabs')}>
              <button
                type="button"
                role="tab"
                aria-selected={sidebarMode === 'files'}
                className={`sidebar-tab${sidebarMode === 'files' ? ' is-active' : ''}`}
                onClick={() => switchSidebarMode('files')}
              >
                {t('sidebar.tab.files')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sidebarMode === 'outline'}
                className={`sidebar-tab${sidebarMode === 'outline' ? ' is-active' : ''}`}
                onClick={() => switchSidebarMode('outline')}
              >
                {t('sidebar.tab.outline')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sidebarMode === 'search'}
                className={`sidebar-tab${sidebarMode === 'search' ? ' is-active' : ''}`}
                onClick={openGlobalSearch}
              >
                {t('sidebar.tab.search')}
              </button>
              <button
                type="button"
                className="sidebar-tabs-close"
                onClick={toggleSidebar}
                title={t('sidebar.close')}
                aria-label={t('sidebar.close')}
              >
                <CloseIcon size={14} />
              </button>
            </div>
            {sidebarMode === 'search' ? (
              <SearchPanel
                folderPath={workspace.folderPath}
                currentFilePath={filePath}
                dirty={dirty}
                focusToken={searchFocusToken}
                onOpenAt={openSearchResult}
                onReloadIfOpen={reloadOpenFile}
              />
            ) : sidebarMode === 'files' ? (
              workspace.folderPath ? (
                <>
                  <div className="sidebar-header" title={workspace.folderPath}>
                    <span className="sidebar-title">{folderName}</span>
                    <button
                      className="sidebar-action"
                      onClick={() => void workspace.treeNewFileAt()}
                      title={t('app.newFile')}
                    >
                      +
                    </button>
                  </div>
                  <FileTree
                    key={workspace.folderPath}
                    nodes={workspace.folderTree}
                    activePath={filePath}
                    renamingPath={workspace.renamingPath}
                    selectedPath={workspace.selection?.path ?? null}
                    onSelect={workspace.selectNode}
                    onOpen={(path) => void workspace.openFileFromTree(path)}
                    onContextMenu={workspace.setTreeMenu}
                    onMove={(src, dest) => void workspace.treeMove(src, dest)}
                    onRenameCommit={(node, name) => void workspace.finishInlineRename(node, name)}
                    onRenameCancel={workspace.cancelInlineRename}
                    pendingCreate={workspace.pendingCreate}
                    onCreateCommit={(name) => void workspace.commitTreeCreate(name)}
                    onCreateCancel={workspace.cancelTreeCreate}
                  />
                  <div
                    className="filetree-blank"
                    onContextMenu={(e) => {
                      e.preventDefault()
                      workspace.setTreeMenu({
                        x: e.clientX,
                        y: e.clientY,
                        node: null
                      })
                    }}
                  />
                  <div className="filetree-bottombar" role="toolbar" aria-label={t('ops.bar')}>
                    <button
                      type="button"
                      className="filetree-bar-btn"
                      data-op="sidebar.ops.newFile"
                      title={t('app.newFile')}
                      onClick={() => void workspace.treeNewFileAt()}
                    >
                      +
                    </button>
                    <div
                      className="filetree-bar-unit"
                      data-op="sidebar.ops.open"
                      onClick={openOpsPanel}
                    >
                      <button
                        type="button"
                        className="filetree-bar-dir"
                        title={workspace.folderPath}
                      >
                        {folderName}
                      </button>
                      <button
                        type="button"
                        className="filetree-bar-btn"
                        title={t('ops.title')}
                      >
                        <MoreVerticalIcon size={14} />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="filetree-bar-btn"
                      data-op="sidebar.ops.toggleView"
                      title={t('ops.toggleView')}
                      aria-pressed={prefs.fileTreeView === 'list'}
                      onClick={() =>
                        setPreferences({
                          fileTreeView: prefs.fileTreeView === 'list' ? 'tree' : 'list'
                        })
                      }
                    >
                      {prefs.fileTreeView === 'list' ? <ListIcon size={14} /> : <TreeIcon size={14} />}
                    </button>
                  </div>
                  <SidebarOpsPanel
                    onNewFile={() => void workspace.treeNewFileAt()}
                    onSearch={() => setShowQuickOpen(true)}
                    onReveal={() => {
                      if (workspace.folderPath) {
                        window.api.showItemInFolder(workspace.folderPath)
                      }
                    }}
                    onOpenFolder={() => void workspace.openFolder()}
                    onRefresh={() => void workspace.refreshTree()}
                    onOpenRecent={(path) => void workspace.loadFolder(path)}
                    currentRoot={workspace.folderPath}
                  />
                  {workspace.treeMenu && (
                    <TreeMenu
                      x={workspace.treeMenu.x}
                      y={workspace.treeMenu.y}
                      items={workspace.treeMenuItems}
                      onClose={() => workspace.setTreeMenu(null)}
                    />
                  )}
                </>
              ) : (
                <div className="sidebar-empty">
                  <p>{t('sidebar.filesEmptyUntitled')}</p>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void workspace.openFolder()}
                  >
                    {t('cmd.openFolder')}
                  </button>
                </div>
              )
            ) : (
              <Outline
                items={outline}
                activePos={activePos}
                onSelect={goToHeading}
                foldedKeys={foldedKeys}
                foldableKeys={foldableKeys}
                onToggleFold={(_pos, key) => {
                  viewRef.current?.dispatch({ effects: toggleFold.of(key) })
                }}
              />
            )}
          </aside>
        )}
        {showSidebar && (
          <div
            className={`sidebar-resizer${sidebarResizing ? ' resizing' : ''}`}
            onMouseDown={startSidebarResize}
          />
        )}
        <div className="editor-column">
          {fileOps.tabInfos.length > 0 && (
            <TabsBar
              tabs={fileOps.tabInfos}
              onActivate={(id) => fileOps.activateTab(id)}
              onClose={(id) => {
                void fileOps.closeTab(id)
              }}
              onCloseOthers={(id) => {
                void fileOps.closeOtherTabs(id)
              }}
              onCloseRight={(id) => {
                void fileOps.closeTabsRight(id)
              }}
              onReorder={(dragId, targetId) => fileOps.reorderTab(dragId, targetId)}
            />
          )}
          <div className="editor-host" ref={hostRef} />
        </div>
      </div>
      {prefs.showStatusBar !== false && (
        <StatusBar
          stats={stats}
          prefs={prefs}
          autoSaveAt={autoSave.lastAutoSaveAt}
          autoSaveError={autoSave.lastAutoSaveError}
          exporting={exportOps.exporting}
          hideSavedAt={dirty && prefs.autoSaveMode === 'off'}
          formatWarnings={formatWarnings}
          onShowFormatWarnings={showFormatWarnings}
        />
      )}
      <Preferences open={showPreferences} onClose={() => setShowPreferences(false)} />
      <QuickOpen
        open={showQuickOpen}
        nodes={workspace.folderTree}
        folderPath={workspace.folderPath}
        onOpenFile={(path) => void workspace.openFileFromTree(path)}
        onClose={() => setShowQuickOpen(false)}
      />
      <ExportDialog
        format={exportOps.exportFormat}
        defaults={exportOps.exportOptions}
        exporting={exportOps.exporting}
        onClose={exportOps.closeExport}
        onConfirm={(format, options) => void exportOps.runExport(format, options)}
      />
      <ListPickDialog
        open={showMermaidInsert}
        title={t('mermaid.dialogTitle')}
        items={getMermaidTemplates().map((x) => ({ id: x.id, labelKey: x.labelKey }))}
        onPick={insertMermaidTemplate}
        onClose={() => setShowMermaidInsert(false)}
      />
      <ListPickDialog
        open={showCalloutInsert}
        title={t('callout.insertTitle')}
        items={CALLOUT_TYPES.map((tp) => ({ id: tp, labelKey: `callout.${tp}` }))}
        onPick={insertCalloutTemplate}
        onClose={() => setShowCalloutInsert(false)}
      />
      <TableInsertDialog
        open={tableDialog}
        form={tableForm}
        selectionText={tableSelText}
        onClose={() => setTableDialog(null)}
        onFormChange={patchTableForm}
        onConfirm={confirmTableDialog}
      />
      <MermaidLightbox />
      <UpdaterBridge />
      <ToastHost />
      <DialogHost />
      <EditorContextMenuHost />
      <RenderFloatHost />
    </div>
  )
}
