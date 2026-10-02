import { describe, expect, it } from 'vitest'
import { EditorState, type Transaction } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { history, redo, undo } from '@codemirror/commands'
import {
  activationHistory,
  colWidthHistory,
  colWidthRemapEffect,
  enterEditMode,
  getTableEdit,
  invertActivation,
  invertColWidths,
  restoreColWidths,
  setActiveCell,
  setColWidth,
  tableEditField,
  tableWrapClamp,
  type ActiveCell
} from './state'
import { MIN_COL_WIDTH } from './colWidth'
import { deleteRowOp, insertColRightOp, insertRowOp, moveRowOp, resizeTableOp, setAlignOp, type TableOp } from './ops'
import { parseTableModel } from './parse'
import { deleteTableRange } from './source'

/**
 * FE-06 undo path (AC-OP-11 Then3 / TBL §3.7): a column-width drag is an
 * effect-only transaction — CM6 history drops those unless `invertedEffects`
 * supplies the inverse. `invertColWidths` must hand back the pre-drag widths so
 * one Ctrl+Z restores them (explicitly NOT the "persist pre-drag values"
 * workaround).
 */

function baseState(): EditorState {
  return EditorState.create({
    doc: '| a | b |\n| - | - |\n| x | y |',
    extensions: [tableEditField]
  })
}

function drag(state: EditorState, widths: number[]): Transaction {
  return state.update({ effects: setColWidth.of({ tableFrom: 0, widths }) })
}

describe('invertColWidths', () => {
  it('returns the pre-drag widths so one undo restores them', () => {
    const tr = drag(baseState(), [150, 90])
    const inv = invertColWidths(tr)
    expect(inv).toHaveLength(1)
    expect(inv[0].is(setColWidth)).toBe(true)
    expect(inv[0].value).toEqual({ tableFrom: 0, widths: [] }) // nothing before → auto
    // applying the inverse (what history's pop does) restores the prior state
    const undone = tr.state.update({ effects: inv })
    expect(getTableEdit(undone.state).colWidths.get(0)).toEqual([])
  })

  it('captures the real previous widths on a second drag', () => {
    const first = drag(baseState(), [150, 90])
    const second = drag(first.state, [180, 60])
    const inv = invertColWidths(second)
    expect(inv[0].value).toEqual({ tableFrom: 0, widths: [150, 90] })
    const undone = second.state.update({ effects: inv })
    expect(getTableEdit(undone.state).colWidths.get(0)).toEqual([150, 90])
  })

  it('stays out of transactions without setColWidth (session restore, doc edits)', () => {
    const map = new Map<number, number[]>()
    map.set(0, [100, 140])
    const restore = baseState().update({ effects: restoreColWidths.of(map) })
    expect(invertColWidths(restore)).toEqual([])
    expect(invertColWidths(baseState().update({ changes: { from: 0, insert: '#' } }))).toEqual([])
  })

  it('only inverts the tables the transaction actually touched', () => {
    const tr = baseState().update({
      effects: [
        setColWidth.of({ tableFrom: 0, widths: [150, 90] }),
        setColWidth.of({ tableFrom: 30, widths: [80, 160] })
      ]
    })
    const inv = invertColWidths(tr)
    expect(inv.map((e) => e.value.tableFrom).sort((a, b) => a - b)).toEqual([0, 30])
    expect(inv.every((e) => e.value.widths.length === 0)).toBe(true)
  })
})

/**
 * FE-07 P1 (AC-OP-12 判据3 / AC-ERR-04 判据1): structure ops ride ONE doc
 * transaction with setActiveCell(nextActive); without an `invertedEffects`
 * inverse, undo restored the doc but left the post-op active cell hanging.
 * `invertActivation` must hand back the pre-op {active, editFrom} snapshot so
 * every undo entry (Ctrl+Z / edit menu / toast button) re-anchors the cell.
 */

const ANCHOR_DOC = 'lead\n\n| h1 | h2 |\n| --- | --- |\n| a | b |\n| c | d |\n'
const ANCHOR_FROM = ANCHOR_DOC.indexOf('| h1')

function anchorState(): EditorState {
  return EditorState.create({
    doc: ANCHOR_DOC,
    extensions: [history(), tableEditField, colWidthHistory, activationHistory]
  })
}

function withActive(state: EditorState, active: ActiveCell | null): EditorState {
  return state.update({ effects: setActiveCell.of(active) }).state
}

