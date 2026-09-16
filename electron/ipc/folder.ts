import { ipcMain } from 'electron'
import { watch, type FSWatcher } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { DirNode } from '../shared/api'
import type { GetWindow } from './index'

const MD_EXT = /\.(md|markdown|mdown|txt)$/i
// Common noise that never contains a user's notes; keeps deep scans fast.
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', 'dist', 'out', 'build'])
const MAX_SCAN_DEPTH = 8

async function listMarkdownTree(dirPath: string, depth = 0): Promise<DirNode[]> {
  if (depth > MAX_SCAN_DEPTH) return []
  let entries
  try {
    entries = await readdir(dirPath, { withFileTypes: true })
  } catch {
    return [] // unreadable directory — treat as empty rather than failing the scan
  }
  const dirs: DirNode[] = []
  const files: DirNode[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      const children = await listMarkdownTree(full, depth + 1)
      // keep a folder only when it (recursively) holds markdown files
      if (children.length > 0) dirs.push({ name: entry.name, path: full, isDir: true, children })
    } else if (entry.isFile() && MD_EXT.test(entry.name)) {
      files.push({ name: entry.name, path: full, isDir: false })
    }
  }
  const byName = (a: DirNode, b: DirNode): number => a.name.localeCompare(b.name)
  dirs.sort(byName)
  files.sort(byName)
  return [...dirs, ...files]
}

// ---- folder watching --------------------------------------------------------
// One recursive watcher per opened folder. FS events are debounced and turned
// into a full tree rescan pushed to the renderer — simple and robust versus
// replaying incremental rename/change events (editors write via temp+rename).

let folderWatcher: FSWatcher | null = null
let watchedFolder: string | null = null
let watchRefreshTimer: NodeJS.Timeout | null = null

export function stopFolderWatcher(): void {
  if (watchRefreshTimer) {
    clearTimeout(watchRefreshTimer)
    watchRefreshTimer = null
  }
  folderWatcher?.close()
  folderWatcher = null
  watchedFolder = null
}

export function registerFolderIpc(getWindow: GetWindow): void {
  async function pushFolderTree(): Promise<void> {
    if (!watchedFolder) return
    const tree = await listMarkdownTree(watchedFolder)
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('folder:tree', tree)
    }
  }

  ipcMain.handle('folder:list', async (_e, dirPath: string): Promise<DirNode[]> => {
    return listMarkdownTree(dirPath)
  })

  ipcMain.handle('folder:watch', async (e, dirPath: string) => {
    // A window owns exactly one watched folder; replace any previous watcher.
    stopFolderWatcher()
    watchedFolder = dirPath
    try {
      folderWatcher = watch(dirPath, { recursive: true }, (_event, changedPath) => {
        // Ignore editor temp files (vim/emacs swap, atomic-save .tmp siblings).
        const name = basename(changedPath ?? '')
        if (name.startsWith('.') || name.endsWith('~') || name.endsWith('.swp')) return
        if (watchRefreshTimer) clearTimeout(watchRefreshTimer)
        watchRefreshTimer = setTimeout(() => {
          watchRefreshTimer = null
          void pushFolderTree()
        }, 200)
      })
      folderWatcher.on('error', () => {
        // Root deleted or became unreadable — surface an empty tree, keep the
        // session alive so the user can reopen another folder.
        stopFolderWatcher()
        const win = getWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send('folder:tree', [])
        }
      })
    } catch {
      // recursive watch unsupported — degraded: tree won't auto-refresh
      folderWatcher = null
    }
    // Send the current tree immediately so the renderer doesn't need a separate
    // list call when (re)subscribing.
    e.sender.send('folder:tree', await listMarkdownTree(dirPath))
    return true
  })

  ipcMain.handle('folder:unwatch', () => {
    stopFolderWatcher()
    return true
  })
}
