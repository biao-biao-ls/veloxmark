import { baseNameOf } from '../pathUtil'

export interface RecentFolder {
  path: string
  pinned?: boolean
}

export const RECENT_HISTORY_MAX = 10
export const RECENT_PINNED_MAX = 5

export function pathKey(path: string): string {
  return path.replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase()
}

export function recentDisplayName(path: string): string {
  return baseNameOf(path) || path
}

const sameEntry = (a: RecentFolder, b: RecentFolder): boolean =>
  pathKey(a.path) === pathKey(b.path)

function normalize(pinned: RecentFolder[], history: RecentFolder[]): RecentFolder[] {
  return [...pinned.slice(0, RECENT_PINNED_MAX), ...history.slice(0, RECENT_HISTORY_MAX)]
}

function identical(a: RecentFolder[], b: RecentFolder[]): boolean {
  return a.length === b.length && a.every((e, i) => e === b[i] || (sameEntry(e, b[i]) && !!e.pinned === !!b[i].pinned))
}

export function visibleRecents(list: RecentFolder[]): RecentFolder[] {
  const pinned = list.filter((e) => e.pinned).slice(0, RECENT_PINNED_MAX)
  const history = list.filter((e) => !e.pinned).slice(0, RECENT_HISTORY_MAX)
  return normalize(pinned, history)
}

export function upsertRecent(list: RecentFolder[], path: string): RecentFolder[] {
  const pinned = list.filter((e) => e.pinned)
  const history = list.filter((e) => !e.pinned)
  if (pinned.some((e) => sameEntry(e, { path }))) return list
  const head = history[0]
  if (head && sameEntry(head, { path })) return list
  const nextHistory = [{ path }, ...history.filter((e) => !sameEntry(e, { path }))].slice(
    0,
    RECENT_HISTORY_MAX
  )
  const next = normalize(pinned, nextHistory)
  return identical(next, list) ? list : next
}

export function togglePinRecent(list: RecentFolder[], path: string): RecentFolder[] {
  const pinned = list.filter((e) => e.pinned)
  const history = list.filter((e) => !e.pinned)
  const pi = pinned.findIndex((e) => sameEntry(e, { path }))
  if (pi >= 0) {
    const nextHistory = [{ path }, ...history.filter((e) => !sameEntry(e, { path }))].slice(
      0,
      RECENT_HISTORY_MAX
    )
    return normalize(pinned.filter((_, i) => i !== pi), nextHistory)
  }
  if (pinned.length >= RECENT_PINNED_MAX) return list
  return normalize(
    [...pinned, { path, pinned: true }],
    history.filter((e) => !sameEntry(e, { path }))
  )
}

export function removeRecent(list: RecentFolder[], path: string): RecentFolder[] {
  const next = list.filter((e) => !sameEntry(e, { path }))
  return next.length === list.length ? list : next
}
