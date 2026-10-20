import { useEffect } from 'react'
import type { FilePathRef, SidebarModeRef, ViewRef, Workspace } from './types'

export interface P13Deps {
  workspace: Workspace
  openGlobalSearch: () => void
  openSearchResult: (path: string, line: number, col: number) => Promise<void>
  sidebarModeRef: SidebarModeRef
  viewRef: ViewRef
  filePathRef: FilePathRef
}

export function useP13Seam(deps: P13Deps): void {
  const { workspace, openGlobalSearch, openSearchResult, sidebarModeRef, viewRef, filePathRef } = deps
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
  }, [openGlobalSearch, openSearchResult, workspace.loadFolder])
}
