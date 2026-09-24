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
 * 6D D3: where「+」creates a file — pure so the priority is unit-testable.
 * Priority (AC2): selected dir → selected/active file's dir → root. The known
 * corner (pinned root + active doc outside it → target outside the visible
 * tree) is AC2's literal semantics, noted in the 6D plan.
 */
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

/**
 * 6G: name rules shared by the inline-create commit — `.md` auto-suffix for
 * extension-less file names only (dirs untouched, explicit extensions kept).
 */
export function withMarkdownSuffix(name: string, kind: 'file' | 'dir'): string {
  return kind === 'file' && !/\.[^./\\]+$/.test(name) ? `${name}.md` : name
}

/** 6G: separator / dot-segment names are never valid node names. */
export function isInvalidTreeName(name: string): boolean {
  return /[/\\]/.test(name) || name === '.' || name === '..'
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
  // doc dir → empty; 6.4a dropped the recent-root fallback), no longer "the
  // opened workspace folder".
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [folderTree, setFolderTree] = useState<DirNode[]>([])
  const [treeMenu, setTreeMenu] = useState<TreeMenuRequest | null>(null)
  // UX-P07-F4: node path in inline-rename mode (entered after create).
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  // 6D D3: last-clicked tree row — steers the new-file target (6G menus reuse).
  const [selection, setSelection] = useState<{ path: string; isDir: boolean } | null>(null)
  // 6G D3: inline-create target — a pending input row in the tree (prompt 退役).
  // Mutually exclusive with `renamingPath` (one input row at a time).
  const [pendingCreate, setPendingCreate] = useState<{
    parentPath: string
    kind: 'file' | 'dir'
  } | null>(null)

  // 6B: single funnel that applies a resolved root — retargets the one folder
  // watcher and records the root in the 6F recent-folders list (MRU upsert).
  // Mode-neutral on purpose: root follow must never flip the sidebar tab (6A).
  const applyTreeRoot = useCallback(async (dirPath: string | null) => {
    setFolderPath(dirPath)
    if (dirPath) {
      // 6F D5 收编完成：lastFolderPath 写侧并入 recents upsert（使用即进历史区首，
      // 面板/置顶/移除经同一 store 真源）。upsert 对「历史首/已置顶」返回原引用，
      // 未变不写 store，避免根重应用时的无谓通知。
      const p = getPreferences()
      const recentFolders = upsertRecent(p.recentFolders, dirPath)
      if (recentFolders !== p.recentFolders) setPreferences({ recentFolders })
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

  // 6D D5: manual rescan — re-watch the current root. Forces a full scan
  // pushed over the existing folder:tree subscription and revives a degraded
  // or dead watcher (the auto-refresh fallback when node:fs watch fails).
  const refreshTree = useCallback(async () => {
    if (!folderPath) return
    await window.api.watchFolder(folderPath, folderScanOptions())
  }, [folderPath])

  // Row selection is only meaningful inside the current root.
  const selectNode = useCallback((path: string, isDir: boolean) => {
    setSelection({ path, isDir })
  }, [])
  useEffect(() => {
    setSelection(null)
    setPendingCreate(null)
  }, [folderPath])
  // Mutual exclusion (6G D3): at most one input row — entering inline rename
  // drops any pending create (covers the post-create rename handoff too).
  useEffect(() => {
    if (renamingPath) setPendingCreate(null)
  }, [renamingPath])

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

  // 6G D3/D4: prompt 对话框退役 — begin-create opens the inline input row
  // (the same `filetree-renaming` mechanism the post-create rename uses).
  const treeNewFile = useCallback((dirPath: string) => {
    setRenamingPath(null)
    setPendingCreate({ parentPath: dirPath, kind: 'file' })
  }, [])

  const treeNewFolder = useCallback((dirPath: string) => {
    setRenamingPath(null)
    setPendingCreate({ parentPath: dirPath, kind: 'dir' })
  }, [])

  const cancelTreeCreate = useCallback(() => setPendingCreate(null), [])

  /**
   * Inline-create commit: validate (empty = cancel; invalid name alerts) →
   * duplicate check (AC2 重名提示不静默覆盖) → IPC create. When the `.md`
   * suffix was auto-appended the fresh row hands off to inline rename so the
   * name is still adjustable (UX-P07-F4, 6G 细化 D6).
   */
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

  // 6D D3: bottom-bar / header「+」— create at the resolved target dir.
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

  // 6G D5 三档布局（分组 + 新项，probe id 只挂新项）：
  //   文件   = [在新标签打开, 在资源管理器中显示 | 拷贝路径, 拷贝相对路径 | 重命名, 删除]
  //   目录   = [新建文件, 新建文件夹, 在资源管理器中显示, 刷新 | 拷贝路径, 拷贝相对路径 | 重命名, 删除]
  //   空白/根 = [新建文件, 新建文件夹, 在资源管理器中显示, 刷新 | 拷贝路径]
  // D5 修订：「刷新」只进空白+目录档（文件档误触风险高，不放）。
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
    // Root: right-click on the empty area under the tree.
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
    /** 6D D3:「+」with the selected-dir → active-dir → root target rule. */
    treeNewFileAt,
    treeNewFolder,
    /** 6G: inline-create input row state + commit/cancel (prompt 退役). */
    pendingCreate,
    commitTreeCreate,
    cancelTreeCreate,
    treeMove,
    /** 6D D5: manual rescan / watcher-revival fallback (ops panel「刷新」). */
    refreshTree,
    /** 6D D3: controlled row selection (new-file target; 6G menus reuse). */
    selection,
    selectNode
  }
}
