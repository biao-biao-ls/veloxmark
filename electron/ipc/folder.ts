import { ipcMain } from 'electron'
import { watch, type FSWatcher } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, isAbsolute, join } from 'node:path'
import { IpcChannels, type DirNode, type FolderScanOptions } from '../shared/api'
import { IMAGE_FILE_EXT, queueImageChange, stopImageChangeBroadcast } from './image'
import type { GetWindow } from './getWindow'

const MD_EXT = /\.(md|markdown|mdown|txt)$/i
// 6B/D4: 8 silently truncated real-world trees (nested repos, home dirs).
const MAX_SCAN_DEPTH = 20

// P07: scan options arrive from the renderer's preferences (localStorage lives
// renderer-side). Defaults must stay in sync with DEFAULT_PREFERENCES in
// src/renderer/src/preferences/store.ts.
const DEFAULT_FOLDER_OPTIONS: FolderScanOptions = {
  ignoreNames: ['node_modules', '.git', '.svn', '.hg', 'dist', 'out', 'build', '.DS_Store'],
  showHiddenFiles: false
}

let scanOptions: FolderScanOptions = { ...DEFAULT_FOLDER_OPTIONS, ignoreNames: [...DEFAULT_FOLDER_OPTIONS.ignoreNames] }
let ignoreMatchers: RegExp[] = scanOptions.ignoreNames.map(nameToMatcher)

