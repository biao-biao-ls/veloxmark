/**
 * UX-P28: table cell focus lifecycle — blur auto-exit + Escape exit.
 *
 * This module provides:
 * 1. Pure helpers for range/selection tests (unit-testable without DOM).
 * 2. A CM6 extension (updateListener + Escape keymap) that auto-commits and
 *    exits cell editing when the main editor selection leaves the active table,
 *    and provides an Escape key in the main editor to exit stale table edit.
 *
 * DESIGN: wired into setup.ts createExtensions array NEXT TO tableEditField.
 * Does NOT touch EditorCallbacks or App.tsx.
 */

import type { EditorState, Transaction } from '@codemirror/state'
import { Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { getTableEdit, setActiveCell } from './state'
import { activeNestedView, resolveWithFallback, exitTableEdit } from './widget'

// ---- Pure helpers (exported for unit tests) ---------------------------------

/**
 * Is every selection range endpoint strictly outside the table's inclusive
 * range [tableFrom, tableTo]? blockTouched is inclusive on both ends
 * (build.ts:60-61), so we mirror that: selection at tableFrom or tableTo is
 * "inside" the table.
 */
export function selectionOutsideTable(
  state: EditorState,
  tableFrom: number,
  tableTo: number
): boolean {
  const sel = state.selection
  for (const r of sel.ranges) {
    // If any part of the range overlaps [tableFrom, tableTo], it's inside.
    if (r.to >= tableFrom && r.from <= tableTo) return false
  }
  return true
}

/**
 * Compute the exit anchor for Escape — a position adjacent to (but strictly
 * outside) the table's range [tableFrom, tableTo]. blockTouched is inclusive
 * (build.ts:60-61), so the anchor must be outside to avoid the enterTable
 * hatch suppressing the widget.
 *
 * Prefer tableTo + 1 (right after the table); fall back to lineFrom - 1
 * (before the table) when tableTo is at the end of the document.
 */
export function resolveExitAnchor(
  docLen: number,
  tableFrom: number,
  tableTo: number
): number {
  if (tableTo < docLen) return tableTo + 1
  return Math.max(0, tableFrom - 1)
}

/**
 * Does any transaction in the update carry a setActiveCell or setColWidth
 * effect? These are "own ops" — widget-internal dispatches that should not
 * trigger the auto-exit listener.
 */
export function ownOp(transactions: readonly Transaction[]): boolean {
  return transactions.some((tr) =>
    tr.effects.some((e) => e.is(setActiveCell) || e.is(setColWidth))
  )
}

// We need setColWidth for the ownOp guard — import it.
import { setColWidth } from './state'

// ---- Extension --------------------------------------------------------------

/**
 * The table edit lifecycle extension: a selection-aware auto-exit listener
 * and a Prec.high Escape keymap for stale-chrome keyboard exit.
 *
 * The listener fires ONLY when:
 * 1. There IS an active table cell (getTableEdit.state.active != null).
 * 2. The update is NOT an own-op (no setActiveCell/setColWidth effects).
 * 3. At least one transaction carries a selection change (tr.selection != null).
 * 4. All selection ranges are strictly outside [tableFrom, tableTo], OR the
 *    table has been deleted (docChanged + model unresolvable).
 *
 * The Escape keymap fires when the main editor has focus and a table cell
 * is active — it commits pending, places cursor adjacent to the table, and
 * clears active state.
 */
export const tableEditLifecycle = [
  // --- Listener: self-heal cell focus (diag-P28 / F1 backstop) ---
  // After every main-view update, if a cell is active but its nested editor
  // lost (or never received) DOM focus — and the main editor isn't holding
  // focus either — deliver focus to the nested view. updateListener runs
  // AFTER DOM sync, so the widget DOM is connected by now (unlike focus()
  // inside toDOM). Guarded by view.hasFocus so click-prose / click-elsewhere
  // never gets its focus stolen back mid-interaction.
  EditorView.updateListener.of((update) => {
    const edit = getTableEdit(update.state)
    if (!edit.active) return
    if (update.view.hasFocus) return
    const nested = activeNestedView()
    if (!nested || nested.hasFocus) return
    nested.focus()
  }),

  // --- Listener: auto-exit on selection-leave ---
  EditorView.updateListener.of((update) => {
    const edit = getTableEdit(update.state)
    if (!edit.active) return

    // Guard: own ops (widget dispatches) must not trigger auto-exit.
    if (ownOp(update.transactions)) return

    // Guard: only react when at least one transaction changed selection.
    // This excludes pure docChanged transactions (e.g. commitActiveOnly
    // in clearTableEditAndFocusSource before the merge) that don't move
    // the cursor — those should not trigger exit.
    const hasSelectionChange = update.transactions.some(
      (tr) => tr.selection != null
    )
    if (!hasSelectionChange) return

    // Resolve the table range.
    const resolved = resolveWithFallback(
      update.view,
      edit.active.tableFrom,
      edit.active.tableFrom
    )

    // Table gone (docChanged deleted it) → exit.
    if (!resolved) {
      exitTableEdit(update.view, { select: 'none' })
      return
    }

    // All selection ranges strictly outside → exit.
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

  // --- Escape keymap: main-editor Escape for stale-chrome / B2 fix ---
  Prec.high(
    keymap.of([
      {
        key: 'Escape',
        run: (view): boolean => {
          const edit = getTableEdit(view.state)
          if (!edit.active) return false
          // exitTableEdit handles commit + clear + cursor placement in one path.
          exitTableEdit(view, { select: 'after' })
          return true
        }
      }
    ])
  )
]