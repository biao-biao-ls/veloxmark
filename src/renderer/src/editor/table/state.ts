import type { EditorState, StateEffect as StateEffectType, Transaction } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { invertedEffects } from '@codemirror/commands'
import { MIN_COL_WIDTH, sanitizeWidths, type ColWidthClamp } from './colWidth'

export interface ActiveCell {
  tableFrom: number
  row: number
  col: number
  caret: number
}

export interface TableEditState {
  active: ActiveCell | null
  editFrom: number | null
  colWidths: Map<number, number[]>
}

export const setActiveCell = StateEffect.define<ActiveCell | null>()
export const enterEditMode = StateEffect.define<number>()
export const setColWidth = StateEffect.define<{ tableFrom: number; widths: number[] }>()
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
        const superseded = new Set<number>()
        for (const e of tr.effects) {
          if (e.is(setColWidth)) superseded.add(e.value.tableFrom)
        }
        const next = new Map<number, number[]>()
        for (const [from, widths] of colWidths) {
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

export function getTableEdit(state: EditorState): TableEditState {
  return state.field(tableEditField, false) ?? { active: null, editFrom: null, colWidths: new Map() }
}

export type ColWidthEffectValue = { tableFrom: number; widths: number[] }

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

export const colWidthHistory = invertedEffects.of(invertColWidths)

export type ActivationEffectValue = ActiveCell | null | number

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

export const activationHistory = invertedEffects.of(invertActivation)

export function tableWrapClamp(view: EditorView, tableFrom: number): ColWidthClamp | undefined {
  const root = view.dom as { querySelector?: (sel: string) => unknown } | undefined
  const el = root?.querySelector?.(`.cm-md-table-wrap[data-table-from="${tableFrom}"]`) as
    | { clientWidth?: number }
    | null
    | undefined
  const w = el?.clientWidth ?? 0
  return w > 0 ? { min: MIN_COL_WIDTH, max: w } : undefined
}

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
