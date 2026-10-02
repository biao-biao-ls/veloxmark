import { describe, expect, it } from 'vitest'
import { formatTable, parseTableModel, type TableModel } from './parse'
import {
  canDeleteCol,
  canDeleteRow,
  deleteColOp,
  deleteRowOp,
  insertColLeftOp,
  insertColOp,
  insertColRightOp,
  insertRowAboveOp,
  insertRowBelowOp,
  insertRowOp,
  moveColOp,
  moveRowOp,
  resizeTableOp
} from './ops'

/** Build a model from a grid via the real formatter/parser pair. */
function modelOf(aligns: string[], grid: string[][]): TableModel {
  return parseTableModel(formatTable(aligns, grid), 0)
}

/** UI cell texts of a model (rows[0] = header). */
function textsOf(model: TableModel): string[][] {
  return model.cells.map((r) => r.map((c) => c.text))
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

describe('insertRowOp — header identity migration (Q5)', () => {
  const grid = [
    ['h1', 'h2'],
    ['a', 'b']
  ]

  it('above the header: empty row becomes the header, old header demotes to first body row', () => {
    const op = insertRowOp(modelOf([], grid), -1)
    expect(textsOf(parseTableModel(op.insert, 0))).toEqual([
      ['', ''],
      ['h1', 'h2'],
      ['a', 'b']
    ])
    expect(op.nextActive).toEqual({ row: 0, col: 0 })
  })

  it('keeps the delimiter at source line 2 after header migration', () => {
    const op = insertRowOp(modelOf([], grid), -1)
    const lines = op.insert.split('\n')
    expect(lines).toHaveLength(4)
    // real delimiter row (dashes), not just a pipe-shaped data row
    expect(lines[1]).toMatch(/^\|[\s:|-]+\|$/)
    expect(lines[1]).toMatch(/-{3}/)
    const m = parseTableModel(op.insert, 0)
    expect(m.delimiterLineFrom).toBe(lines[0].length + 1)
    expect(m.aligns).toEqual(['', ''])
  })

  it('inserts at the anchor above a body row (shared path, i>1)', () => {
    const op = insertRowOp(modelOf([], grid), 0)
    expect(textsOf(parseTableModel(op.insert, 0))).toEqual([
      ['h1', 'h2'],
      ['', ''],
      ['a', 'b']
    ])
    expect(op.nextActive).toEqual({ row: 1, col: 0 })
  })
})

describe('deleteRowOp — header identity migrate-down (PEND-12)', () => {
  const grid = [
    ['h1', 'h2'],
    ['a', 'b'],
    ['c', 'd']
  ]

  it('deleting the first row promotes the first body row to header', () => {
    const op = deleteRowOp(modelOf([], grid), 0)
    expect(op).not.toBeNull()
    const m = parseTableModel(op!.insert, 0)
    expect(textsOf(m)).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ])
    const lines = op!.insert.split('\n')
    expect(lines[1]).toMatch(/^\|[\s:|-]+\|$/)
  })

  it('refuses deletion when the header is the last row (no body to take over)', () => {
    expect(deleteRowOp(modelOf([], [['h1', 'h2']]), 0)).toBeNull()
    expect(deleteRowOp(modelOf([], [['h']]), 0)).toBeNull()
  })

  it('still deletes a plain body row at i>1', () => {
    const op = deleteRowOp(modelOf([], grid), 1)
    expect(op).not.toBeNull()
    expect(textsOf(parseTableModel(op!.insert, 0))).toEqual([
      ['h1', 'h2'],
      ['c', 'd']
    ])
  })
})

describe('minimal-structure disable predicates (AC-ERR-02)', () => {
  it('row deletion disabled at 1 row (incl. 1×1); enabled with a body row', () => {
    expect(canDeleteRow(modelOf([], [['h']]))).toBe(false)
    expect(canDeleteRow(modelOf([], [['h1', 'h2']]))).toBe(false)
    expect(canDeleteRow(modelOf([], [['h'], ['a']]))).toBe(true)
    expect(canDeleteRow(modelOf([], [['h1', 'h2'], ['a', 'b']]))).toBe(true)
  })

  it('column deletion disabled at 1 column; enabled at 2+', () => {
    expect(canDeleteCol(modelOf([], [['h'], ['a']]))).toBe(false)
    expect(canDeleteCol(modelOf([], [['h1', 'h2'], ['a', 'b']]))).toBe(true)
    expect(canDeleteCol(modelOf([], [['h1', 'h2', 'h3']]))).toBe(true)
  })

  it('1×1 disables both and the delete ops refuse (no empty-table residue)', () => {
    const one = modelOf([], [['h']])
    expect(canDeleteRow(one)).toBe(false)
    expect(canDeleteCol(one)).toBe(false)
    expect(deleteRowOp(one, 0)).toBeNull()
    expect(deleteColOp(one, 0)).toBeNull()
  })

  it('delete ops agree with the disable predicates (single data source)', () => {
    const rowOnly = modelOf([], [['h'], ['a']])
    expect(canDeleteRow(rowOnly)).toBe(true)
    expect(deleteRowOp(rowOnly, 0)).not.toBeNull()
    expect(canDeleteCol(rowOnly)).toBe(false)
    expect(deleteColOp(rowOnly, 0)).toBeNull()
  })
})