/** Compile a name pattern (`*` / `?` wildcards) into an anchored matcher. */
function nameToMatcher(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`, 'i')
}

function setScanOptions(options: Partial<FolderScanOptions> | undefined): void {
  if (!options) return
  const ignoreNames = Array.isArray(options.ignoreNames)
    ? options.ignoreNames.filter((n): n is string => typeof n === 'string' && n.trim() !== '')
    : scanOptions.ignoreNames
  scanOptions = {
    ignoreNames,
    showHiddenFiles: options.showHiddenFiles === true
  }
  ignoreMatchers = scanOptions.ignoreNames.map(nameToMatcher)
}

/** P13: shared with search.ts — same scan rules the folder tree uses. */
export function applyFolderScanOptions(options: Partial<FolderScanOptions> | undefined): void {
  setScanOptions(options)
}

/** P13: shared ignore/hidden rule for a path segment or relative path. */
export function isIgnoredPath(relPath: string): boolean {
  return pathFiltered(relPath)
}

/** True when the entry name matches the user's ignore list. */
function isIgnored(name: string): boolean {
  return ignoreMatchers.some((m) => m.test(name))
}

/** Apply the hidden/ignore rules to one fs path (relative or absolute). */
function pathFiltered(relPath: string): boolean {
  const segments = relPath.split(/[\\/]+/).filter(Boolean)
  return segments.some(
    (seg) => (!scanOptions.showHiddenFiles && seg.startsWith('.')) || isIgnored(seg)
  )
}

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
    if (!scanOptions.showHiddenFiles && entry.name.startsWith('.')) continue
    if (isIgnored(entry.name)) continue
    const full = join(dirPath, entry.name)
    // 6E: sort timestamps gathered at scan time (renderer comparators never
    // re-scan). Entry vanished mid-scan → omit both fields (sort treats as last).
    let times: Pick<DirNode, 'mtimeMs' | 'birthtimeMs'> = {}
    try {
      const st = await stat(full)
      times = { mtimeMs: st.mtimeMs, birthtimeMs: st.birthtimeMs }
    } catch {
      times = {}
    }
    if (entry.isDirectory()) {
      const children = await listMarkdownTree(full, depth + 1)
      // keep a folder only when it (recursively) holds markdown files
      if (children.length > 0)
        dirs.push({ name: entry.name, path: full, isDir: true, children, ...times })
    } else if (entry.isFile() && MD_EXT.test(entry.name)) {
      files.push({ name: entry.name, path: full, isDir: false, ...times })
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
// 6B: retarget race guard — bumped on every (un)watch; scans capture it and
// drop their result when a newer watch/unwatch superseded them mid-await.
// Covers root-follow retargeting (rapid tab switches) without changing the
// folder:* channel shapes.
let watchEpoch = 0

export function stopFolderWatcher(): void {
  watchEpoch++
  if (watchRefreshTimer) {
    clearTimeout(watchRefreshTimer)
    watchRefreshTimer = null
  }
  stopImageChangeBroadcast()
  folderWatcher?.close()
  folderWatcher = null
  watchedFolder = null
}

export function registerFolderIpc(getWindow: GetWindow): void {
  async function pushFolderTree(): Promise<void> {
    const root = watchedFolder
    const epoch = watchEpoch
    if (!root) return
    const tree = await listMarkdownTree(root)
    // 6B: retargeted mid-scan — this tree is stale, never push it.
    if (epoch !== watchEpoch) return
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(IpcChannels.folderTree, tree)
    }
  }

  ipcMain.handle(IpcChannels.folderList, async (_e, dirPath: string): Promise<DirNode[]> => {
    return listMarkdownTree(dirPath)
  })

  ipcMain.handle(IpcChannels.folderWatch, async (e, dirPath: string, options?: FolderScanOptions) => {
    // A window owns exactly one watched folder; replace any previous watcher.
    stopFolderWatcher()
    setScanOptions(options)
    watchedFolder = dirPath
    const epoch = watchEpoch
    try {
      folderWatcher = watch(dirPath, { recursive: true }, (_event, changedPath) => {
        // Ignore editor temp files (vim/emacs swap, atomic-save .tmp siblings).
        // Dotfiles are handled by pathFiltered below so that hidden .md files
        // still refresh the tree when "show hidden files" is on.
        const name = basename(changedPath ?? '')
        if (name.endsWith('~') || name.endsWith('.swp') || name.endsWith('.tmp')) return
        // Changes inside ignored/hidden trees can't affect the pushed tree —
        // skip them before scheduling a full rescan (node_modules churn etc.).
        if (changedPath && pathFiltered(changedPath)) return
        // P05: image files never appear in the markdown tree — broadcast them
        // on their own channel so the editor can invalidate its image cache.
        if (changedPath && IMAGE_FILE_EXT.test(name)) {
          queueImageChange(getWindow, isAbsolute(changedPath) ? changedPath : join(dirPath, changedPath))
        }
        if (watchRefreshTimer) clearTimeout(watchRefreshTimer)
        watchRefreshTimer = setTimeout(() => {
          watchRefreshTimer = null
          void pushFolderTree()
        }, 200)
      })
      folderWatcher.on('error', () => {
        // 6B: a replaced watcher's late error must not tear down the new root.
        if (epoch !== watchEpoch) return
        // Root deleted or became unreadable — surface an empty tree, keep the
        // session alive so the user can reopen another folder.
        stopFolderWatcher()
        const win = getWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send(IpcChannels.folderTree, [])
        }
      })
    } catch {
      // recursive watch unsupported — degraded: tree won't auto-refresh.
      // 6D D5: make the degradation visible in the main-process log (was
      // silent); the ops panel's refresh still rescans on demand.
      console.warn('[folder] recursive watch unsupported — tree auto-refresh degraded:', dirPath)
      folderWatcher = null
    }
    const tree = await listMarkdownTree(dirPath)
    // 6B: superseded by a newer watch/unwatch while scanning — drop silently
    // (the newer call delivers its own tree; return false marks this one lost).
    if (epoch !== watchEpoch) return false
    // Send the current tree immediately so the renderer doesn't need a separate
    // list call when (re)subscribing.
    e.sender.send(IpcChannels.folderTree, tree)
    return true
  })

  ipcMain.handle(IpcChannels.folderUnwatch, () => {
    stopFolderWatcher()
    return true
  })

  // P07: preferences changed — swap the rules and refresh the live tree.
  ipcMain.handle(IpcChannels.folderSetOptions, (_e, options: FolderScanOptions) => {
    setScanOptions(options)
    void pushFolderTree()
  })
}
