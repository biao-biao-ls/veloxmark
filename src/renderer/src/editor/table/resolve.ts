import { syntaxTree } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { parseTableModel, type TableModel } from './parse'


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
