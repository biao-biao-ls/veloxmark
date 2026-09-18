import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { buildDecorations } from './editor/livePreview/build'
import { DEFAULT_LIVE_PREVIEW_CONFIG } from './editor/livePreview/config'
import Outline from './components/Outline'
import FileTree from './components/FileTree'
import TreeMenu from './components/TreeMenu'
import Titlebar from './components/Titlebar'
import Preferences from './components/Preferences'
import ExportDialog from './components/ExportDialog'
import QuickOpen from './components/QuickOpen'
import SearchPanel from './components/SearchPanel'
import ListPickDialog from './components/ListPickDialog'
import MermaidLightbox from './components/MermaidLightbox'
import { DialogHost, dialog } from './components/Dialog'
import { SearchIcon } from './components/Icons'
import { createExtensions, updateEditingAssists, updateShowLineNumbers, bumpImageEpoch, updateLivePreviewConfig } from './editor/setup'
import { invalidateImageCache, setMermaidExportIo } from './editor/widgets'
import { readEditingAssistsConfig } from './editor/assists'
import { extractOutline, type OutlineItem } from './outline/extract'
import { MERMAID_TEMPLATES, isCursorInMermaidFence } from './editor/mermaidTemplates'
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
import type { SearchOptions, SearchReplaceRequest, SearchReplaceResult } from '../../../electron/shared/api'
import type { RecentItem } from './commands'

