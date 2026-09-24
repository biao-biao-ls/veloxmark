import { describe, expect, it } from 'vitest'
import { formatTable, parseTableModel } from './parse'
import { moveColOp, moveRowOp } from './ops'

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
