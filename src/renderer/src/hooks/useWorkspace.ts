import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DirNode } from '@shared/ipc'
import { basenameOf, joinPath, replaceBasename } from '@shared/paths'
import type { TreeMenuRequest } from '../components/FileTree'
import type { TreeMenuItem } from '../components/TreeMenu'

export type SidebarMode = 'outline' | 'files'

/** Document-hook surface the workspace needs to open files and follow paths. */
export interface WorkspaceDocumentLink {
  /** Currently open file path (null for untitled / detached buffers). */
  filePath: string | null
  openPathFromDisk: (path: string) => Promise<boolean>
  reattachIfUnder: (oldPath: string, isDir: boolean, newPath: string) => void
  detachIfUnder: (path: string, isDir: boolean) => void
}

/** Folder workspace: tree state, sidebar mode, and tree CRUD operations. */
export function useWorkspace(link: WorkspaceDocumentLink): {
  folderPath: string | null
  folderTree: DirNode[]
  sidebarMode: SidebarMode
  setSidebarMode: (mode: SidebarMode) => void
  treeMenu: TreeMenuRequest | null
  setTreeMenu: (req: TreeMenuRequest | null) => void
  treeMenuItems: TreeMenuItem[]
  loadFolder: (dirPath: string) => Promise<void>
  openFolder: () => Promise<void>
  openFileFromTree: (path: string) => Promise<void>
  treeNewFile: (dirPath: string) => Promise<void>
} {
  // Destructured so callbacks depend on the stable function identities from
  // useDocument rather than on the fresh link object each render.
  const { filePath, openPathFromDisk, reattachIfUnder, detachIfUnder } = link

  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [folderTree, setFolderTree] = useState<DirNode[]>([])
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('outline')
  const [treeMenu, setTreeMenu] = useState<TreeMenuRequest | null>(null)

  // Main pushes the (re)scanned tree on every watcher event; the setter is
  // stable so this subscribes exactly once.
  useEffect(() => window.api.onFolderTree(setFolderTree), [])

  // Load a folder workspace: sidebar switches to the markdown file tree.
  // The editor keeps its current document until a file is picked. Subscribing
  // the watcher delivers the initial tree and every subsequent refresh.
  const loadFolder = useCallback(async (dirPath: string) => {
    setFolderPath(dirPath)
    setSidebarMode('files')
    await window.api.watchFolder(dirPath)
  }, [])

  const openFolder = useCallback(async () => {
    const result = await window.api.openFolder()
    if (!result) return
    await loadFolder(result.folderPath)
  }, [loadFolder])

  // Open a file picked from the folder tree — switches the sidebar to outline.
  const openFileFromTree = useCallback(
    async (path: string) => {
      if (filePath === path) {
        setSidebarMode('outline')
        return
      }
      if (await openPathFromDisk(path)) setSidebarMode('outline')
    },
    [filePath, openPathFromDisk]
  )

  // ---- tree operations (new / rename / delete) ------------------------------
  // Tree refresh after each op comes from the watcher's folder:tree push —
  // no manual rescan here.

  const treeNewFile = useCallback(async (dirPath: string) => {
    const name = window.prompt('New file name:')
    if (!name) return
    if (/[/\\]/.test(name) || name === '.' || name === '..') {
      window.alert('Invalid file name.')
      return
    }
    const fileName = /\.[^./\\]+$/.test(name) ? name : `${name}.md`
    try {
      await window.api.createFile(joinPath(dirPath, fileName, window.api.platform))
    } catch (err) {
      window.alert(`Could not create file: ${err instanceof Error ? err.message : err}`)
    }
  }, [])

  const treeRename = useCallback(
    async (node: DirNode) => {
      const name = window.prompt(node.isDir ? 'Rename folder:' : 'Rename file:', node.name)
      if (!name || name === node.name) return
      if (/[/\\]/.test(name) || name === '.' || name === '..') {
        window.alert('Invalid name.')
        return
      }
      const newPath = replaceBasename(node.path, name)
      try {
        await window.api.renamePath(node.path, newPath)
      } catch (err) {
        window.alert(`Could not rename: ${err instanceof Error ? err.message : err}`)
        return
      }
      // keep the open editor attached when its file (or an ancestor folder) moves
      reattachIfUnder(node.path, node.isDir, newPath)
    },
    [reattachIfUnder]
  )

  const treeDelete = useCallback(
    async (node: DirNode) => {
      const what = node.isDir ? 'folder' : 'file'
      if (!window.confirm(`Delete ${what} "${node.name}"? This cannot be undone.`)) return
      try {
        await window.api.deletePath(node.path)
      } catch (err) {
        window.alert(`Could not delete: ${err instanceof Error ? err.message : err}`)
        return
      }
      detachIfUnder(node.path, node.isDir)
    },
    [detachIfUnder]
  )

  const treeMenuItems: TreeMenuItem[] = useMemo(() => {
    if (!treeMenu) return []
    const { node } = treeMenu
    if (node.isDir) {
      return [
        { label: 'New File', action: () => void treeNewFile(node.path) },
        { label: 'Rename', action: () => void treeRename(node) },
        { label: 'Delete', danger: true, action: () => void treeDelete(node) }
      ]
    }
    return [
      { label: 'Rename', action: () => void treeRename(node) },
      { label: 'Delete', danger: true, action: () => void treeDelete(node) }
    ]
  }, [treeMenu, treeNewFile, treeRename, treeDelete])

  return {
    folderPath,
    folderTree,
    sidebarMode,
    setSidebarMode,
    treeMenu,
    setTreeMenu,
    treeMenuItems,
    loadFolder,
    openFolder,
    openFileFromTree,
    treeNewFile
  }
}
