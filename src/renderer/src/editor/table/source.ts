/**
 * Table source-range helpers (task 4.3 = 2.17: moved verbatim from
 * contextMenu/transforms.ts — table-domain ops parked in the table module).
 * Sole consumer: contextMenu/opsTable.ts (复制表格 / 格式化表格源 / 删除表格).
 */
import type { EditorView } from '@codemirror/view'
import { formatMarkdown } from '../format'
import { formatTable, parseTableModel, type TableModel } from './parse'
import { modelToGrid } from './ops'
import { setActiveCell } from './state'

export function tableModelOf(view: EditorView, from: number, to: number): TableModel | null {
  try {
    return parseTableModel(view.state.sliceDoc(from, to), from)
  } catch {
    return null
  }
}

/** Aligned markdown source of the whole table (复制表格). */
export function tableMarkdown(view: EditorView, from: number, to: number): string | null {
  const model = tableModelOf(view, from, to)
  if (!model) return null
  return formatTable(model.aligns, modelToGrid(model))
}

/** P23 formatter applied to the table source range only; true if changed. */
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
  // Absorb one trailing newline so the blank line doesn't pile up.
  const end = to < view.state.doc.length && view.state.sliceDoc(to, to + 1) === '\n' ? to + 1 : to
  const start = from > 0 && view.state.sliceDoc(from - 1, from) === '\n' ? from - 1 : from
  // UX-P28: explicitly clear active cell when deleting the table — prevents
  // dangling active pointing at a nonexistent table (lifecycle is a safety net
  // but explicit clear is cleaner and avoids one update where enterTable sees
  // a bogus isActive).
  view.dispatch({
    changes: { from: start, to: end, insert: '' },
    selection: { anchor: start },
    effects: setActiveCell.of(null),
    userEvent: 'input.contextMenu.deleteTable'
  })
}
