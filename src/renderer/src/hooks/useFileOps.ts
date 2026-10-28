import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import { t } from '../i18n'
import type { SidebarMode } from '../preferences/store'
import type { DocTabInfo } from './docTabs'
import { useTabStore } from './useTabStore'
import { useDocIo } from './useDocIo'
import { confirmDiscard as policyConfirmDiscard, queryClose as policyQueryClose } from './tabClosePolicy'

export type { SidebarMode }
export type { DocTabInfo }

interface Args {
  viewRef: RefObject<EditorView | null>
  updateOutline: () => void
  onSaveFailed?: (message: string) => void
  onFormatOnSaveFailed?: () => void
}

export function useFileOps({
  viewRef,
  updateOutline,
  onSaveFailed,
  onFormatOnSaveFailed
}: Args) {
  const onSaveFailedRef = useRef(onSaveFailed)
  onSaveFailedRef.current = onSaveFailed
  const onFormatOnSaveFailedRef = useRef(onFormatOnSaveFailed)
  onFormatOnSaveFailedRef.current = onFormatOnSaveFailed
  const notifySaveFailed = useCallback((path: string | null, err: unknown): void => {
    const reason = err instanceof Error ? err.message : String(err)
    onSaveFailedRef.current?.(
      path ? t('toast.saveFailedPath', { path, reason }) : t('toast.saveFailed', { reason })
    )
  }, [])

  const store = useTabStore({ viewRef, updateOutline, notifySaveFailed })
  const io = useDocIo({ viewRef, store, notifySaveFailed, onFormatOnSaveFailedRef, updateOutline })

  // Keep the main-process file watcher in sync with the open tabs so external
  // edits to any open document are detected.
  const watchedKeyRef = useRef('')
  useEffect(() => {
    const paths = store.tabInfos
      .map((info) => info.path)
      .filter((p): p is string => p != null)
      .sort()
    const key = paths.join(' ')
    if (key === watchedKeyRef.current) return
    watchedKeyRef.current = key
    void window.api.setWatchedFiles(paths)
  }, [store.tabInfos])

  const confirmDiscard = useCallback(
    () =>
      policyConfirmDiscard({
        isDirty: () => store.dirtyRef.current,
        getFilePath: () => store.filePathRef.current,
        getDraftSlot: () => store.getDraftSlot(),
        saveFile: io.saveFile
      }),
    [store.dirtyRef, store.filePathRef, store.getDraftSlot, io.saveFile]
  )

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
    openUntitledContent: io.openUntitledContent,
    confirmDiscard,
    queryClose,
    newFile: store.newFile,
    openFile: io.openFile,
    openFromSystem: io.openFromSystem,
    openRecentFile: io.openRecentFile,
    openFileByPath: io.openFileByPath,
    saveFile: io.saveFile,
    saveFileAs: io.saveFileAs,
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
    getDraftSlot: store.getDraftSlot,
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
