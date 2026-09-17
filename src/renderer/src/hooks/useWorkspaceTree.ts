import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import type { DirNode, FolderScanOptions } from '../../../../electron/shared/api'
import type { TreeMenuRequest } from '../components/FileTree'
import type { TreeMenuItem } from '../components/TreeMenu'
import { dialog } from '../components/Dialog'
import { getPreferences, getSession, patchSession } from '../preferences/store'
import type { SidebarMode } from './useFileOps'

interface Args {
  filePathRef: RefObject<string | null>
  dirty: boolean
  confirmDiscard: () => Promise<boolean>
  loadContent: (content: string, path: string | null) => void
  setBaseDir: (path: string) => void
  setFilePath: (path: string | null) => void
  syncAppState: (path: string | null, dirty: boolean) => void
  setSidebarMode: (mode: SidebarMode) => void
  setShowOutline: (visible: boolean) => void
}

/** Current P07 scan options, pushed to main with every watchFolder. */
export function folderScanOptions(): FolderScanOptions {
  const p = getPreferences()
  return { ignoreNames: p.folderIgnoreNames, showHiddenFiles: p.showHiddenFiles }
}

/**
 * Folder workspace state: markdown file tree, watcher subscription, tree
 * CRUD (new/rename/delete/move) and the tree context menu.
 */
