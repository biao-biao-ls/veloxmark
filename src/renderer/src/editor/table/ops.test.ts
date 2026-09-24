import { describe, expect, it } from 'vitest'
import { formatTable, parseTableModel } from './parse'
import { moveColOp, moveRowOp, resizeTableOp } from './ops'

/** Build a model from a grid via the real formatter/parser pair. */
function modelOf(aligns: string[], grid: string[][]): ReturnType<typeof parseTableModel> {
  return parseTableModel(formatTable(aligns, grid), 0)
}

describe('moveRowOp', () => {
  const grid = [
    ['h1', 'h2'],
    ['a', 'b'],
    ['c', 'd']
  ]

  it('swaps a body row with the one below and follows the anchor', () => {
    const op = moveRowOp(modelOf([], grid), 1, 1, 1)
    expect(op).not.toBeNull()
    const m = parseTableModel(op!.insert, 0)
    expect(m.cells.map((r) => r.map((c) => c.text))).toEqual([
      ['h1', 'h2'],
      ['c', 'd'],
      ['a', 'b']
    ])
    expect(op!.nextActive).toEqual({ row: 2, col: 1 })
  })

  it('lets the header move down (swap with first body row)', () => {
    const op = moveRowOp(modelOf([], grid), 0, 0, 1)
    expect(op).not.toBeNull()
    const m = parseTableModel(op!.insert, 0)
    expect(m.cells.map((r) => r.map((c) => c.text))[0]).toEqual(['a', 'b'])
    expect(op!.nextActive).toEqual({ row: 1, col: 0 })
  })

  it('returns null at both edges', () => {
    expect(moveRowOp(modelOf([], grid), 0, 0, -1)).toBeNull()
    expect(moveRowOp(modelOf([], grid), 2, 0, 1)).toBeNull()
    expect(moveRowOp(modelOf([], grid), -1, 0, 1)).toBeNull()
    expect(moveRowOp(modelOf([], grid), 3, 0, -1)).toBeNull()
  })
})

describe('moveColOp', () => {
  const grid = [
    ['h1', 'h2', 'h3'],
    ['a', 'b', 'c']
  ]

  it('swaps columns and carries aligns with them', () => {
    const op = moveColOp(modelOf(['left', '', 'right'], grid), 1, 0, 1)
    expect(op).not.toBeNull()
    const m = parseTableModel(op!.insert, 0)
    expect(m.cells.map((r) => r.map((c) => c.text))).toEqual([
      ['h2', 'h1', 'h3'],
      ['b', 'a', 'c']
    ])
    expect(m.aligns.slice(0, 3)).toEqual(['', 'left', 'right'])
    expect(op!.nextActive).toEqual({ row: 1, col: 1 })
  })

  it('returns null at both edges', () => {
    expect(moveColOp(modelOf([], grid), 0, 0, -1)).toBeNull()
    expect(moveColOp(modelOf([], grid), 0, 2, 1)).toBeNull()
    expect(moveColOp(modelOf([], grid), 0, 3, 1)).toBeNull()
    expect(moveColOp(modelOf([], grid), 0, -1, -1)).toBeNull()
  })
})

describe('resizeTableOp', () => {
  const grid = [
    ['h1', 'h2'],
    ['a', 'b'],
    ['c', 'd']
  ]

  it('grows with empty rows at the bottom and empty cols at the right', () => {
    const op = resizeTableOp(modelOf(['left', ''], grid), 4, 3)
    expect(op).not.toBeNull()
    const m = parseTableModel(op!.insert, 0)
    expect(m.cells.map((r) => r.map((c) => c.text))).toEqual([
      ['h1', 'h2', ''],
      ['a', 'b', ''],
      ['c', 'd', ''],
      ['', '', '']
    ])
    expect(m.aligns.slice(0, 3)).toEqual(['left', '', ''])
  })

  it('shrinks by dropping bottom rows and right cols (header survives)', () => {
    const four = [
      ['h1', 'h2', 'h3'],
      ['a', 'b', 'c'],
      ['d', 'e', 'f']
    ]
    const op = resizeTableOp(modelOf(['left', 'center', 'right'], four), 2, 2)
    expect(op).not.toBeNull()
    const m = parseTableModel(op!.insert, 0)
    expect(m.cells.map((r) => r.map((c) => c.text))).toEqual([
      ['h1', 'h2'],
      ['a', 'b']
    ])
    expect(m.cells[0].map((c) => c.text)).toEqual(['h1', 'h2'])
    expect(m.aligns.slice(0, 2)).toEqual(['left', 'center'])
  })

  it('shrinking to 1×1 keeps only the header cell', () => {
    const op = resizeTableOp(modelOf([], grid), 1, 1)
    expect(op).not.toBeNull()
    const m = parseTableModel(op!.insert, 0)
    expect(m.cells.map((r) => r.map((c) => c.text))).toEqual([['h1']])
  })

  it('normalizes ragged aligns when the column count changes', () => {
    // aligns shorter than colCount: pad with '', then extend/truncate to target
    const grow = resizeTableOp(modelOf(['left'], grid), 2, 3)
    expect(parseTableModel(grow!.insert, 0).aligns.slice(0, 3)).toEqual(['left', '', ''])
    const shrink = resizeTableOp(modelOf(['left'], grid), 3, 1)
    expect(parseTableModel(shrink!.insert, 0).aligns.slice(0, 1)).toEqual(['left'])
  })

  it('returns null for no-op and below-minimum targets', () => {
    expect(resizeTableOp(modelOf([], grid), 3, 2)).toBeNull() // current shape (3×2) — no empty transaction
    expect(resizeTableOp(modelOf([], grid), 0, 2)).toBeNull()
    expect(resizeTableOp(modelOf([], grid), 3, 0)).toBeNull()
    expect(resizeTableOp(modelOf([], grid), -1, -1)).toBeNull()
  })

  it('clamps the anchor into the new shape', () => {
    const op = resizeTableOp(modelOf([], grid), 2, 1, 9, 9)
    expect(op!.nextActive).toEqual({ row: 1, col: 0 })
  })
})
