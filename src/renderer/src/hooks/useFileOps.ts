import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { Extension } from '@codemirror/state'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  reconfigureTheme,
  updateEditingAssists,
  updateLivePreviewConfig,
  updateShowLineNumbers
} from '../editor/setup'
import { readEditingAssistsConfig } from '../editor/assists'
import { dialog } from '../components/Dialog'
import { WELCOME_MD } from '../content'
import { addRecentFile, getPreferences, patchSession } from '../preferences/store'
import { formatMarkdown } from '../editor/format'
import { t } from '../i18n'
import { resolveThemeMode } from './useAppTheme'

export type SidebarMode = 'outline' | 'files' | 'search'

/** P26: one open document tab (display projection of DocTab). */
export interface DocTabInfo {
  id: string
  path: string | null
  name: string
  dirty: boolean
  active: boolean
}

interface DocTab {
  id: string
  path: string | null
  name: string
  untitledNo: number | null
  /** Full CM6 state while the tab is inactive; null while active (view holds it). */
  state: EditorState | null
  savedContent: string
  scroll: number
  baseDir: string
  dirty: boolean
}

interface Args {
  viewRef: RefObject<EditorView | null>
  updateOutline: () => void
  setSidebarMode: (mode: SidebarMode) => void
  /** P03 session restore only — suppress the outline switch for one open. */
  restoringRef: RefObject<boolean>
}

function baseDirOf(path: string): string {
  return path.replace(/[\\/][^\\/]*$/, '')
}

function baseNameOf(path: string): string {
  return path.replace(/^.*[\\/]/, '')
}

/**
 * P26 multi-document state and operations (hook name kept — App and the
 * e2e hooks bind to useFileOps). Each open file is a DocTab holding its own
 * EditorState (selection/history/folds travel with the state); the view is
 * swapped with `view.setState` on activation. View-level prefs (theme, line
 * numbers, assists, live-preview config incl. per-tab baseDir) are
 * re-applied after every swap so inactive states never carry stale config.
 *
 * Dirty tracking (P12 micro-opt, per-tab): the active tab uses dirtyRef (set
 * on change, cleared on save); inactive tabs carry a dirty flag stored on
 * switch-away, re-derivable from savedContent vs their state doc.
 */
