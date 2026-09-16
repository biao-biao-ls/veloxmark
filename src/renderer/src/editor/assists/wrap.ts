import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

/**
 * Wrap the current selection with `mark` (e.g. ** for bold).
 *
 * Enhancements over the original setup.ts version:
 * - empty selection → insert a mark pair with the cursor in the middle
 * - cursor already between a pair of `mark` → remove the pair (toggle off)
 * - selection already wrapped in `mark` → unwrap (toggle off)
 */
export function wrapSelectionWith(view: EditorView, mark: string): boolean {
  const { state } = view
  const changes = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to)

    if (range.empty) {
      const before = state.sliceDoc(range.from - mark.length, range.from)
      const after = state.sliceDoc(range.to, range.to + mark.length)
      if (before === mark && after === mark) {
        // Toggle off: cursor sits between a mark pair — delete both marks.
        return {
          changes: [
            { from: range.from - mark.length, to: range.from },
            { from: range.to, to: range.to + mark.length }
          ],
          range: EditorSelection.cursor(range.from - mark.length)
        }
      }
      const insert = mark + mark
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.cursor(range.from + mark.length)
      }
    }

    const wrapLen = mark.length
    if (
      selected.length >= wrapLen * 2 &&
      selected.startsWith(mark) &&
      selected.endsWith(mark)
    ) {
      // Toggle off: selection already wrapped — strip the marks.
      const inner = selected.slice(wrapLen, selected.length - wrapLen)
      return {
        changes: { from: range.from, to: range.to, insert: inner },
        range: EditorSelection.range(range.from, range.from + inner.length)
      }
    }

    const insert = `${mark}${selected}${mark}`
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(
        range.from + mark.length,
        range.from + mark.length + selected.length
      )
    }
  })
  view.dispatch(changes, { scrollIntoView: true })
  return true
}
