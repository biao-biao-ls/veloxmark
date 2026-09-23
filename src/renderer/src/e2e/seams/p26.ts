/**
 * P26 e2e seam — multi-document tab handle (task 1A split).
 *
 * Effect body moved verbatim from App.tsx (dep array kept as-is).
 * Contract: e2e/handles.d.ts `__veloxP26`.
 */
import { useEffect } from 'react'
import { undo } from '@codemirror/commands'
import { getSession, setPreferences } from '../../preferences/store'
import type { FileOps, FilePathRef, ViewRef } from './types'

export interface P26Deps {
  viewRef: ViewRef
  fileOps: FileOps
  filePathRef: FilePathRef
  toast: string | null
}

export function useP26Seam(deps: P26Deps): void {
  const { viewRef, fileOps, filePathRef, toast } = deps
  // P26 e2e handle — multi-document tab seams.
  useEffect(() => {
    window.__veloxP26 = {
      getDoc: () => viewRef.current?.state.doc.toString() ?? '',
      loadDoc: (text, path) => fileOps.loadContent(text, path),
      openPath: (path) => fileOps.openDocPath(path),
      tabs: () => fileOps.tabInfos,
      activeIndex: () => fileOps.tabInfos.findIndex((x) => x.active),
      activate: (id) => fileOps.activateTab(id),
      activateIndex: (i) => {
        const list = fileOps.tabInfos
        if (i >= 0 && i < list.length) fileOps.activateTab(list[i].id)
      },
      closeActive: (opts) => fileOps.closeTab(fileOps.getActiveTabId(), opts),
      closeId: (id, opts) => fileOps.closeTab(id, opts),
      // Probe hygiene only: product close paths close the window when the
      // last tab closes — sweeping closeId to zero tabs would kill the page.
      resetWelcome: () => fileOps.resetToWelcome(),
      nextTab: () => fileOps.nextTab(),
      reopenClosed: () => fileOps.reopenClosedTab(),
      hasClosedTabs: () => fileOps.hasClosedTabs(),
      reorder: (dragId, targetId) => fileOps.reorderTab(dragId, targetId),
      getFilePath: () => filePathRef.current,
      getDirty: () => fileOps.dirtyRef.current,
      insertText: (pos, text) => {
        const view = viewRef.current
        if (!view) return
        const p = Math.min(Math.max(0, pos), view.state.doc.length)
        view.dispatch({
          changes: { from: p, insert: text },
          selection: { anchor: p + text.length }
        })
      },
      setCursor: (pos) => {
        const view = viewRef.current
        if (!view) return
        const p = Math.min(Math.max(0, pos), view.state.doc.length)
        view.dispatch({ selection: { anchor: p } })
      },
      getCursor: () => viewRef.current?.state.selection.main.from ?? -1,
      undo: () => {
        const view = viewRef.current
        return view ? undo(view) : false
      },
      getBaseDir: () => fileOps.getActiveBaseDir(),
      getToast: () => toast,
      persistTabs: () => fileOps.persistTabsSession(),
      getSessionTabs: () => {
        const sess = getSession()
        return { openTabs: sess.openTabs ?? [], activePath: sess.activePath ?? null }
      },
      saveAllDirty: async () => {
        await fileOps.saveAllDirtyTabs()
      },
      newUntitled: () => {
        void fileOps.newFile()
      },
      closeOthers: (id) => {
        void fileOps.closeOtherTabs(id)
      },
      closeRight: (id) => {
        void fileOps.closeTabsRight(id)
      },
      queryClose: () => fileOps.queryClose(),
      dialogOpen: () => !!document.querySelector('.dialog'),
      setPrefs: (patch) => setPreferences(patch),
      getScrollTop: () => viewRef.current?.scrollDOM.scrollTop ?? -1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileOps, toast])
}