/** Dispatch shape of runTableOp: one whole-table replace + setActiveCell. */
function opTr(state: EditorState, op: TableOp, tableFrom = ANCHOR_FROM): Transaction {
  return state.update({
    changes: { from: op.from, to: op.to, insert: op.insert },
    effects: setActiveCell.of({
      tableFrom,
      row: op.nextActive.row,
      col: op.nextActive.col,
      caret: 0
    })
  })
}

function runUndo(state: EditorState): EditorState | null {
  let next: EditorState | null = null
  const ok = undo({ state, dispatch: (tr) => (next = tr.state) })
  return ok ? next : null
}

function runRedo(state: EditorState): EditorState | null {
  let next: EditorState | null = null
  const ok = redo({ state, dispatch: (tr) => (next = tr.state) })
  return ok ? next : null
}

describe('invertActivation', () => {
  const model = () => parseTableModel(ANCHOR_DOC.slice(ANCHOR_FROM), ANCHOR_FROM)

  it('returns the pre-op activation snapshot for a doc-changing activation tr', () => {
    const pre = withActive(anchorState(), { tableFrom: ANCHOR_FROM, row: 1, col: 1, caret: 2 })
    const tr = opTr(pre, insertRowOp(model(), 1))
    const inv = invertActivation(tr)
    expect(inv).toHaveLength(1)
    expect(inv[0].is(setActiveCell)).toBe(true)
    expect(inv[0].value).toEqual({ tableFrom: ANCHOR_FROM, row: 1, col: 1, caret: 2 })
  })

  it('restores the edit-form session when the op started from enterEditMode', () => {
    const pre = anchorState().update({ effects: enterEditMode.of(ANCHOR_FROM) }).state
    const tr = opTr(pre, insertRowOp(model(), 1))
    const inv = invertActivation(tr)
    expect(inv).toHaveLength(1)
    expect(inv[0].is(enterEditMode)).toBe(true)
    expect(inv[0].value).toBe(ANCHOR_FROM)
  })

  it('clears the post-op active cell when the op started quiet', () => {
    const tr = opTr(anchorState(), insertRowOp(model(), 1))
    const inv = invertActivation(tr)
    expect(inv).toHaveLength(1)
    expect(inv[0].is(setActiveCell)).toBe(true)
    expect(inv[0].value).toBeNull()
  })

  it('stays out of effect-only activations (cell clicks never enter history)', () => {
    const pre = withActive(anchorState(), { tableFrom: ANCHOR_FROM, row: 0, col: 0, caret: 0 })
    const click = pre.update({
      effects: setActiveCell.of({ tableFrom: ANCHOR_FROM, row: 1, col: 1, caret: 0 })
    })
    expect(click.docChanged).toBe(false)
    expect(invertActivation(click)).toEqual([])
  })

  it('stays out of plain doc edits (text undo behavior unchanged)', () => {
    const pre = withActive(anchorState(), { tableFrom: ANCHOR_FROM, row: 1, col: 1, caret: 2 })
    const typed = pre.update({ changes: { from: 0, insert: 'x' } })
    expect(invertActivation(typed)).toEqual([])
  })
})

