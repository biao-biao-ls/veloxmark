import { describe, expect, it } from 'vitest'
import { resolveKey, type FiletreeKeyState, type VisibleRow } from './filetreeKeys'

/**
 * Fixture tree (rows are the already-visible view, filetreeRows.visibleRows
 * output shape consumed by nav-keyboard:file-tree):
 *
 *   0 docs/        dir  expanded
 *   1   deep/      dir  expanded
 *   2     a.md     file
 *   3   intro.md   file
 *   4 root.md      file
 */
const row = (
  path: string,
  depth: number,
  isDir: boolean,
  expanded = false,
  visible = true
): VisibleRow => ({ path, depth, isDir, expanded, visible })

const TREE: VisibleRow[] = [
  row('docs', 0, true, true),
  row('docs/deep', 1, true, true),
  row('docs/deep/a.md', 2, false),
  row('docs/intro.md', 1, false),
  row('root.md', 0, false)
]

const state = (focusIndex: number, rows: VisibleRow[] = TREE): FiletreeKeyState => ({
  rows,
  focusIndex
})

describe('resolveKey — 焦点移动（↑/↓/Home/End）', () => {
  it('ArrowDown moves focus to the next row', () => {
    expect(resolveKey(state(0), 'ArrowDown')).toEqual({ action: 'move', nextIndex: 1 })
  })

  it('ArrowUp moves focus to the previous row', () => {
    expect(resolveKey(state(3), 'ArrowUp')).toEqual({ action: 'move', nextIndex: 2 })
  })

  it('ArrowDown on the last row is a no-op', () => {
    expect(resolveKey(state(4), 'ArrowDown')).toEqual({ action: 'none', nextIndex: 4 })
  })

  it('ArrowUp on the first row is a no-op', () => {
    expect(resolveKey(state(0), 'ArrowUp')).toEqual({ action: 'none', nextIndex: 0 })
  })

  it('movement skips rows flagged invisible (virtualized window)', () => {
    const rows = TREE.map((r, i) => (i === 1 ? { ...r, visible: false } : r))
    expect(resolveKey(state(0, rows), 'ArrowDown')).toEqual({ action: 'move', nextIndex: 2 })
    expect(resolveKey(state(2, rows), 'ArrowUp')).toEqual({ action: 'move', nextIndex: 0 })
  })

  it('Home jumps to the first visible row', () => {
    const rows = TREE.map((r, i) => (i === 0 ? { ...r, visible: false } : r))
    expect(resolveKey(state(4, rows), 'Home')).toEqual({ action: 'first', nextIndex: 1 })
  })

  it('End jumps to the last visible row', () => {
    const rows = TREE.map((r, i) => (i === 4 ? { ...r, visible: false } : r))
    expect(resolveKey(state(0, rows), 'End')).toEqual({ action: 'last', nextIndex: 3 })
  })

  it('ArrowDown with no prior focus lands on the first visible row', () => {
    expect(resolveKey(state(-1), 'ArrowDown')).toEqual({ action: 'move', nextIndex: 0 })
    expect(resolveKey(state(-1), 'End')).toEqual({ action: 'last', nextIndex: 4 })
  })
})

