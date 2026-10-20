import type { EditorView } from '@codemirror/view'
import { t } from '../../i18n'
import { undoAction } from '../../hooks/useToast'
import { getCtxRuntime, buildContextMenu, openContextMenu } from '../contextMenu/registry'
import { escapeCell, formatTable, parseTableModel, isSentinelCell, type TableModel } from './parse'
import { gridWithCellText, insertColLeftOp, insertColRightOp, insertRowAboveOp, insertRowBelowOp, moveColOp, moveRowOp, pasteTsvOp, type TableOp } from './ops'
import { colWidthRemapEffect, enterEditMode, getTableEdit, setActiveCell, tableWrapClamp } from './state'
import { insertColWidths, moveColWidths } from './colWidth'
import { TABLE_OP_TOAST_KEYS } from './contract'
import { resolveTableModel, resolveWithFallback } from './resolve'
import { activeNestedView, withHandoffSuppressed } from './nestedSession'
import { assertWritable } from '../readOnlyGuard'
import type { Dir, StructCmd } from './keymap'

type CellChange = { from: number; to: number; insert: string }

function pendingCommitChanges(
  main: EditorView,
  resolved: { model: TableModel; lineFrom: number },
  opts: { sentinel: 'skip' | 'rewrite' }
): CellChange[] {
  const nested = activeNestedView()
  const edit = getTableEdit(main.state)
  if (!nested || !edit.active) return []
  const a = edit.active
  const orig = resolved.model.cells[a.row]?.[a.col]
  const newText = escapeCell(nested.state.doc.toString())
  if (!orig || newText === orig.text) return []
  if (isSentinelCell(orig)) {
    if (opts.sentinel === 'skip') return []
    const grid = gridWithCellText(resolved.model, a.row, a.col, newText)
    return [
      {
        from: resolved.model.tableFrom,
        to: resolved.model.tableTo,
        insert: formatTable(resolved.model.aligns, grid)
      }
    ]
  }
  return [{ from: orig.from, to: orig.to, insert: newText }]
}

function modelWithPendingText(
  view: EditorView,
  model: TableModel
): { model: TableModel; lineFrom: number; pending: boolean } | null {
  const edit = getTableEdit(view.state)
  const nested = activeNestedView()
  if (!nested || !edit.active) return { model, lineFrom: model.tableFrom, pending: false }
  const newText = escapeCell(nested.state.doc.toString())
  const cell = model.cells[edit.active.row]?.[edit.active.col]
  if (!cell || isSentinelCell(cell) || newText === cell.text) {
    return { model, lineFrom: model.tableFrom, pending: false }
  }
  const cells = model.cells.map((row, r) =>
    row.map((c, ci) =>
      r === edit.active!.row && ci === edit.active!.col ? { ...c, text: newText } : c
    )
  )
  return { model: { ...model, cells }, lineFrom: model.tableFrom, pending: true }
}

export function moveCell(nested: EditorView, main: EditorView, dir: Dir): void {
  const edit = getTableEdit(main.state)
  if (!edit.active) return
  const resolved = resolveTableModel(main, edit.active.tableFrom)
  if (!resolved) return
  const model = resolved.model
  const lineFrom = resolved.lineFrom
  const a = edit.active
  const nestedText = escapeCell(nested.state.doc.toString())
  const cell = model.cells[a.row]?.[a.col]
  const cellChanged = !!cell && nestedText !== cell.text

  const gridWithPending = (): string[][] => {
    const grid = model.cells.map((r) => r.map((c) => c.text))
    if (grid[a.row]) {
      while (grid[a.row].length <= a.col) grid[a.row].push('')
      grid[a.row][a.col] = nestedText
    }
    return grid
  }
  const cellChange = (): { from: number; to: number; insert: string } | null =>
    cellChanged && cell && !isSentinelCell(cell)
      ? { from: cell.from, to: cell.to, insert: nestedText }
      : null

  if (dir === 'out') {
    exitTableEdit(main, { select: 'after' })
    main.focus()
    return
  }

  const lastRow = model.cells.length - 1
  const lastCol = model.colCount - 1
  let nextRow = a.row
  let nextCol = a.col
  let structural = false

  switch (dir) {
    case 'next':
      if (a.col < lastCol) nextCol = a.col + 1
      else if (a.row < lastRow) {
        nextRow = a.row + 1
        nextCol = 0
      } else {
        structural = true
        const grid = gridWithPending()
        grid.push(new Array(model.colCount).fill(''))
        main.dispatch({
          changes: { from: model.tableFrom, to: model.tableTo, insert: formatTable(model.aligns, grid) },
          effects: setActiveCell.of({
            tableFrom: lineFrom,
            row: grid.length - 1,
            col: 0,
            caret: 0
          }),
          userEvent: 'input.table.appendRow'
        })
        return
      }
      break
    case 'prev':
      if (a.col > 0) nextCol = a.col - 1
      else if (a.row > 0) {
        nextRow = a.row - 1
        nextCol = lastCol
      }
      break
    case 'down':
      if (a.row < lastRow) nextRow = a.row + 1
      break
    case 'up':
      if (a.row > 0) nextRow = a.row - 1
      break
  }
  if (structural) return

  if (nextRow === a.row && nextCol === a.col) {
    const change = cellChange()
    if (change) {
      main.dispatch({ changes: change, userEvent: 'input.table.cell' })
    } else if (cellChanged) {
      main.dispatch({
        changes: {
          from: model.tableFrom,
          to: model.tableTo,
          insert: formatTable(model.aligns, gridWithPending())
        },
        userEvent: 'input.table.cell'
      })
    }
    return
  }

  const target = model.cells[nextRow]?.[nextCol]
  const caret = target && !isSentinelCell(target) ? target.text.length : 0
  const change = cellChange()
  main.dispatch({
    changes:
      change ??
      (cellChanged
        ? {
            from: model.tableFrom,
            to: model.tableTo,
            insert: formatTable(model.aligns, gridWithPending())
          }
        : undefined),
    effects: setActiveCell.of({ tableFrom: lineFrom, row: nextRow, col: nextCol, caret }),
    userEvent: 'input.table.nav'
  })
}