describe('undo re-anchors the active cell (AC-OP-12 criterion 3)', () => {
  const model = () => parseTableModel(ANCHOR_DOC.slice(ANCHOR_FROM), ANCHOR_FROM)
  const preAnchor: ActiveCell = { tableFrom: ANCHOR_FROM, row: 1, col: 1, caret: 2 }

  it('structure op + undo: active falls back to the pre-op anchored cell, doc byte-identical', () => {
    const pre = withActive(anchorState(), preAnchor)
    const after = opTr(pre, insertRowOp(model(), 1)).state
    // op moves the active cell forward (nextActive) — the bug kept this after undo
    expect(getTableEdit(after).active).toMatchObject({ row: 2, col: 0 })
    const undone = runUndo(after)
    expect(undone).not.toBeNull()
    expect(undone!.doc.toString()).toBe(ANCHOR_DOC)
    expect(getTableEdit(undone!).active).toEqual(preAnchor)
  })

  it('setAlignOp (nextActive jumps to the header row) still re-anchors the body cell', () => {
    // Review P1 case: align from body (1,1) sets nextActive {row:0,col:1};
    // undo must land back on (1,1), not stay on the header.
    const pre = withActive(anchorState(), preAnchor)
    const alignOp = setAlignOp(model(), 1, 'center')
    expect(alignOp).not.toBeNull()
    expect(alignOp!.nextActive).toEqual({ row: 0, col: 1 })
    const after = opTr(pre, alignOp!).state
    expect(getTableEdit(after).active).toMatchObject({ row: 0, col: 1 })
    const undone = runUndo(after)!
    expect(undone.doc.toString()).toBe(ANCHOR_DOC)
    expect(getTableEdit(undone).active).toEqual(preAnchor)
  })

  it('covers delete / move / resize ops (all structure ops re-anchor)', () => {
    const ops: [string, TableOp | null][] = [
      ['deleteRow', deleteRowOp(model(), 1)],
      ['moveRow', moveRowOp(model(), 1, 1, 1)],
      ['resize', resizeTableOp(model(), 4, 3)]
    ]
    for (const [name, op] of ops) {
      expect(op, name).not.toBeNull()
      const pre = withActive(anchorState(), preAnchor)
      const undone = runUndo(opTr(pre, op!).state)
      expect(undone, name).not.toBeNull()
      expect(undone!.doc.toString(), name).toBe(ANCHOR_DOC)
      expect(getTableEdit(undone!).active, name).toEqual(preAnchor)
    }
  })

  it('delete-table undo restores the pre-delete anchored cell with the table', () => {
    const pre = withActive(anchorState(), preAnchor)
    const deleted = pre.update({
      changes: { from: ANCHOR_FROM - 2, to: ANCHOR_DOC.length, insert: '' },
      effects: setActiveCell.of(null)
    })
    const undone = runUndo(deleted.state)!
    expect(undone.doc.toString()).toBe(ANCHOR_DOC)
    expect(getTableEdit(undone).active).toEqual(preAnchor)
  })

  it('redo re-applies the post-op anchor (undo/redo symmetric)', () => {
    const pre = withActive(anchorState(), preAnchor)
    const after = opTr(pre, insertRowOp(model(), 1)).state
    const postActive = getTableEdit(after).active
    const undone = runUndo(after)!
    const redone = runRedo(undone)!
    expect(redone.doc.toString()).toBe(after.doc.toString())
    expect(getTableEdit(redone).active).toEqual(postActive)
  })

  it('a later cell click does not block re-anchor: undo still lands on the pre-op cell', () => {
    const pre = withActive(anchorState(), preAnchor)
    const after = opTr(pre, insertRowOp(model(), 1)).state
    // effect-only click elsewhere — kept out of history by invertActivation
    const clicked = after.update({
      effects: setActiveCell.of({ tableFrom: ANCHOR_FROM, row: 3, col: 1, caret: 0 })
    }).state
    const undone = runUndo(clicked)!
    expect(undone.doc.toString()).toBe(ANCHOR_DOC)
    expect(getTableEdit(undone).active).toEqual(preAnchor)
  })

  it('pure text undo is unchanged: no activation effect, active only maps with the doc', () => {
    const pre = withActive(anchorState(), preAnchor)
    const typed = pre.update({ changes: { from: 0, insert: 'x' } }).state
    expect(getTableEdit(typed).active).toMatchObject({ tableFrom: ANCHOR_FROM + 1 })
    const undone = runUndo(typed)!
    expect(undone.doc.toString()).toBe(ANCHOR_DOC)
    expect(getTableEdit(undone).active).toEqual(preAnchor)
  })

  it('op starting quiet: undo clears the active cell back to quiet', () => {
    const after = opTr(anchorState(), insertRowOp(model(), 1)).state
    expect(getTableEdit(after).active).not.toBeNull()
    const undone = runUndo(after)!
    expect(getTableEdit(undone).active).toBeNull()
    expect(getTableEdit(undone).editFrom).toBeNull()
  })

  it('op starting from edit-form step-back: undo restores the session without an active cell', () => {
    const pre = anchorState().update({ effects: enterEditMode.of(ANCHOR_FROM) }).state
    const after = opTr(pre, insertRowOp(model(), 1)).state
    expect(getTableEdit(after).active).not.toBeNull()
    const undone = runUndo(after)!
    expect(getTableEdit(undone).active).toBeNull()
    expect(getTableEdit(undone).editFrom).toBe(ANCHOR_FROM)
  })
})

/**
 * FE-08/FE-06 扩展 (AC-OP-09/12「一次 Ctrl+Z 还原整表（含对齐与列宽）」):
 * deleteTableRange 里 mapPos(assoc=1) 把 colWidths 键推到回插段末尾，还原表
 * 的 tableFrom 落空 → 列宽丢失。delete 事务须骑 setColWidth 快照（经
 * invertColWidths 一步还原时重键位），undo 后键位=还原表 tableFrom。
 *
 * 收口批 #3（colWidths debris）：旧键的 mapPos 残留（删/重放落删除点、undo
 * 漂回插段末尾）曾自认残留脏宽度——现由 state.ts 的 supersede 规则移除（同事务
 * setColWidth 覆写的键不再 mapPos，由 effect 写正键），delete/undo/redo 三向
 * 均只剩还原表 tableFrom 一键。
 */
