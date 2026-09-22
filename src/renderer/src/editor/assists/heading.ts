import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { getEditingAssists } from './config'

/**
 * Typing `#` at the start of an ATX heading (level < 6) upgrades it by
 * inserting one more `#`. Plain `#` + space insertion (making a new
 * heading) is plain typing + the parser, no handler needed.
 */
export function upgradeHeading(view: EditorView): boolean {
  const { state } = view
  if (!getEditingAssists(state).enabled) return false
  let handled = false
  const changes = state.changeByRange((range) => {
    if (!range.empty || range.from !== state.doc.lineAt(range.from).from) return { range }
    const line = state.doc.lineAt(range.from)
    if (!/^(#{1,5}) /.test(line.text)) return { range }
    handled = true
    return {
      changes: { from: line.from, insert: '#' },
      range: EditorSelection.cursor(range.from + 1)
    }
  })
  if (!handled) return false
  view.dispatch(state.update(changes, { scrollIntoView: true, userEvent: 'input' }))
  return true
}
