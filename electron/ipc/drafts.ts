import { app, ipcMain } from 'electron'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { IpcChannels, type DraftListItem, type DraftRecord } from '../shared/api'


const UNTITLED_KEY_SOURCE = '__untitled__'

function draftsDir(): string {
  return join(app.getPath('userData'), 'drafts')
}

function keyOf(path: string | null, slot?: string): string {
  const source = path ?? (slot ? `${UNTITLED_KEY_SOURCE}:${slot}` : UNTITLED_KEY_SOURCE)
  return createHash('sha1').update(source).digest('hex')
}

const WRITE_THROTTLE_MS = 500

const pending = new Map<string, DraftRecord>()
const timers = new Map<string, NodeJS.Timeout>()
const lastWriteAt = new Map<string, number>()
const discardEpoch = new Map<string, number>()

function epochOf(key: string): number {
  return discardEpoch.get(key) ?? 0
}

async function writeDraftFile(key: string, rec: DraftRecord): Promise<void> {
  const epoch = epochOf(key)
  await mkdir(draftsDir(), { recursive: true })
  await writeFile(join(draftsDir(), `${key}.json`), JSON.stringify(rec), 'utf-8')
  lastWriteAt.set(key, Date.now())
  if (epochOf(key) !== epoch) {
    await rm(join(draftsDir(), `${key}.json`), { force: true })
  }
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
    })
  }, delay)
  timers.set(key, timer)
}

export function registerDraftsIpc(): void {
  ipcMain.handle(IpcChannels.draftWrite, (_e, path: string | null, content: string, slot?: string) => {
    const key = keyOf(path, slot)
    scheduleWrite(key, { path, content, mtime: Date.now(), slot })
    return true
  })

  ipcMain.handle(IpcChannels.draftDiscard, async (_e, path: string | null, slot?: string) => {
    const key = keyOf(path, slot)
    discardEpoch.set(key, epochOf(key) + 1)
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
            mtime: typeof rec.mtime === 'number' ? rec.mtime : 0,
            slot: typeof rec.slot === 'string' ? rec.slot : undefined
          })
        } catch {
        }
      }
      return out
    } catch {
      return []
    }
  })
}
