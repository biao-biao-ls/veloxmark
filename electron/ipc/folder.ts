import { ipcMain } from 'electron'
import { watch, type FSWatcher } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, isAbsolute, join } from 'node:path'
import { IpcChannels, type DirNode, type FolderScanOptions } from '../shared/api'
import { IMAGE_FILE_EXT, queueImageChange, stopImageChangeBroadcast } from './image'
import type { GetWindow } from './getWindow'

const MD_EXT = /\.(md|markdown|mdown|txt)$/i
const MAX_SCAN_DEPTH = 20

const DEFAULT_FOLDER_OPTIONS: FolderScanOptions = {
  ignoreNames: ['node_modules', '.git', '.svn', '.hg', 'dist', 'out', 'build', '.DS_Store'],
  showHiddenFiles: false
}

let scanOptions: FolderScanOptions = { ...DEFAULT_FOLDER_OPTIONS, ignoreNames: [...DEFAULT_FOLDER_OPTIONS.ignoreNames] }
let ignoreMatchers: RegExp[] = scanOptions.ignoreNames.map(nameToMatcher)

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

export function applyFolderScanOptions(options: Partial<FolderScanOptions> | undefined): void {
  setScanOptions(options)
}

export function isIgnoredPath(relPath: string): boolean {
  return pathFiltered(relPath)
}

function isIgnored(name: string): boolean {
  return ignoreMatchers.some((m) => m.test(name))
}

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
    return []
  }
  const dirs: DirNode[] = []
  const files: DirNode[] = []
  for (const entry of entries) {
    if (!scanOptions.showHiddenFiles && entry.name.startsWith('.')) continue
    if (isIgnored(entry.name)) continue
    const full = join(dirPath, entry.name)
    let times: Pick<DirNode, 'mtimeMs' | 'birthtimeMs'> = {}
    try {
      const st = await stat(full)
      times = { mtimeMs: st.mtimeMs, birthtimeMs: st.birthtimeMs }
    } catch {
      times = {}
    }
    if (entry.isDirectory()) {
      const children = await listMarkdownTree(full, depth + 1)
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


let folderWatcher: FSWatcher | null = null
let watchedFolder: string | null = null
let watchRefreshTimer: NodeJS.Timeout | null = null
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
    stopFolderWatcher()
    setScanOptions(options)
    watchedFolder = dirPath
    const epoch = watchEpoch
    try {
      folderWatcher = watch(dirPath, { recursive: true }, (_event, changedPath) => {
        const name = basename(changedPath ?? '')
        if (name.endsWith('~') || name.endsWith('.swp') || name.endsWith('.tmp')) return
        if (changedPath && pathFiltered(changedPath)) return
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
        if (epoch !== watchEpoch) return
        stopFolderWatcher()
        const win = getWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send(IpcChannels.folderTree, [])
        }
      })
    } catch {
      console.warn('[folder] recursive watch unsupported — tree auto-refresh degraded:', dirPath)
      folderWatcher = null
    }
    const tree = await listMarkdownTree(dirPath)
    if (epoch !== watchEpoch) return false
    e.sender.send(IpcChannels.folderTree, tree)
    return true
  })

  ipcMain.handle(IpcChannels.folderUnwatch, () => {
    stopFolderWatcher()
    return true
  })

  ipcMain.handle(IpcChannels.folderSetOptions, (_e, options: FolderScanOptions) => {
    setScanOptions(options)
    void pushFolderTree()
  })
}