// Handle for CDP smoke tests (scripts/cdp-p05.mjs) — mirrors the __veloxPrefs
// / __veloxExport pattern; nothing in the app reads it.
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
  }
}
window.__veloxEditor = null
window.__veloxP12 = null
window.__veloxP13 = null
window.__veloxP14 = null
window.__veloxP15 = null
window.__veloxP16 = null

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

  const fileOps = useFileOps({ viewRef, updateOutline, setSidebarMode, restoringRef })
  const { dirty, setDirty, filePath, filePathRef, syncAppState, savedContentRef } = fileOps

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
    saveFile: fileOps.saveFile,
    setDirty,
    syncAppState
  })
  const autoSaveNotifyRef = useRef(autoSave.notifyChange)
  autoSaveNotifyRef.current = autoSave.notifyChange

  const exportOps = useExport({ viewRef, filePath })

  const workspace = useWorkspaceTree({
    filePathRef,
    dirty,
    confirmDiscard: fileOps.confirmDiscard,
    loadContent: fileOps.loadContent,
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
    return () => {
      offOpen()
      offClear()
    }
  }, [fileOps.openRecentFile])

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
        if (saved.lastFilePath && (await window.api.pathExists(saved.lastFilePath))) {
          await fileOps.openRecentFile(saved.lastFilePath)
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
    const drafts = await window.api.draftList()
    for (const d of drafts) {
      if (!d.content) {
        void window.api.draftDiscard(d.path)
        continue
      }
      if (d.path == null) {
        const choice = await dialog.choose({
          title: t('dialog.recoverTitle'),
          message: t('dialog.recoverUntitled'),
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
        message: t('dialog.recoverPath', { path: d.path ?? '' }),
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
    window.__veloxP12 = {
      queryClose: () => queryClose(),
      confirmDiscard: () => fileOps.confirmDiscard(),
      saveFile: () => fileOps.saveFile(),
      loadDoc: (content, path) => fileOps.loadContent(content, path),
      getFilePath: () => filePathRef.current,
      getDirty: () => fileOps.dirtyRef.current,
      draftList: () => window.api.draftList(),
      draftWrite: (path, content) => window.api.draftWrite(path, content),
      draftDiscard: (path) => window.api.draftDiscard(path),
      runDraftCheck: () => checkDrafts(),
      getLastAutoSaveAt: () => lastAutoSaveAtRef.current
    }
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
        wrapBareUrlOnPaste: prefs.wrapBareUrlOnPaste
      })
    }
  }, [prefs.typingAssistsEnabled, prefs.wrapBareUrlOnPaste])

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
      typewriterMode: prefs.typewriterMode
    })
    // Line heights change when live-preview decorations drop (source) or
    // return (live); the doc offsets are identical either way, so re-centering
    // on the cursor is all the "position mapping" needed.
    if (prevSourceModeRef.current !== prefs.sourceMode) {
      prevSourceModeRef.current = prefs.sourceMode
      const head = view.state.selection.main.head
      view.dispatch({ effects: EditorView.scrollIntoView(head) })
    }
  }, [prefs.sourceMode, prefs.focusMode, prefs.typewriterMode])

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

    const view = new EditorView({
      state: EditorState.create({
        doc: getWelcomeMd(getLang()),
        extensions: createExtensions(
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
              // P12 autosave + draft debounce pipelines.
              autoSaveNotifyRef.current()
              // P14 status bar: cursor immediate + full stats debounced.
              updateCursorStatsRef.current()
              scheduleDocStatsRef.current()
            },
            onSelectionChanged: () => {
              updateActiveHeading()
              updateCursorStatsRef.current()
              // P12: persist the cursor for session restore (throttled).
              const head = view.state.selection.main.head
              clearTimeout(cursorPersistTimer)
              cursorPersistTimer = setTimeout(() => patchSession({ lastCursor: head }), 500)
            },
            onTreeChanged: () => {
              updateOutline()
              updateActiveHeading()
              scheduleDocStatsRef.current()
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
      }),
      parent: hostRef.current
    })
    viewRef.current = view
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
    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: 'center' }),
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
  }, [prefs.language])

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

  // P14 e2e handle.
  const statsRef = useRef(stats)
  statsRef.current = stats
  const loadContentRef = useRef(fileOps.loadContent)
  loadContentRef.current = fileOps.loadContent
  useEffect(() => {
    window.__veloxP14 = {
      setLanguage: (pref) => setPreferences({ language: pref }),
      getLang: () => getLang(),
      getStats: () => statsRef.current,
      t: (key, params) => t(key, params),
      loadDoc: (text, path) => loadContentRef.current(text, path)
    }
  }, [])

  // P15 e2e/bench handle: times buildDecorations on synthetic docs in the
  // live renderer (the built bundle — same code path the editor uses).
  useEffect(() => {
    window.__veloxP15 = {
      bench: (lines, formulas, samples = 100) => {
        // Mixed doc: headings/bold/code/links + `formulas` $$-blocks spread out.
        const parts: string[] = []
        for (let i = 1; i <= lines; i++) {
          if (i % 7 === 0) parts.push(`## Section ${i}`)
          else if (i % 3 === 0) parts.push(`line ${i} with **bold** and \`code\` and [link](./x${i}.md)`)
          else parts.push(`line ${i} plain text for padding the document body`)
        }
        for (let f = 0; f < formulas; f++) {
          const at = Math.min(parts.length - 1, Math.floor(((f + 1) * parts.length) / (formulas + 1)))
          parts.splice(at, 0, `$$E_${f} = mc^2 + \\frac{${f}}{2} + \\sum_{i=1}^{${f}} i$$`)
        }
        const base = parts.join('\n')
        // Cursor parks in a trailing scratch line so mark-touched rules stay stable.
        let state = EditorState.create({
          doc: `${base}\n\ntype-here: `,
          extensions: [markdown()]
        })
        ensureSyntaxTree(state, state.doc.length, 300000)
        const cfg = DEFAULT_LIVE_PREVIEW_CONFIG
        const times: number[] = []
        for (let i = 0; i < samples; i++) {
          const insertAt = state.doc.length - 1
          state = state.update({ changes: { from: insertAt, insert: 'x' } }).state
          ensureSyntaxTree(state, state.doc.length, 300000)
          const t0 = performance.now()
          buildDecorations(state, cfg)
          times.push(performance.now() - t0)
        }
        const sorted = [...times].sort((a, b) => a - b)
        const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length)
        const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0
        return { lines, formulas, samples: times.length, avg, p95, max: sorted[sorted.length - 1] ?? 0 }
      }
    }
  }, [])

  // ---- P13 folder-wide search ------------------------------------------------
  const openGlobalSearch = useCallback(() => {
    setShowOutline(true)
    setSidebarMode('search')
    setSearchFocusToken((t) => t + 1)
  }, [])

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
      if (filePathRef.current !== path) return
      const content = await window.api.readFile(path)
      fileOps.loadContent(content, path)
    },
    [filePathRef, fileOps]
  )

  const sidebarModeRef = useRef<SidebarMode>(sidebarMode)
  sidebarModeRef.current = sidebarMode

  // P13 e2e handle.
  useEffect(() => {
    window.__veloxP13 = {
      openFolder: (path) => workspace.loadFolder(path),
      openSearch: () => openGlobalSearch(),
      getSidebarMode: () => sidebarModeRef.current,
      searchRun: (root, pattern, options) => window.api.searchRun(root, pattern, options),
      searchReplace: (req) => window.api.searchReplace(req),
      openAt: (path, line, col) => openSearchResult(path, line, col),
      getDoc: () => viewRef.current?.state.doc.toString() ?? '',
      getFilePath: () => filePathRef.current
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openGlobalSearch, openSearchResult, workspace.loadFolder])

  // ---- P16: Mermaid insert dialog + template application --------------------
  const [showMermaidInsert, setShowMermaidInsert] = useState(false)
  const mermaidDialogOpenRef = useRef(false)
  mermaidDialogOpenRef.current = showMermaidInsert

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

  // P16 e2e handle.
  useEffect(() => {
    window.__veloxP16 = {
      templates: () => MERMAID_TEMPLATES.map((x) => x.id),
      insertTemplate: (id) => insertMermaidTemplate(id),
      openInsertDialog: () => openMermaidInsert(),
      getDialogOpen: () => mermaidDialogOpenRef.current,
      isCursorInMermaidFence: () => {
        const view = viewRef.current
        return view ? isCursorInMermaidFence(view.state) : false
      },
      setExportIo: (io) => setMermaidExportIo(io)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertMermaidTemplate, openMermaidInsert])

  const { menus, formatShortcut } = useMenus({
    viewRef,
    isMac,
    recentItems,
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
    openMermaidInsert
  })

  // Fullscreen state is pushed from main (traffic-light / F11 transitions).
  useEffect(() => {
    return window.api.onFullScreen((full) => setIsFullScreen(full))
  }, [])

  const fileName = filePath ? filePath.replace(/^.*[\\/]/, '') : 'Untitled'
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
                onSwitchMode={(mode) => setSidebarMode(mode)}
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
                  onOpen={(path) => void workspace.openFileFromTree(path)}
                  onContextMenu={workspace.setTreeMenu}
                  onMove={(src, dest) => void workspace.treeMove(src, dest)}
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
                <Outline items={outline} activePos={activePos} onSelect={goToHeading} />
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
        <div className="editor-host" ref={hostRef} />
      </div>
      {prefs.showStatusBar !== false && (
        <StatusBar stats={stats} prefs={prefs} autoSaveAt={autoSave.lastAutoSaveAt} />
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
      <MermaidLightbox />
      <DialogHost />
    </div>
  )
}
