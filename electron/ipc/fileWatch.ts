import { ipcMain } from 'electron'
import { watch, type FSWatcher } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { IpcChannels } from '../shared/api'
import type { GetWindow } from './getWindow'

const CHANGE_DEBOUNCE_MS = 200

interface DirWatch {
  watcher: FSWatcher
  files: Set<string>
}

const watchedPaths = new Set<string>()
const dirWatches = new Map<string, DirWatch>()
const pendingTimers = new Map<string, NodeJS.Timeout>()
const lastNotified = new Map<string, string>()

function notifyChanged(filePath: string): void {
  const prev = pendingTimers.get(filePath)
  if (prev) clearTimeout(prev)
  pendingTimers.set(
    filePath,
    setTimeout(() => {
      pendingTimers.delete(filePath)
      void flushChange(filePath)
    }, CHANGE_DEBOUNCE_MS)
  )
}

async function flushChange(filePath: string): Promise<void> {
  if (!watchedPaths.has(filePath)) return
  let content: string
  try {
    content = await readFile(filePath, 'utf-8')
  } catch {
    // Deleted or unreadable — nothing to sync.
    return
  }
  if (lastNotified.get(filePath) === content) return
  lastNotified.set(filePath, content)
  const win = getWindowRef?.()
  if (win && !win.isDestroyed()) {
    win.webContents.send(IpcChannels.fileChanged, { path: filePath, content })
  }
}

function handleDirEvent(dir: string, filename: string | null): void {
  const entry = dirWatches.get(dir)
  if (!entry) return
  const names = filename ? [basename(filename)] : [...entry.files]
  for (const name of names) {
    if (!entry.files.has(name)) continue
    const full = join(dir, name)
    if (watchedPaths.has(full)) notifyChanged(full)
  }
}

function rebuildDirWatches(): void {
  const wanted = new Map<string, Set<string>>()
  for (const filePath of watchedPaths) {
    const dir = dirname(filePath)
    const set = wanted.get(dir) ?? new Set<string>()
    set.add(basename(filePath))
    wanted.set(dir, set)
  }
  for (const [dir, entry] of [...dirWatches]) {
    const target = wanted.get(dir)
    if (target && sameNames(entry.files, target)) {
      wanted.delete(dir)
      continue
    }
    entry.watcher.close()
    dirWatches.delete(dir)
  }
  for (const [dir, files] of wanted) {
    try {
      const watcher = watch(dir, (_event, filename) => {
        handleDirEvent(dir, filename ? filename.toString() : null)
      })
      watcher.on('error', () => {
        const cur = dirWatches.get(dir)
        if (cur?.watcher === watcher) {
          cur.watcher.close()
          dirWatches.delete(dir)
        }
      })
      dirWatches.set(dir, { watcher, files })
    } catch {
      // Directory unreadable — external-change sync degrades for these files.
    }
  }
}

function sameNames(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const name of a) if (!b.has(name)) return false
  return true
}

function setWatchedFiles(paths: string[]): void {
  const next = new Set(paths)
  for (const filePath of [...watchedPaths]) {
    if (next.has(filePath)) continue
    watchedPaths.delete(filePath)
    lastNotified.delete(filePath)
    const timer = pendingTimers.get(filePath)
    if (timer) {
      clearTimeout(timer)
      pendingTimers.delete(filePath)
    }
  }
  for (const filePath of next) watchedPaths.add(filePath)
  rebuildDirWatches()
}

let getWindowRef: GetWindow | null = null

export function stopFileWatcher(): void {
  for (const timer of pendingTimers.values()) clearTimeout(timer)
  pendingTimers.clear()
  for (const entry of dirWatches.values()) entry.watcher.close()
  dirWatches.clear()
  watchedPaths.clear()
  lastNotified.clear()
}

export function registerFileWatchIpc(getWindow: GetWindow): void {
  getWindowRef = getWindow
  ipcMain.handle(IpcChannels.fileWatchSet, (_e, paths: string[]) => {
    setWatchedFiles(Array.isArray(paths) ? paths.filter((p) => typeof p === 'string' && p) : [])
    return true
  })
}
