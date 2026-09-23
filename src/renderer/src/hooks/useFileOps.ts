/**
 * P26 multi-document facade (task 3.6) — hook name and return surface kept so
 * App and the e2e hooks keep binding to useFileOps. Bodies now live in:
 *   - useTabStore (3.3): tab Map CRUD, dirty/savedContent single-source
 *     mutators (3.1), view-swap glue
 *   - useDocIo (3.4): open/load/save pipelines, reopenClosedTab
 *   - tabClosePolicy (3.5): confirmDiscard / queryClose three-option gates
 *
 * Dirty tracking (3.1 single source): `DocTab.dirty` / `DocTab.savedContent`
 * are the truth for every tab (active included). `dirtyRef` / the `dirty`
 * React state / `savedContentRef` are projections of the ACTIVE tab and are
 * written ONLY through setActiveDirty / setSavedBaseline / projectActiveMirrors
 * (markActiveSaved composes them). External code must call the facade mutators
 * (setDirty / setSavedBaseline / markActiveSaved) instead of writing the refs.
 *
 * Stability contract: every callback on the returned object keeps the old
 * useCallback-stable identity (App effect dep arrays rely on it).
 */
import { useCallback, useRef, type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import { t } from '../i18n'
import type { SidebarMode } from '../preferences/store'
import type { DocTabInfo } from './docTabs'
import { useTabStore } from './useTabStore'
import { useDocIo } from './useDocIo'
import { confirmDiscard as policyConfirmDiscard, queryClose as policyQueryClose } from './tabClosePolicy'

// Single-source re-exports (3.2): SidebarMode is declared in preferences/store
// (session persistence shape); DocTab/DocTabInfo live in hooks/docTabs.
export type { SidebarMode }
export type { DocTabInfo }

interface Args {
  viewRef: RefObject<EditorView | null>
  updateOutline: () => void
  setSidebarMode: (mode: SidebarMode) => void
  /** P03 session restore only — suppress the outline switch for one open. */
  restoringRef: RefObject<boolean>
  /** wave③ toast 统一: manual Save/Save As write failures surface here. */
  onSaveFailed?: (message: string) => void
  /** UX-P23 wave⑥-6 F3: format-on-save throw → one-shot toast; save continues. */
  onFormatOnSaveFailed?: () => void
}

export function useFileOps({
  viewRef,
  updateOutline,
  setSidebarMode,
  restoringRef,
  onSaveFailed,
  onFormatOnSaveFailed
}: Args) {
  const onSaveFailedRef = useRef(onSaveFailed)
  onSaveFailedRef.current = onSaveFailed
  const onFormatOnSaveFailedRef = useRef(onFormatOnSaveFailed)
  onFormatOnSaveFailedRef.current = onFormatOnSaveFailed
  /** wave③: visible failure for user-initiated writes (autosave has its own channel). */
  const notifySaveFailed = useCallback((path: string | null, err: unknown): void => {
    const reason = err instanceof Error ? err.message : String(err)
    onSaveFailedRef.current?.(
      path ? t('toast.saveFailedPath', { path, reason }) : t('toast.saveFailed', { reason })
    )
  }, [])

  const store = useTabStore({ viewRef, updateOutline, notifySaveFailed })
  const io = useDocIo({ viewRef, store, setSidebarMode, restoringRef, notifySaveFailed, onFormatOnSaveFailedRef, updateOutline })

  /** P12 three-option gate (buffer-replacement paths / e2e). */
  const confirmDiscard = useCallback(
    () =>
      policyConfirmDiscard({
        isDirty: () => store.dirtyRef.current,
        getFilePath: () => store.filePathRef.current,
        saveFile: io.saveFile
      }),
    [store.dirtyRef, store.filePathRef, io.saveFile]
  )

  /** P12/P26 close intercept — also reachable via window.__veloxP12 for CDP. */
  const queryClose = useCallback(
    () =>
      policyQueryClose({
        allTabs: store.allTabs,
        isTabDirty: store.isTabDirty,
        saveAllDirtyTabs: io.saveAllDirtyTabs
      }),
    [store.allTabs, store.isTabDirty, io.saveAllDirtyTabs]
  )

  return {
    // legacy surface (App/e2e keep working)
    filePath: store.filePath,
    dirty: store.dirty,
    setDirty: store.setDirty,
    setFilePath: store.setFilePath,
    filePathRef: store.filePathRef,
    savedContentRef: store.savedContentRef,
    dirtyRef: store.dirtyRef,
    suppressDirtyRef: store.suppressDirtyRef,
    syncAppState: store.syncAppState,
    setSavedBaseline: store.setSavedBaseline,
    markActiveSaved: io.markActiveSaved,
    setBaseDir: store.setBaseDir,
    loadContent: io.loadContent,
    confirmDiscard,
    queryClose,
    newFile: store.newFile,
    openFile: io.openFile,
    openFromSystem: io.openFromSystem,
    openRecentFile: io.openRecentFile,
    openFileByPath: io.openFileByPath,
    saveFile: io.saveFile,
    saveFileAs: io.saveFileAs,
    // P26 tab surface
    tabInfos: store.tabInfos,
    initTabs: store.initTabs,
    openDocPath: io.openDocPath,
    activateTab: store.activateTabById,
    closeTab: store.closeTab,
    closeOtherTabs: store.closeOtherTabs,
    closeTabsRight: store.closeTabsRight,
    nextTab: store.nextTab,
    prevTab: store.prevTab,
    reorderTab: store.reorderTab,
    reopenClosedTab: io.reopenClosedTab,
    hasClosedTabs: store.hasClosedTabs,
    getTabCount: store.getTabCount,
    getActiveTabId: store.getActiveTabId,
    getActiveBaseDir: store.getActiveBaseDir,
    listTabs: store.listTabs,
    tabOrder: store.tabOrder,
    findTabIdByPath: store.findTabIdByPath,
    tabContent: store.tabContent,
    saveAllDirtyTabs: io.saveAllDirtyTabs,
    reloadTabFromDisk: io.reloadTabFromDisk,
    persistTabsSession: store.persistTabsSession,
    resetToWelcome: store.resetToWelcome
  }
}
