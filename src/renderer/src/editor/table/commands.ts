/**
 * Table edit commands (task 3.9) — bodies moved verbatim from table/widget.ts,
 * except the sanctioned pending-commit dedupe below.
 *
 * Pending-commit dedupe (spec 3B AC3 — merge, do not copy): the three
 * identical "commit pending nested text" blocks (commitActiveOnly /
 * activateCellAt / enterTableEdit) are collapsed into
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

/**
 * wave③ toast 统一: structure-destructive ops get a completion toast at the
 * dispatch layer so EVERY caller (widget handles, P27 menu via shared ops,
 * e2e hooks) produces the same visible feedback. Insert receipts ride the
 * cmd-level map below (above/below share a userEvent, so the key follows the
 * op id — TBL §3.1 four-face same source).
 *
 * `{i}`/`{j}` are 1-based per the frozen AC texts (「第 i 行」); the anchor
 * cell supplies them at dispatch time.
 */
const STRUCTURE_TOASTS: Record<string, string> = {
  'input.table.deleteRow': 'toast.rowDeleted',
  'input.table.deleteCol': 'toast.colDeleted',
  // FE-05/AC-OP-07: 缩放回执「表格缩放为 R×C（Ctrl+Z 可撤销）」— target dims,
  // not the anchor cell (same text for toolbar ⊞ and the e2e probe path).
  'input.table.resize': 'toast.tableResized'
}

/**
 * Frozen insert/move receipts keyed by op id (AC-OP-01~06). Same i18n keys the
 * ⋮/右键 menu items toast through (FE-04 run closures) — text consistency is
 * guaranteed by the shared dictionary, not by copying strings.
 */
const INSERT_TOAST_KEYS: Partial<Record<StructCmd, string>> = {
  insertRowAbove: 'toast.rowInsertedAbove',
  insertRowBelow: 'toast.rowInsertedBelow',
  insertColLeft: 'toast.colInsertedLeft',
  insertColRight: 'toast.colInsertedRight'
}

/**
 * P1 (AC-ERR-08/AC-RULE-16) — read-only gate consumer for the table write
 * paths. Thin wrapper over the IT-03/FE-04 `readOnlyGuard.assertWritable`:
 * runs `apply` when the active document may be edited, else nothing (the
 * guard already fired the frozen `err.readonly` toast).
 *
 * - Untitled / no runtime path: exactly assertWritable's own early answer
 *   (writable) — taken synchronously so the dispatch/receipt timing of the
 *   no-file unit hosts and the untitled doc is unchanged.
 * - A real file path defers to the IPC probe. Concurrent calls share one
 *   in-flight probe (a write and its success receipt ride the same answer),
 *   so one refused entry yields exactly one `err.readonly` toast and zero
 *   success toasts. The probe is not cached across entries — every write
 *   re-probes (chmod / 另存为 must be picked up).
 */
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

/**
 * Toast the frozen receipt for `cmd` (insert family). FE-07: structural-op
 * receipts carry the「撤销」button (glb-toast:action) — one undo step on `view`.
 * Self-gated (P1): the call sites (`if (runTableOp(...)) toast…`) are sync, so
 * the receipt rides the same writable probe as the write — a refused op shows
 * only `err.readonly`, never the success receipt.
 */
function toastStructCmd(view: EditorView, cmd: StructCmd): void {
  const key = INSERT_TOAST_KEYS[cmd]
  if (!key) return
  whenWritable(() => {
    getCtxRuntime()?.toast({ message: t(key), action: undoAction(view) })
  })
}

/**
 * FE-04: move/align receipts via TABLE_OP_TOAST_KEYS (four-face same source).
 * `{i}`/`{j}` are 1-based per frozen AC texts. Self-gated like toastStructCmd
 * (toolbar's `if (runTableOp(...)) toastTableOp(...)` stays sync — toolbar.ts
 * is not ours to change; the gate suppresses the receipt on read-only).
 */
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

/**
 * Resolve + fold pending text + run the op (pure prep, no dispatch). Shared by
 * the sync preview in `runTableOp` and the gated apply — the apply re-prepares
 * because the writable probe may defer the write past further edits
 * (stale-instance discipline: never dispatch a pre-computed range).
 */
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
        // AC-ERR-03: over-max widths reset on structure ops — same wrap max
        // the col-grip drag clamps to.
        tableWrapClamp(main, resolved.lineFrom)
      )
    : null
  return { lineFrom: resolved.lineFrom, op, nextTable, widthEffect, anchor: edit.active }
}

/**
 * Dispatch a whole-table op (handles/menu), folding in any pending cell text.
 * `widthsRemap` (FE-06, col-structure ops only) maps the stored widths onto the
 * new structure — see colWidthRemapEffect (rides the same transaction).
 * Returns true when the op applies (callers toast receipts on success only).
 *
 * P1: the write is gated by `whenWritable` (AC-ERR-08/AC-RULE-16) — read-only
 * documents see no dispatch, no dirty and the frozen `err.readonly` toast; the
 * caller-side receipts self-gate so no success toast leaks either.
 * P0: the dispatch runs under `withHandoffSuppressed` — the pending nested text
 * already rides this single transaction (modelWithPendingText), so the
 * widget-destroy handoff must not turn it into a second undo entry (AC-RULE-08)
 * by writing it into the post-op active cell (Q5 header migration collides at
 * (0,0)).
 */