const STRUCTURE_TOASTS: Record<string, string> = {
  'input.table.deleteRow': 'toast.rowDeleted',
  'input.table.deleteCol': 'toast.colDeleted',
  'input.table.resize': 'toast.tableResized'
}

const INSERT_TOAST_KEYS: Partial<Record<StructCmd, string>> = {
  insertRowAbove: 'toast.rowInsertedAbove',
  insertRowBelow: 'toast.rowInsertedBelow',
  insertColLeft: 'toast.colInsertedLeft',
  insertColRight: 'toast.colInsertedRight'
}

let writableProbe: { path: string; promise: Promise<boolean> } | null = null

function whenWritable(apply: () => void): void {
  const path = getCtxRuntime()?.getActiveFilePath?.() ?? null
  if (path === null) {
    apply()
    return
  }
  let probe = writableProbe
  if (!probe || probe.path !== path) {
    probe = { path, promise: assertWritable() }
    writableProbe = probe
    void probe.promise.then(() => {
      if (writableProbe === probe) writableProbe = null
    })
  }
  void probe.promise.then((ok) => {
    if (ok) apply()
  })
}

function toastStructCmd(view: EditorView, cmd: StructCmd): void {
  const key = INSERT_TOAST_KEYS[cmd]
  if (!key) return
  whenWritable(() => {
    getCtxRuntime()?.toast({ message: t(key), action: undoAction(view) })
  })
}

export function toastTableOp(
  view: EditorView,
  opId: string,
  anchor: { row: number; col: number }
): void {
  const key = TABLE_OP_TOAST_KEYS[opId as keyof typeof TABLE_OP_TOAST_KEYS]
  if (!key) return
  whenWritable(() => {
    getCtxRuntime()?.toast({
      message: t(key, { i: anchor.row + 1, j: anchor.col + 1 }),
      action: undoAction(view)
    })
  })
}

function prepareTableOp(
  main: EditorView,
  tableFromHint: number,
  opFn: (model: TableModel) => TableOp | null,
  widthsRemap?: (prev: readonly number[]) => readonly number[]
): {
  lineFrom: number
  op: TableOp
  nextTable: TableModel
  widthEffect: ReturnType<typeof colWidthRemapEffect> | null
  anchor: { row: number; col: number } | null
} | null {
  const edit = getTableEdit(main.state)
  const resolved = resolveWithFallback(main, edit.active?.tableFrom, tableFromHint)
  if (!resolved) return null
  const withPending = modelWithPendingText(main, resolved.model)
  if (!withPending) return null
  const op = opFn(withPending.model)
  if (!op) return null
  const nextTable = parseTableModel(op.insert, 0)
  const widthEffect = widthsRemap
    ? colWidthRemapEffect(
        main.state,
        resolved.lineFrom,
        nextTable.colCount,
        widthsRemap,
        tableWrapClamp(main, resolved.lineFrom)
      )
    : null
  return { lineFrom: resolved.lineFrom, op, nextTable, widthEffect, anchor: edit.active }
}

