/**
 * Table edit commands (task 3.9) — bodies moved verbatim from table/widget.ts,
 * except the sanctioned pending-commit dedupe below.
 *
 * Pending-commit dedupe (spec 3B AC3 — merge, do not copy): the three
 * identical "commit pending nested text" blocks (commitActiveOnly /
 * activateCellAt / clearTableEditAndFocusSource) are collapsed into
 * `pendingCommitChanges`, parameterized by the one real divergence —
 * sentinel-cell policy ('skip' vs whole-table 'rewrite'). Dispatch merging
 * (each site's own transaction shape) stays at the call sites. NOT merged:
 * moveCell's gridWithPending/cellChange (hop semantics + structural append),
 * modelWithPendingText (folds into model for whole-table ops), and the
 * destroy-side microtask commit (commitHandoff in nestedSession).
 *
 * Dropped dead code: the old `cellClipboard` had ZERO call sites (the live
 * clipboard path is the table-cell delta closure in contextMenu/opsTable.ts).
 *
 * Stale-instance discipline (P05 ImageWidget precedent): event closures must
 * NOT capture cell offsets — every handler re-resolves the table model from
 * `view.state` at event time, anchored on `tableFrom` which the tableEditField
 * maps through doc changes.
 */
import type { EditorView } from '@codemirror/view'
import { t } from '../../i18n'
import { getCtxRuntime, buildContextMenu, openContextMenu } from '../contextMenu/registry'
import { escapeCell, formatTable, isSentinelCell, type TableModel } from './parse'
import { gridWithCellText, pasteTsvOp, type TableOp } from './ops'
import { getTableEdit, setActiveCell } from './state'
import { resolveTableModel, resolveWithFallback } from './resolve'
import { activeNestedView } from './nestedSession'
import type { Dir } from './keymap'

type CellChange = { from: number; to: number; insert: string }

/**
 * Shared pending-commit construction (see file header): write the nested
 * editor's text back to the ORIGINAL model's active cell when it differs.
 * Sentinel cells (ragged-table placeholders) are skipped ('skip') or
 * committed via a whole-table rewrite ('rewrite' — activateCellAt hop path).
 */
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

/** Model with the pending nested-cell text folded in (for whole-table ops). */
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

