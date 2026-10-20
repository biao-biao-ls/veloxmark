import type { EditorView } from '@codemirror/view'
import { formatMarkdown } from '../format'
import { formatTable, parseTableModel, type TableModel } from './parse'
import { modelToGrid } from './ops'
import { getTableEdit, setActiveCell, setColWidth } from './state'

export function tableModelOf(view: EditorView, from: number, to: number): TableModel | null {
  try {
    return parseTableModel(view.state.sliceDoc(from, to), from)
  } catch {
    return null
  }
}

export function tableMarkdown(view: EditorView, from: number, to: number): string | null {
  const model = tableModelOf(view, from, to)
  if (!model) return null
  return formatTable(model.aligns, modelToGrid(model))
}

export function formatTableSourceRange(view: EditorView, from: number, to: number): boolean {
  const src = view.state.sliceDoc(from, to)
  const result = formatMarkdown(src)
  const next = result.text.trimEnd()
  if (!next || next === src.trimEnd()) return false
  view.dispatch({
    changes: { from, to, insert: next },
    userEvent: 'input.contextMenu.formatTableSource'
  })
  return true
}

export function deleteTableRange(view: EditorView, from: number, to: number): void {
  const end = to < view.state.doc.length && view.state.sliceDoc(to, to + 1) === '\n' ? to + 1 : to
  const start = from > 0 && view.state.sliceDoc(from - 1, from) === '\n' ? from - 1 : from
  const widths = getTableEdit(view.state).colWidths.get(from)
  view.dispatch({
    changes: { from: start, to: end, insert: '' },
    selection: { anchor: start },
    effects: [
      setActiveCell.of(null),
      ...(widths?.length ? [setColWidth.of({ tableFrom: from, widths: [...widths] })] : [])
    ],
    userEvent: 'input.contextMenu.deleteTable'
  })
}