export function runTableOp(
  main: EditorView,
  tableFromHint: number,
  opFn: (model: TableModel) => TableOp | null,
  userEvent: string,
  widthsRemap?: (prev: readonly number[]) => readonly number[]
): boolean {
  if (!prepareTableOp(main, tableFromHint, opFn, widthsRemap)) return false
  whenWritable(() => {
    const prepared = prepareTableOp(main, tableFromHint, opFn, widthsRemap)
    if (!prepared) return
    withHandoffSuppressed(() => {
      main.dispatch({
        changes: { from: prepared.op.from, to: prepared.op.to, insert: prepared.op.insert },
        effects: [
          setActiveCell.of({
            tableFrom: prepared.lineFrom,
            row: prepared.op.nextActive.row,
            col: prepared.op.nextActive.col,
            caret: 0
          }),
          ...(prepared.widthEffect ? [prepared.widthEffect] : [])
        ],
        userEvent
      })
    })
    const toastKey = STRUCTURE_TOASTS[userEvent]
    if (toastKey) {
      const a = prepared.anchor
      const params: Record<string, string | number> | undefined =
        toastKey === 'toast.tableResized'
          ? { R: prepared.nextTable.cells.length, C: prepared.nextTable.colCount }
          : a
            ? { i: a.row + 1, j: a.col + 1 }
            : undefined
      getCtxRuntime()?.toast({ message: t(toastKey, params), action: undoAction(main) })
    }
  })
  return true
}

export function tryStructCmd(main: EditorView, cmd: StructCmd): boolean {
  const a = getTableEdit(main.state).active
  if (!a) return false
  const { row, col, tableFrom } = a
  switch (cmd) {
    case 'insertRowBelow':
      if (runTableOp(main, tableFrom, (m) => insertRowBelowOp(m, row), 'input.table.insertRow')) {
        toastStructCmd(main, cmd)
      }
      break
    case 'insertRowAbove':
      if (runTableOp(main, tableFrom, (m) => insertRowAboveOp(m, row), 'input.table.insertRow')) {
        toastStructCmd(main, cmd)
      }
      break
    case 'insertColLeft':
      if (
        runTableOp(
          main,
          tableFrom,
          (m) => insertColLeftOp(m, col),
          'input.table.insertCol',
          (w) => insertColWidths(w, col)
        )
      ) {
        toastStructCmd(main, cmd)
      }
      break
    case 'insertColRight':
      if (
        runTableOp(
          main,
          tableFrom,
          (m) => insertColRightOp(m, col),
          'input.table.insertCol',
          (w) => insertColWidths(w, col + 1)
        )
      ) {
        toastStructCmd(main, cmd)
      }
      break
    case 'moveRowUp':
      if (runTableOp(main, tableFrom, (m) => moveRowOp(m, row, col, -1), 'input.table.moveRow')) {
        toastTableOp(main, cmd, { row, col })
      }
      break
    case 'moveRowDown':
      if (runTableOp(main, tableFrom, (m) => moveRowOp(m, row, col, 1), 'input.table.moveRow')) {
        toastTableOp(main, cmd, { row, col })
      }
      break
    case 'moveColLeft':
      if (
        runTableOp(
          main,
          tableFrom,
          (m) => moveColOp(m, row, col, -1),
          'input.table.moveCol',
          (w) => moveColWidths(w, col, col - 1)
        )
      ) {
        toastTableOp(main, cmd, { row, col })
      }
      break
    case 'moveColRight':
      if (
        runTableOp(
          main,
          tableFrom,
          (m) => moveColOp(m, row, col, 1),
          'input.table.moveCol',
          (w) => moveColWidths(w, col, col + 1)
        )
      ) {
        toastTableOp(main, cmd, { row, col })
      }
      break
  }
  return true
}

export function commitActiveOnly(main: EditorView, hintFrom?: number): void {
  const edit = getTableEdit(main.state)
  if (!edit.active) return
  const resolved = resolveWithFallback(main, edit.active.tableFrom, hintFrom ?? edit.active.tableFrom)
  if (!resolved) return
  const changes = pendingCommitChanges(main, resolved, { sentinel: 'skip' })
  if (changes.length) {
    main.dispatch({
      changes,
      userEvent: 'input.table.cell'
    })
  }
}