export function useWorkspaceTree({
  filePathRef,
  dirty,
  confirmDiscard,
  loadContent,
  setBaseDir,
  setFilePath,
  syncAppState,
  setSidebarMode,
  setShowOutline
}: Args) {
  // Folder workspace: when set, the sidebar can show the markdown file tree
  // and switch between it and the current file's outline.
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [folderTree, setFolderTree] = useState<DirNode[]>([])
  const [treeMenu, setTreeMenu] = useState<TreeMenuRequest | null>(null)

  // Load a folder workspace: sidebar switches to the markdown file tree.
  // The editor keeps its current document until a file is picked. Subscribing
  // the watcher delivers the initial tree and every subsequent refresh.
  const loadFolder = useCallback(
    async (dirPath: string) => {
      setFolderPath(dirPath)
      setSidebarMode('files')
      setShowOutline(true)
      // P03: remember for session restore.
      patchSession({ lastFolderPath: dirPath })
      await window.api.watchFolder(dirPath, folderScanOptions())
    },
    [setSidebarMode, setShowOutline]
  )

  const openFolder = useCallback(async () => {
    const result = await window.api.openFolder()
    if (!result) return
    await loadFolder(result.folderPath)
  }, [loadFolder])

  // Finder "Open" on a folder (macOS open-file with a directory path).
  const openFolderFromSystem = useCallback(
    (path: string) => {
      void loadFolder(path)
    },
    [loadFolder]
  )

  // Open a file picked from the folder tree — switches the sidebar to outline.
  const openFileFromTree = useCallback(
    async (path: string) => {
      if (filePathRef.current === path) {
        setSidebarMode('outline')
        return
      }
      if (!(await confirmDiscard())) return
      const content = await window.api.readFile(path)
      setBaseDir(path)
      loadContent(content, path)
      setSidebarMode('outline')
    },
    [filePathRef, confirmDiscard, loadContent, setSidebarMode, setBaseDir]
  )

  const joinPath = useCallback((dir: string, name: string): string => {
    const sep = window.api.platform === 'win32' ? '\\' : '/'
    return dir.replace(/[\\/]+$/, '') + sep + name
  }, [])

  // ---- tree operations (new / rename / delete / move) -----------------------
  // Tree refresh after each op comes from the watcher's folder:tree push —
  // no manual rescan here.

  /**
   * Point the editor and session state at a path that just moved from
   * oldPath to newPath (rename or drag-move; the moved node may be the open
   * file itself or an ancestor folder of it). Also repairs the recent-files
   * list so menus don't keep dead paths.
   */
  const followMovedPath = useCallback(
    (oldPath: string, newPath: string) => {
      const sep = window.api.platform === 'win32' ? '\\' : '/'
      const current = filePathRef.current
      if (current === oldPath) {
        setFilePath(newPath)
        syncAppState(newPath, dirty)
      } else if (current && current.startsWith(oldPath + sep)) {
        const moved = newPath + current.slice(oldPath.length)
        setFilePath(moved)
        syncAppState(moved, dirty)
      }
      const mapPath = (p: string): string =>
        p === oldPath ? newPath : p.startsWith(oldPath + sep) ? newPath + p.slice(oldPath.length) : p
      const s = getSession()
      patchSession({
        recentFiles: [...new Set(s.recentFiles.map(mapPath))],
        ...(s.lastFilePath ? { lastFilePath: mapPath(s.lastFilePath) } : {})
      })
    },
    [filePathRef, dirty, setFilePath, syncAppState]
  )

  const treeNewFile = useCallback(
    async (dirPath: string) => {
      const name = await dialog.prompt({ title: 'New File', message: 'New file name:' })
      if (!name) return
      if (/[/\\]/.test(name) || name === '.' || name === '..') {
        await dialog.alert('Invalid file name.')
        return
      }
      const fileName = /\.[^./\\]+$/.test(name) ? name : `${name}.md`
      try {
        await window.api.createFile(joinPath(dirPath, fileName))
      } catch (err) {
        await dialog.alert(`Could not create file: ${err instanceof Error ? err.message : err}`)
      }
    },
    [joinPath]
  )

  const treeNewFolder = useCallback(
    async (dirPath: string) => {
      const name = await dialog.prompt({ title: 'New Folder', message: 'New folder name:' })
      if (!name) return
      if (/[/\\]/.test(name) || name === '.' || name === '..') {
        await dialog.alert('Invalid folder name.')
        return
      }
      try {
        await window.api.mkdirPath(joinPath(dirPath, name))
      } catch (err) {
        await dialog.alert(`Could not create folder: ${err instanceof Error ? err.message : err}`)
      }
    },
    [joinPath]
  )

  const treeRename = useCallback(
    async (node: DirNode) => {
      const name = await dialog.prompt({
        title: node.isDir ? 'Rename Folder' : 'Rename File',
        message: node.isDir ? 'Rename folder:' : 'Rename file:',
        defaultValue: node.name
      })
      if (!name || name === node.name) return
      if (/[/\\]/.test(name) || name === '.' || name === '..') {
        await dialog.alert('Invalid name.')
        return
      }
      // sibling path: swap the last segment, keeping the original separator
      const newPath = node.path.slice(0, node.path.length - node.name.length) + name
      try {
        await window.api.renamePath(node.path, newPath)
      } catch (err) {
        await dialog.alert(`Could not rename: ${err instanceof Error ? err.message : err}`)
        return
      }
      // keep the open editor attached when its file (or an ancestor folder) moves
      followMovedPath(node.path, newPath)
    },
    [followMovedPath]
  )

  // P07: drag-drop — move srcPath into destDir (main validates the subtree).
  const treeMove = useCallback(
    async (srcPath: string, destDir: string) => {
      const sep = window.api.platform === 'win32' ? '\\' : '/'
      // drop into itself or its own subtree — refuse before hitting IPC
      if (destDir === srcPath || destDir.startsWith(srcPath + sep)) return
      try {
        const newPath = await window.api.movePath(srcPath, destDir)
        followMovedPath(srcPath, newPath)
      } catch (err) {
        await dialog.alert(`Could not move: ${err instanceof Error ? err.message : err}`)
      }
    },
    [followMovedPath]
  )

  const treeDelete = useCallback(
    async (node: DirNode) => {
      const what = node.isDir ? 'folder' : 'file'
      const ok = await dialog.confirm({
        title: `Delete ${what}`,
        message: `Delete ${what} "${node.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true
      })
      if (!ok) return
      try {
        await window.api.deletePath(node.path)
      } catch (err) {
        await dialog.alert(`Could not delete: ${err instanceof Error ? err.message : err}`)
        return
      }
      // if the open file is gone, detach it (buffer keeps its content → Save As)
      const current = filePathRef.current
      const sep = window.api.platform === 'win32' ? '\\' : '/'
      if (current === node.path || (node.isDir && current?.startsWith(node.path + sep))) {
        setFilePath(null)
        syncAppState(null, dirty)
      }
    },
    [filePathRef, dirty, setFilePath, syncAppState]
  )

  const treeCopyPath = useCallback((node: DirNode | null) => {
    const target = node ? node.path : folderPath
    if (target) void window.api.clipboardWrite(target)
  }, [folderPath])

  const treeCopyRelativePath = useCallback(
    (node: DirNode) => {
      if (!folderPath) return
      const sep = window.api.platform === 'win32' ? '\\' : '/'
      const prefix = folderPath.endsWith(sep) ? folderPath : folderPath + sep
      void window.api.clipboardWrite(node.path.startsWith(prefix) ? node.path.slice(prefix.length) : node.path)
    },
    [folderPath]
  )

  const treeMenuItems: TreeMenuItem[] = useMemo(() => {
    if (!treeMenu || !folderPath) return []
    const { node } = treeMenu
    // Root: right-click on the empty area under the tree.
    if (!node) {
      return [
        { label: 'New File', action: () => void treeNewFile(folderPath) },
        { label: 'New Folder', action: () => void treeNewFolder(folderPath) },
        { label: 'Copy Path', action: () => treeCopyPath(null) }
      ]
    }
    if (node.isDir) {
      return [
        { label: 'New File', action: () => void treeNewFile(node.path) },
        { label: 'New Folder', action: () => void treeNewFolder(node.path) },
        { label: 'Copy Path', action: () => treeCopyPath(node) },
        { label: 'Copy Relative Path', action: () => treeCopyRelativePath(node) },
        { label: 'Rename', action: () => void treeRename(node) },
        { label: 'Delete', danger: true, action: () => void treeDelete(node) }
      ]
    }
    return [
      { label: 'Copy Path', action: () => treeCopyPath(node) },
      { label: 'Copy Relative Path', action: () => treeCopyRelativePath(node) },
      { label: 'Rename', action: () => void treeRename(node) },
      { label: 'Delete', danger: true, action: () => void treeDelete(node) }
    ]
  }, [
    treeMenu,
    folderPath,
    treeNewFile,
    treeNewFolder,
    treeCopyPath,
    treeCopyRelativePath,
    treeRename,
    treeDelete
  ])

  // Watcher pushes a full tree on every (debounced) FS change.
  useEffect(() => {
    return window.api.onFolderTree((tree) => setFolderTree(tree))
  }, [])

  // macOS open-file event with a directory path.
  useEffect(() => {
    return window.api.onOpenFolder((path) => openFolderFromSystem(path))
  }, [openFolderFromSystem])

  return {
    folderPath,
    folderTree,
    treeMenu,
    setTreeMenu,
    treeMenuItems,
    loadFolder,
    openFolder,
    openFolderFromSystem,
    openFileFromTree,
    treeNewFile,
    treeNewFolder,
    treeMove
  }
}