export function useFileOps({ viewRef, updateOutline, setSidebarMode, restoringRef }: Args) {
  const filePathRef = useRef<string | null>(null)
  const savedContentRef = useRef<string>(WELCOME_MD)
  const dirtyRef = useRef(false)
  /** True only while loadContent/tab swaps are replacing the document. */
  const suppressDirtyRef = useRef(false)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  // ---- P26 tab model --------------------------------------------------------
  const tabsRef = useRef<Map<string, DocTab>>(new Map())
  const activeIdRef = useRef<string>('')
  const untitledSeqRef = useRef(0)
  const tabSeqRef = useRef(0)
  const extensionsRef = useRef<Extension[] | null>(null)
  const closedStackRef = useRef<Array<{ path: string | null; content: string; name: string }>>([])
  const [tabInfos, setTabInfos] = useState<DocTabInfo[]>([])

  const syncAppState = useCallback((path: string | null, isDirty: boolean) => {
    filePathRef.current = path
    void window.api.setAppState({ filePath: path, dirty: isDirty })
  }, [])

  /** Point relative image resolution at the directory of `path`. */
  const setBaseDir = useCallback(
    (path: string) => {
      const view = viewRef.current
      if (view) {
        updateLivePreviewConfig(view, { baseDir: baseDirOf(path) })
      }
    },
    [viewRef]
  )

  const currentDocText = useCallback((): string => {
    return viewRef.current?.state.doc.toString() ?? ''
  }, [viewRef])

  const refreshTabs = useCallback(() => {
    const view = viewRef.current
    const activeId = activeIdRef.current
    const infos: DocTabInfo[] = []
    for (const tab of tabsRef.current.values()) {
      const isActive = tab.id === activeId
      const dirtyNow = isActive ? dirtyRef.current : tab.dirty
      infos.push({
        id: tab.id,
        path: tab.path,
        name: tab.name,
        dirty: dirtyNow,
        active: isActive
      })
      if (isActive) tab.dirty = dirtyNow
    }
    // Title/status reflect the ACTIVE tab.
    const active = tabsRef.current.get(activeId)
    if (active && view) {
      savedContentRef.current = active.savedContent
    }
    setTabInfos(infos)
  }, [viewRef])

  /** Re-apply view-level preference configuration onto the active state. */
  const reapplyViewState = useCallback(
    (baseDir: string) => {
      const view = viewRef.current
      if (!view) return
      const p = getPreferences()
      reconfigureTheme(view, resolveThemeMode(p.theme))
      updateShowLineNumbers(view, p.showLineNumbers)
      updateEditingAssists(view, readEditingAssistsConfig())
      updateLivePreviewConfig(view, {
        baseDir,
        mode: p.sourceMode ? 'source' : 'live',
        focusMode: p.focusMode,
        typewriterMode: p.typewriterMode,
        codeBlockCollapseLines: p.codeBlockCollapseLines,
        codeBlockShowLineNumbers: p.codeBlockShowLineNumbers,
        codeBlockWrap: p.codeBlockWrap
      })
    },
    [viewRef]
  )

  /** Create an EditorState for `content` with the view's extension array. */
  const makeState = useCallback((content: string): EditorState | null => {
    const exts = extensionsRef.current
    if (!exts) return null
    return EditorState.create({ doc: content, extensions: exts })
  }, [])

  const activateTab = useCallback(
    (id: string): boolean => {
      const view = viewRef.current
      if (!view) return false
      const next = tabsRef.current.get(id)
      if (!next || id === activeIdRef.current) {
        if (next) refreshTabs()
        return !!next
      }
      const prev = tabsRef.current.get(activeIdRef.current)
      if (prev) {
        prev.state = view.state
        prev.scroll = view.scrollDOM.scrollTop
        prev.dirty = dirtyRef.current
      }
      activeIdRef.current = id
      filePathRef.current = next.path
      setFilePath(next.path)
      suppressDirtyRef.current = true
      const state = next.state ?? makeState(next.savedContent)
      if (!state) {
        suppressDirtyRef.current = false
        return false
      }
      view.setState(state)
      next.state = null
      reapplyViewState(next.baseDir)
      view.scrollDOM.scrollTop = next.scroll
      suppressDirtyRef.current = false
      dirtyRef.current = next.dirty
      setDirty(next.dirty)
      savedContentRef.current = next.savedContent
      syncAppState(next.path, next.dirty)
      updateOutline()
      patchSession({ lastFilePath: next.path, lastCursor: 0 })
      refreshTabs()
      return true
    },
    [viewRef, makeState, reapplyViewState, syncAppState, updateOutline, refreshTabs]
  )

  /** Register the editor's extension array + the initial (welcome) tab. */
  const initTabs = useCallback(
    (extensions: Extension[], initialContent: string) => {
      extensionsRef.current = extensions
      untitledSeqRef.current += 1
      const no = untitledSeqRef.current
      const id = `tab-${++tabSeqRef.current}`
      tabsRef.current.clear()
      tabsRef.current.set(id, {
        id,
        path: null,
        name: `untitled-${no}`,
        untitledNo: no,
        state: null,
        savedContent: initialContent,
        scroll: 0,
        baseDir: '',
        dirty: false
      })
      activeIdRef.current = id
      filePathRef.current = null
      setFilePath(null)
      dirtyRef.current = false
      setDirty(false)
      savedContentRef.current = initialContent
      syncAppState(null, false)
      refreshTabs()
    },
    [syncAppState, refreshTabs]
  )

  /** Rebuild the welcome tab (closing the last tab lands here). */
  const resetToWelcome = useCallback(() => {
    const view = viewRef.current
    const content = view ? view.state.doc.toString() : WELCOME_MD
    initTabs(extensionsRef.current ?? [], content === '' ? WELCOME_MD : WELCOME_MD)
  }, [initTabs, viewRef])

  interface OpenDocPathOpts {
    /** false = open in background (session restore); default true. */
    activate?: boolean
    /** true = skip the outline sidebar switch (restore/search keep mode). */
    quiet?: boolean
    /** Optional cursor offset applied after activation. */
    pos?: number
  }

  /**
   * P26 unified open entry: already-open paths activate their tab; new paths
   * read from disk and create a tab. Opening NEVER replaces another doc —
   * the P12 confirmDiscard gate no longer applies to open flows (content is
   * preserved in its own tab); queryClose still guards window close.
   */
  const openDocPath = useCallback(
    async (path: string, opts?: OpenDocPathOpts): Promise<boolean> => {
      const activate = opts?.activate !== false
      for (const tab of tabsRef.current.values()) {
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
      const id = `tab-${++tabSeqRef.current}`
      tabsRef.current.set(id, {
        id,
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
        activateTab(id)
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
    [activateTab, makeState, refreshTabs, restoringRef, setSidebarMode, viewRef]
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
        for (const tab of tabsRef.current.values()) {
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
            const cur = tabsRef.current.get(tab.id)
            if (cur) {
              cur.savedContent = content
              cur.dirty = false
            }
            dirtyRef.current = false
            setDirty(false)
            savedContentRef.current = content
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
        const id = `tab-${++tabSeqRef.current}`
        tabsRef.current.set(id, {
          id,
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
        activateTab(id)
        return
      }
      // null path → replace the active tab's document in place.
      const active = tabsRef.current.get(activeIdRef.current)
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
        active.savedContent = content
        active.dirty = false
        active.baseDir = ''
      }
      dirtyRef.current = false
      setDirty(false)
      savedContentRef.current = content
      syncAppState(null, false)
      patchSession({ lastCursor: 0 })
      updateOutline()
      refreshTabs()
    },
    [viewRef, syncAppState, activateTab, makeState, updateOutline, refreshTabs]
  )

  /** P23: apply formatMarkdown in-editor before a save when the pref is on. */
  const maybeFormatForSave = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    if (!getPreferences().formatOnSave) return
    const before = view.state.doc.toString()
    const { text } = formatMarkdown(before)
    if (text === before) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      selection: {
        anchor: Math.min(view.state.selection.main.from, text.length)
      },
      userEvent: 'format'
    })
  }, [viewRef])

  /** Mark the active tab clean after its content hit disk. */
  const markActiveSaved = useCallback(
    (content: string, path: string | null) => {
      const tab = tabsRef.current.get(activeIdRef.current)
      if (tab) {
        tab.savedContent = content
        tab.dirty = false
        if (path) {
          tab.path = path
          tab.name = baseNameOf(path)
          tab.baseDir = baseDirOf(path)
        }
      }
      savedContentRef.current = content
      dirtyRef.current = false
      setDirty(false)
      if (path) {
        setFilePath(path)
        filePathRef.current = path
      }
      syncAppState(path, false)
      refreshTabs()
    },
    [syncAppState, refreshTabs]
  )

  const saveFileAs = useCallback(async (): Promise<boolean> => {
    const view = viewRef.current
    if (!view) return false
    const target = await window.api.showSaveDialog(filePathRef.current ?? 'untitled.md')
    if (!target) return false
    maybeFormatForSave()
    const content = view.state.doc.toString()
    await window.api.writeFile(target, content)
    setBaseDir(target)
    markActiveSaved(content, target)
    // P12: a successful save retires both the target's and the Untitled drafts.
    void window.api.draftDiscard(target)
    void window.api.draftDiscard(null)
    // P03: Save As to a new path also becomes the recent/session file.
    addRecentFile(target)
    patchSession({ lastFilePath: target })
    return true
  }, [viewRef, setBaseDir, maybeFormatForSave, markActiveSaved])

  /** Save the current document; false when a Save As dialog is cancelled. */
  const saveFile = useCallback(async (): Promise<boolean> => {
    const view = viewRef.current
    if (!view) return false
    if (!filePathRef.current) return saveFileAs()
    maybeFormatForSave()
    const content = view.state.doc.toString()
    await window.api.writeFile(filePathRef.current, content)
    markActiveSaved(content, filePathRef.current)
    void window.api.draftDiscard(filePathRef.current)
    return true
  }, [viewRef, saveFileAs, maybeFormatForSave, markActiveSaved])

  /**
   * P26: write every dirty tab to disk (P12 autosave covers ALL dirty tabs,
   * not just the active one). Untitled buffers save into the draft area and
   * are marked clean ("保存即 clean" — the draft is the save target).
   */
  const saveAllDirtyTabs = useCallback(async (): Promise<void> => {
    const view = viewRef.current
    for (const tab of tabsRef.current.values()) {
      const isActive = tab.id === activeIdRef.current
      const isDirty = isActive ? dirtyRef.current : tab.dirty
      if (!isDirty) continue
      const content = isActive && view ? view.state.doc.toString() : (tab.state?.doc.toString() ?? tab.savedContent)
      if (tab.path) {
        await window.api.writeFile(tab.path, content)
        void window.api.draftDiscard(tab.path)
      } else {
        await window.api.draftWrite(null, content)
      }
      tab.savedContent = content
      tab.dirty = false
      if (isActive) {
        dirtyRef.current = false
        setDirty(false)
        savedContentRef.current = content
        syncAppState(tab.path, false)
      }
    }
    refreshTabs()
  }, [viewRef, syncAppState, refreshTabs])

  /**
   * P12 three-option gate before discarding dirty content. Post-P26 this
   * guards direct buffer-replacement paths and e2e; open flows go through
   * tabs instead. Message stays single-document (active tab).
   */
  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    if (!dirtyRef.current) return true
    const choice = await dialog.choose({
      title: t('dialog.unsavedTitle'),
      message: t('dialog.unsavedSwitch'),
      confirmLabel: t('dialog.save'),
      discardLabel: t('dialog.dontSave'),
      cancelLabel: t('dialog.cancel')
    })
    if (choice === 'cancel') return false
    if (choice === 'discard') {
      void window.api.draftDiscard(filePathRef.current)
      return true
    }
    return saveFile()
  }, [saveFile])

  /**
   * P12/P26 close intercept — also reachable via window.__veloxP12 for CDP.
   * Multiple dirty tabs: the dialog message lists every dirty document
   * (list-confirm v1 — one decision applies to all; per-item buttons are a
   * documented non-goal for this batch). Returns whether main may close.
   */
  const queryClose = useCallback(async (): Promise<boolean> => {
    const dirtyTabs: DocTab[] = []
    for (const tab of tabsRef.current.values()) {
      const isActive = tab.id === activeIdRef.current
      if (isActive ? dirtyRef.current : tab.dirty) dirtyTabs.push(tab)
    }
    if (dirtyTabs.length === 0) return true
    let message = t('dialog.unsavedClose')
    if (dirtyTabs.length > 1) {
      const names = dirtyTabs.slice(0, 8).map((tb) => `· ${tb.name}`)
      const more = dirtyTabs.length > 8 ? `\n… +${dirtyTabs.length - 8}` : ''
      message = `${t('dialog.unsavedCloseMulti', { n: dirtyTabs.length })}\n${names.join('\n')}${more}`
    }
    const choice = await dialog.choose({
      title: t('dialog.unsavedTitle'),
      message,
      confirmLabel: t('dialog.save'),
      discardLabel: t('dialog.dontSave'),
      cancelLabel: t('dialog.cancel')
    })
    if (choice === 'cancel') return false
    if (choice === 'discard') {
      for (const tb of dirtyTabs) void window.api.draftDiscard(tb.path)
      return true
    }
    await saveAllDirtyTabs()
    // A cancelled Save As on an untitled active tab keeps the window open.
    const stillDirty = dirtyTabs.some((tb) => {
      const isActive = tb.id === activeIdRef.current
      return isActive ? dirtyRef.current : tb.dirty
    })
    return !stillDirty
  }, [saveAllDirtyTabs])

  const newFile = useCallback(async () => {
    // P26: New opens its own tab — the current document stays open, so no
    // discard confirmation is needed.
    untitledSeqRef.current += 1
    const no = untitledSeqRef.current
    const state = makeState('')
    if (!state) return
    const id = `tab-${++tabSeqRef.current}`
    tabsRef.current.set(id, {
      id,
      path: null,
      name: `untitled-${no}`,
      untitledNo: no,
      state,
      savedContent: '',
      scroll: 0,
      baseDir: '',
      dirty: false
    })
    activateTab(id)
  }, [makeState, activateTab])

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

  // ---- P26 tab operations ---------------------------------------------------

  const listTabs = useCallback((): DocTabInfo[] => {
    return [...tabInfos]
  }, [tabInfos])

  const tabOrder = useCallback((): DocTab[] => {
    return [...tabsRef.current.values()]
  }, [])

  const findTabIdByPath = useCallback((path: string): string | null => {
    for (const tab of tabsRef.current.values()) if (tab.path === path) return tab.id
    return null
  }, [])

  /** Content of a tab (live for the active tab, stored state otherwise). */
  const tabContent = useCallback(
    (id: string): string | null => {
      if (id === activeIdRef.current) return currentDocText()
      return tabsRef.current.get(id)?.state?.doc.toString() ?? null
    },
    [currentDocText]
  )

  const closeTab = useCallback(
    async (id: string, opts?: { force?: boolean }): Promise<boolean> => {
      const view = viewRef.current
      const tab = tabsRef.current.get(id)
      if (!tab) return false
      const orderBefore = [...tabsRef.current.keys()]
      const closedIdx = orderBefore.indexOf(id)
      const isActive = id === activeIdRef.current
      const isDirty = isActive ? dirtyRef.current : tab.dirty
      if (isDirty && !opts?.force) {
        const choice = await dialog.choose({
          title: t('dialog.unsavedTitle'),
          message: t('tabs.closeDirty', { name: tab.name }),
          confirmLabel: t('dialog.save'),
          discardLabel: t('dialog.dontSave'),
          cancelLabel: t('dialog.cancel')
        })
        if (choice === 'cancel') return false
        if (choice === 'confirm') {
          const content = isActive && view ? view.state.doc.toString() : (tab.state?.doc.toString() ?? tab.savedContent)
          if (tab.path) {
            await window.api.writeFile(tab.path, content)
            void window.api.draftDiscard(tab.path)
          } else if (isActive) {
            // Untitled active tab needs a path before it can be "saved".
            const target = await window.api.showSaveDialog('untitled.md')
            if (!target) return false
            await window.api.writeFile(target, content)
            tab.path = target
            tab.name = baseNameOf(target)
            void window.api.draftDiscard(null)
          } else {
            await window.api.draftWrite(null, content)
          }
        } else {
          void window.api.draftDiscard(tab.path)
        }
      }
      // Reorder-capable close: remember for Reopen Closed Tab (path tabs only
      // restore from disk; untitleds keep their content in the stack entry).
      closedStackRef.current.push({
        path: tab.path,
        content:
          isActive && view ? view.state.doc.toString() : (tab.state?.doc.toString() ?? tab.savedContent),
        name: tab.name
      })
      if (closedStackRef.current.length > 10) closedStackRef.current.shift()

      tabsRef.current.delete(id)
      if (isActive) {
        // Activate the neighbor that took the closed slot (right, else left).
        const orderAfter = [...tabsRef.current.keys()]
        if (orderAfter.length === 0) {
          resetToWelcome()
        } else {
          activateTab(orderAfter[Math.min(closedIdx, orderAfter.length - 1)])
        }
      } else {
        refreshTabs()
      }
      return true
    },
    [viewRef, activateTab, resetToWelcome, refreshTabs]
  )

  const closeOtherTabs = useCallback(
    async (keepId: string): Promise<void> => {
      const ids = [...tabsRef.current.keys()].filter((id) => id !== keepId)
      for (const id of ids) {
        const ok = await closeTab(id)
        if (!ok) break // user cancelled on a dirty tab — stop the sweep
      }
      if (tabsRef.current.has(keepId)) activateTab(keepId)
    },
    [closeTab, activateTab]
  )

  const closeTabsRight = useCallback(
    async (id: string): Promise<void> => {
      const ids = [...tabsRef.current.keys()]
      const idx = ids.indexOf(id)
      if (idx < 0) return
      for (let i = ids.length - 1; i > idx; i--) {
        const ok = await closeTab(ids[i])
        if (!ok) break
      }
    },
    [closeTab]
  )

  const nextTab = useCallback(() => {
    const ids = [...tabsRef.current.keys()]
    if (ids.length < 2) return
    const idx = ids.indexOf(activeIdRef.current)
    activateTab(ids[(idx + 1) % ids.length])
  }, [activateTab])

  const prevTab = useCallback(() => {
    const ids = [...tabsRef.current.keys()]
    if (ids.length < 2) return
    const idx = ids.indexOf(activeIdRef.current)
    activateTab(ids[(idx - 1 + ids.length) % ids.length])
  }, [activateTab])

  const activateTabById = useCallback(
    (id: string) => {
      activateTab(id)
      viewRef.current?.focus()
    },
    [activateTab, viewRef]
  )

  /** P26 drag reorder: move `dragId` to index of `targetId` (before it). */
  const reorderTab = useCallback((dragId: string, targetId: string) => {
    if (dragId === targetId) return
    const entries = [...tabsRef.current.entries()]
    const from = entries.findIndex(([id]) => id === dragId)
    const to = entries.findIndex(([id]) => id === targetId)
    if (from < 0 || to < 0) return
    const [moved] = entries.splice(from, 1)
    entries.splice(to, 0, moved)
    tabsRef.current = new Map(entries)
    setTabInfos((prev) => {
      const list = [...prev]
      const f = list.findIndex((x) => x.id === dragId)
      const tIdx = list.findIndex((x) => x.id === targetId)
      if (f < 0 || tIdx < 0) return prev
      const [m] = list.splice(f, 1)
      list.splice(tIdx, 0, m)
      return list
    })
  }, [])

  const reopenClosedTab = useCallback(async (): Promise<void> => {
    const entry = closedStackRef.current.pop()
    if (!entry) return
    if (entry.path) {
      const ok = await openDocPath(entry.path)
      if (!ok) return
    } else {
      const state = makeState(entry.content)
      if (!state) return
      untitledSeqRef.current += 1
      const no = untitledSeqRef.current
      const id = `tab-${++tabSeqRef.current}`
      tabsRef.current.set(id, {
        id,
        path: null,
        name: `untitled-${no}`,
        untitledNo: no,
        state,
        savedContent: entry.content,
        scroll: 0,
        baseDir: '',
        dirty: entry.content !== ''
      })
      activateTab(id)
    }
  }, [openDocPath, makeState, activateTab])

  const hasClosedTabs = useCallback((): boolean => closedStackRef.current.length > 0, [])
  const getTabCount = useCallback((): number => tabsRef.current.size, [])
  const getActiveTabId = useCallback((): string => activeIdRef.current, [])
  const getActiveBaseDir = useCallback((): string => {
    return tabsRef.current.get(activeIdRef.current)?.baseDir ?? ''
  }, [])

  /** P07: external file change hit an open tab — reload per-tab. */
  const reloadTabFromDisk = useCallback(
    async (path: string): Promise<void> => {
      const id = findTabIdByPath(path)
      if (!id) return
      const content = await window.api.readFile(path)
      const isActive = id === activeIdRef.current
      const tab = tabsRef.current.get(id)
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
    [findTabIdByPath, loadContent, makeState, refreshTabs]
  )

  /**
   * Session openTabs snapshot — called by App when tabInfos change (after
   * sessionSynced) and after restores.
   */
  const persistTabsSession = useCallback(() => {
    const paths: string[] = []
    for (const tab of tabsRef.current.values()) if (tab.path) paths.push(tab.path)
    const active = tabsRef.current.get(activeIdRef.current)
    patchSession({ openTabs: paths, activePath: active?.path ?? null })
  }, [])

  /**
   * Dirty-dot seam: every dirty transition refreshes tabInfos so TabsBar
   * dots, Titlebar name and close dialogs see live flags (acceptance 1).
   */
  const setDirtyAndSyncTabs = useCallback(
    (d: boolean) => {
      setDirty(d)
      refreshTabs()
    },
    [setDirty, refreshTabs]
  )

  return {
    // legacy surface (App/e2e keep working)
    filePath,
    dirty,
    setDirty: setDirtyAndSyncTabs,
    setFilePath,
    filePathRef,
    savedContentRef,
    dirtyRef,
    suppressDirtyRef,
    syncAppState,
    setBaseDir,
    loadContent,
    confirmDiscard,
    queryClose,
    newFile,
    openFile,
    openFromSystem,
    openRecentFile,
    openFileByPath,
    saveFile,
    saveFileAs,
    // P26 tab surface
    tabInfos,
    initTabs,
    openDocPath,
    activateTab: activateTabById,
    closeTab,
    closeOtherTabs,
    closeTabsRight,
    nextTab,
    prevTab,
    reorderTab,
    reopenClosedTab,
    hasClosedTabs,
    getTabCount,
    getActiveTabId,
    getActiveBaseDir,
    listTabs,
    tabOrder,
    findTabIdByPath,
    tabContent,
    saveAllDirtyTabs,
    reloadTabFromDisk,
    persistTabsSession,
    resetToWelcome
  }
}
