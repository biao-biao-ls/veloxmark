import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { getEditingAssists } from './config'

/** ≥3 of the same `-`/`*`/`_`, optional spaces between, nothing else on the line. */
const HR_LINE = /^ {0,3}([-*_])( *\1){2,} *$/

/**
 * Enter on a line holding 3+ `-`/`*`/`_` → normalize it to `---` (a
 * thematic break) and move to a new line below.
 *
 * Registered at Prec.highest so it runs before lang-markdown's
 * insertNewlineContinueMarkup.
 */
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
