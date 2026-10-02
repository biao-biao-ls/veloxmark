import type { EditorState, StateEffect as StateEffectType, Transaction } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { invertedEffects } from '@codemirror/commands'
import { MIN_COL_WIDTH, sanitizeWidths, type ColWidthClamp } from './colWidth'

/**
 * P10 table-editing state.
 *
 * Which cell is being edited (if any) and UI column widths. This is ephemeral
 * UI state — it never enters the Markdown document (widths persist via
 * SessionState.tableColWidths, 7F). Markdown stays the single source of truth;
 * everything here only steers decorations/widgets.
 */
export interface ActiveCell {
  /** Table identity: doc offset of the table's first source line (mapped through changes). */
  tableFrom: number
  /** UI row: 0 = header, 1..n = body (delimiter row excluded). */
  row: number
  col: number
  /** Caret offset (in cell-source chars) to restore when the cell editor mounts. */
  caret: number
}

export interface TableEditState {
  active: ActiveCell | null
  /** AC-FN-29 edit form: the table (doc offset of its first source line) whose
   * edit chrome (toolbar/grips) is on — may hold with `active: null` (graded
   * step-back / AC-FN-03 miss path). Activation implies a session; only the
   * full-exit effect (`setActiveCell.of(null)`) clears both. Null = quiet. */
  editFrom: number | null
  /** Column widths (px) keyed by tableFrom. In-memory projection of
   * SessionState.tableColWidths[current file] (7F persistence); never
   * written into the Markdown document. */
  colWidths: Map<number, number[]>
}

export const setActiveCell = StateEffect.define<ActiveCell | null>()
/** AC-FN-29 graded step-back / AC-FN-03 miss path: land the table on its edit
 * form WITHOUT an active cell (clears `active`, keeps the chrome session). */
export const enterEditMode = StateEffect.define<number>()
export const setColWidth = StateEffect.define<{ tableFrom: number; widths: number[] }>()
/** 7F: wholesale-replace colWidths on file open/switch (session restore) —
 * drops the outgoing file's mapPos debris (anti-crosstalk). */
export const restoreColWidths = StateEffect.define<Map<number, number[]>>()

export const tableEditField = StateField.define<TableEditState>({
  create: () => ({ active: null, editFrom: null, colWidths: new Map() }),
  update(value, tr) {
    let { active, editFrom, colWidths } = value
    if (tr.docChanged) {
      if (active) {
        active = { ...active, tableFrom: tr.changes.mapPos(active.tableFrom, 1) }
      }
      if (editFrom != null) {
        editFrom = tr.changes.mapPos(editFrom, 1)
      }
      if (colWidths.size > 0) {
        // Keys this same transaction's setColWidth re-establishes are NOT
        // mapped (收口批 #3): their mapPos residue is debris — delete-table
        // leaves it at the deletion point (delete/redo) or slides it to the
        // reinserted segment's end (undo, assoc=1), where a future table's
        // tableFrom can inherit dirty widths. The effect writes the canonical
        // entry (also the invertColWidths/redo symmetry snapshot).
        const superseded = new Set<number>()
        for (const e of tr.effects) {
          if (e.is(setColWidth)) superseded.add(e.value.tableFrom)
        }
        const next = new Map<number, number[]>()
        for (const [from, widths] of colWidths) {
          // Drop out-of-range keys (delete-table snapshot carriers, stale
          // session offsets): mapPos throws past the doc end — a debris key
          // must never brick the next edit.
          if (from > tr.startState.doc.length) continue
          if (superseded.has(from)) continue
          next.set(tr.changes.mapPos(from, 1), widths)
        }
        colWidths = next
      }
    }
    for (const e of tr.effects) {
      if (e.is(setActiveCell)) {
        active = e.value
        // Activation implies the edit session; null = full exit (both die).
        editFrom = e.value?.tableFrom ?? null
      } else if (e.is(enterEditMode)) {
        active = null
        editFrom = e.value
      } else if (e.is(setColWidth)) {
        colWidths = new Map(colWidths)
        colWidths.set(e.value.tableFrom, e.value.widths)
      } else if (e.is(restoreColWidths)) {
        colWidths = e.value
      }
    }
    return { active, editFrom, colWidths }
  }
})

/** Current table-edit state; safe when the field is absent (snapshot tests). */
export function getTableEdit(state: EditorState): TableEditState {
  return state.field(tableEditField, false) ?? { active: null, editFrom: null, colWidths: new Map() }
}

export type ColWidthEffectValue = { tableFrom: number; widths: number[] }

