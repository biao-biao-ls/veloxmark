/**
 * Table model re-resolution (task 3.8) — bodies moved verbatim from
 * table/widget.ts.
 *
 * Stale-instance discipline (P05 ImageWidget precedent): widget instances are
 * recreated on every decoration rebuild and event closures must NOT capture
 * cell offsets. Every handler re-resolves the table model from `view.state`
 * at event time (resolveTableModel), anchored on `tableFrom` which the
 * tableEditField maps through doc changes.
 *
 * Non-verbatim point (visibility only): `resolveTableModel` is exported for
 * tableTestHook (was module-private alongside its only other caller).
 */
import { syntaxTree } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { parseTableModel, type TableModel } from './parse'

// ---- model re-resolution -----------------------------------------------------

/** Resolve the Table syntax node covering `approxFrom` and re-parse its source. */
export function resolveTableModel(
  view: EditorView,
  approxFrom: number
): { model: TableModel; lineFrom: number } | null {
  const state = view.state
  const tree = syntaxTree(state)
  let node: SyntaxNode | null = tree.resolveInner(approxFrom, 1)
  while (node && node.name !== 'Table') node = node.parent
  if (!node || node.name !== 'Table') {
    let b: SyntaxNode | null = tree.topNode.firstChild
    while (b) {
      if (b.name === 'Table' && b.from <= approxFrom + 4 && approxFrom <= b.to + 4) {
        node = b
        break
      }
      b = b.nextSibling
    }
  }
  if (!node || node.name !== 'Table') return null
  const lineFrom = state.doc.lineAt(node.from).from
  const lineTo = state.doc.lineAt(node.to).to
  return { model: parseTableModel(state.sliceDoc(lineFrom, lineTo), lineFrom), lineFrom }
}

/**
 * Resolve with fallbacks: the active cell's mapped tableFrom first, then the
 * widget-supplied hint (fresh even when the mapped anchor drifted through a
 * large doc replacement, e.g. a test setDoc that swaps the whole document).
 */
export function resolveWithFallback(
  view: EditorView,
  activeFrom: number | null | undefined,
  hintFrom: number
): { model: TableModel; lineFrom: number } | null {
  if (activeFrom != null) {
    const r = resolveTableModel(view, activeFrom)
    if (r) return r
  }
  return resolveTableModel(view, hintFrom)
}
