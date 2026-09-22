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
    const stripped = selected.slice(wrapLen, selected.length - wrapLen)
    if (
      selected.length >= wrapLen * 2 &&
      selected.startsWith(mark) &&
      selected.endsWith(mark) &&
      stripped.trim().length > 0
    ) {
      // Toggle off: selection already wrapped — strip the marks.
      return {
        changes: { from: range.from, to: range.to, insert: stripped },
        range: EditorSelection.range(range.from, range.from + stripped.length)
      }
    }

    // UX-P01: hoist leading/trailing whitespace outside the marks — wrapping
    // "boldme " must yield `**boldme** ` (Typora parity), never `**boldme **`.
    const lead = /^\s*/.exec(selected)?.[0] ?? ''
    const trail = /\s*$/.exec(selected)?.[0] ?? ''
    const core = selected.slice(lead.length, selected.length - trail.length)
    if (core.length === 0) {
      // Whitespace-only selection — degrade to an empty pair at the cursor.
      const insert = mark + mark
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.cursor(range.from + lead.length + mark.length)
      }
    }
    const insert = `${lead}${mark}${core}${mark}${trail}`
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(
        range.from + lead.length + mark.length,
        range.from + lead.length + mark.length + core.length
      )
    }
  })
  view.dispatch(changes, { scrollIntoView: true })
  return true
}