/**
 * Commit the active cell's nested text, then move / exit / clamp.
 * Structural cases (last-cell Tab) rebuild the whole table in ONE transaction
 * together with the commit so undo is a single doc-level step.
 *
 * IMPORTANT: cell commits compare nested text against the ORIGINAL model's
 * cell source — never against a pending-folded copy (that would make
 * `changed` always false and silently drop the write-back).
 */
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

  /** Grid carrying the pending cell text — for whole-table rewrites. */
  const gridWithPending = (): string[][] => {
    const grid = model.cells.map((r) => r.map((c) => c.text))
    if (grid[a.row]) {
      while (grid[a.row].length <= a.col) grid[a.row].push('')
      grid[a.row][a.col] = nestedText
    }
    return grid
  }
  /** Cell-range replace when the cell has a real source range; else null. */
  const cellChange = (): { from: number; to: number; insert: string } | null =>
    cellChanged && cell && !isSentinelCell(cell)
      ? { from: cell.from, to: cell.to, insert: nestedText }
      : null

  if (dir === 'out') {
    // UX-P28: use exitTableEdit for consistent commit+clear semantics.
    // For non-sentinel cells, commitActiveOnly handles the commit.
    // Sentinel cell pending (ragged tables) is committed via whole-table
    // rewrite only in the moveCell hop path; 'out' via exitTableEdit skips
    // sentinel (D3 known limitation, out of scope).
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

  // Same-cell move (clamped at an edge): just commit; keep the cell active.
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

/** Dispatch a whole-table op (handles/menu), folding in any pending cell text. */
/**
 * wave③ toast 统一: structure-destructive ops get a completion toast at the
 * dispatch layer so EVERY caller (widget handles, P27 menu via shared ops,
 * e2e hooks) produces the same visible feedback. Insert/align stay quiet —
 * the table change itself is the feedback.
 */
const STRUCTURE_TOASTS: Record<string, string> = {
  'input.table.deleteRow': 'toast.rowDeleted',
  'input.table.deleteCol': 'toast.colDeleted'
}

export function runTableOp(
  main: EditorView,
  tableFromHint: number,
  opFn: (model: TableModel) => TableOp | null,
  userEvent: string
): void {
  const edit = getTableEdit(main.state)
  const resolved = resolveWithFallback(main, edit.active?.tableFrom, tableFromHint)
  if (!resolved) return
  const withPending = modelWithPendingText(main, resolved.model)
  if (!withPending) return
  const op = opFn(withPending.model)
  if (!op) return
  main.dispatch({
    changes: { from: op.from, to: op.to, insert: op.insert },
    effects: setActiveCell.of({
      tableFrom: resolved.lineFrom,
      row: op.nextActive.row,
      col: op.nextActive.col,
      caret: 0
    }),
    userEvent
  })
  const toastKey = STRUCTURE_TOASTS[userEvent]
  if (toastKey) getCtxRuntime()?.toast(t(toastKey))
}

/** Commit pending nested text (if any) without changing the active cell. */
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

/**
 * UX-P28: commit pending cell text and exit table editing.
 *
 * @param select - 'none' for blur-path (don't change selection);
 *                 'after' for Escape path (place cursor adjacent to table).
 */
export function exitTableEdit(
  main: EditorView,
  opts?: { select?: 'none' | 'after' }
): void {
  const edit = getTableEdit(main.state)
  if (!edit.active) return

  // Commit pending first.
  commitActiveOnly(main)

  const selectMode = opts?.select ?? 'none'
  const spec: Parameters<EditorView['dispatch']>[0] = {
    effects: setActiveCell.of(null),
    userEvent: 'input.table.exit'
  }

  if (selectMode === 'after') {
    const resolved = resolveWithFallback(
      main,
      edit.active.tableFrom,
      edit.active.tableFrom
    )
    if (resolved) {
      const docLen = main.state.doc.length
      const { lineFrom, model } = resolved
      // Place cursor adjacent to table — outside [tableFrom, tableTo] so
      // the enterTable hatch (blockTouched, inclusive) doesn't suppress.
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
  // Commit any pending nested-cell text before hopping to the target cell.
  // Sentinel cells commit via whole-table rewrite here ('rewrite' — see
  // pendingCommitChanges; the only site that keeps ragged placeholders).
  const changes = pendingCommitChanges(main, resolved, { sentinel: 'rewrite' })
  const target = resolved.model.cells[row]?.[col]
  main.dispatch({
    changes: changes.length ? changes : undefined,
    effects: setActiveCell.of({
      tableFrom: resolved.lineFrom,
      row,
      col,
      // UX-P28 F2: use click-computed caret when available; else end-of-cell.
      caret: caretOverride != null
        ? Math.min(Math.max(caretOverride, 0), target && !isSentinelCell(target) ? target.text.length : 0)
        : target && !isSentinelCell(target) ? target.text.length : 0
    }),
    userEvent: 'input.table.activate'
  })
}

export function clearTableEditAndFocusSource(main: EditorView, sourceFrom: number): void {
  // UX-P28: merge to single dispatch — the old two-dispatch path (commit then
  // selection+clear) would trigger the lifecycle auto-exit listener on the first
  // dispatch (docChanged without setActiveCell, selection still outside table).
  const edit = getTableEdit(main.state)
  let changes: CellChange[] = []
  if (edit.active) {
    const resolved = resolveWithFallback(main, edit.active.tableFrom, sourceFrom)
    if (resolved) changes = pendingCommitChanges(main, resolved, { sentinel: 'skip' })
  }
  main.dispatch({
    changes: changes.length ? changes : undefined,
    selection: { anchor: sourceFrom },
    effects: setActiveCell.of(null),
    scrollIntoView: true,
    userEvent: 'select.table.exit'
  })
}

// ---- TSV paste / clipboard ---------------------------------------------------

export function handleTsvPaste(main: EditorView, tsv: string): void {
  const edit = getTableEdit(main.state)
  if (!edit.active) return
  const resolved = resolveWithFallback(main, edit.active.tableFrom, edit.active.tableFrom)
  if (!resolved) return
  const op = pasteTsvOp(resolved.model, edit.active.row, edit.active.col, tsv)
  if (!op) return
  main.dispatch({
    changes: { from: op.from, to: op.to, insert: op.insert },
    effects: setActiveCell.of({
      tableFrom: resolved.lineFrom,
      row: op.nextActive.row,
      col: op.nextActive.col,
      caret: 0
    }),
    userEvent: 'input.table.pasteTsv'
  })
}

// ---- context menu (P27: unified .editor-context-menu) -----------------------

export function openTableContextMenu(
  main: EditorView,
  tableFromHint: number,
  row: number,
  col: number,
  x: number,
  y: number
): void {
  // Commit any pending nested-cell text first so the shared table-cell delta
  // (registry) parses a fresh source model — one menu surface, no widget-only
  // dispatch path to drift.
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
    })
  })
}