export function exitTableEdit(
  main: EditorView,
  opts?: { select?: 'none' | 'after' }
): void {
  const edit = getTableEdit(main.state)
  const sessionFrom = edit.active?.tableFrom ?? edit.editFrom
  if (sessionFrom == null) return

  commitActiveOnly(main)

  const selectMode = opts?.select ?? 'none'
  const spec: Parameters<EditorView['dispatch']>[0] = {
    effects: setActiveCell.of(null),
    userEvent: 'input.table.exit'
  }

  if (selectMode === 'after') {
    const resolved = resolveWithFallback(main, sessionFrom, sessionFrom)
    if (resolved) {
      const docLen = main.state.doc.length
      const { lineFrom, model } = resolved
      spec.selection = {
        anchor: model.tableTo < docLen
          ? model.tableTo + 1
          : Math.max(0, lineFrom - 1)
      }
    }
  }

  main.dispatch(spec)
}

export function activateCellAt(main: EditorView, tableFromHint: number, row: number, col: number, caretOverride?: number): void {
  const edit = getTableEdit(main.state)
  const resolved = resolveWithFallback(main, edit.active?.tableFrom, tableFromHint)
  if (!resolved) return
  const changes = pendingCommitChanges(main, resolved, { sentinel: 'rewrite' })
  const target = resolved.model.cells[row]?.[col]
  main.dispatch({
    changes: changes.length ? changes : undefined,
    effects: setActiveCell.of({
      tableFrom: resolved.lineFrom,
      row,
      col,
      caret: caretOverride != null
        ? Math.min(Math.max(caretOverride, 0), target && !isSentinelCell(target) ? target.text.length : 0)
        : target && !isSentinelCell(target) ? target.text.length : 0
    }),
    userEvent: 'input.table.activate'
  })
}

export function enterTableEdit(main: EditorView, sourceFrom: number): void {
  const edit = getTableEdit(main.state)
  if (!edit.active && edit.editFrom === sourceFrom) return
  let changes: CellChange[] = []
  if (edit.active) {
    const resolved = resolveWithFallback(main, edit.active.tableFrom, sourceFrom)
    if (resolved) changes = pendingCommitChanges(main, resolved, { sentinel: 'skip' })
  }
  main.dispatch({
    changes: changes.length ? changes : undefined,
    effects: enterEditMode.of(sourceFrom),
    userEvent: 'input.table.editMode'
  })
}


function prepareTsvPaste(
  main: EditorView,
  tsv: string
): { lineFrom: number; op: TableOp } | null {
  const a = getTableEdit(main.state).active
  if (!a) return null
  const resolved = resolveWithFallback(main, a.tableFrom, a.tableFrom)
  if (!resolved) return null
  const op = pasteTsvOp(resolved.model, a.row, a.col, tsv)
  if (!op) return null
  return { lineFrom: resolved.lineFrom, op }
}

export function handleTsvPaste(main: EditorView, tsv: string): void {
  if (!getTableEdit(main.state).active) return
  if (!prepareTsvPaste(main, tsv)) return
  whenWritable(() => {
    const prepared = prepareTsvPaste(main, tsv)
    if (!prepared) return
    withHandoffSuppressed(() => {
      main.dispatch({
        changes: { from: prepared.op.from, to: prepared.op.to, insert: prepared.op.insert },
        effects: setActiveCell.of({
          tableFrom: prepared.lineFrom,
          row: prepared.op.nextActive.row,
          col: prepared.op.nextActive.col,
          caret: 0
        }),
        userEvent: 'input.table.pasteTsv'
      })
    })
  })
}


export function openTableMenuAtActive(main: EditorView): boolean {
  const a = getTableEdit(main.state).active
  if (!a) return false
  const coords = main.coordsAtPos(main.state.selection.main.head)
  openTableContextMenu(main, a.tableFrom, a.row, a.col, coords?.left ?? 0, coords?.bottom ?? 0, 'keyboard')
  return true
}

export function openTableContextMenu(
  main: EditorView,
  tableFromHint: number,
  row: number,
  col: number,
  x: number,
  y: number,
  via: 'pointer' | 'keyboard' = 'pointer'
): void {
  commitActiveOnly(main, tableFromHint)
  const resolved = resolveWithFallback(main, getTableEdit(main.state).active?.tableFrom, tableFromHint)
  const from = resolved?.lineFrom ?? tableFromHint
  const to = resolved?.model.tableTo ?? main.state.doc.length
  openContextMenu({
    x,
    y,
    items: buildContextMenu(main, {
      kind: 'table-cell',
      pos: from,
      lineFrom: from,
      lineTo: to,
      table: { from, to, row, col }
    }),
    maxHeightCap: 480,
    via
  })
}