describe('UI-anchored insert adapters (op id contract face)', () => {
  const grid = [
    ['h1', 'h2'],
    ['a', 'b'],
    ['c', 'd']
  ]

  it('insertRowAboveOp at row 0 performs header identity migration', () => {
    const op = insertRowAboveOp(modelOf([], grid), 0)
    expect(textsOf(parseTableModel(op.insert, 0))).toEqual([
      ['', ''],
      ['h1', 'h2'],
      ['a', 'b'],
      ['c', 'd']
    ])
  })

  it('insertRowAboveOp/insertRowBelowOp map to the shared splice path', () => {
    expect(textsOf(parseTableModel(insertRowAboveOp(modelOf([], grid), 1).insert, 0))).toEqual([
      ['h1', 'h2'],
      ['', ''],
      ['a', 'b'],
      ['c', 'd']
    ])
    expect(textsOf(parseTableModel(insertRowBelowOp(modelOf([], grid), 1).insert, 0))).toEqual([
      ['h1', 'h2'],
      ['a', 'b'],
      ['', ''],
      ['c', 'd']
    ])
  })

  it('insertColLeftOp/insertColRightOp anchor at the active column', () => {
    expect(textsOf(parseTableModel(insertColLeftOp(modelOf([], grid), 1).insert, 0))).toEqual([
      ['h1', '', 'h2'],
      ['a', '', 'b'],
      ['c', '', 'd']
    ])
    expect(textsOf(parseTableModel(insertColRightOp(modelOf([], grid), 1).insert, 0))).toEqual([
      ['h1', 'h2', ''],
      ['a', 'b', ''],
      ['c', 'd', '']
    ])
  })

  /**
   * AC-OP-03 判据2 / AC-OP-08 词表（业务流评审 P2）：插列产生新列写显式
   * 左对齐 `:---`（与菜单 setAlignOp('left') 同形态），不写词表外 `---`。
   * 红线：既有源列的 `---` 必须原样保留（零往返失真）——只动「插列新列」。
   */
  it('insertColOp writes the new column as explicit left-align `:---` (AC-OP-03/08)', () => {
    const src = '| h1 | h2 |\n| --- | --- |\n| a | b |'
    const op = insertColOp(parseTableModel(src, 0), 1)
    const m = parseTableModel(op.insert, 0)
    // new column = 'left'; untouched source columns keep '' (their literal `---`)
    expect(m.aligns).toEqual(['', 'left', ''])
    const delimCells = op.insert
      .split('\n')[1]
      .split('|')
      .map((c) => c.trim())
      .filter((c, i, arr) => i > 0 && i < arr.length - 1)
    expect(delimCells).toEqual(['---', ':---', '---'])
  })

  it('insertColLeftOp/insertColRightOp write the same `:---` new-column form', () => {
    const src = '| h1 | h2 |\n| --- | --- |\n| a | b |'
    for (const op of [
      insertColLeftOp(parseTableModel(src, 0), 1),
      insertColRightOp(parseTableModel(src, 0), 0)
    ]) {
      const m = parseTableModel(op.insert, 0)
      expect(m.aligns[1]).toBe('left')
      expect(op.insert.split('\n')[1]).toContain(':---')
    }
  })
})

describe('ragged rectify in one transaction (PEND-07)', () => {
  const ragged = '| h1 | h2 |\n| --- | --- |\n| a |\n| b | c |'

  it('insert row rectifies to equal columns without losing or shifting content', () => {
    const model = parseTableModel(ragged, 0)
    const op = insertRowOp(model, 1)
    // single whole-table replace = one undo step
    expect(op.from).toBe(0)
    expect(op.to).toBe(ragged.length)
    const m = parseTableModel(op.insert, 0)
    expect(m.cells.every((r) => r.length === m.colCount)).toBe(true)
    expect(textsOf(m)).toEqual([
      ['h1', 'h2'],
      ['a', ''],
      ['', ''],
      ['b', 'c']
    ])
    expect(m.aligns).toEqual(['', ''])
  })

  it('insert column keeps over-wide body cells (content not lost) and syncs the delimiter', () => {
    const src = '| h1 | h2 |\n| --- | --- |\n| a | b | c |'
    const op = insertColOp(parseTableModel(src, 0), 1)
    const m = parseTableModel(op.insert, 0)
    expect(textsOf(m)).toEqual([
      ['h1', '', 'h2', ''],
      ['a', '', 'b', 'c']
    ])
    expect(m.aligns).toHaveLength(m.colCount)
    expect(op.insert).toContain('c')
  })

  it('delete column on a ragged table rectifies rows in the same replace', () => {
    const model = parseTableModel(ragged, 0)
    const op = deleteColOp(model, 1)
    expect(op).not.toBeNull()
    const m = parseTableModel(op!.insert, 0)
    expect(m.cells.every((r) => r.length === m.colCount)).toBe(true)
    expect(textsOf(m)).toEqual([
      ['h1'],
      ['a'],
      ['b']
    ])
  })

  it('one replace whose inverse restores the ragged source byte-for-byte', () => {
    const src = '| h1 | h2 |\n| --- | --- |\n| a |'
    const prefix = 'before\n'
    const doc = `${prefix}${src}\nafter`
    const op = insertRowOp(parseTableModel(src, prefix.length), -1)
    expect(op.from).toBe(prefix.length)
    expect(op.to).toBe(prefix.length + src.length)
    const afterDoc = doc.slice(0, op.from) + op.insert + doc.slice(op.to)
    // one inverse replace ≡ one Ctrl+Z
    const undone = afterDoc.slice(0, op.from) + src + afterDoc.slice(op.from + op.insert.length)
    expect(undone).toBe(doc)
    expect(parseTableModel(op.insert, 0).cells.every((r) => r.length === 2)).toBe(true)
    expect(src.split('\n')[2]).toBe('| a |')
  })
})
