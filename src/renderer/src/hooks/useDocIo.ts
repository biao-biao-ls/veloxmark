/**
 * P26 document IO (task 3.4) — open/load/save pipelines on top of useTabStore.
 * Bodies moved verbatim from useFileOps.ts (which stays as the App-facing
 * facade, task 3.6); tab Map writes go through the store's addTab/mutators.
 *
 * `reopenClosedTab` lives here (not in useTabStore) because it reuses
 * openDocPath — keeping it in the store would invert store→io. Closed-stack
 * pops go through store.popClosedStack (the stack is pushed by store.closeTab).
 *
 * Stability contract: callbacks are useCallback-wrapped with ONLY stable deps
 * (the store's own useCallback identities / refs) so App effect dep arrays keep
 * working — never put the store object literal itself in a dep array.
 */
import { useCallback, useEffect, type RefObject } from 'react'
import { EditorView } from '@codemirror/view'
import { dialog } from '../components/Dialog'
import { addRecentFile, getPreferences, patchSession, type SidebarMode } from '../preferences/store'
import { formatMarkdown } from '../editor/format'
import { t } from '../i18n'
import { showSaveDialog } from '../export/e2eSaveDialog'
import { baseDirOf, baseNameOf } from '../pathUtil'
import type { TabStore } from './useTabStore'
import type { SaveAllResult } from './tabClosePolicy'

export interface OpenDocPathOpts {
  /** false = open in background (session restore); default true. */
  activate?: boolean
  /** true = skip the outline sidebar switch (restore/search keep mode). */
  quiet?: boolean
  /** Optional cursor offset applied after activation. */
  pos?: number
}

export interface DocIo {
  openDocPath: (path: string, opts?: OpenDocPathOpts) => Promise<boolean>
  loadContent: (content: string, path: string | null) => void
  maybeFormatForSave: () => void
  markActiveSaved: (content: string, path: string | null) => void
  saveFileAs: () => Promise<boolean>
  saveFile: (options?: { notifyFailure?: boolean }) => Promise<boolean>
  saveAllDirtyTabs: () => Promise<SaveAllResult>
  openFile: () => Promise<void>
  openFromSystem: (path: string) => Promise<void>
  openRecentFile: (path: string) => Promise<void>
  openFileByPath: (path: string, pos?: number) => Promise<boolean>
  reopenClosedTab: () => Promise<void>
  reloadTabFromDisk: (path: string) => Promise<void>
}

