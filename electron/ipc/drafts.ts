import { app, ipcMain } from 'electron'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { IpcChannels, type DraftListItem, type DraftRecord } from '../shared/api'

/**
 * P12 crash-recovery drafts (main-process storage).
 *
 * Renderer pushes `{path, content}` after a change debounce; main throttles
 * disk writes (latest-wins trailing timer per key) so a burst of updates
 * costs one write. Files live in `userData/drafts/<sha1(path)>.json` — the
 * hash keeps arbitrary document paths out of filenames. Drafts disappear on
 * successful save / explicit discard and are scanned at startup by the
 * renderer via `draft:list`.
 */

const UNTITLED_KEY_SOURCE = '__untitled__'

function draftsDir(): string {
  return join(app.getPath('userData'), 'drafts')
}

function keyOf(path: string | null): string {
  return createHash('sha1').update(path ?? UNTITLED_KEY_SOURCE).digest('hex')
}

const WRITE_THROTTLE_MS = 500

// Latest-wins pending writes: one timer per key, always writing the newest content.
const pending = new Map<string, DraftRecord>()
const timers = new Map<string, NodeJS.Timeout>()
const lastWriteAt = new Map<string, number>()

async function writeDraftFile(key: string, rec: DraftRecord): Promise<void> {
  await mkdir(draftsDir(), { recursive: true })
  await writeFile(join(draftsDir(), `${key}.json`), JSON.stringify(rec), 'utf-8')
  lastWriteAt.set(key, Date.now())
}

function scheduleWrite(key: string, rec: DraftRecord): void {
  pending.set(key, rec)
  if (timers.has(key)) return
  const elapsed = Date.now() - (lastWriteAt.get(key) ?? 0)
  const delay = Math.max(0, WRITE_THROTTLE_MS - elapsed)
  const timer = setTimeout(() => {
    timers.delete(key)
    const latest = pending.get(key)
    pending.delete(key)
    if (!latest) return
    void writeDraftFile(key, latest).catch(() => {
      // disk errors are non-fatal — drafts are best-effort crash insurance
    })
  }, delay)
  timers.set(key, timer)
}

export function registerDraftsIpc(): void {
  ipcMain.handle(IpcChannels.draftWrite, (_e, path: string | null, content: string) => {
    const key = keyOf(path)
    scheduleWrite(key, { path, content, mtime: Date.now() })
    // Pending-timer model: acknowledge immediately; the write lands ≤ throttle.
    return true
  })

  ipcMain.handle(IpcChannels.draftDiscard, async (_e, path: string | null) => {
    const key = keyOf(path)
    pending.delete(key)
    const timer = timers.get(key)
    if (timer) {
      clearTimeout(timer)
      timers.delete(key)
    }
    await rm(join(draftsDir(), `${key}.json`), { force: true })
    return true
  })

  ipcMain.handle(IpcChannels.draftList, async (): Promise<DraftListItem[]> => {
    // Flush any pending writes so a list right after edits sees fresh content.
    for (const [key, timer] of [...timers]) {
      clearTimeout(timer)
      timers.delete(key)
      const rec = pending.get(key)
      pending.delete(key)
      if (rec) await writeDraftFile(key, rec).catch(() => undefined)
    }
    try {
      const names = await readdir(draftsDir())
      const out: DraftListItem[] = []
      for (const name of names) {
        if (!name.endsWith('.json')) continue
        try {
          const raw = await readFile(join(draftsDir(), name), 'utf-8')
          const rec = JSON.parse(raw) as DraftRecord
          if (typeof rec.content !== 'string') continue
          out.push({
            key: name.replace(/\.json$/, ''),
            path: rec.path ?? null,
            content: rec.content,
            mtime: typeof rec.mtime === 'number' ? rec.mtime : 0
          })
        } catch {
          // corrupt draft — skip
        }
      }
      return out
    } catch {
      return []
    }
  })
}