export function runTableOp(
  main: EditorView,
  tableFromHint: number,
  opFn: (model: TableModel) => TableOp | null,
  userEvent: string,
  widthsRemap?: (prev: readonly number[]) => readonly number[]
): boolean {
  // Sync preview — the unmodifiable callers (toolbar `if (runTableOp(...))`)
  // need a boolean at call time to decide on their receipt; the real write
  // re-prepares inside the gate below.
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
      // 1-based params for the frozen texts; t() leaves unknown placeholders,
      // so pass both and let the key pick (anchor = the op's target cell).
      // FE-05: the resize receipt is the only dims-shaped key ({R}×{C} = post-op).
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

/**
 * 7B/FE-02: structure shortcuts (TBL §3.2 frozen 5 groups) — same ops/
 * userEvents/receipts as the ⋮ menu items via runTableOp (pending fold +
 * nextActive follow + single-step undo). Op adapters come from ops.ts
 * (op id → anchor mapping single source). Returns true when the key was
 * taken (table edit active); false lets the main-editor side fall through
 * to default bindings (no global hijack — AC-ERR-12).
 */
export function tryStructCmd(main: EditorView, cmd: StructCmd): boolean {
  // Stale-instance discipline: read the anchor at event time from state.
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
      // FE-06/AC-ERR-03: the width rides with the column (single transaction).
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
 * UX-P28: commit pending cell text and exit table editing — the AC-FN-21/22
 * quiet path. Also clears the AC-FN-29 step-back edit form (session without an
 * active cell), so Esc/body-blank collapse from ANY edit state is one-shot.
 *
 * @param select - 'none' for blur-path (don't change selection);
 *                 'after' for Escape path (place cursor adjacent to table).
 */
export function exitTableEdit(
  main: EditorView,
  opts?: { select?: 'none' | 'after' }
): void {
  const edit = getTableEdit(main.state)
  const sessionFrom = edit.active?.tableFrom ?? edit.editFrom
  if (sessionFrom == null) return

  // Commit pending first (no-op on the step-back form — nothing active).
  commitActiveOnly(main)

  const selectMode = opts?.select ?? 'none'
  const spec: Parameters<EditorView['dispatch']>[0] = {
    // setActiveCell.of(null) = full exit: active AND editFrom die together.
    effects: setActiveCell.of(null),
    userEvent: 'input.table.exit'
  }

  if (selectMode === 'after') {
    const resolved = resolveWithFallback(main, sessionFrom, sessionFrom)
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

/**
 * AC-FN-29 graded step-back / AC-FN-03 miss path — the table gap-click route:
 * land the table on its edit form with NO active cell (toolbar/chrome stay),
 * committing any pending cell text first. Deliberately does NOT touch the
 * selection and does NOT focus source — full exit stays with exitTableEdit
 * (AC-FN-21/22 quiet paths). Single dispatch (UX-P28): the merge keeps the
 * lifecycle auto-exit listener from racing the commit.
 */
export function enterTableEdit(main: EditorView, sourceFrom: number): void {
  const edit = getTableEdit(main.state)
  // Idempotent: a second gap click on the same form is a no-op (keeps the
  // graded step-back from ever acting as a quiet path).
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

// ---- TSV paste / clipboard ---------------------------------------------------

/**
 * Resolve + pasteTsvOp (pure prep, no dispatch). Shared by the sync preview in
 * `handleTsvPaste` and the gated apply — the apply re-prepares because the
 * writable probe may defer the write past further edits (stale-instance
 * discipline: never dispatch a pre-computed range).
 */
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

/**
 * P1 (AC-ERR-08/AC-RULE-16) 写前闸门（PATH-04-r3 观察②）：整表结构替换
 * dispatch 与 runTableOp/opsTable.runOp 同口径——只读文件下零写入 + 恰一条
 * 冻结 err.readonly（assertWritable 侧发），无成功回执泄漏。同 runTableOp：
 * 同步预览决定是否探闸，写入在闸内重解析（探针可被更早的编辑推迟）。
 */
export function handleTsvPaste(main: EditorView, tsv: string): void {
  if (!getTableEdit(main.state).active) return
  if (!prepareTsvPaste(main, tsv)) return
  whenWritable(() => {
    const prepared = prepareTsvPaste(main, tsv)
    if (!prepared) return
    // P0 (CHANGE-20 同窗扩展): pasteTsvOp 的 nextActive 对 1×1 TSV 恒等于激活格
    // （任意列坐标均可碰撞）——整表 rewrite 的 destroy 端 capture 若不抑制，
    // 旧嵌套文本会经 commitHandoff 微任务覆盖刚粘贴的值并多出一条 input.table.cell
    // 历史（一次 Ctrl+Z 不还原）。整表结构替换 dispatch 与 runTableOp 同款裹入
    // withHandoffSuppressed。
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

// ---- context menu (P27: unified .editor-context-menu) -----------------------

/**
 * Q8 keyboard channel (FE-04): Shift+F10 / Menu key opens the ⋮=right-click
 * same-source menu at the active cell. Returns true when the key was taken
 * (table edit active); false falls through (AC-ERR-12: no global hijack).
 * Keyboard-open marks `via: 'keyboard'` so the first item default-activates
 * (FE-05 菜单键盘通道「首项默认激活」；指针打开静息无预选 — keyboardNav.openActiveIndex).
 */
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
    }),
    // ui_03_table_menu.html: max-height 480px + overflow-y auto (AC-RULE-10).
    maxHeightCap: 480,
    via
  })
}
