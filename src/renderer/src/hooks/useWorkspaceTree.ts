import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import type { DirNode, FolderScanOptions } from '../../../../electron/shared/api'
import type { TreeMenuRequest } from '../components/FileTree'
import type { TreeMenuItem } from '../components/TreeMenu'
import { dialog } from '../components/Dialog'
import { getPreferences, getSession, patchSession, setPreferences } from '../preferences/store'
import { upsertRecent } from '../filetree/recents'
import { baseDirOf } from '../pathUtil'
import type { SidebarMode } from './useFileOps'
import { useTreeRoot } from './useTreeRoot'
import { t } from '../i18n'

interface Args {
  activePath: string | null
  filePathRef: RefObject<string | null>
  dirty: boolean
  confirmDiscard: () => Promise<boolean>
  loadContent: (content: string, path: string | null) => void
  openDocPath?: (path: string) => Promise<boolean>
  setBaseDir: (path: string) => void
  setFilePath: (path: string | null) => void
  syncAppState: (path: string | null, dirty: boolean) => void
  setSidebarMode: (mode: SidebarMode) => void
  setShowSidebar: (visible: boolean) => void
}

export function folderScanOptions(): FolderScanOptions {
  const p = getPreferences()
  return { ignoreNames: p.folderIgnoreNames, showHiddenFiles: p.showHiddenFiles }
}

function cleanIpcMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
}

export function resolveNewFileTarget(input: {
  selection: { path: string; isDir: boolean } | null
  activePath: string | null
  root: string | null
}): string | null {
  const sel = input.selection
  if (sel) return sel.isDir ? sel.path : baseDirOf(sel.path)
  if (input.activePath) return baseDirOf(input.activePath)
  return input.root
}

export function withMarkdownSuffix(name: string, kind: 'file' | 'dir'): string {
  return kind === 'file' && !/\.[^./\\]+$/.test(name) ? `${name}.md` : name
}

