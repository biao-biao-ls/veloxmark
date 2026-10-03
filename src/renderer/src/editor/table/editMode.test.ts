/**
 * AC-FN-29 分级退格 (graded step-back) + AC-FN-03 未命中路径 + AC-FN-21/22 二次退出.
 *
 * The gap click lands the table on the edit form WITHOUT an active cell —
 * the edit session (`TableEditState.editFrom`, not `active`) drives the edit
 * chrome, so the toolbar stays mounted (toolbar retention). Only the quiet
 * paths (Esc / body blank → exitTableEdit) do the full exit. Unit level pins
 * the state model + the click-router commands headless (no widget rendering —
 * constitution); the DOM toolbar mount is CDP-verified in the task report.
 */
import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { GFM } from '@lezer/markdown'
import type { EditorView } from '@codemirror/view'
import {
  enterEditMode,
  getTableEdit,
  setActiveCell,
  tableEditField
} from './state'
import { activateCellAt, enterTableEdit, exitTableEdit } from './commands'
import { TableWidget } from './widget'

// ---- headless view (keymap.test.ts pattern) ----------------------------------

function stateView(doc: string): { view: EditorView; getDoc: () => string; sel: () => number } {
  let state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM], addKeymap: false }), tableEditField]
  })
  ensureSyntaxTree(state, state.doc.length, 50000)
  const view = {
    get state() {
      return state
    },
    dispatch(spec: { [k: string]: unknown }) {
      state = state.update(spec as never).state
      ensureSyntaxTree(state, state.doc.length, 50000)
    }
  } as unknown as EditorView
  return { view, getDoc: () => state.doc.toString(), sel: () => state.selection.main.from }
}

const TABLE_DOC = 'lead paragraph\n\n| h1 | h2 |\n| --- | --- |\n| a | b |\n| c | d |\n'
const TABLE_FROM = TABLE_DOC.indexOf('| h1')

function viewWithActiveCell(row = 1, col = 0) {
  const sv = stateView(TABLE_DOC)
  sv.view.dispatch({
    effects: setActiveCell.of({ tableFrom: TABLE_FROM, row, col, caret: 0 })
  })
  return sv
}

// ---- AC-FN-29 state model: edit form without active cell --------------------

describe('TableEditState edit form (AC-FN-29 model)', () => {
  it('enterEditMode steps back to edit form: active cleared, session kept', () => {
    const state = viewWithActiveCell(1, 0).view.state.update({
      effects: enterEditMode.of(TABLE_FROM)
    }).state
    const edit = getTableEdit(state)
    expect(edit.active).toBeNull()
    expect(edit.editFrom).toBe(TABLE_FROM) // toolbar-mount source stays on
  })

  it('setActiveCell follows the session (activation implies edit form)', () => {
    const state = stateView(TABLE_DOC).view.state.update({
      effects: setActiveCell.of({ tableFrom: TABLE_FROM, row: 2, col: 1, caret: 3 })
    }).state
    expect(getTableEdit(state).editFrom).toBe(TABLE_FROM)
  })

  it('setActiveCell.of(null) is the full exit — session dies with the active cell', () => {
    const stepped = viewWithActiveCell(1, 0).view.state.update({
      effects: enterEditMode.of(TABLE_FROM)
    }).state
    const quiet = stepped.update({ effects: setActiveCell.of(null) }).state
    const edit = getTableEdit(quiet)
    expect(edit.active).toBeNull()
    expect(edit.editFrom).toBeNull()
  })

  it('maps editFrom through doc changes like the active tableFrom', () => {
    const stepped = viewWithActiveCell(1, 0).view.state.update({
      effects: enterEditMode.of(TABLE_FROM)
    }).state
    const shifted = stepped.update({ changes: { from: 0, insert: 'x\n\n' } }).state
    expect(getTableEdit(shifted).editFrom).toBe(TABLE_FROM + 3)
  })
})

// ---- gap click router -------------------------------------------------------