export function useDocIo({
  viewRef,
  store,
  setSidebarMode,
  restoringRef,
  notifySaveFailed,
  onFormatOnSaveFailedRef,
  updateOutline
}: {
  viewRef: RefObject<EditorView | null>
  store: TabStore
  setSidebarMode: (mode: SidebarMode) => void
  restoringRef: RefObject<boolean>
  notifySaveFailed: (path: string | null, err: unknown) => void
  onFormatOnSaveFailedRef: RefObject<(() => void) | undefined>
  updateOutline: () => void
}): DocIo {
  const {
    filePathRef,
    suppressDirtyRef,
    setSavedBaseline,
    setActiveDirty,
    isTabDirty,
    projectActiveMirrors,
    syncAppState,
    setBaseDir,
    setFilePath,
    makeState,
    refreshTabs,
    allTabs,
    addTab,
    nextUntitledNo,
    popClosedStack,
    activateTab,
    findTabIdByPath,
    getTab,
    getActiveTab,
    getActiveTabId
  } = store

  /**
   * P26 unified open entry: already-open paths activate their tab; new paths
   * read from disk and create a tab. Opening NEVER replaces another doc —
   * the P12 confirmDiscard gate no longer applies to open flows (content is
   * preserved in its own tab); queryClose still guards window close.
   */
  const openDocPath = useCallback(
    async (path: string, opts?: OpenDocPathOpts): Promise<boolean> => {
      const activate = opts?.activate !== false
      for (const tab of allTabs()) {
        if (tab.path === path) {
          if (activate) {
            activateTab(tab.id)
            const view = viewRef.current
            if (view && opts?.pos != null) {
              const anchor = Math.min(Math.max(opts.pos, 0), view.state.doc.length)
              view.dispatch({
                selection: { anchor },
                effects: EditorView.scrollIntoView(anchor, { y: 'center' }),
                scrollIntoView: true
              })
              view.focus()
            }
            if (!opts?.quiet && !restoringRef.current) setSidebarMode('outline')
          }
          return true
        }
      }
      if (!(await window.api.pathExists(path))) {
        await dialog.alert({
          title: t('dialog.fileNotFound'),
          message: t('dialog.fileGone', { path })
        })
        return false
      }
      const content = await window.api.readFile(path)
      const state = makeState(content)
      if (!state) return false
      const tab = addTab({
        path,
        name: baseNameOf(path),
        untitledNo: null,
        state,
        savedContent: content,
        scroll: 0,
        baseDir: baseDirOf(path),
        dirty: false
      })
      addRecentFile(path)
      patchSession({ lastFilePath: path, lastCursor: 0 })
      if (activate) {
        activateTab(tab.id)
        const view = viewRef.current
        if (view && opts?.pos != null) {
          const anchor = Math.min(Math.max(opts.pos, 0), view.state.doc.length)
          view.dispatch({
            selection: { anchor },
            effects: EditorView.scrollIntoView(anchor, { y: 'center' }),
            scrollIntoView: true
          })
          view.focus()
        }
        if (!opts?.quiet && !restoringRef.current) setSidebarMode('outline')
      } else {
        refreshTabs()
      }
      return true
    },
    [allTabs, activateTab, makeState, addTab, refreshTabs, restoringRef, setSidebarMode, viewRef]
  )

  /**
   * Programmatic/e2e load. Path resolves to a tab (replace its content when
   * already open, else create+activate); null path replaces the ACTIVE tab
   * in place — legacy single-doc semantics for hooks that drive one buffer.
   */
  const loadContent = useCallback(
    (content: string, path: string | null) => {
      const view = viewRef.current
      if (!view) return
      if (path) {
        for (const tab of allTabs()) {
          if (tab.path === path) {
            activateTab(tab.id)
            const v = viewRef.current
            if (!v) return
            suppressDirtyRef.current = true
            v.dispatch({
              changes: { from: 0, to: v.state.doc.length, insert: content },
              selection: { anchor: 0 },
              effects: EditorView.scrollIntoView(0, { y: 'start' })
            })
            suppressDirtyRef.current = false
            const cur = getTab(tab.id)
            if (cur) {
              setSavedBaseline(content)
              setActiveDirty(false)
            }
            syncAppState(path, false)
            addRecentFile(path)
            patchSession({ lastFilePath: path, lastCursor: 0 })
            updateOutline()
            refreshTabs()
            return
          }
        }
        // New path → materialize tab state directly (no view round-trip).
        const state = makeState(content)
        if (!state) return
        const tab = addTab({
          path,
          name: baseNameOf(path),
          untitledNo: null,
          state,
          savedContent: content,
          scroll: 0,
          baseDir: baseDirOf(path),
          dirty: false
        })
        addRecentFile(path)
        patchSession({ lastFilePath: path, lastCursor: 0 })
        activateTab(tab.id)
        return
      }
      // null path → replace the active tab's document in place.
      const active = getActiveTab()
      // P18: set the path BEFORE the replace dispatch (fold sync keying).
      filePathRef.current = null
      setFilePath(null)
      suppressDirtyRef.current = true
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
        selection: { anchor: 0 },
        effects: EditorView.scrollIntoView(0, { y: 'start' })
      })
      suppressDirtyRef.current = false
      if (active) {
        active.path = null
        active.baseDir = ''
      }
      setSavedBaseline(content)
      setActiveDirty(false)
      syncAppState(null, false)
      patchSession({ lastCursor: 0 })
      updateOutline()
      refreshTabs()
    },
    [
      allTabs,
      activateTab,
      getTab,
      getActiveTab,
      makeState,
      addTab,
      setSavedBaseline,
      setActiveDirty,
      syncAppState,
      setFilePath,
      updateOutline,
      refreshTabs,
      viewRef
    ]
  )

  /** P23: apply formatMarkdown in-editor before a save when the pref is on. */
  const maybeFormatForSave = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    if (!getPreferences().formatOnSave) return
    const before = view.state.doc.toString()
    // wave⑥-6 F3: format must never block the save — a throw surfaces one
    // restrained toast (own channel; autosave failures report save errors only,
    // so the two never double-report) and the original content still saves.
    let text: string
    try {
      text = formatMarkdown(before).text
    } catch {
      onFormatOnSaveFailedRef.current?.()
      return
    }
    if (text === before) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      selection: {
        anchor: Math.min(view.state.selection.main.from, text.length)
      },
      userEvent: 'format'
    })
  }, [viewRef, onFormatOnSaveFailedRef])

  /** Mark the active tab clean after its content hit disk. */
  const markActiveSaved = useCallback(
    (content: string, path: string | null) => {
      const tab = getActiveTab()
      if (tab && path) {
        tab.path = path
        tab.name = baseNameOf(path)
        tab.baseDir = baseDirOf(path)
      }
      setSavedBaseline(content)
      setActiveDirty(false)
      if (path) {
        setFilePath(path)
        filePathRef.current = path
      }
      syncAppState(path, false)
      refreshTabs()
    },
    [getActiveTab, setSavedBaseline, setActiveDirty, setFilePath, syncAppState, refreshTabs]
  )

  const saveFileAs = useCallback(async (): Promise<boolean> => {
    const view = viewRef.current
    if (!view) return false
    const target = await showSaveDialog(filePathRef.current ?? 'untitled.md')
    // User cancel = quiet false (wave③: never toast a cancelled Save As).
    if (!target) return false
    maybeFormatForSave()
    const content = view.state.doc.toString()
    try {
      await window.api.writeFile(target, content)
    } catch (err) {
      notifySaveFailed(target, err)
      return false
    }
    setBaseDir(target)
    markActiveSaved(content, target)
    // P12: a successful save retires both the target's and the Untitled drafts.
    void window.api.draftDiscard(target)
    void window.api.draftDiscard(null)
    // P03: Save As to a new path also becomes the recent/session file.
    addRecentFile(target)
    patchSession({ lastFilePath: target })
    return true
  }, [viewRef, setBaseDir, maybeFormatForSave, markActiveSaved, notifySaveFailed])

  /**
   * Save the current document; false when a Save As dialog is cancelled or
   * the write fails. `notifyFailure: false` lets the autosave layer own the
   * failure toast (its sticky slot + autoSaveFailed channel) — manual paths
   * keep the default and surface `toast.saveFailedPath`.
   */
  const saveFile = useCallback(
    async (options?: { notifyFailure?: boolean }): Promise<boolean> => {
      const view = viewRef.current
      if (!view) return false
      if (!filePathRef.current) return saveFileAs()
      maybeFormatForSave()
      const content = view.state.doc.toString()
      try {
        await window.api.writeFile(filePathRef.current, content)
      } catch (err) {
        // UX-P12 F3: write failure must surface as `false` instead of an
        // unhandled rejection. Dirty state stays set — nothing was written.
        if (options?.notifyFailure !== false) notifySaveFailed(filePathRef.current, err)
        return false
      }
      markActiveSaved(content, filePathRef.current)
      void window.api.draftDiscard(filePathRef.current)
      return true
    },
    [viewRef, saveFileAs, maybeFormatForSave, markActiveSaved, notifySaveFailed]
  )

  /**
   * P26: write every dirty tab to disk (P12 autosave covers ALL dirty tabs,
   * not just the active one). Untitled buffers save into the draft area and
   * are marked clean ("保存即 clean" — the draft is the save target).
   * UX-P12 F3: per-tab try/catch — a failed write keeps that tab dirty and is
   * reported via the returned `{ ok, failedPath, error }` (never thrown), so
   * autosave can show failure feedback instead of dying as an unhandled
   * rejection.
   */
  const saveAllDirtyTabs = useCallback(async (): Promise<SaveAllResult> => {
    const view = viewRef.current
    let ok = true
    let failedPath: string | null = null
    let error: unknown = null
    for (const tab of allTabs()) {
      const isActive = tab.id === getActiveTabId()
      const isDirty = isTabDirty(tab)
      if (!isDirty) continue
      const content = isActive && view ? view.state.doc.toString() : (tab.state?.doc.toString() ?? tab.savedContent)
      try {
        if (tab.path) {
          await window.api.writeFile(tab.path, content)
          void window.api.draftDiscard(tab.path)
        } else {
          await window.api.draftWrite(null, content)
        }
      } catch (e) {
        ok = false
        if (failedPath == null) failedPath = tab.path
        if (error == null) error = e
        continue
      }
      tab.savedContent = content
      tab.dirty = false
      if (isActive) {
        projectActiveMirrors(tab)
        syncAppState(tab.path, false)
      }
    }
    refreshTabs()
    return { ok, failedPath, error }
  }, [allTabs, getActiveTabId, isTabDirty, projectActiveMirrors, syncAppState, refreshTabs, viewRef])

  const openFile = useCallback(async () => {
    const result = await window.api.openFile()
    if (!result) return
    await openDocPath(result.filePath)
  }, [openDocPath])

  // Finder "Open With" / double-clicking a registered file (macOS open-file).
  const openFromSystem = useCallback(
    async (path: string) => {
      await openDocPath(path)
    },
    [openDocPath]
  )

  // Open a specific path (Recent Files entries, session restore).
  const openRecentFile = useCallback(
    async (path: string) => {
      await openDocPath(path, { quiet: restoringRef.current })
    },
    [openDocPath, restoringRef]
  )

  // macOS Finder "Open With" delivers paths before/after mount — subscribe here.
  useEffect(() => {
    return window.api.onOpenPath((path) => void openFromSystem(path))
  }, [openFromSystem])

  /**
   * P13: open a workspace path (search results, deep links) as a tab, with
   * optional cursor placement. Already-open files activate their existing
   * tab (acceptance 2). Leaves the sidebar mode untouched.
   */
  const openFileByPath = useCallback(
    async (path: string, pos?: number): Promise<boolean> => {
      return openDocPath(path, { pos, quiet: true })
    },
    [openDocPath]
  )

  const reopenClosedTab = useCallback(async (): Promise<void> => {
    const entry = popClosedStack()
    if (!entry) return
    if (entry.path) {
      const ok = await openDocPath(entry.path)
      if (!ok) return
    } else {
      const state = makeState(entry.content)
      if (!state) return
      const no = nextUntitledNo()
      const tab = addTab({
        path: null,
        name: `untitled-${no}`,
        untitledNo: no,
        state,
        savedContent: entry.content,
        scroll: 0,
        baseDir: '',
        dirty: entry.content !== ''
      })
      activateTab(tab.id)
    }
  }, [popClosedStack, openDocPath, makeState, nextUntitledNo, addTab, activateTab])

  /** P07: external file change hit an open tab — reload per-tab. */
  const reloadTabFromDisk = useCallback(
    async (path: string): Promise<void> => {
      const id = findTabIdByPath(path)
      if (!id) return
      const content = await window.api.readFile(path)
      const isActive = id === getActiveTabId()
      const tab = getTab(id)
      if (!tab) return
      if (isActive) {
        loadContent(content, path)
        return
      }
      if (tab.dirty) return // leave dirty inactive tabs alone (documented)
      tab.state = makeState(content)
      tab.savedContent = content
      refreshTabs()
    },
    [findTabIdByPath, getActiveTabId, getTab, loadContent, makeState, refreshTabs]
  )

  return {
    openDocPath,
    loadContent,
    maybeFormatForSave,
    markActiveSaved,
    saveFileAs,
    saveFile,
    saveAllDirtyTabs,
    openFile,
    openFromSystem,
    openRecentFile,
    openFileByPath,
    reopenClosedTab,
    reloadTabFromDisk
  }
}
