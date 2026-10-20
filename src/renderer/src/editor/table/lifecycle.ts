
import type { EditorState, Transaction } from '@codemirror/state'
import { Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { enterEditMode, getTableEdit, setActiveCell, setColWidth } from './state'
import { activeNestedView, resolveWithFallback, exitTableEdit } from './widget'


export function selectionOutsideTable(
  state: EditorState,
  tableFrom: number,
  tableTo: number
): boolean {
  const sel = state.selection
  for (const r of sel.ranges) {
    if (r.to >= tableFrom && r.from <= tableTo) return false
  }
  return true
}

export function resolveExitAnchor(
  docLen: number,
  tableFrom: number,
  tableTo: number
): number {
  if (tableTo < docLen) return tableTo + 1
  return Math.max(0, tableFrom - 1)
}

export function ownOp(transactions: readonly Transaction[]): boolean {
  return transactions.some((tr) =>
    tr.effects.some(
      (e) => e.is(setActiveCell) || e.is(setColWidth) || e.is(enterEditMode)
    )
  )
}


export const tableEditLifecycle = [
  EditorView.updateListener.of((update) => {
    const edit = getTableEdit(update.state)
    if (!edit.active) return
    if (update.view.hasFocus) return
    const nested = activeNestedView()
    if (!nested || nested.hasFocus) return
    nested.focus()
  }),

  EditorView.updateListener.of((update) => {
    const edit = getTableEdit(update.state)
    const sessionFrom = edit.active?.tableFrom ?? edit.editFrom
    if (sessionFrom == null) return

    if (ownOp(update.transactions)) return

    const hasSelectionChange = update.transactions.some(
      (tr) => tr.selection != null
    )
    if (!hasSelectionChange) return

    const resolved = resolveWithFallback(update.view, sessionFrom, sessionFrom)

    if (!resolved) {
      exitTableEdit(update.view, { select: 'none' })
      return
    }

    if (
      selectionOutsideTable(
        update.state,
        resolved.lineFrom,
        resolved.model.tableTo
      )
    ) {
      exitTableEdit(update.view, { select: 'none' })
    }
  }),

  Prec.high(
    keymap.of([
      {
        key: 'Escape',
        run: (view): boolean => {
          const edit = getTableEdit(view.state)
          if (edit.active == null && edit.editFrom == null) return false
          exitTableEdit(view, { select: 'after' })
          return true
        }
      }
    ])
  )
]