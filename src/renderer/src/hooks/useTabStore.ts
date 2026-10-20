import { useCallback, useRef, useState, type RefObject } from 'react'
import type { Extension } from '@codemirror/state'
import { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import {
  reconfigureTheme,
  updateEditingAssists,
  updateLivePreviewConfig,
  updateShowLineNumbers
} from '../editor/setup'
import { readEditingAssistsConfig } from '../editor/assists'
import { getWelcomeMd } from '../content'
import { getPreferences, patchSession } from '../preferences/store'
import { baseDirOf, baseNameOf } from '../pathUtil'
import { resolveThemeMode } from './useAppTheme'
import { displayTabName, newDraftSlot, type DocTab, type DocTabInfo } from './docTabs'
import { resolveTabCloseDirty } from './tabClosePolicy'

export interface AddTabInput {
  path: string | null
  name: string
  isWelcome?: boolean
  untitledNo: number | null
  draftSlot?: string
  state: EditorState | null
  savedContent: string
  scroll: number
  baseDir: string
  dirty: boolean
}

export interface TabStore {
  filePath: string | null
  dirty: boolean
  tabInfos: DocTabInfo[]
  setFilePath: (path: string | null) => void
  filePathRef: RefObject<string | null>
  savedContentRef: RefObject<string>
  dirtyRef: RefObject<boolean>
  suppressDirtyRef: RefObject<boolean>
  setDirty: (d: boolean) => void
  setSavedBaseline: (content: string) => void
  setActiveDirty: (d: boolean) => void
  isTabDirty: (tab: DocTab) => boolean
  projectActiveMirrors: (tab: DocTab) => void
  syncAppState: (path: string | null, isDirty: boolean) => void
  setBaseDir: (path: string) => void
  currentDocText: () => string
  makeState: (content: string) => EditorState | null
  refreshTabs: () => void
  allTabs: () => DocTab[]
  getTab: (id: string) => DocTab | undefined
  getActiveTab: () => DocTab | undefined
  getDraftSlot: () => string | undefined
  addTab: (input: AddTabInput) => DocTab
  nextUntitledNo: () => number
  popClosedStack: () =>
    | { path: string | null; content: string; name: string; isWelcome: boolean }
    | undefined
  initTabs: (extensions: Extension[], initialContent: string) => void
  activateTab: (id: string) => boolean
  newFile: () => Promise<void>
  closeTab: (id: string, opts?: { force?: boolean }) => Promise<boolean>
  closeOtherTabs: (keepId: string) => Promise<void>
  closeTabsRight: (id: string) => Promise<void>
  nextTab: () => void
  prevTab: () => void
  activateTabById: (id: string) => void
  reorderTab: (dragId: string, targetId: string) => void
  hasClosedTabs: () => boolean
  getTabCount: () => number
  getActiveTabId: () => string
  getActiveBaseDir: () => string
  listTabs: () => DocTabInfo[]
  tabOrder: () => DocTab[]
  findTabIdByPath: (path: string) => string | null
  tabContent: (id: string) => string | null
  persistTabsSession: () => void
  resetToWelcome: () => void
}

export function useTabStore({
  viewRef,
  updateOutline,
  notifySaveFailed
}: {
  viewRef: RefObject<EditorView | null>
  updateOutline: () => void
  notifySaveFailed: (path: string | null, err: unknown) => void
}): TabStore {
  const filePathRef = useRef<string | null>(null)
  const savedContentRef = useRef<string>(getWelcomeMd())
  const dirtyRef = useRef(false)
  const suppressDirtyRef = useRef(false)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const tabsRef = useRef<Map<string, DocTab>>(new Map())
  const activeIdRef = useRef<string>('')
  const untitledSeqRef = useRef(0)
  const tabSeqRef = useRef(0)
  const extensionsRef = useRef<Extension[] | null>(null)
  const closedStackRef = useRef<Array<{ path: string | null; content: string; name: string; isWelcome: boolean }>>([])
  const [tabInfos, setTabInfos] = useState<DocTabInfo[]>([])

  const isTabDirty = useCallback((tab: DocTab): boolean => tab.dirty, [])

  const setActiveDirty = useCallback((d: boolean) => {
    const tab = tabsRef.current.get(activeIdRef.current)
    if (tab) tab.dirty = d
    dirtyRef.current = d
    setDirty(d)
  }, [])

  const setSavedBaseline = useCallback((content: string) => {
    const tab = tabsRef.current.get(activeIdRef.current)
    if (tab) tab.savedContent = content
    savedContentRef.current = content
  }, [])

  const projectActiveMirrors = useCallback((tab: DocTab) => {
    dirtyRef.current = tab.dirty
    setDirty(tab.dirty)
    savedContentRef.current = tab.savedContent
  }, [])

  const syncAppState = useCallback((path: string | null, isDirty: boolean) => {
    filePathRef.current = path
    const active = tabsRef.current.get(activeIdRef.current)
    const name = active ? displayTabName(active) : path ? baseNameOf(path) : 'Untitled'
    void window.api.setAppState({ filePath: path, dirty: isDirty, name })
  }, [])

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
    const activeId = activeIdRef.current
    const infos: DocTabInfo[] = []
    for (const tab of tabsRef.current.values()) {
      infos.push({
        id: tab.id,
        path: tab.path,
        name: tab.name,
        isWelcome: tab.isWelcome,
        dirty: isTabDirty(tab),
        active: tab.id === activeId
      })
    }
    setTabInfos(infos)
  }, [isTabDirty])

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

  const makeState = useCallback((content: string): EditorState | null => {
    const exts = extensionsRef.current
    if (!exts) return null
    return EditorState.create({ doc: content, extensions: exts })
  }, [])

  const allTabs = useCallback((): DocTab[] => [...tabsRef.current.values()], [])
  const getTab = useCallback((id: string) => tabsRef.current.get(id), [])
  const getActiveTab = useCallback(() => tabsRef.current.get(activeIdRef.current), [])
  const getDraftSlot = useCallback(
    () => tabsRef.current.get(activeIdRef.current)?.draftSlot,
    []
  )
  const nextUntitledNo = useCallback((): number => ++untitledSeqRef.current, [])
  const addTab = useCallback((input: AddTabInput): DocTab => {
    const tab: DocTab = {
      id: `tab-${++tabSeqRef.current}`,
      ...input,
      isWelcome: input.isWelcome ?? false,
      draftSlot: input.draftSlot ?? newDraftSlot()
    }
    tabsRef.current.set(tab.id, tab)
    return tab
  }, [])
  const popClosedStack = useCallback(
    () => closedStackRef.current.pop(),
    []
  )

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
      projectActiveMirrors(next)
      syncAppState(next.path, next.dirty)
      updateOutline()
      patchSession({ lastFilePath: next.path, lastCursor: 0 })
      refreshTabs()
      return true
    },
    [viewRef, makeState, reapplyViewState, syncAppState, updateOutline, refreshTabs, projectActiveMirrors]
  )

  const initTabs = useCallback(
    (extensions: Extension[], initialContent: string) => {
      extensionsRef.current = extensions
      tabsRef.current.clear()
      const tab = addTab({
        path: null,
        name: 'welcome',
        isWelcome: true,
        untitledNo: null,
        state: null,
        savedContent: initialContent,
        scroll: 0,
        baseDir: '',
        dirty: false
      })
      activeIdRef.current = tab.id
      filePathRef.current = null
      setFilePath(null)
      projectActiveMirrors(tab)
      syncAppState(null, false)
      refreshTabs()
    },
    [addTab, projectActiveMirrors, syncAppState, refreshTabs]
  )

  const resetToWelcome = useCallback(() => {
    initTabs(extensionsRef.current ?? [], getWelcomeMd())
  }, [initTabs])

  const newFile = useCallback(async () => {
    const no = nextUntitledNo()
    const state = makeState('')
    if (!state) return
    const tab = addTab({
      path: null,
      name: `untitled-${no}`,
      untitledNo: no,
      state,
      savedContent: '',
      scroll: 0,
      baseDir: '',
      dirty: false
    })
    activateTab(tab.id)
  }, [nextUntitledNo, makeState, addTab, activateTab])


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
      const isDirty = isTabDirty(tab)
      if (isDirty && !opts?.force) {
        const content =
          isActive && view ? view.state.doc.toString() : (tab.state?.doc.toString() ?? tab.savedContent)
        const proceed = await resolveTabCloseDirty(tab, content, { notifySaveFailed })
        if (!proceed) return false
      } else if (isDirty) {
        void window.api.draftDiscard(tab.path, tab.draftSlot)
      }
      closedStackRef.current.push({
        path: tab.path,
        content:
          isActive && view ? view.state.doc.toString() : (tab.state?.doc.toString() ?? tab.savedContent),
        name: tab.name,
        isWelcome: tab.isWelcome
      })
      if (closedStackRef.current.length > 10) closedStackRef.current.shift()

      tabsRef.current.delete(id)
      if (isActive) {
        const orderAfter = [...tabsRef.current.keys()]
        if (orderAfter.length === 0) {
          window.api.windowClose()
        } else {
          activateTab(orderAfter[Math.min(closedIdx, orderAfter.length - 1)])
        }
      } else {
        refreshTabs()
      }
      return true
    },
    [viewRef, activateTab, refreshTabs, isTabDirty, notifySaveFailed]
  )

  const closeOtherTabs = useCallback(
    async (keepId: string): Promise<void> => {
      const ids = [...tabsRef.current.keys()].filter((id) => id !== keepId)
      for (const id of ids) {
        const ok = await closeTab(id)
        if (!ok) break
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

  const hasClosedTabs = useCallback((): boolean => closedStackRef.current.length > 0, [])
  const getTabCount = useCallback((): number => tabsRef.current.size, [])
  const getActiveTabId = useCallback((): string => activeIdRef.current, [])
  const getActiveBaseDir = useCallback((): string => {
    return tabsRef.current.get(activeIdRef.current)?.baseDir ?? ''
  }, [])

  const persistTabsSession = useCallback(() => {
    const paths: string[] = []
    for (const tab of tabsRef.current.values()) if (tab.path) paths.push(tab.path)
    const active = tabsRef.current.get(activeIdRef.current)
    patchSession({ openTabs: paths, activePath: active?.path ?? null })
  }, [])

  const setDirtyAndSyncTabs = useCallback(
    (d: boolean) => {
      setActiveDirty(d)
      refreshTabs()
    },
    [setActiveDirty, refreshTabs]
  )

  return {
    filePath,
    dirty,
    tabInfos,
    setFilePath,
    filePathRef,
    savedContentRef,
    dirtyRef,
    suppressDirtyRef,
    setDirty: setDirtyAndSyncTabs,
    setSavedBaseline,
    setActiveDirty,
    isTabDirty,
    projectActiveMirrors,
    syncAppState,
    setBaseDir,
    currentDocText,
    makeState,
    refreshTabs,
    allTabs,
    getTab,
    getActiveTab,
    getDraftSlot,
    addTab,
    nextUntitledNo,
    popClosedStack,
    initTabs,
    activateTab,
    newFile,
    closeTab,
    closeOtherTabs,
    closeTabsRight,
    nextTab,
    prevTab,
    activateTabById,
    reorderTab,
    hasClosedTabs,
    getTabCount,
    getActiveTabId,
    getActiveBaseDir,
    listTabs,
    tabOrder,
    findTabIdByPath,
    tabContent,
    persistTabsSession,
    resetToWelcome
  }
}
