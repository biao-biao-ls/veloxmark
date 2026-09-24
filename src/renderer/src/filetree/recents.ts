/**
 * 6F「最近使用的目录」模型（tasks 6.11/6.12）——纯逻辑叶模块。
 *
 * 模型（plan D1/D3）：
 * - `recentFolders: Array<{ path, pinned? }>`，数组**恒为显示序**：
 *   置顶组（保持相对序）→ 历史组（MRU，最近使用在前）。
 * - 使用（成为树根）= 历史组前移去重（`upsertRecent`）；已置顶项被使用时位置不动。
 * - 历史区 ≤10（超出挤出最旧未置顶）；置顶为独立槽位 ≤5（防滥用）；合计 ≤15。
 * - 置顶钮 toggle 语义（plan 实现细化 D6）：已置顶再点 = 取消置顶 → 回落历史区首。
 *   满 5 置顶再点新项 = no-op（返回原引用）。
 *
 * 路径同一性（spec 约束 D4）：大小写不敏感 + 分隔符归一（`/`/`\` 等价、去尾分隔符），
 * 源路径字符串原样保留（只用于比较与显示名解析）。
 */
import { baseNameOf } from '../pathUtil'

export interface RecentFolder {
  path: string
  pinned?: boolean
}

export const RECENT_HISTORY_MAX = 10
export const RECENT_PINNED_MAX = 5

/** Path identity key — case-folded, separator-normalized, no trailing seps. */
export function pathKey(path: string): string {
  return path.replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase()
}

/** Display name of a recent folder entry (final segment; path fallback). */
export function recentDisplayName(path: string): string {
  return baseNameOf(path) || path
}

const sameEntry = (a: RecentFolder, b: RecentFolder): boolean =>
  pathKey(a.path) === pathKey(b.path)

/** Merge groups into display order and re-apply caps (invariant keeper). */
function normalize(pinned: RecentFolder[], history: RecentFolder[]): RecentFolder[] {
  return [...pinned.slice(0, RECENT_PINNED_MAX), ...history.slice(0, RECENT_HISTORY_MAX)]
}

/** True when both lists hold the same entries in the same order/flags. */
function identical(a: RecentFolder[], b: RecentFolder[]): boolean {
  return a.length === b.length && a.every((e, i) => e === b[i] || (sameEntry(e, b[i]) && !!e.pinned === !!b[i].pinned))
}

/**
 * Display list (D1 `visibleRecents`) — pinned group first (stable relative
 * order), then history MRU; caps applied defensively (writers already cap).
 */
export function visibleRecents(list: RecentFolder[]): RecentFolder[] {
  const pinned = list.filter((e) => e.pinned).slice(0, RECENT_PINNED_MAX)
  const history = list.filter((e) => !e.pinned).slice(0, RECENT_HISTORY_MAX)
  return normalize(pinned, history)
}

/**
 * Use-as-root upsert (D1): new/moved history entry goes to the history front;
 * an already-pinned entry keeps its pinned slot (returns `list` unchanged).
 * No-op when the entry is already the history head — same reference out.
 */
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

/**
 * Pin toggle (D6): unpinned → pinned (append to the pinned group, stable
 * relative order); full pinned group = no-op. Pinned → unpin, landing at the
 * history front (as if just used).
 */
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

/** Remove one entry (pinned or history) — immediate (AC3). */
export function removeRecent(list: RecentFolder[], path: string): RecentFolder[] {
  const next = list.filter((e) => !sameEntry(e, { path }))
  return next.length === list.length ? list : next
}
