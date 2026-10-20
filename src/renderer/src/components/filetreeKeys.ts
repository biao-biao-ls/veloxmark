import type { DirNode } from '../../../../electron/shared/api'

export interface VisibleRow {
  path: string
  depth: number
  isDir: boolean
  expanded: boolean
  visible: boolean
}

export interface FiletreeKeyState {
  rows: readonly VisibleRow[]
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

function nextVisible(rows: readonly VisibleRow[], from: number): number {
  for (let i = from + 1; i < rows.length; i++) if (rows[i].visible) return i
  return -1
}

function prevVisible(rows: readonly VisibleRow[], from: number): number {
  for (let i = from - 1; i >= 0; i--) if (rows[i].visible) return i
  return -1
}

function parentIndex(rows: readonly VisibleRow[], from: number): number {
  const depth = rows[from].depth
  for (let i = from - 1; i >= 0; i--) if (rows[i].depth < depth) return i
  return -1
}

function firstVisibleChild(rows: readonly VisibleRow[], from: number): number {
  for (let i = from + 1; i < rows.length && rows[i].depth > rows[from].depth; i++) {
    if (rows[i].visible && rows[i].depth === rows[from].depth + 1) return i
  }
  return -1
}

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
      if (!row.isDir) return NONE(focusIndex)
      if (row.expanded) return { action: 'collapse', nextIndex: at }
      const parent = parentIndex(rows, at)
      return parent < 0 ? NONE(focusIndex) : { action: 'move', nextIndex: parent }
    }
    case 'ArrowRight': {
      if (at < 0) return NONE(focusIndex)
      const row = rows[at]
      if (!row.isDir) return NONE(focusIndex)
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
