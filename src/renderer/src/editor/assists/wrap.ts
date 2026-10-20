import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

export function wrapSelectionWith(view: EditorView, mark: string): boolean {
  const { state } = view
  const changes = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to)

    if (range.empty) {
      const before = state.sliceDoc(range.from - mark.length, range.from)
      const after = state.sliceDoc(range.to, range.to + mark.length)
      if (before === mark && after === mark) {
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
      return {
        changes: { from: range.from, to: range.to, insert: stripped },
        range: EditorSelection.range(range.from, range.from + stripped.length)
      }
    }

    const lead = /^\s*/.exec(selected)?.[0] ?? ''
    const trail = /\s*$/.exec(selected)?.[0] ?? ''
    const core = selected.slice(lead.length, selected.length - trail.length)
    if (core.length === 0) {
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
