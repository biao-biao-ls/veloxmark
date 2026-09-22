import type { EditorState } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'

/**
 * P10 table-editing state.
 *
 * Which cell is being edited (if any) and session-only column widths. This is
 * ephemeral UI state — it never enters the Markdown document. Markdown stays
 * the single source of truth; everything here only steers decorations/widgets.
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
  /** Session-only column widths (px) keyed by tableFrom. */
  colWidths: Map<number, number[]>
}

export const setActiveCell = StateEffect.define<ActiveCell | null>()
export const setColWidth = StateEffect.define<{ tableFrom: number; widths: number[] }>()

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
      }
    }
    return { active, colWidths }
  }
})

/** Current table-edit state; safe when the field is absent (snapshot tests). */
export function getTableEdit(state: EditorState): TableEditState {
  return state.field(tableEditField, false) ?? { active: null, colWidths: new Map() }
}
