import type { EditorState } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'

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
  /** Column widths (px) keyed by tableFrom. In-memory projection of
   * SessionState.tableColWidths[current file] (7F persistence); never
   * written into the Markdown document. */
  colWidths: Map<number, number[]>
}

export const setActiveCell = StateEffect.define<ActiveCell | null>()
export const setColWidth = StateEffect.define<{ tableFrom: number; widths: number[] }>()
/** 7F: wholesale-replace colWidths on file open/switch (session restore) —
 * drops the outgoing file's mapPos debris (anti-crosstalk). */
export const restoreColWidths = StateEffect.define<Map<number, number[]>>()

export const tableEditField = StateField.define<TableEditState>({
  create: () => ({ active: null, colWidths: new Map() }),
  update(value, tr) {
    let { active, colWidths } = value
    if (tr.docChanged) {
      if (active) {
        active = { ...active, tableFrom: tr.changes.mapPos(active.tableFrom, 1) }
      }
      if (colWidths.size > 0) {
        const next = new Map<number, number[]>()
        for (const [from, widths] of colWidths) next.set(tr.changes.mapPos(from, 1), widths)
        colWidths = next
      }
    }
    for (const e of tr.effects) {
      if (e.is(setActiveCell)) active = e.value
      else if (e.is(setColWidth)) {
        colWidths = new Map(colWidths)
        colWidths.set(e.value.tableFrom, e.value.widths)
      } else if (e.is(restoreColWidths)) {
        colWidths = e.value
      }
    }
    return { active, colWidths }
  }
})

/** Current table-edit state; safe when the field is absent (snapshot tests). */
export function getTableEdit(state: EditorState): TableEditState {
  return state.field(tableEditField, false) ?? { active: null, colWidths: new Map() }
}
