import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { getLivePreviewConfig } from './editor/livePreview/config'
import {
  expandFolds,
  foldKey,
  getFoldedKeys,
  headingAtLine,
  restoreFolds,
  toggleFold
} from './editor/livePreview/fold'
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
import {
  mermaidFenceAt,
  resolvePinnedFence,
  type MermaidFence
} from './editor/mermaidPreview'
import { MermaidPreviewPanel } from './components/MermaidPreviewPanel'
import { TabsBar } from './components/TabsBar'
import MermaidLightbox from './components/MermaidLightbox'
import { DialogHost, dialog } from './components/Dialog'
import { EditorContextMenuHost } from './components/EditorContextMenu'
import { SearchIcon } from './components/Icons'
import { createExtensions, updateEditingAssists, updateShowLineNumbers, bumpImageEpoch, bumpLinkEpoch, bumpI18nEpoch, updateLivePreviewConfig } from './editor/setup'
import { invalidateImageCache } from './editor/widgets'
import { readEditingAssistsConfig, setHtmlPasteFallbackNotice } from './editor/assists'
import { formatMarkdown, type FormatWarning } from './editor/format'
import { extractOutline, findHeadingBySlug, type OutlineItem } from './outline/extract'
import { MERMAID_TEMPLATES, isCursorInMermaidFence } from './editor/mermaidTemplates'
import { CALLOUT_TYPES } from './editor/livePreview/callout'
import { getWelcomeMd, WELCOME_MD_EN, WELCOME_MD_ZH } from './content'
import { getLang, resolveLang, setLang, t, useTranslation } from './i18n'
import StatusBar, { EMPTY_STATS, computeDocStats, type DocStats } from './components/StatusBar'
import { useFileOps } from './hooks/useFileOps'
import { useAutoSave } from './hooks/useAutoSave'
import { useWorkspaceTree } from './hooks/useWorkspaceTree'
import { useAppTheme } from './hooks/useAppTheme'
import { useExport } from './hooks/useExport'
import { useMenus } from './hooks/useMenus'
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
import { buildCommands, type CommandOps, type RecentItem } from './commands'
import { linkAtPos } from './editor/contextMenu/detect'
import { setCtxRuntime } from './editor/contextMenu/registry'
import { useE2eSeams } from './e2e/seams'
import { installP12Handle } from './e2e/seams/p12'

