import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { EditorView } from '@codemirror/view'
import type { FileChangedPayload } from '../../../../electron/shared/api'
import { dialog } from '../components/Dialog'
import { addRecentFile, getPreferences, patchSession } from '../preferences/store'
import { formatMarkdown } from '../editor/format'
import { t } from '../i18n'
import { showSaveDialog } from '../export/e2eSaveDialog'
import { baseDirOf, baseNameOf } from '../pathUtil'
import type { TabStore } from './useTabStore'
import type { SaveAllResult } from './tabClosePolicy'

export interface OpenDocPathOpts {
  activate?: boolean
  pos?: number
}

export interface DocIo {
  openDocPath: (path: string, opts?: OpenDocPathOpts) => Promise<boolean>
  loadContent: (content: string, path: string | null) => void
  openUntitledContent: (content: string, draftSlot?: string) => void
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
  notifySaveFailed,
  onFormatOnSaveFailedRef,
  updateOutline
}: {
  viewRef: RefObject<EditorView | null>
  store: TabStore
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

  const openDocPath = useCallback(
    async (path: string, opts?: OpenDocPathOpts): Promise<boolean> => {
      const activate = opts?.activate !== false
      // Collapse this open onto an existing tab for the same path. Called both
      // on entry and again after the file read: a concurrent open of the same
      // path (cold-start session restore racing the system open queued from the
      // launch argv) passes the entry check before either side reaches addTab,
      // so the re-check after the last await is what actually keeps one tab per
      // path — it and addTab run synchronously, no interleaving in between.
      const foldIntoExisting = (): boolean => {
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
            }
            return true
          }
        }
        return false
      }
      if (foldIntoExisting()) return true
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
      if (foldIntoExisting()) return true
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
      } else {
        refreshTabs()
      }
      return true
    },
    [allTabs, activateTab, makeState, addTab, refreshTabs, viewRef]
  )

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
      const active = getActiveTab()
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

  const openUntitledContent = useCallback(
    (content: string, draftSlot?: string): void => {
      const state = makeState(content)
      if (!state) return
      const no = nextUntitledNo()
      const tab = addTab({
        path: null,
        name: `untitled-${no}`,
        untitledNo: no,
        draftSlot,
        state,
        savedContent: '',
        scroll: 0,
        baseDir: '',
        dirty: true
      })
      activateTab(tab.id)
    },
    [makeState, nextUntitledNo, addTab, activateTab]
  )

  const maybeFormatForSave = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    if (!getPreferences().formatOnSave) return
    const before = view.state.doc.toString()
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

  const markActiveSaved = useCallback(
    (content: string, path: string | null) => {
      const tab = getActiveTab()
      if (tab && path) {
        tab.path = path
        tab.name = baseNameOf(path)
        tab.isWelcome = false
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
    void window.api.draftDiscard(target)
    void window.api.draftDiscard(null, getActiveTab()?.draftSlot)
    addRecentFile(target)
    patchSession({ lastFilePath: target })
    return true
  }, [viewRef, setBaseDir, maybeFormatForSave, markActiveSaved, notifySaveFailed])

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
        if (options?.notifyFailure !== false) notifySaveFailed(filePathRef.current, err)
        return false
      }
      markActiveSaved(content, filePathRef.current)
      void window.api.draftDiscard(filePathRef.current)
      return true
    },
    [viewRef, saveFileAs, maybeFormatForSave, markActiveSaved, notifySaveFailed]
  )

  const saveAllDirtyTabs = useCallback(
    async (options?: { interactive?: boolean }): Promise<SaveAllResult> => {
      const view = viewRef.current
      let ok = true
      let failedPath: string | null = null
      let error: unknown = null
      for (const tab of allTabs()) {
        const isActive = tab.id === getActiveTabId()
        const isDirty = isTabDirty(tab)
        if (!isDirty) continue
        const content =
          isActive && view ? view.state.doc.toString() : (tab.state?.doc.toString() ?? tab.savedContent)
        const prevPath = tab.path
        let target = tab.path
        if (!target && options?.interactive) {
          target = await showSaveDialog('untitled.md')
          if (!target) continue
        }
        if (!getTab(tab.id)) continue
        try {
          if (target) {
            await window.api.writeFile(target, content)
            void window.api.draftDiscard(prevPath, tab.draftSlot)
            if (target !== prevPath) void window.api.draftDiscard(target)
          } else {
            await window.api.draftWrite(null, content, tab.draftSlot)
            continue
          }
        } catch (e) {
          ok = false
          if (failedPath == null) failedPath = target
          if (error == null) error = e
          continue
        }
        if (target !== tab.path) {
          tab.path = target
          tab.name = baseNameOf(target)
          tab.isWelcome = false
          tab.baseDir = baseDirOf(target)
          if (isActive) {
            setBaseDir(target)
            setFilePath(target)
            filePathRef.current = target
          }
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
    },
    [
      allTabs,
      getActiveTabId,
      getTab,
      isTabDirty,
      projectActiveMirrors,
      syncAppState,
      refreshTabs,
      viewRef,
      setBaseDir,
      setFilePath,
      filePathRef
    ]
  )

  const openFile = useCallback(async () => {
    const result = await window.api.openFile()
    if (!result) return
    await openDocPath(result.filePath)
  }, [openDocPath])

  const openFromSystem = useCallback(
    async (path: string) => {
      await openDocPath(path)
    },
    [openDocPath]
  )

  const openRecentFile = useCallback(
    async (path: string) => {
      await openDocPath(path)
    },
    [openDocPath]
  )

  // Chain system opens so multi-file launches (Explorer multi-select) open tabs
  // in the order the user picked instead of racing their file reads.
  const systemOpenChainRef = useRef<Promise<void>>(Promise.resolve())
  useEffect(() => {
    return window.api.onOpenPath((path) => {
      systemOpenChainRef.current = systemOpenChainRef.current.then(() => openFromSystem(path))
    })
  }, [openFromSystem])

  const openFileByPath = useCallback(
    async (path: string, pos?: number): Promise<boolean> => {
      return openDocPath(path, { pos })
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
      let name = 'welcome'
      let no: number | null = null
      if (!entry.isWelcome) {
        no = nextUntitledNo()
        name = `untitled-${no}`
      }
      const tab = addTab({
        path: null,
        name,
        isWelcome: entry.isWelcome,
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
      if (tab.dirty) return
      tab.state = makeState(content)
      tab.savedContent = content
      refreshTabs()
    },
    [findTabIdByPath, getActiveTabId, getTab, loadContent, makeState, refreshTabs]
  )

  // Replace a tab's content with an externally-changed version, preserving the
  // caret (clamped) and scroll position. Does not go through loadContent, which
  // resets the selection to the document start.
  const applyExternalReload = useCallback(
    (id: string, content: string): void => {
      const tab = getTab(id)
      if (!tab) return
      void window.api.draftDiscard(tab.path, tab.draftSlot)
      const view = viewRef.current
      if (id === getActiveTabId() && view) {
        const scrollTop = view.scrollDOM.scrollTop
        const anchor = Math.min(view.state.selection.main.head, content.length)
        suppressDirtyRef.current = true
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: content },
          selection: { anchor }
        })
        suppressDirtyRef.current = false
        view.scrollDOM.scrollTop = scrollTop
        setSavedBaseline(content)
        setActiveDirty(false)
        syncAppState(tab.path, false)
        updateOutline()
      } else {
        tab.state = makeState(content)
        tab.savedContent = content
        tab.dirty = false
      }
      refreshTabs()
    },
    [
      getTab,
      getActiveTabId,
      viewRef,
      suppressDirtyRef,
      setSavedBaseline,
      setActiveDirty,
      syncAppState,
      updateOutline,
      makeState,
      refreshTabs
    ]
  )

  // Sync the editor when an open file changes on disk (external editor, git, …).
  // Clean tabs reload silently; a dirty active tab asks before discarding edits;
  // dirty background tabs keep their edits untouched.
  const handleExternalFileChange = useCallback(
    async (payload: FileChangedPayload): Promise<void> => {
      const id = findTabIdByPath(payload.path)
      if (!id) return
      const tab = getTab(id)
      if (!tab) return
      if (payload.content === tab.savedContent) return
      if (isTabDirty(tab)) {
        if (id !== getActiveTabId()) return
        const reload = await dialog.confirm({
          titleKey: 'dialog.fileChangedTitle',
          messageKey: 'dialog.fileChangedDirty',
          messageParams: { name: tab.name },
          confirmLabelKey: 'dialog.fileChangedReload',
          cancelLabelKey: 'dialog.fileChangedKeep',
          danger: true
        })
        if (!reload) return
      }
      applyExternalReload(id, payload.content)
    },
    [findTabIdByPath, getTab, isTabDirty, getActiveTabId, applyExternalReload]
  )

  useEffect(() => {
    return window.api.onFileChanged((payload) => void handleExternalFileChange(payload))
  }, [handleExternalFileChange])

  return {
    openDocPath,
    loadContent,
    openUntitledContent,
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