describe('resolveKey — 折叠/展开（←/→）', () => {
  it('ArrowLeft on an expanded dir collapses it (focus stays)', () => {
    expect(resolveKey(state(0), 'ArrowLeft')).toEqual({ action: 'collapse', nextIndex: 0 })
    expect(resolveKey(state(1), 'ArrowLeft')).toEqual({ action: 'collapse', nextIndex: 1 })
  })

  it('ArrowLeft on a collapsed dir moves focus to the parent', () => {
    // docs/deep collapsed at depth 1 → parent is docs (0)
    const rows = TREE.map((r, i) => (i === 1 ? { ...r, expanded: false } : r))
    expect(resolveKey(state(1, rows), 'ArrowLeft')).toEqual({ action: 'move', nextIndex: 0 })
  })

  it('ArrowLeft on a root-level collapsed dir has no parent → no-op', () => {
    const rows = [{ ...TREE[0], expanded: false }, ...TREE.slice(1).map((r) => ({ ...r, visible: false }))]
    expect(resolveKey(state(0, rows), 'ArrowLeft')).toEqual({ action: 'none', nextIndex: 0 })
  })

  it('ArrowRight on a collapsed dir expands it (focus stays)', () => {
    const rows = TREE.map((r, i) => (i === 1 ? { ...r, expanded: false } : r))
    expect(resolveKey(state(1, rows), 'ArrowRight')).toEqual({ action: 'expand', nextIndex: 1 })
  })

  it('ArrowRight on an expanded dir moves focus to the first child', () => {
    expect(resolveKey(state(0), 'ArrowRight')).toEqual({ action: 'move', nextIndex: 1 })
    expect(resolveKey(state(1), 'ArrowRight')).toEqual({ action: 'move', nextIndex: 2 })
  })

  it('ArrowRight on an expanded childless dir is a no-op', () => {
    const rows = [row('empty', 0, true, true), row('root.md', 0, false)]
    expect(resolveKey(state(0, rows), 'ArrowRight')).toEqual({ action: 'none', nextIndex: 0 })
  })

  it('ArrowRight skips invisible rows when seeking the first child', () => {
    const rows = [
      row('docs', 0, true, true),
      { ...row('docs/a.md', 1, false), visible: false },
      row('docs/b.md', 1, false)
    ]
    expect(resolveKey(state(0, rows), 'ArrowRight')).toEqual({ action: 'move', nextIndex: 2 })
  })

  it('ArrowLeft/ArrowRight on a file row are no-ops (disabled rule)', () => {
    expect(resolveKey(state(4), 'ArrowLeft')).toEqual({ action: 'none', nextIndex: 4 })
    expect(resolveKey(state(4), 'ArrowRight')).toEqual({ action: 'none', nextIndex: 4 })
  })
})

describe('resolveKey — Enter 打开/切换', () => {
  it('Enter on a file row opens it', () => {
    expect(resolveKey(state(2), 'Enter')).toEqual({ action: 'open', nextIndex: 2 })
    expect(resolveKey(state(4), 'Enter')).toEqual({ action: 'open', nextIndex: 4 })
  })

  it('Enter on a collapsed dir expands it', () => {
    const rows = TREE.map((r, i) => (i === 1 ? { ...r, expanded: false } : r))
    expect(resolveKey(state(1, rows), 'Enter')).toEqual({ action: 'expand', nextIndex: 1 })
  })

  it('Enter on an expanded dir collapses it', () => {
    expect(resolveKey(state(0), 'Enter')).toEqual({ action: 'collapse', nextIndex: 0 })
  })
})

describe('resolveKey — 禁用规则与空树', () => {
  it('empty tree: every key is a no-op and never hijacks input', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Home', 'End']) {
      expect(resolveKey({ rows: [], focusIndex: -1 }, key)).toEqual({ action: 'none', nextIndex: -1 })
    }
  })

  it('unknown keys are no-ops', () => {
    expect(resolveKey(state(0), 'a')).toEqual({ action: 'none', nextIndex: 0 })
    expect(resolveKey(state(0), 'Escape')).toEqual({ action: 'none', nextIndex: 0 })
  })

  it('out-of-range focusIndex is handled defensively (no throw, no-op on structure keys)', () => {
    expect(resolveKey(state(99), 'Enter')).toEqual({ action: 'none', nextIndex: 99 })
    expect(resolveKey(state(99), 'ArrowDown')).toEqual({ action: 'move', nextIndex: 0 })
    expect(resolveKey(state(99), 'Home')).toEqual({ action: 'first', nextIndex: 0 })
    expect(resolveKey(state(99), 'End')).toEqual({ action: 'last', nextIndex: 4 })
  })

  it('a tree with zero visible rows behaves like an empty tree', () => {
    const rows = TREE.map((r) => ({ ...r, visible: false }))
    expect(resolveKey(state(0, rows), 'ArrowDown')).toEqual({ action: 'none', nextIndex: 0 })
    expect(resolveKey(state(0, rows), 'Enter')).toEqual({ action: 'none', nextIndex: 0 })
  })
})