export default function App(): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  // True only while the startup restore is replaying lastFile/lastFolder, so
  // openRecentFile does not fight the restored sidebar mode.
  const restoringRef = useRef(false)
  // Separate from restoringRef: that one brackets the async restore body, while
  // this stays false from first render until the restore attempt is resolved,
  // so the session-persistence effects below cannot write during the gap.
  // State rather than a ref, because flipping it must re-run those effects —
  // a ref would leave them permanently skipped after their mount run.
  const [sessionSynced, setSessionSynced] = useState(false)

  // macOS: native traffic lights + menu-bar shortcuts; Win/Linux: custom titlebar.
  const isMac = window.api.platform === 'darwin'

  const { theme, toggleTheme } = useAppTheme(viewRef)
  const prefs = usePreferences()
  // P14: subscribes App (and therefore all t() descendants) to language flips.
  const { lang } = useTranslation()
  const [stats, setStats] = useState<DocStats>(EMPTY_STATS)
  // P20 transient command feedback chip in the status bar.
  const [toast, setToast] = useState<string | null>(null)
  const toastRef = useRef<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const showToast = useCallback((message: string) => {
    toastRef.current = message
    setToast(message)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      toastRef.current = null
      setToast(null)
    }, 2500)
  }, [])
  const session = useSession()
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [activePos, setActivePos] = useState<number | null>(null)
  // P03: sidebar visibility/mode/width come from session memory; with no
  // memory yet, visibility falls back to the "sidebar open by default" pref.
  const [showOutline, setShowOutline] = useState(
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
  // P13: bumped by Ctrl+Shift+F so the SearchPanel focuses its query box.
  const [searchFocusToken, setSearchFocusToken] = useState(0)

  const updateOutline = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    setOutline(extractOutline(view.state))
  }, [])

  const updateActiveHeading = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const head = view.state.selection.main.head
    const line = view.state.doc.lineAt(head).from
    let active: number | null = null
    for (const item of extractOutline(view.state)) {
      if (item.pos <= line) active = item.pos
      else break
    }
    setActivePos(active)
  }, [])

  const fileOps = useFileOps({
    viewRef,
    updateOutline,
    setSidebarMode,
    restoringRef,
    onSaveFailed: showToast,
    // wave⑥-6 F3: format-on-save throw — one-shot, distinct copy from save failures.
    onFormatOnSaveFailed: () => showToast(t('format.onSaveFailed'))
  })
  const { dirty, setDirty, filePath, filePathRef, syncAppState, savedContentRef } = fileOps

  // ---- P18: heading folds ------------------------------------------------------
  const [foldedKeys, setFoldedKeys] = useState<ReadonlySet<string>>(() => new Set())
  const foldSigRef = useRef<string>('')

  /**
   * Mirror the editor fold set into React (Outline triangles) and persist it
   * under SessionState.headingFolds[filePath]. Signature-gated so frequent
   * selection transactions stay cheap and do not spam localStorage.
   */
  const syncFoldedKeys = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const keys = getFoldedKeys(view.state)
    const sig = [...keys].sort().join('\n')
    if (sig === foldSigRef.current) return
    foldSigRef.current = sig
    setFoldedKeys(new Set(keys))
    // Programmatic document replacement (file open/switch) drops the outgoing
    // file's keys inside foldField — that is not a user unfold. Persisting it
    // would wipe the target path's session folds mid-switch, so loads skip
    // the session write (see useFileOps suppressDirtyRef).
    if (fileOps.suppressDirtyRef.current) return
    const path = filePathRef.current
    if (!path) return
    const have = new Set(extractOutline(view.state).map((i) => foldKey(i.level, i.text)))
    const valid = [...keys].filter((k) => have.has(k))
    const all = getSession().headingFolds ?? {}
    patchSession({ headingFolds: { ...all, [path]: valid } })
  }, [viewRef, filePathRef, fileOps.suppressDirtyRef])
  const syncFoldedKeysRef = useRef(syncFoldedKeys)
  syncFoldedKeysRef.current = syncFoldedKeys

  /** Restore session folds for `path` — keys must still match live headings. */
  const restoreFoldsFor = useCallback(
    (path: string | null) => {
      const view = viewRef.current
      if (!view) return
      const saved = path ? getSession().headingFolds?.[path] : undefined
      const have = new Set(extractOutline(view.state).map((i) => foldKey(i.level, i.text)))
      const valid = new Set((saved ?? []).filter((k) => have.has(k)))
      view.dispatch({ effects: restoreFolds.of(valid) })
    },
    [viewRef]
  )
  const restoreFoldsForRef = useRef(restoreFoldsFor)
  restoreFoldsForRef.current = restoreFoldsFor

  // File open/switch → apply that file's remembered folds.
  // loadContent dispatches the new doc synchronously before setFilePath, so
  // this effect (post-render) always reads outlines of the new document.
  useEffect(() => {
    restoreFoldsForRef.current(filePath)
  }, [filePath])

  // P12: autosave + draft pipeline. notifyChange is read through a ref from
  // the editor's once-mounted onChange (see createExtensions below).
  const autoSave = useAutoSave({
    viewRef,
    filePathRef,
    dirtyRef: fileOps.dirtyRef,
    savedContentRef,
    mode: prefs.autoSaveMode,
    delaySec: prefs.autoSaveDelaySec,
    intervalMin: prefs.autoSaveIntervalMin,
    crashRecoveryEnabled: prefs.crashRecoveryEnabled,
    // wave③: autosave owns its failure channel (sticky slot + toast.autoSaveFailed*)
    // — suppress the manual-save toast to avoid double-firing.
    saveFile: () => fileOps.saveFile({ notifyFailure: false }),
    saveAllDirtyTabs: fileOps.saveAllDirtyTabs,
    setDirty,
    syncAppState,
    // UX-P12 F3: failure toast lands in the statusbar sb-toast slot.
    onAutoSaveFailed: showToast
  })
  const autoSaveNotifyRef = useRef(autoSave.notifyChange)
  autoSaveNotifyRef.current = autoSave.notifyChange

  const exportOps = useExport({ viewRef, filePath, onExported: showToast })

  const workspace = useWorkspaceTree({
    filePathRef,
    dirty,
    confirmDiscard: fileOps.confirmDiscard,
    loadContent: fileOps.loadContent,
    openDocPath: fileOps.openDocPath,
    setBaseDir: fileOps.setBaseDir,
    setFilePath: fileOps.setFilePath,
    syncAppState,
    setSidebarMode,
    setShowOutline
  })

  // ---- P03: session persistence ---------------------------------------------
  // These effects fire on mount, which is *before* the restore effect runs and
  // while restoringRef is still false. Writing then would overwrite the saved
  // session with the initial React state — sidebarVisible true, mode 'outline',
  // width 240 — wiping recents, last paths and the stored sidebar layout on
  // every launch. Gate on sessionSynced, which the restore effect flips once
  // the saved state has been applied; flipping it re-runs these effects, so
  // the restored values are written back and later edits keep persisting.
  useEffect(() => {
    if (!sessionSynced) return
    patchSession({ sidebarVisible: showOutline })
  }, [sessionSynced, showOutline])
  useEffect(() => {
    if (!sessionSynced) return
    patchSession({ sidebarMode })
  }, [sessionSynced, sidebarMode])
  useEffect(() => {
    if (!sessionSynced) return
    patchSession({ sidebarWidth })
  }, [sessionSynced, sidebarWidth])
  // P26: tab set persistence (paths + active) — fires when tabs change.
  useEffect(() => {
    if (!sessionSynced) return
    fileOps.persistTabsSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionSynced, fileOps.tabInfos])

  // Validated Recent Files entries for the File menu (and the macOS native
  // menu, which receives the same list over IPC).
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const files = session.recentFiles
      const items = await Promise.all(
        files.map(async (path) => ({
          path,
          name: path.replace(/^.*[\\/]/, ''),
          exists: await window.api.pathExists(path)
        }))
      )
      if (!cancelled) setRecentItems(items)
    })()
    return () => {
      cancelled = true
    }
  }, [session.recentFiles])

  useEffect(() => {
    void window.api.setRecentFiles(recentItems.map(({ path, exists }) => ({ path, exists })))
  }, [recentItems])

  // Native-menu Open Recent / Clear Menu clicks arrive with payloads.
  useEffect(() => {
    const offOpen = window.api.onMenu('menu:openRecent', (path?: string) => {
      if (path) void fileOps.openRecentFile(path)
    })
    const offClear = window.api.onMenu('menu:clearRecent', () => clearRecentFiles())
    // P26 native-menu tab commands (darwin File menu + Cmd/Ctrl+W routing).
    const offCloseTab = window.api.onMenu('menu:closeTab', () => {
      void fileOps.closeTab(fileOps.getActiveTabId())
    })
    const offReopenTab = window.api.onMenu('menu:reopenClosedTab', () => {
      void fileOps.reopenClosedTab()
    })
    const offNextTab = window.api.onMenu('menu:nextTab', () => fileOps.nextTab())
    const offCloseOrWindow = window.api.onMenu('menu:closeTabOrWindow', () => {
      // Spec: Cmd/Ctrl+W closes a tab only when tabs>1; otherwise it keeps
      // the window-close semantics (P12 intercept runs on window:close).
      if (fileOps.getTabCount() > 1) {
        void fileOps.closeTab(fileOps.getActiveTabId())
      } else {
        void fileOps.queryClose().then((allow) => {
          if (allow) window.api.windowClose()
        })
      }
    })
    return () => {
      offOpen()
      offClear()
      offCloseTab()
      offReopenTab()
      offNextTab()
      offCloseOrWindow()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileOps])

  // Minimal session restore (full snapshot restore belongs to P12): reopen the
  // last folder workspace and file. System open-file events queued in main
  // arrive right after rendererReady and simply replace whatever we load here.
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
      restoringRef.current = true
      try {
        if (saved.lastFolderPath && (await window.api.pathExists(saved.lastFolderPath))) {
          await workspace.loadFolder(saved.lastFolderPath)
        }
        // P26: restore the whole tab set; missing files are skipped with a
        // toast (acceptance 4). Falls back to lastFilePath for old sessions.
        const openTabs =
          saved.openTabs && saved.openTabs.length > 0
            ? saved.openTabs
            : saved.lastFilePath
              ? [saved.lastFilePath]
              : []
        const missingNames: string[] = []
        for (const p of openTabs) {
          if (await window.api.pathExists(p)) {
            await fileOps.openDocPath(p, { activate: false, quiet: true })
          } else {
            // wave⑥/⑦ F3: list-form (names, capped) — count-only toast is
            // not actionable when several tabs fail to restore.
            missingNames.push(p.split('/').pop() || p)
          }
        }
        if (saved.activePath && (await window.api.pathExists(saved.activePath))) {
          await fileOps.openDocPath(saved.activePath, { quiet: true })
        } else if (openTabs.length > 0) {
          // Activate the first restored tab that exists.
          for (const p of openTabs) {
            if (await window.api.pathExists(p)) {
              await fileOps.openDocPath(p, { quiet: true })
              break
            }
          }
        }
        if (missingNames.length > 0) {
          // List-form toast (wave⑦ F3): name the files (cap 3 + overflow count)
          // so the skip is actionable; never blocks session restore.
          const shown = missingNames.slice(0, 3).join(', ')
          const overflow = missingNames.length > 3 ? ` +${missingNames.length - 3}` : ''
          showToast(t('tabs.missingRestoredList', { names: shown + overflow }))
        }
        {
          // P12: reapply the saved cursor position with the restored file.
          const view = viewRef.current
          const cursor = saved.lastCursor
          if (view && cursor != null && cursor > 0 && cursor <= view.state.doc.length) {
            view.dispatch({ selection: { anchor: cursor } })
          }
        }
        // Reapply the stored mode last, so restoring a file inside a folder
        // workspace comes back in files mode (acceptance criterion 2).
        if (saved.sidebarMode) setSidebarMode(saved.sidebarMode)
      } catch {
        // restore is best-effort
      } finally {
        restoringRef.current = false
        // Re-enable the session-persistence effects only now, so they fire for
        // the restored state rather than clobbering it mid-boot.
        setSessionSynced(true)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- P12: close intercept + crash-recovery drafts --------------------------
  // Startup draft scan: after session restore settles, compare stored drafts
  // against disk and offer restore/discard. Runs once per launch when the
  // pref is on; e2e drives the same body via __veloxP12.runDraftCheck.
  const checkDrafts = useCallback(async (): Promise<void> => {
    const drafts = (await window.api.draftList()).slice().sort((a, b) => {
      // Named-file drafts first — a path-backed document is the higher-stakes
      // recovery offer; Untitled buffers follow. Also keeps the offer order
      // deterministic when both kinds of drafts survive a crash (UX-P12).
      return (a.path != null ? 0 : 1) - (b.path != null ? 0 : 1)
    })
    // UX-P12 F2 trust element: recovery copy carries the draft timestamp.
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
        void window.api.draftDiscard(d.path)
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
          fileOps.loadContent(d.content, null)
          // Draft content was never saved — dirty against an empty baseline.
          fileOps.savedContentRef.current = ''
          fileOps.dirtyRef.current = true
          fileOps.setDirty(true)
        } else if (choice === 'discard') {
          void window.api.draftDiscard(null)
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
        // Loaded draft vs disk baseline → dirty until the user saves again.
        fileOps.savedContentRef.current = disk
        const isDirty = d.content !== disk
        fileOps.dirtyRef.current = isDirty
        fileOps.setDirty(isDirty)
        fileOps.syncAppState(d.path, isDirty)
        // Restore keeps the draft until an explicit save/discard.
      } else if (choice === 'discard') {
        void window.api.draftDiscard(d.path)
      }
      // 'cancel'/Later: leave the draft on disk — the next launch re-offers.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileOps.loadContent, fileOps.setDirty, fileOps.syncAppState])

  useEffect(() => {
    if (!sessionSynced) return
    if (!getPreferences().crashRecoveryEnabled) return
    void checkDrafts()
  }, [sessionSynced, checkDrafts])

  // Close-query subscription + CDP handle. Identity tracks queryClose.
  const queryClose = fileOps.queryClose
  // lastAutoSaveAt via ref — this effect must not depend on the autosave
  // hook's per-render object identity.
  const lastAutoSaveAtRef = useRef<number | null>(null)
  lastAutoSaveAtRef.current = autoSave.lastAutoSaveAt
  useEffect(() => {
    installP12Handle({ queryClose, fileOps, filePathRef, checkDrafts, lastAutoSaveAtRef })
    return window.api.onQueryClose(() => {
      void queryClose().then((allow) => window.api.closeResponse(allow))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClose, checkDrafts])

  // ---- P07: folder-tree scan options live in preferences (renderer) but are
  // applied in main — push them whenever they change (main re-scans if a
  // folder is being watched).
  useEffect(() => {
    void window.api.setFolderOptions({
      ignoreNames: prefs.folderIgnoreNames,
      showHiddenFiles: prefs.showHiddenFiles
    })
  }, [prefs.folderIgnoreNames, prefs.showHiddenFiles])

  // ---- editor preference toggles (live reconfigure) --------------------------
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

  // P08: focus / typewriter / source modes — the command registry only writes
  // preferences; this effect is the single path that pushes them into the
  // editor config facet (decorations rebuild via the facet, per field.ts).
  const prevSourceModeRef = useRef(prefs.sourceMode)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    updateLivePreviewConfig(view, {
      mode: prefs.sourceMode ? 'source' : 'live',
      focusMode: prefs.focusMode,
      typewriterMode: prefs.typewriterMode,
      // P24: code-block display prefs — facet identity change rebuilds widgets.
      codeBlockCollapseLines: prefs.codeBlockCollapseLines,
      codeBlockShowLineNumbers: prefs.codeBlockShowLineNumbers,
      codeBlockWrap: prefs.codeBlockWrap
    })
    // Line heights change when live-preview decorations drop (source) or
    // return (live); the doc offsets are identical either way, so re-centering
    // on the cursor is all the "position mapping" needed.
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

  // ---- sidebar drag-resize ---------------------------------------------------
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

  // ---- create editor --------------------------------------------------------
  useEffect(() => {
    if (!hostRef.current || viewRef.current) return
    let cursorPersistTimer: ReturnType<typeof setTimeout> | undefined

    // P26: one extensions array serves the initial state AND every DocTab
    // state — view.setState requires the same extension configuration.
    const extensions = createExtensions(
          {
            onChange: () => {
              // P12 dirty flag: set on change, cleared on save — no per-change
              // full-document compare. Programmatic loads suppress the flag.
              if (!fileOps.suppressDirtyRef.current && !fileOps.dirtyRef.current) {
                fileOps.dirtyRef.current = true
                setDirty(true)
                syncAppState(filePathRef.current, true)
              }
              updateOutline()
              // P18: heading renames drop fold keys inside foldField (docChanged
              // filter) without emitting fold effects — mirror into React.
              syncFoldedKeysRef.current()
              // P12 autosave + draft debounce pipelines.
              autoSaveNotifyRef.current()
              // P14 status bar: cursor immediate + full stats debounced.
              updateCursorStatsRef.current()
              scheduleDocStatsRef.current()
              // P25: mermaid preview follows doc edits under the cursor/pin.
              mpProbeRef.current(view.state)
            },
            onSelectionChanged: () => {
              updateActiveHeading()
              updateCursorStatsRef.current()
              // P18: auto-expand folds live in foldField.update — mirror on selection.
              syncFoldedKeysRef.current()
              // P12: persist the cursor for session restore (throttled).
              const head = view.state.selection.main.head
              clearTimeout(cursorPersistTimer)
              cursorPersistTimer = setTimeout(() => patchSession({ lastCursor: head }), 500)
              // P25: fence-entry/exit detection is selection-driven.
              mpProbeRef.current(view.state)
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
            // P05: images need the document's directory for assets/ — resolve
            // true when a path exists, otherwise run Save As first.
            ensureSaved: async () => {
              if (filePathRef.current) return true
              return fileOps.saveFileAs()
            }
          },
          // Read from the store, not the closure: this effect runs once ([]),
          // so a `theme` captured here would be the mount-time value and a
          // theme chosen before the editor mounts would never reach it.
          getPreferences().theme === 'dark' ? 'dark' : 'light',
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
    // P26: register the shared extension array + seed the welcome tab.
    fileOps.initTabs(extensions, view.state.doc.toString())
    // CDP smoke-test handle (scripts/cdp-p05.mjs) — no other runtime consumers.
    // applyLivePreviewConfig lets CDP toggle source/focus/typewriter modes the
    // same way the prefs effect below does, without going through the store.
    window.__veloxEditor = { view, applyLivePreviewConfig: updateLivePreviewConfig }
    updateOutline()
    updateCursorStatsRef.current()
    scheduleDocStatsRef.current()

    // Editor is mounted — main may now deliver queued system open-file paths.
    window.api.rendererReady()

    return () => {
      clearTimeout(cursorPersistTimer)
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- P05: image cache invalidation -----------------------------------------
  const refreshImages = useCallback(() => {
    invalidateImageCache()
    const view = viewRef.current
    if (view) bumpImageEpoch(view)
  }, [])

  // Folder workspace: the watcher broadcasts every image file change.
  useEffect(() => window.api.onImageChanged(() => refreshImages()), [refreshImages])

  // Single-file mode has no watcher — revalidate when the window regains focus.
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

  // ---- outline navigation ---------------------------------------------------
  const goToHeading = useCallback((pos: number) => {
    const view = viewRef.current
    if (!view) return
    // P18: jumping to a folded heading unfolds it first; a heading hidden
    // inside a folded parent auto-expands via foldField's selection rule.
    const item = headingAtLine(view.state, pos)
    const effects: Parameters<typeof view.dispatch>[0] extends { effects?: infer E }
      ? E extends readonly (infer U)[]
        ? U[]
        : never
      : never = [EditorView.scrollIntoView(pos, { y: 'center' })]
    if (item) {
      const key = foldKey(item.level, item.text)
      if (getFoldedKeys(view.state).has(key)) {
        effects.unshift(expandFolds.of([key]))
      }
    }
    view.dispatch({
      selection: { anchor: pos },
      effects,
      scrollIntoView: true
    })
    view.focus()
  }, [])

  const toggleOutline = useCallback(() => setShowOutline((v) => !v), [])

  // ---- P14: language pref → i18n runtime + macOS native menu ------------------
  useEffect(() => {
    const resolved = resolveLang(prefs.language)
    setLang(resolved)
    void window.api.setUiLanguage(resolved).catch(() => {})
    // wave④/P18-F6: live-preview widgets embed t() strings at build time —
    // bump the decoration epoch so lang-tagged widgets (fold/callout chips,
    // table toolbar) re-render instead of keeping stale DOM.
    const view = viewRef.current
    if (view) bumpI18nEpoch(view)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.language])

  // UX-P01-F8/P08: keep the macOS native menu's checkbox state in sync with
  // the preference-backed toggles (in-app MenuBar reads checked() live).
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

  // Swap a still-showing welcome document when the language flips.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (filePathRef.current != null) return
    const doc = view.state.doc.toString()
    if (doc !== WELCOME_MD_EN && doc !== WELCOME_MD_ZH) return
    const next = getWelcomeMd(lang)
    if (doc === next) return
    fileOps.loadContent(next, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  // ---- P14 status-bar stats bridges (cursor live; doc stats debounced 300ms) -
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

  // ---- P13 folder-wide search ------------------------------------------------
  // P13-F3: remember the non-search mode so SearchPanel's single back button
  // returns to wherever the user came from (files/outline), not always files.
  const sidebarBackModeRef = useRef<SidebarMode>('files')
  const switchSidebarMode = useCallback((mode: SidebarMode) => {
    const cur = sidebarModeRef.current
    if (mode === 'search' && cur !== 'search') sidebarBackModeRef.current = cur
    setSidebarMode(mode)
  }, [])

  const openGlobalSearch = useCallback(() => {
    setShowOutline(true)
    switchSidebarMode('search')
    setSearchFocusToken((t) => t + 1)
  }, [switchSidebarMode])

  /** Open a search hit: same dirty gate, then cursor at line/col. */
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

  /** Re-read an open file from disk after a replace wrote it. */
  const reloadOpenFile = useCallback(
    async (path: string) => {
      // P07/P26: external change reload — per-tab; inactive clean tabs swap
      // their stored state, dirty inactive tabs keep their edits (documented).
      await fileOps.reloadTabFromDisk(path)
    },
    [fileOps]
  )

  const sidebarModeRef = useRef<SidebarMode>(sidebarMode)
  sidebarModeRef.current = sidebarMode

  // ---- P16: Mermaid insert dialog + template application --------------------
  const [showMermaidInsert, setShowMermaidInsert] = useState(false)

  /** Menu/command entry: no-op while the cursor sits in a mermaid fence. */
  const openMermaidInsert = useCallback(() => {
    const view = viewRef.current
    if (view && isCursorInMermaidFence(view.state)) return
    setShowMermaidInsert(true)
  }, [viewRef])

  const insertMermaidTemplate = useCallback(
    (id: string) => {
      setShowMermaidInsert(false)
      const tpl = MERMAID_TEMPLATES.find((x) => x.id === id)
      const view = viewRef.current
      if (!tpl || !view) return
      const { state } = view
      const { from, to } = state.selection.main
      let insert = tpl.code
      let lead = 0
      // Keep the fence on its own lines even when inserted mid-sentence.
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

  // ---- P21: callout insert dialog + template application ---------------------
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
      // Cursor lands right after `[!TYPE] ` — the title slot.
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

  // ---- P22: table insert / convert dialog --------------------------------------
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
    // Selection text captured at open may be stale — re-read live selection.
    const { from, to } = view.state.selection.main
    const text = from === to ? tableSelText : view.state.doc.sliceString(from, to)
    const delim = form.delim ?? sniffDelimiter(text)
    const res = convertSelectionAtCursor(view, text, delim)
    if (!res.ok && res.reason === 'in-block') showToast(t('tableInsert.noConvertInBlock'))
    else if (!res.ok) showToast(t('tableInsert.noSelection'))
    view.focus()
  }, [showToast, tableSelText])

  // ---- P23: format document ---------------------------------------------------
  const lastFormatRef = useRef<{ changed: number; warnings: FormatWarning[] }>({
    changed: 0,
    warnings: []
  })
  // wave⑥-6 F1: warnings slot state — mirrors lastFormatRef; StatusBar chip
  // opens the detail dialog. Declared before formatDocument to stay hook-safe.
  const formatWarningsRef = useRef<FormatWarning[]>([])
  const [formatWarnings, setFormatWarnings] = useState<FormatWarning[]>([])
  formatWarningsRef.current = formatWarnings

  const formatDocument = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const before = view.state.doc.toString()
    const { text, warnings, changed } = formatMarkdown(before)
    lastFormatRef.current = { changed, warnings }
    // wave⑥-6 F1: warnings stay reachable even when the run changes nothing —
    // the status-bar slot mirrors lastFormat; toast still fires only on change.
    setFormatWarnings(warnings)
    if (text === before) return // silent when nothing to change
    // Best-effort cursor keep: map by line number, clamp into the new doc.
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

  // wave⑥-6 F1: warnings detail dialog — key-based title (live-relabel) with
  // line list resolved via i18n at open time (line numbers are data, not copy).
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

  // ---- P25: mermaid source live preview (route B) ----------------------------
  const mpPinRef = useRef(false)
  const mpFenceRef = useRef<MermaidFence | null>(null)
  const mpPinnedFenceRef = useRef<MermaidFence | null>(null)
  const mpHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mpCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mpProbeRef = useRef<(state: EditorState) => void>(() => {})
  const [mpFence, setMpFence] = useState<MermaidFence | null>(null)
  const [mpPin, setMpPin] = useState(false)
  // wave⑥-7 F2: two-phase collapse — 2s grace, then a short CSS transition
  // class before unmount so the panel visibly shrinks instead of vanishing.
  const [mpCollapsing, setMpCollapsing] = useState(false)

  const setMpFenceBoth = useCallback((f: MermaidFence | null) => {
    mpFenceRef.current = f
    setMpFence(f)
  }, [])

  const toggleMpPin = useCallback(() => {
    const next = !mpPinRef.current
    mpPinRef.current = next
    setMpPin(next)
    patchSession({ mermaidPreviewPin: next })
    if (next) {
      mpPinnedFenceRef.current = mpFenceRef.current
    } else {
      mpPinnedFenceRef.current = null
      const view = viewRef.current
      if (view) mpProbeRef.current(view.state)
    }
  }, [])

  // Probe body lives in an effect so createExtensions callbacks (registered
  // once at editor mount) always run the latest closure through the ref.
  useEffect(() => {
    mpProbeRef.current = (state: EditorState) => {
      if (mpPinRef.current) {
        const resolved = resolvePinnedFence(state, mpPinnedFenceRef.current)
        mpPinnedFenceRef.current = resolved
        setMpFenceBoth(resolved)
        return
      }
      const head = state.selection.main.head
      const inFence = mermaidFenceAt(state, head)
      if (inFence) {
        if (mpHideTimerRef.current) {
          clearTimeout(mpHideTimerRef.current)
          mpHideTimerRef.current = null
        }
        if (mpCollapseTimerRef.current) {
          clearTimeout(mpCollapseTimerRef.current)
          mpCollapseTimerRef.current = null
        }
        setMpCollapsing(false)
        setMpFenceBoth(inFence)
        return
      }
      // Leaving a fence: collapse after 2s; re-entering cancels the timer.
      if (mpFenceRef.current && !mpHideTimerRef.current) {
        mpHideTimerRef.current = setTimeout(() => {
          mpHideTimerRef.current = null
          const view = viewRef.current
          if (!view) return
          if (mpPinRef.current) return
          if (mermaidFenceAt(view.state, view.state.selection.main.head)) return
          // Phase 2: play the shrink transition, then unmount.
          setMpCollapsing(true)
          mpCollapseTimerRef.current = setTimeout(() => {
            mpCollapseTimerRef.current = null
            setMpCollapsing(false)
            const v = viewRef.current
            if (mpPinRef.current) return
            if (v && mermaidFenceAt(v.state, v.state.selection.main.head)) return
            setMpFenceBoth(null)
          }, 220)
        }, 2000)
      }
    }
  }, [setMpFenceBoth])

  // Session pin restore (P03) — mount-time only.
  useEffect(() => {
    const pin = getSession().mermaidPreviewPin === true
    mpPinRef.current = pin
    setMpPin(pin)
  }, [])

  // ---- P17: link navigation ---------------------------------------------------
  // openExternal goes through a seam so e2e can capture URLs instead of
  // launching the real browser (contextBridge window.api is frozen).
  const openExternalImplRef = useRef<((url: string) => Promise<boolean>) | null>(null)

  /** Scroll to the heading whose GitHub slug matches `anchor`; false if none. */
  const jumpToAnchor = useCallback(
    (anchor: string): boolean => {
      const view = viewRef.current
      if (!view || !anchor) return false
      // The target document may have just loaded — force a parse before lookup.
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
      // Keep the existence cache warm; decorations rebuild only on a flip.
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
        // Dirty gate intact: openFileByPath runs the P12 confirm flow.
        const ok = await fileOps.openFileByPath(res.absPath ?? href)
        if (!ok) return
        if (res.anchor) jumpToAnchor(res.anchor)
        return
      }
      if (res.kind === 'external') {
        const url = res.absPath ?? href
        if (!/^https?:\/\//i.test(url)) {
          // wave④/P17-F5: keyed copy — dialog resolves t() at render, so an
          // open modal live-relabels when the UI language changes.
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
      // kind === 'dir': sidebar locate is a 低优 item — not implemented in v1.
    },
    [fileOps, jumpToAnchor, viewRef]
  )

  /** Re-resolve every path-like href; bump linkEpoch when statuses flip. */
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
          /* transient IPC failure — keep the previous cache entry */
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

  // Navigation bus: linkNavExtension mousedown → resolveAndNavigate.
  useEffect(() => {
    setLinkNavHandler((href) => {
      void resolveAndNavigate(href)
    })
    return () => setLinkNavHandler(null)
  }, [resolveAndNavigate])

  // Hover tips: anchor slugs resolve to heading text via the current outline.
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
              /* unreadable target — path alone is enough */
            }
          }
          return text
        }
      } catch {
        /* fall through */
      }
      return href
    })
    return () => setLinkTipResolver(null)
  }, [viewRef])

  // Revalidation triggers: open/switch file, folder watcher, autosave, focus.
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

  // P19 wave⑥-4 F2: converter-throw fallback → one restrained status notice
  // (success stays silent — Typora-parity decision, UX-P19 report).
  useEffect(() => {
    setHtmlPasteFallbackNotice((key) => showToast(t(key)))
    return () => setHtmlPasteFallbackNotice(null)
  }, [showToast])

  // P13–P29 probe handles: single assembly entry (task 1A split). P12 installs
  // from the close-query effect above (subscription is product behavior);
  // __veloxEditor installs in the create-editor effect (editor lifecycle).
  useE2eSeams({
    // P13
    workspace,
    openGlobalSearch,
    openSearchResult,
    sidebarModeRef,
    // P14
    stats,
    // P16
    insertMermaidTemplate,
    openMermaidInsert,
    dialogOpen: showMermaidInsert,
    // P17
    resolveAndNavigate,
    revalidateLinks,
    openExternalImplRef,
    // P18
    restoreFoldsForRef,
    // P20
    toastRef,
    // P21
    insertCalloutTemplate,
    setShowCalloutInsert,
    calloutDialogOpen: showCalloutInsert,
    // P22
    openTableInsert,
    tableDialogRef,
    tableFormRef,
    patchTableForm,
    confirmTableDialog,
    // P23
    formatDocument,
    showFormatWarnings,
    lastFormatRef,
    formatWarningsRef,
    toast,
    // P25
    mpProbeRef,
    // shared (P13/P18/P19/P24–P26)
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
    toggleOutline,
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

  // P27 context-menu runtime — the registry builds items; this supplies the
  // app capabilities they call (command dispatch, clipboard, link open, toasts
  // and the P02 danger confirm). Commands are rebuilt per call so run closures
  // always see the latest ops.
  useEffect(() => {
    setCtxRuntime({
      runCommand: (id) => {
        const cmd = buildCommands(commandOpsRef.current).find((c) => c.id === id)
        if (cmd) cmd.run()
      },
      // P22-F3: menu-disabled state from the same catalog as runCommand.
      isCommandDisabled: (id) => {
        const cmd = buildCommands(commandOpsRef.current).find((c) => c.id === id)
        return cmd?.isDisabled?.() ?? false
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

  const { menus, formatShortcut } = useMenus({
    isMac,
    recentItems,
    ...commandOps
  })

  // Fullscreen state is pushed from main (traffic-light / F11 transitions).
  useEffect(() => {
    return window.api.onFullScreen((full) => setIsFullScreen(full))
  }, [])

  const activeTab = fileOps.tabInfos.find((x) => x.active)
  const fileName = activeTab ? activeTab.name : filePath ? filePath.replace(/^.*[\/]/, '') : 'Untitled'
  const folderName = workspace.folderPath
    ? workspace.folderPath.replace(/^.*[\\/]/, '') || workspace.folderPath
    : null

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
        theme={theme}
        toggleOutline={toggleOutline}
        toggleTheme={toggleTheme}
        formatShortcut={formatShortcut}
        autoSaveAt={autoSave.lastAutoSaveAt}
        autoSaveError={autoSave.lastAutoSaveError}
        hideSavedAt={dirty && prefs.autoSaveMode === 'off'}
        openSearch={openGlobalSearch}
      />

      <div className="main">
        {showOutline && (
          <aside className="sidebar" style={{ width: sidebarWidth }}>
            {sidebarMode === 'search' ? (
              <SearchPanel
                folderPath={workspace.folderPath}
                currentFilePath={filePath}
                dirty={dirty}
                focusToken={searchFocusToken}
                onOpenAt={openSearchResult}
                onReloadIfOpen={reloadOpenFile}
                onSwitchMode={switchSidebarMode}
                backMode={sidebarBackModeRef.current}
              />
            ) : sidebarMode === 'files' && workspace.folderPath ? (
              <>
                <div className="sidebar-header" title={workspace.folderPath}>
                  <span className="sidebar-title">{folderName}</span>
                  <button
                    className="sidebar-action"
                    onClick={openGlobalSearch}
                    title={t('app.searchInFolder')}
                  >
                    <SearchIcon size={13} />
                  </button>
                  <button
                    className="sidebar-action"
                    onClick={() => void workspace.treeNewFile(workspace.folderPath!)}
                    title={t('app.newFile')}
                  >
                    +
                  </button>
                </div>
                <FileTree
                  nodes={workspace.folderTree}
                  activePath={filePath}
                  renamingPath={workspace.renamingPath}
                  onOpen={(path) => void workspace.openFileFromTree(path)}
                  onContextMenu={workspace.setTreeMenu}
                  onMove={(src, dest) => void workspace.treeMove(src, dest)}
                  onRenameCommit={(node, name) => void workspace.finishInlineRename(node, name)}
                  onRenameCancel={workspace.cancelInlineRename}
                />
                {/* P07: right-click on the empty area under the tree → root menu
                    (rows stopPropagation, so only bare clicks land here). */}
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
              <>
                <div className="sidebar-header">
                  {workspace.folderPath && (
                    <button
                      className="sidebar-back"
                      onClick={() => setSidebarMode('files')}
                      title={t('app.filesBack')}
                    >
                      {t('app.filesBack')}
                    </button>
                  )}
                  <span>{t('outline.title')}</span>
                  {workspace.folderPath && (
                    <button
                      className="sidebar-action"
                      onClick={openGlobalSearch}
                      title={t('app.searchInFolder')}
                    >
                      <SearchIcon size={13} />
                    </button>
                  )}
                </div>
                <Outline
                  items={outline}
                  activePos={activePos}
                  onSelect={goToHeading}
                  foldedKeys={foldedKeys}
                  onToggleFold={(_pos, key) => {
                    viewRef.current?.dispatch({ effects: toggleFold.of(key) })
                  }}
                />
              </>
            )}
          </aside>
        )}
        {showOutline && (
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
          {mpFence && (
            <MermaidPreviewPanel
              code={mpFence.code}
              theme={prefs.theme === 'dark' ? 'dark' : 'light'}
              pin={mpPin}
              collapsing={mpCollapsing}
              height={prefs.mermaidPreviewHeight}
              onTogglePin={toggleMpPin}
              onHeightChange={(h) => setPreferences({ mermaidPreviewHeight: h })}
              onClose={() => {
                // Manual close acts like an unpinned hide; pin flag untouched
                // only when the user unpins explicitly via the pin button.
                if (mpHideTimerRef.current) {
                  clearTimeout(mpHideTimerRef.current)
                  mpHideTimerRef.current = null
                }
                if (mpCollapseTimerRef.current) {
                  clearTimeout(mpCollapseTimerRef.current)
                  mpCollapseTimerRef.current = null
                }
                setMpCollapsing(false)
                setMpFenceBoth(null)
              }}
            />
          )}
        </div>
      </div>
      {prefs.showStatusBar !== false && (
        <StatusBar
          stats={stats}
          prefs={prefs}
          autoSaveAt={autoSave.lastAutoSaveAt}
          autoSaveError={autoSave.lastAutoSaveError}
          exporting={exportOps.exporting}
          toast={toast}
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
        items={MERMAID_TEMPLATES.map((x) => ({ id: x.id, labelKey: x.labelKey }))}
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
      <DialogHost />
      <EditorContextMenuHost />
    </div>
  )
}