/**
 * FE-06 (AC-OP-11 Then3): width drags are effect-only transactions — CM6's
 * history drops those unless `invertedEffects` supplies an inverse. Return the
 * pre-transaction widths for every `setColWidth` in `tr` so one Ctrl+Z restores
 * them (undo AND redo stay symmetric: history re-runs this on the undo tr).
 * `restoreColWidths` is deliberately NOT inverted — session restore must never
 * enter the undo stack.
 */
export function invertColWidths(
  tr: Transaction
): StateEffectType<ColWidthEffectValue>[] {
  const out: StateEffectType<ColWidthEffectValue>[] = []
  for (const e of tr.effects) {
    if (e.is(setColWidth)) {
      const prev = getTableEdit(tr.startState).colWidths.get(e.value.tableFrom) ?? []
      out.push(setColWidth.of({ tableFrom: e.value.tableFrom, widths: [...prev] }))
    }
  }
  return out
}

/** Register with `history()` in setup.ts — see invertColWidths. */
export const colWidthHistory = invertedEffects.of(invertColWidths)

export type ActivationEffectValue = ActiveCell | null | number

/**
 * FE-07 P1 (AC-OP-12 判据3 / AC-ERR-04 判据1): table structure ops ride ONE
 * doc-changing transaction with a `setActiveCell`/`enterEditMode` effect. CM6
 * history inverts the doc changes but not these UI effects, so undo restored
 * the table yet left the op's `nextActive` hanging (align jumped to the header
 * row, insert/move landed on the new cell). Return the pre-transaction
 * activation snapshot so one Ctrl+Z — from ANY of the three undo entries
 * (keymap / edit menu / toast button) — re-anchors the active cell and the next
 * keystroke reaches the content.
 *
 * Only doc-changing transactions are inverted: effect-only activations (cell
 * clicks, full exit) must NOT re-enter the undo stack — a click is not an
 * undoable step. `restoreColWidths`-style session restores carry no activation
 * effect and stay untouched. Undo/redo stay symmetric because history re-runs
 * this on the undo transaction (same as invertColWidths).
 */
export function invertActivation(
  tr: Transaction
): StateEffectType<ActivationEffectValue>[] {
  if (!tr.docChanged) return []
  const touched = tr.effects.some((e) => e.is(setActiveCell) || e.is(enterEditMode))
  if (!touched) return []
  const prev = getTableEdit(tr.startState)
  if (prev.active) return [setActiveCell.of({ ...prev.active })]
  if (prev.editFrom != null) return [enterEditMode.of(prev.editFrom)]
  return [setActiveCell.of(null)]
}

/** Register with `history()` in setup.ts — see invertActivation. */
export const activationHistory = invertedEffects.of(invertActivation)

/**
 * AC-ERR-03 drag-clamp parity (扩展-3): the max source for width sanitizing is
 * the table wrap's clientWidth — the same content-column box the col-grip drag
 * clamps to (widget.ts). Degrades to undefined (min floor only) when the wrap
 * isn't measurable (headless tests / detached view) — same fallback the drag
 * path takes for `contentW`. Lives here so commands/runTableOp and
 * contextMenu/opsTable/runOp share one seam without a registry↔commands cycle.
 */
export function tableWrapClamp(view: EditorView, tableFrom: number): ColWidthClamp | undefined {
  const root = view.dom as { querySelector?: (sel: string) => unknown } | undefined
  const el = root?.querySelector?.(`.cm-md-table-wrap[data-table-from="${tableFrom}"]`) as
    | { clientWidth?: number }
    | null
    | undefined
  const w = el?.clientWidth ?? 0
  return w > 0 ? { min: MIN_COL_WIDTH, max: w } : undefined
}

/**
 * FE-06 / AC-ERR-03: remap this table's stored widths for a column-structure
 * op and return the setColWidth effect to ride in the SAME transaction as the
 * doc replace (one Ctrl+Z then reverts structure AND widths together). Lives
 * here (not table/commands) so contextMenu/opsTable can share it without
 * adding a registry↔commands import cycle. Returns null when the table has no
 * width state — untouched tables stay untouched.
 *
 * `clamp` (AC-ERR-03 判据1「失效/超界列宽重置为默认列宽」) comes from
 * `tableWrapClamp` at the call sites — pass it so over-max widths reset to 0
 * on structure ops exactly like the drag path; omitted = min floor only.
 */
export function colWidthRemapEffect(
  state: EditorState,
  tableFrom: number,
  nextColCount: number,
  widthsRemap: (prev: readonly number[]) => readonly number[],
  clamp?: ColWidthClamp
): StateEffectType<ColWidthEffectValue> | null {
  const prev = getTableEdit(state).colWidths.get(tableFrom)
  if (!prev?.length) return null
  return setColWidth.of({
    tableFrom,
    widths: sanitizeWidths(widthsRemap(prev), nextColCount, clamp)
  })
}