export function isInvalidTreeName(name: string): boolean {
  return /[/\\]/.test(name) || name === '.' || name === '..'
}

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
  setShowSidebar
}: Args) {
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [folderTree, setFolderTree] = useState<DirNode[]>([])
  const [treeMenu, setTreeMenu] = useState<TreeMenuRequest | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [selection, setSelection] = useState<{ path: string; isDir: boolean } | null>(null)
  const [pendingCreate, setPendingCreate] = useState<{
    parentPath: string
    kind: 'file' | 'dir'
  } | null>(null)

  const applyTreeRoot = useCallback(async (dirPath: string | null) => {
    setFolderPath(dirPath)
    if (dirPath) {
      const p = getPreferences()
      const recentFolders = upsertRecent(p.recentFolders, dirPath)
      if (recentFolders !== p.recentFolders) setPreferences({ recentFolders })
      await window.api.watchFolder(dirPath, folderScanOptions())
    } else {
      await window.api.unwatchFolder()
    }
  }, [])

  const { setExplicitRoot } = useTreeRoot({ activePath, onRootChange: applyTreeRoot })

  const loadFolder = useCallback(
    async (dirPath: string) => {
      setSidebarMode('files')
      setShowSidebar(true)
      await setExplicitRoot(dirPath)
    },
    [setExplicitRoot, setSidebarMode, setShowSidebar]
  )

  const openFolder = useCallback(async () => {
    const result = await window.api.openFolder()
    if (!result) return
    await loadFolder(result.folderPath)
  }, [loadFolder])

  const refreshTree = useCallback(async () => {
    if (!folderPath) return
    await window.api.watchFolder(folderPath, folderScanOptions())
  }, [folderPath])

  const selectNode = useCallback((path: string, isDir: boolean) => {
    setSelection({ path, isDir })
  }, [])
  useEffect(() => {
    setSelection(null)
    setPendingCreate(null)
  }, [folderPath])
  useEffect(() => {
    if (renamingPath) setPendingCreate(null)
  }, [renamingPath])

  const openFolderFromSystem = useCallback(
    (path: string) => {
      void loadFolder(path)
    },
    [loadFolder]
  )

  const openFileFromTree = useCallback(
    async (path: string) => {
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

  const commitTreeRename = useCallback(
    async (node: DirNode, name: string): Promise<boolean> => {
      if (!name || name === node.name) return true
      if (/[/\\]/.test(name) || name === '.' || name === '..') {
        await dialog.alert(t('tree.invalidAnyName'))
        return false
      }
      const newPath = node.path.slice(0, node.path.length - node.name.length) + name
      try {
        await window.api.renamePath(node.path, newPath)
      } catch (err) {
        await dialog.alert(t('tree.renameErr', { msg: cleanIpcMessage(err) }))
        return false
      }
      followMovedPath(node.path, newPath)
      return true
    },
    [followMovedPath]
  )

  const treeNewFile = useCallback((dirPath: string) => {
    setRenamingPath(null)
    setPendingCreate({ parentPath: dirPath, kind: 'file' })
  }, [])

  const treeNewFolder = useCallback((dirPath: string) => {
    setRenamingPath(null)
    setPendingCreate({ parentPath: dirPath, kind: 'dir' })
  }, [])

  const cancelTreeCreate = useCallback(() => setPendingCreate(null), [])

  const commitTreeCreate = useCallback(
    async (name: string) => {
      const pending = pendingCreate
      setPendingCreate(null)
      if (!pending || !name) return
      if (isInvalidTreeName(name)) {
        await dialog.alert(
          pending.kind === 'dir' ? t('tree.invalidFolderName') : t('tree.invalidName')
        )
        return
      }
      const isFile = pending.kind === 'file'
      const fileName = withMarkdownSuffix(name, pending.kind)
      const fullPath = joinPath(pending.parentPath, fileName)
      if (await window.api.pathExists(fullPath)) {
        await dialog.alert(t('tree.nameExists', { name: fileName }))
        return
      }
      try {
        if (isFile) await window.api.createFile(fullPath)
        else await window.api.mkdirPath(fullPath)
      } catch (err) {
        await dialog.alert(
          t(isFile ? 'tree.createFileErr' : 'tree.createFolderErr', { msg: cleanIpcMessage(err) })
        )
        return
      }
      if (isFile && fileName !== name) setRenamingPath(fullPath)
    },
    [pendingCreate, joinPath]
  )

  const treeNewFileAt = useCallback(() => {
    const dir = resolveNewFileTarget({ selection, activePath, root: folderPath })
    if (dir) void treeNewFile(dir)
  }, [selection, activePath, folderPath, treeNewFile])

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

  const treeMove = useCallback(
    async (srcPath: string, destDir: string) => {
      const sep = window.api.platform === 'win32' ? '\\' : '/'
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
    const revealItem = (): TreeMenuItem => ({
      label: 'ops.reveal',
      op: 'tree.revealInOS',
      action: () => void window.api.showItemInFolder(node ? node.path : folderPath)
    })
    const refreshItem = (): TreeMenuItem => ({
      label: 'ops.refresh',
      op: 'tree.refresh',
      action: () => void refreshTree()
    })
    if (!node) {
      return [
        { label: 'tree.newFile', action: () => treeNewFile(folderPath) },
        { label: 'tree.newFolder', action: () => treeNewFolder(folderPath) },
        revealItem(),
        refreshItem(),
        { sep: true },
        { label: 'tree.copyPath', action: () => treeCopyPath(null) }
      ]
    }
    if (node.isDir) {
      return [
        { label: 'tree.newFile', action: () => treeNewFile(node.path) },
        { label: 'tree.newFolder', action: () => treeNewFolder(node.path) },
        revealItem(),
        refreshItem(),
        { sep: true },
        { label: 'tree.copyPath', action: () => treeCopyPath(node) },
        { label: 'tree.copyRelPath', action: () => treeCopyRelativePath(node) },
        { sep: true },
        { label: 'tree.rename', action: () => void treeRename(node) },
        { label: 'tree.delete', danger: true, action: () => void treeDelete(node) }
      ]
    }
    return [
      {
        label: 'tree.openInTab',
        op: 'tree.openInTab',
        action: () => void openFileFromTree(node.path)
      },
      revealItem(),
      { sep: true },
      { label: 'tree.copyPath', action: () => treeCopyPath(node) },
      { label: 'tree.copyRelPath', action: () => treeCopyRelativePath(node) },
      { sep: true },
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
    treeDelete,
    openFileFromTree,
    refreshTree
  ])

  useEffect(() => {
    return window.api.onFolderTree((tree) => setFolderTree(tree))
  }, [])

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
    setExplicitRoot,
    openFolder,
    openFolderFromSystem,
    openFileFromTree,
    treeNewFile,
    treeNewFileAt,
    treeNewFolder,
    pendingCreate,
    commitTreeCreate,
    cancelTreeCreate,
    treeMove,
    refreshTree,
    selection,
    selectNode
  }
}
