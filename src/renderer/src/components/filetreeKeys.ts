/**
 * nav-keyboard:file-tree — pure key → action mapping for the folder file tree
 * (FE-06). No DOM, no React: the component feeds the *visible-row view*
 * (filetreeRows.visibleRows output, flattened) and this module answers what a
 * key press means. Roving tabindex, scroll-into-view and expand-state writes
 * stay in FileTree.tsx.
 *
 * Contract (NAV-sidebar.md 3.1):
 *   ↑/↓      move focus between visible rows
 *   ←        collapse current dir / when collapsed, move to parent
 *   →        expand current dir / when expanded, move to first child
 *   Enter    open file node / toggle dir expansion
 *   Home/End first / last visible row
 * Disabled rules: file rows ignore ←/→; empty or all-invisible tree is a total
 * no-op (the caller also must not bind keys when the tree is empty).
 */
import type { DirNode } from '../../../../electron/shared/api'

/** One row of the keyboard-visible view (virtualization may hide rows). */
export interface VisibleRow {
  path: string
  depth: number
  isDir: boolean
  /** Effective expansion (dir rows only). */
  expanded: boolean
  /**
   * False when the row is outside the virtualized render window (or otherwise
   * not a navigation target). Movement skips these; tree structure (parent /
   * first-child) still walks through them.
   */
  visible: boolean
}

export interface FiletreeKeyState {
  rows: readonly VisibleRow[]
  /** Index into `rows` of the focused row; -1 = no focus yet. */
  focusIndex: number
}

export type FiletreeKeyAction =
  | { action: 'move'; nextIndex: number }
  | { action: 'collapse'; nextIndex: number }
  | { action: 'expand'; nextIndex: number }
  | { action: 'open'; nextIndex: number }
  | { action: 'first'; nextIndex: number }
  | { action: 'last'; nextIndex: number }
  | { action: 'none'; nextIndex: number }

const NONE = (nextIndex: number): FiletreeKeyAction => ({ action: 'none', nextIndex })

/** Index of the next visible row strictly after `from`, or -1. */
function nextVisible(rows: readonly VisibleRow[], from: number): number {
  for (let i = from + 1; i < rows.length; i++) if (rows[i].visible) return i
  return -1
}

/** Index of the previous visible row strictly before `from`, or -1. */
function prevVisible(rows: readonly VisibleRow[], from: number): number {
  for (let i = from - 1; i >= 0; i--) if (rows[i].visible) return i
  return -1
}

/** Parent row of `from` (shallower depth scanning upward), or -1. */
function parentIndex(rows: readonly VisibleRow[], from: number): number {
  const depth = rows[from].depth
  for (let i = from - 1; i >= 0; i--) if (rows[i].depth < depth) return i
  return -1
}

/**
 * First visible child of `from`, or -1. Children are the contiguous run of
 * deeper rows directly after `from` in the flattened view; the first row of the
 * run is the first child when its depth is exactly parent+1.
 */
function firstVisibleChild(rows: readonly VisibleRow[], from: number): number {
  for (let i = from + 1; i < rows.length && rows[i].depth > rows[from].depth; i++) {
    if (rows[i].visible && rows[i].depth === rows[from].depth + 1) return i
  }
  return -1
}

/**
 * Resolve a key press against the visible-row view.
 * Returns the action to perform plus the resulting focus index (unchanged for
 * non-focus actions). Unknown keys and disabled contexts yield `none` so the
 * caller can leave the event alone (editor input must stay free).
 */
export function resolveKey(state: FiletreeKeyState, key: string): FiletreeKeyAction {
  const { rows, focusIndex } = state
  const hasVisible = rows.some((r) => r.visible)
  if (!hasVisible) return NONE(focusIndex)

  const inRange = focusIndex >= 0 && focusIndex < rows.length
  const at = inRange ? focusIndex : -1

  switch (key) {
    case 'ArrowDown': {
      const next = at < 0 ? firstVisibleIdx(rows) : nextVisible(rows, at)
      return next < 0 ? NONE(focusIndex) : { action: 'move', nextIndex: next }
    }
    case 'ArrowUp': {
      if (at < 0) {
        const last = lastVisibleIdx(rows)
        return last < 0 ? NONE(focusIndex) : { action: 'move', nextIndex: last }
      }
      const prev = prevVisible(rows, at)
      return prev < 0 ? NONE(focusIndex) : { action: 'move', nextIndex: prev }
    }
    case 'Home': {
      const first = firstVisibleIdx(rows)
      return first < 0 ? NONE(focusIndex) : { action: 'first', nextIndex: first }
    }
    case 'End': {
      const last = lastVisibleIdx(rows)
      return last < 0 ? NONE(focusIndex) : { action: 'last', nextIndex: last }
    }
    case 'ArrowLeft': {
      if (at < 0) return NONE(focusIndex)
      const row = rows[at]
      if (!row.isDir) return NONE(focusIndex) // file rows: disabled
      if (row.expanded) return { action: 'collapse', nextIndex: at }
      const parent = parentIndex(rows, at)
      return parent < 0 ? NONE(focusIndex) : { action: 'move', nextIndex: parent }
    }
    case 'ArrowRight': {
      if (at < 0) return NONE(focusIndex)
      const row = rows[at]
      if (!row.isDir) return NONE(focusIndex) // file rows: disabled
      if (!row.expanded) return { action: 'expand', nextIndex: at }
      const child = firstVisibleChild(rows, at)
      return child < 0 ? NONE(focusIndex) : { action: 'move', nextIndex: child }
    }
    case 'Enter': {
      if (at < 0) return NONE(focusIndex)
      const row = rows[at]
      if (!row.isDir) return { action: 'open', nextIndex: at }
      return row.expanded
        ? { action: 'collapse', nextIndex: at }
        : { action: 'expand', nextIndex: at }
    }
    default:
      return NONE(focusIndex)
  }
}

function firstVisibleIdx(rows: readonly VisibleRow[]): number {
  for (let i = 0; i < rows.length; i++) if (rows[i].visible) return i
  return -1
}

function lastVisibleIdx(rows: readonly VisibleRow[]): number {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].visible) return i
  return -1
}

/** Map filetreeRows.FlatRow view rows into the keyboard-visible row shape. */
export function toVisibleRows(
  viewRows: readonly { node: DirNode; depth: number; open: boolean }[]
): VisibleRow[] {
  return viewRows.map((r) => ({
    path: r.node.path,
    depth: r.depth,
    isDir: r.node.isDir,
    expanded: r.open,
    visible: true
  }))
}
