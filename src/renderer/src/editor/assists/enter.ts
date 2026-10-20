import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { getEditingAssists } from './config'

const HR_LINE = /^ {0,3}([-*_])( *\1){2,} *$/

export function insertHorizontalRule(view: EditorView): boolean {
  const { state } = view
  if (!getEditingAssists(state).enabled) return false
  let handled = false
  const changes = state.changeByRange((range) => {
    if (!range.empty) return { range }
    const line = state.doc.lineAt(range.from)
    const before = line.text.slice(0, range.from - line.from)
    const after = line.text.slice(range.from - line.from)
    if (!HR_LINE.test(before) || /\S/.test(after)) return { range }
    handled = true
    return {
      changes: { from: line.from, to: range.from, insert: '---' + state.lineBreak },
      range: EditorSelection.cursor(line.from + 4)
    }
  })
  if (!handled) return false
  view.dispatch(state.update(changes, { scrollIntoView: true, userEvent: 'input' }))
  return true
}

const EMPTY_LIST_ITEM = /^(\s*)(?:[-*+]|\d+[.)])(\s+)$/

export function exitEmptyListItem(view: EditorView): boolean {
  const { state } = view
  if (!getEditingAssists(state).enabled) return false
  let handled = false
  const changes = state.changeByRange((range) => {
    if (!range.empty) return { range }
    const line = state.doc.lineAt(range.from)
    const m = EMPTY_LIST_ITEM.exec(line.text)
    if (!m) return { range }
    const after = line.text.slice(range.from - line.from)
    if (/\S/.test(after)) return { range }
    handled = true
    const indent = m[1]
    return {
      changes: { from: line.from, to: line.to, insert: indent },
      range: EditorSelection.cursor(line.from + indent.length)
    }
  })
  if (!handled) return false
  view.dispatch(state.update(changes, { scrollIntoView: true, userEvent: 'input' }))
  return true
}