const TABLE_END = ANCHOR_DOC.lastIndexOf('| c | d |') + '| c | d |'.length

/** Minimal view stand-in for deleteTableRange (state getter + apply-on-dispatch). */
function deleteViaView(state: EditorState, from: number, to: number): EditorState {
  let cur = state
  const view = {
    get state() {
      return cur
    },
    dispatch(spec: Parameters<EditorState['update']>[0]) {
      cur = cur.update(spec).state
    }
  } as unknown as EditorView
  deleteTableRange(view, from, to)
  return cur
}

describe('delete-table undo restores column widths and edit session', () => {
  it('undo restores the pre-delete widths at the restored tableFrom (扩展-1)', () => {
    const pre = anchorState().update({
      effects: setColWidth.of({ tableFrom: ANCHOR_FROM, widths: [120, 80] })
    }).state
    const deleted = deleteViaView(pre, ANCHOR_FROM, TABLE_END)
    expect(deleted.doc.toString()).toBe('lead\n')
    const undone = runUndo(deleted)
    expect(undone).not.toBeNull()
    expect(undone!.doc.toString()).toBe(ANCHOR_DOC)
    expect(getTableEdit(undone!).colWidths.get(ANCHOR_FROM)).toEqual([120, 80])
  })

  it('undo restores the pre-delete active cell onto the restored table (扩展-2)', () => {
    const preAnchor: ActiveCell = { tableFrom: ANCHOR_FROM, row: 1, col: 1, caret: 2 }
    const pre = withActive(anchorState(), preAnchor)
    const deleted = deleteViaView(pre, ANCHOR_FROM, TABLE_END)
    expect(getTableEdit(deleted).active).toBeNull()
    const undone = runUndo(deleted)!
    expect(undone.doc.toString()).toBe(ANCHOR_DOC)
    // tableFrom equals the restored table's lineFrom → enterTable's
    // `!isEditing && blockTouched` hatch stays suppressed (direct keystrokes).
    expect(getTableEdit(undone).active).toEqual(preAnchor)
    expect(getTableEdit(undone).active!.tableFrom).toBe(ANCHOR_FROM)
  })

  it('undo restores the pre-delete edit-form session (editFrom) without an active cell (扩展-2)', () => {
    const pre = anchorState().update({ effects: enterEditMode.of(ANCHOR_FROM) }).state
    const deleted = deleteViaView(pre, ANCHOR_FROM, TABLE_END)
    expect(getTableEdit(deleted).editFrom).toBeNull()
    const undone = runUndo(deleted)!
    expect(undone.doc.toString()).toBe(ANCHOR_DOC)
    const edit = getTableEdit(undone)
    expect(edit.active).toBeNull()
    // editFrom === restored lineFrom → isEditing true → hatch suppressed.
    expect(edit.editFrom).toBe(ANCHOR_FROM)
  })

  it('收口批 #3：delete/undo/redo 三向 colWidths 均无 mapPos debris 键', () => {
    const pre = anchorState().update({
      effects: setColWidth.of({ tableFrom: ANCHOR_FROM, widths: [120, 80] })
    }).state
    const deleted = deleteViaView(pre, ANCHOR_FROM, TABLE_END)
    // 删后仅剩 invert 对称快照键（=原 tableFrom），无删除点残留
    expect([...getTableEdit(deleted).colWidths.keys()]).toEqual([ANCHOR_FROM])
    const undone = runUndo(deleted)!
    // undo 后仅还原表 tableFrom 一键——修前旧键 mapPos 漂到回插段末尾残留
    expect([...getTableEdit(undone).colWidths.keys()]).toEqual([ANCHOR_FROM])
    expect(getTableEdit(undone).colWidths.get(ANCHOR_FROM)).toEqual([120, 80])
    const redone = runRedo(undone)!
    expect([...getTableEdit(redone).colWidths.keys()]).toEqual([ANCHOR_FROM])
    expect(getTableEdit(redone).colWidths.get(ANCHOR_FROM)).toEqual([120, 80])
  })
})

/**
 * 收口批 #4（IT-01-FE-08 Minor 测试盲点）：①state.ts 越界键丢弃 guard 无独立
 * 单测（原仅被删除/undo 集成用例隐式覆盖）；②宽度 redo 对称（原仅断言
 * activation）。
 */
