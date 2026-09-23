import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import type { DirNode, FolderScanOptions } from '../../../../electron/shared/api'
import type { TreeMenuRequest } from '../components/FileTree'
import type { TreeMenuItem } from '../components/TreeMenu'
import { dialog } from '../components/Dialog'
import { getPreferences, getSession, patchSession } from '../preferences/store'
import type { SidebarMode } from './useFileOps'
import { useTreeRoot } from './useTreeRoot'
import { t } from '../i18n'

interface Args {
  /** 6B: reactive active-document path — drives tree-root follow (D1). */
  activePath: string | null
  filePathRef: RefObject<string | null>
  dirty: boolean
  confirmDiscard: () => Promise<boolean>
  loadContent: (content: string, path: string | null) => void
  /** P26: unified tab open — already-open paths activate their tab. */
  openDocPath?: (path: string) => Promise<boolean>
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
 * UX-P07-F3: Electron wraps ipcMain rejections as
 * `Error invoking remote method 'file:x': Error: <message>`. Alerts show the
 * handler's own copy — never the IPC envelope or raw errno text.
 */
function cleanIpcMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
}

/**
 * Folder workspace state: markdown file tree, watcher subscription, tree
 * CRUD (new/rename/delete/move) and the tree context menu.
 */
export function useWorkspaceTree({
  activePath,
  filePathRef,
  dirty,
  confirmDiscard,
  loadContent,
  openDocPath,
  setBaseDir,
  setFilePath,
  syncAppState,
  setSidebarMode,
  setShowOutline
}: Args) {
  // 6B tree root: `folderPath` is the *resolved* root (explicit pin → active
  // doc dir → recent root), no longer "the opened workspace folder".
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [folderTree, setFolderTree] = useState<DirNode[]>([])
  const [treeMenu, setTreeMenu] = useState<TreeMenuRequest | null>(null)
  // UX-P07-F4: node path in inline-rename mode (entered after create).
  const [renamingPath, setRenamingPath] = useState<string | null>(null)

  // 6B: single funnel that applies a resolved root — retargets the one folder
  // watcher and remembers the root as the session's recent-root slot (D5).
  // Mode-neutral on purpose: root follow must never flip the sidebar tab (6A).
  const applyTreeRoot = useCallback(async (dirPath: string | null) => {
    setFolderPath(dirPath)
    if (dirPath) {
      // P03/6B D5: lastFolderPath is the recent-root slot (6F grows it into
      // the recent-folders list). Written on every root application so the
      // AC4 fallback ("无文档时树根回落最近一次根") tracks the live root.
      patchSession({ lastFolderPath: dirPath })
      await window.api.watchFolder(dirPath, folderScanOptions())
    } else {
      await window.api.unwatchFolder()
    }
  }, [])

  // 6B: root follow + explicit pin (D1/D2). Follow transitions come from
  // activation changes; explicit opens pin through setExplicitRoot.
  const { setExplicitRoot } = useTreeRoot({ activePath, onRootChange: applyTreeRoot })

  // Explicit "open folder" channel (dialog / macOS open-file / P13 seam /
  // 6D/6F ops panel + recents): pins the root (D1) and shows the files tab.
  // The editor keeps its current document until a file is picked.
  const loadFolder = useCallback(
    async (dirPath: string) => {
      setSidebarMode('files')
      setShowOutline(true)
      await setExplicitRoot(dirPath)
    },
    [setExplicitRoot, setSidebarMode, setShowOutline]
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

  // Open a file picked from the folder tree. 6A: the sidebar stays on the
  // files tab (Typora file-tab semantics) — opens never switch sidebar mode.
  const openFileFromTree = useCallback(
    async (path: string) => {
      // P26: tree opens go through the tab layer — already-open files just
      // activate; new files become a tab (no content replacement, no gate).
      if (openDocPath) {
        await openDocPath(path)
        return
      }
      if (filePathRef.current === path) return
      if (!(await confirmDiscard())) return
      const content = await window.api.readFile(path)
      setBaseDir(path)
      loadContent(content, path)
    },
    [openDocPath, filePathRef, confirmDiscard, loadContent, setBaseDir]
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

  /**
   * Shared rename commit (dialog path + inline-rename path): validate → IPC →
   * followMovedPath. Same-name is a silent no-op (inline Enter on a fresh
   * file that already has its final name).
   */
  const commitTreeRename = useCallback(
    async (node: DirNode, name: string): Promise<boolean> => {
      if (!name || name === node.name) return true
      if (/[/\\]/.test(name) || name === '.' || name === '..') {
        await dialog.alert(t('tree.invalidAnyName'))
        return false
      }
      // sibling path: swap the last segment, keeping the original separator
      const newPath = node.path.slice(0, node.path.length - node.name.length) + name
      try {
        await window.api.renamePath(node.path, newPath)
      } catch (err) {
        await dialog.alert(t('tree.renameErr', { msg: cleanIpcMessage(err) }))
        return false
      }
      // keep the open editor attached when its file (or an ancestor folder) moves
      followMovedPath(node.path, newPath)
      return true
    },
    [followMovedPath]
  )

  const treeNewFile = useCallback(
    async (dirPath: string) => {
      const name = await dialog.prompt({ title: t('tree.newFile'), message: t('tree.newFileName') })
      if (!name) return
      if (/[/\\]/.test(name) || name === '.' || name === '..') {
        await dialog.alert(t('tree.invalidName'))
        return
      }
      const fileName = /\.[^./\\]+$/.test(name) ? name : `${name}.md`
      const fullPath = joinPath(dirPath, fileName)
      try {
        await window.api.createFile(fullPath)
      } catch (err) {
        await dialog.alert(t('tree.createFileErr', { msg: cleanIpcMessage(err) }))
        return
      }
      // UX-P07-F4: IDE-grade flow — the fresh row opens inline rename so the
      // user can immediately adjust the auto-suffixed name.
      setRenamingPath(fullPath)
    },
    [joinPath]
  )

  const treeNewFolder = useCallback(
    async (dirPath: string) => {
      const name = await dialog.prompt({ title: t('tree.newFolder'), message: t('tree.newFolderName') })
      if (!name) return
      if (/[/\\]/.test(name) || name === '.' || name === '..') {
        await dialog.alert(t('tree.invalidFolderName'))
        return
      }
      const fullPath = joinPath(dirPath, name)
      try {
        await window.api.mkdirPath(fullPath)
      } catch (err) {
        await dialog.alert(t('tree.createFolderErr', { msg: cleanIpcMessage(err) }))
        return
      }
      setRenamingPath(fullPath)
    },
    [joinPath]
  )

  const treeRename = useCallback(
    async (node: DirNode) => {
      const name = await dialog.prompt({
        title: node.isDir ? t('tree.renameFolder') : t('tree.renameFile'),
        message: node.isDir ? t('tree.renameFolderMsg') : t('tree.renameFileMsg'),
        defaultValue: node.name
      })
      if (!name || name === node.name) return
      await commitTreeRename(node, name)
    },
    [commitTreeRename]
  )

  const cancelInlineRename = useCallback(() => setRenamingPath(null), [])
  const finishInlineRename = useCallback(
    async (node: DirNode, name: string) => {
      setRenamingPath(null)
      await commitTreeRename(node, name)
    },
    [commitTreeRename]
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
        await dialog.alert(t('tree.moveErr', { msg: cleanIpcMessage(err) }))
      }
    },
    [followMovedPath]
  )

  const treeDelete = useCallback(
    async (node: DirNode) => {
      const ok = await dialog.confirm({
        title: node.isDir ? t('tree.deleteFolderTitle') : t('tree.deleteFileTitle'),
        message: node.isDir
          ? t('tree.deleteFolderMsg', { name: node.name })
          : t('tree.deleteFileMsg', { name: node.name }),
        confirmLabel: t('tree.deleteConfirm'),
        danger: true
      })
      if (!ok) return
      try {
        await window.api.deletePath(node.path)
      } catch (err) {
        await dialog.alert(t('tree.deleteErr', { msg: cleanIpcMessage(err) }))
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
        { label: 'tree.newFile', action: () => void treeNewFile(folderPath) },
        { label: 'tree.newFolder', action: () => void treeNewFolder(folderPath) },
        { label: 'tree.copyPath', action: () => treeCopyPath(null) }
      ]
    }
    if (node.isDir) {
      return [
        { label: 'tree.newFile', action: () => void treeNewFile(node.path) },
        { label: 'tree.newFolder', action: () => void treeNewFolder(node.path) },
        { label: 'tree.copyPath', action: () => treeCopyPath(node) },
        { label: 'tree.copyRelPath', action: () => treeCopyRelativePath(node) },
        { label: 'tree.rename', action: () => void treeRename(node) },
        { label: 'tree.delete', danger: true, action: () => void treeDelete(node) }
      ]
    }
    return [
      { label: 'tree.copyPath', action: () => treeCopyPath(node) },
      { label: 'tree.copyRelPath', action: () => treeCopyRelativePath(node) },
      { label: 'tree.rename', action: () => void treeRename(node) },
      { label: 'tree.delete', danger: true, action: () => void treeDelete(node) }
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
    renamingPath,
    cancelInlineRename,
    finishInlineRename,
    loadFolder,
    /** 6B explicit-root channel for 6D/6F (ops panel / recent folders). */
    setExplicitRoot,
    openFolder,
    openFolderFromSystem,
    openFileFromTree,
    treeNewFile,
    treeNewFolder,
    treeMove
  }
}