describe('enterTableEdit (gap click router)', () => {
  it('cell-active + gap click → graded step-back to edit form with no active cell', () => {
    const { view } = viewWithActiveCell(1, 0)
    enterTableEdit(view, TABLE_FROM)
    const edit = getTableEdit(view.state)
    expect(edit.active).toBeNull() // ① 退出单元格激活态
    expect(edit.editFrom).toBe(TABLE_FROM) // ② 回到表格编辑态（非直达静息）
  })

  it('keeps the edit session that mounts the toolbar (toolbar retention)', () => {
    const { view } = viewWithActiveCell(1, 0)
    enterTableEdit(view, TABLE_FROM)
    // The chrome condition is the session, not `active` — enterTable reads
    // `edit.editFrom === lineFrom` for the widget's editing/toolbar flag.
    expect(getTableEdit(view.state).editFrom).not.toBeNull()
  })

  it('does not jump the cursor to the table source (no source-focus escape)', () => {
    const sv = viewWithActiveCell(1, 0)
    const before = sv.sel()
    enterTableEdit(sv.view, TABLE_FROM)
    expect(sv.sel()).toBe(before)
  })

  it('gap click from rest enters the edit form (AC-FN-03 miss path)', () => {
    const { view } = stateView(TABLE_DOC)
    enterTableEdit(view, TABLE_FROM)
    const edit = getTableEdit(view.state)
    expect(edit.active).toBeNull()
    expect(edit.editFrom).toBe(TABLE_FROM)
  })

  it('a second gap click is idempotent (stays on the edit form)', () => {
    const { view } = viewWithActiveCell(1, 0)
    enterTableEdit(view, TABLE_FROM)
    enterTableEdit(view, TABLE_FROM)
    const edit = getTableEdit(view.state)
    expect(edit.active).toBeNull()
    expect(edit.editFrom).toBe(TABLE_FROM)
  })
})

// ---- secondary exit (AC-FN-21 / AC-FN-22) -----------------------------------

describe('secondary exit (exitTableEdit from the step-back form)', () => {
  it('full quiet from edit form without active cell', () => {
    const { view } = viewWithActiveCell(1, 0)
    enterTableEdit(view, TABLE_FROM)
    exitTableEdit(view)
    const edit = getTableEdit(view.state)
    expect(edit.active).toBeNull()
    expect(edit.editFrom).toBeNull()
  })

  it('full quiet from cell-active (one-shot collapse stays intact)', () => {
    const { view } = viewWithActiveCell(1, 0)
    exitTableEdit(view, { select: 'after' })
    const edit = getTableEdit(view.state)
    expect(edit.active).toBeNull()
    expect(edit.editFrom).toBeNull()
  })

  it('no-op on an already quiet table', () => {
    const { view } = stateView(TABLE_DOC)
    exitTableEdit(view)
    expect(getTableEdit(view.state).editFrom).toBeNull()
  })
})

// ---- AC-FN-32 activation transfer -------------------------------------------

describe('activation transfer from the step-back form (AC-FN-32)', () => {
  it('click cell A then B: single active cell moves, session persists', () => {
    const { view } = viewWithActiveCell(1, 0)
    enterTableEdit(view, TABLE_FROM) // gap click first (Given)
    activateCellAt(view, TABLE_FROM, 1, 1) // cell A
    let edit = getTableEdit(view.state)
    expect(edit.active).toMatchObject({ row: 1, col: 1 })
    expect(edit.editFrom).toBe(TABLE_FROM)
    activateCellAt(view, TABLE_FROM, 2, 0) // cell B
    edit = getTableEdit(view.state)
    expect(edit.active).toMatchObject({ row: 2, col: 0 }) // at most one active
    expect(edit.editFrom).toBe(TABLE_FROM) // table stays in edit state
  })
})

// ---- eq rebuild contract (toolbar mount on the quiet ↔ edit-form edge) -------

describe('TableWidget.eq (edit-chrome rebuild contract)', () => {
  const spec = (editing: boolean, active: { row: number; col: number } | null) => ({
    active: active ? { ...active, caret: 0 } : null,
    editing,
    theme: 'light' as const,
    i18nEpoch: 0
  })

  it('quiet vs edit-form-without-active are NOT eq (DOM rebuild mounts the toolbar)', () => {
    const quiet = new TableWidget(TABLE_DOC, 0, 10, spec(false, null))
    const stepped = new TableWidget(TABLE_DOC, 0, 10, spec(true, null))
    expect(quiet.eq(stepped)).toBe(false)
    expect(stepped.eq(quiet)).toBe(false)
  })

  it('same edit form without active stays eq (no spurious rebuild)', () => {
    const a = new TableWidget(TABLE_DOC, 0, 10, spec(true, null))
    const b = new TableWidget(TABLE_DOC, 0, 10, spec(true, null))
    expect(a.eq(b)).toBe(true)
  })
})