describe('colWidths 越界 debris 键 guard + 宽度 undo/redo 对称', () => {
  it('①from > doc.length 的 debris 键：doc 变更不抛且键被弃，范围内键照常 mapPos', () => {
    const state = anchorState().update({
      effects: [
        setColWidth.of({ tableFrom: 9999, widths: [120, 80] }),
        setColWidth.of({ tableFrom: ANCHOR_FROM, widths: [60, 70] })
      ]
    }).state
    expect(getTableEdit(state).colWidths.has(9999)).toBe(true)
    let next: EditorState | null = null
    expect(() => {
      next = state.update({ changes: { from: 0, insert: 'x' } }).state
    }).not.toThrow()
    expect(getTableEdit(next!).colWidths.has(9999)).toBe(false) // 越界键被弃
    expect(getTableEdit(next!).colWidths.get(ANCHOR_FROM + 1)).toEqual([60, 70]) // 正常键随文档前移
  })

  it('②宽度 undo/redo 对称：结构 op 骑 setColWidth，undo 还原旧宽、redo 重放新宽', () => {
    const model = parseTableModel(ANCHOR_DOC.slice(ANCHOR_FROM), ANCHOR_FROM)
    const pre = anchorState().update({
      effects: setColWidth.of({ tableFrom: ANCHOR_FROM, widths: [120, 80] })
    }).state
    const op = insertColRightOp(model, 0)
    const after = pre.update({
      changes: { from: op.from, to: op.to, insert: op.insert },
      effects: [
        setActiveCell.of({
          tableFrom: ANCHOR_FROM,
          row: op.nextActive.row,
          col: op.nextActive.col,
          caret: 0
        }),
        setColWidth.of({ tableFrom: ANCHOR_FROM, widths: [120, 60, 80] })
      ]
    }).state
    expect(getTableEdit(after).colWidths.get(ANCHOR_FROM)).toEqual([120, 60, 80])
    const undone = runUndo(after)!
    expect(undone.doc.toString()).toBe(ANCHOR_DOC)
    expect(getTableEdit(undone).colWidths.get(ANCHOR_FROM)).toEqual([120, 80]) // 旧宽
    const redone = runRedo(undone)!
    expect(redone.doc.toString()).toBe(after.doc.toString())
    expect(getTableEdit(redone).colWidths.get(ANCHOR_FROM)).toEqual([120, 60, 80]) // 新宽
  })
})

/**
 * FE-06 AC-ERR-03 判据1「失效/超界列宽重置为默认列宽」: the remap path must
 * sanitize through the SAME clamp the col-grip drag uses (min token + wrap
 * max) — without a max, >max widths never reset on structure ops.
 */
describe('colWidthRemapEffect clamp (AC-ERR-03 over-max reset)', () => {
  function widthState(widths: number[]): EditorState {
    return anchorState().update({
      effects: setColWidth.of({ tableFrom: ANCHOR_FROM, widths })
    }).state
  }

  /** Fake view whose table wrap measures `wrapW` px (as the drag clamp does). */
  function wrapView(wrapW: number | null): EditorView {
    return {
      dom: {
        querySelector: () => (wrapW == null ? null : { clientWidth: wrapW })
      }
    } as unknown as EditorView
  }

  it('resets widths above the wrap max to the default width on structure remap', () => {
    const state = widthState([100, 900, 800])
    const clamp = tableWrapClamp(wrapView(800), ANCHOR_FROM)
    expect(clamp).toEqual({ min: MIN_COL_WIDTH, max: 800 })
    const eff = colWidthRemapEffect(state, ANCHOR_FROM, 3, (w) => w, clamp)
    expect(eff).not.toBeNull()
    expect(eff!.value.widths).toEqual([100, 0, 800])
  })

  it('resets below-min widths to default and degrades to min-only when the wrap is not measurable', () => {
    const state = widthState([10, 900])
    expect(tableWrapClamp(wrapView(null), ANCHOR_FROM)).toBeUndefined()
    expect(tableWrapClamp(wrapView(0), ANCHOR_FROM)).toBeUndefined()
    const eff = colWidthRemapEffect(
      state,
      ANCHOR_FROM,
      2,
      (w) => w,
      tableWrapClamp(wrapView(null), ANCHOR_FROM)
    )
    // < min resets to the default (0 = auto, sanitizeWidths contract — NOT a
    // clamp-up). Without a wrap max, over-max is kept (same degradation the
    // drag path takes when contentW is unmeasurable).
    expect(eff!.value.widths).toEqual([0, 900])
  })
})
