/**
 * P13 e2e seam — global-search handle (task 1A split).
 *
 * Effect body moved verbatim from App.tsx (dep array kept as-is). Ref
 * discipline: `sidebarModeRef` is business-shared (App's `openGlobalSearch`
 * reads it) and stays in App; only seam-only refs would migrate here.
 * Contract: e2e/handles.d.ts `__veloxP13`.
 */
import { useEffect } from 'react'
import type { FilePathRef, SidebarModeRef, ViewRef, Workspace } from './types'

export interface P13Deps {
  workspace: Workspace
  openGlobalSearch: () => void
  openSearchResult: (path: string, line: number, col: number) => Promise<void>
  /** Business-shared — App's `openGlobalSearch` reads it; lives in App. */
  sidebarModeRef: SidebarModeRef
  viewRef: ViewRef
  filePathRef: FilePathRef
}

export function useP13Seam(deps: P13Deps): void {
  const { workspace, openGlobalSearch, openSearchResult, sidebarModeRef, viewRef, filePathRef } = deps
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
}
