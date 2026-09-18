import { ensureSyntaxTree, indentUnit, syntaxTree } from '@codemirror/language'
import { EditorSelection, type ChangeSpec, type EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { getEditingAssists } from './config'

/**
 * Tab / Shift+Tab: indent/dedent the list item under the cursor as a whole
 * (including its subtree), then renumber any ordered lists that intersect
 * the changed region.
 */

function listItemAt(state: EditorState, pos: number): SyntaxNode | null {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1)
  while (node) {
    if (node.name === 'ListItem') return node
    if (node.name === 'FencedCode' || node.name === 'CodeBlock') return null
    node = node.parent
  }
  return null
}

/** The line range covering an item and its subtree (node.to may sit at the start of the next line). */
function itemLineRange(state: EditorState, item: SyntaxNode): { first: number; last: number } {
  const first = state.doc.lineAt(item.from).number
  let endPos = item.to
  if (endPos > item.from && state.doc.lineAt(endPos).from === endPos) endPos--
  const last = state.doc.lineAt(Math.max(endPos, item.from)).number
  return { first, last }
}

/** How many leading characters of `lead` to remove for one dedent step. */
function dedentLen(lead: string, unit: string): number {
  if (unit === '\t') return lead.startsWith('\t') ? 1 : 0
  let n = 0
  while (n < unit.length && n < lead.length && lead[n] === ' ') n++
  return n
}

export function indentListItem(view: EditorView, dir: 1 | -1): boolean {
  const { state } = view
  if (!getEditingAssists(state).enabled) return false
  const plan = computeIndentChanges(state, dir)
  if (!plan) return false

  const tr = state.update({ changes: plan.changes, scrollIntoView: true })
  view.dispatch(tr)
  renumberOrderedLists(view, tr.changes.mapPos(plan.from), tr.changes.mapPos(plan.to, 1))
  return true
}

/**
 * P15: pure planning step of indentListItem — computes the change set for an
 * indent/dedent of the list item(s) under the selection without touching a
 * view. Returns null when the operation is a no-op or illegal (e.g. dedent
 * attempted on an unindented item marker line). Unit-tested headlessly.
 */
export function computeIndentChanges(
  state: EditorState,
  dir: 1 | -1
): { changes: ChangeSpec[]; from: number; to: number } | null {
  const unit = state.facet(indentUnit)

  const items: SyntaxNode[] = []
  for (const range of state.selection.ranges) {
    const item = listItemAt(state, range.from)
    if (!item) return null
    if (!items.some((i) => i.from === item.from && i.to === item.to)) items.push(item)
  }
  if (!items.length) return null

  const changes: ChangeSpec[] = []
  const seenLines = new Set<number>()
  let minFrom = Infinity
  let maxTo = -Infinity

  for (const item of items) {
    const { first, last } = itemLineRange(state, item)
    for (let n = first; n <= last; n++) {
      if (seenLines.has(n)) continue
      seenLines.add(n)
      const line = state.doc.line(n)
      if (dir === 1) {
        changes.push({ from: line.from, insert: unit })
      } else {
        const lead = /^[\t ]*/.exec(line.text)![0]
        // The item's own marker line must be indented to dedent at all.
        if (n === first && !dedentLen(lead, unit)) return null
        const remove = dedentLen(lead, unit)
        if (remove) changes.push({ from: line.from, to: line.from + remove })
      }
      minFrom = Math.min(minFrom, line.from)
      maxTo = Math.max(maxTo, line.to)
    }
  }
  if (!changes.length) return null
  return { changes, from: minFrom, to: maxTo }
}

/**
 * Renumber every ordered list intersecting [from, to]: the first item keeps
 * its start number, the rest are made consecutive.
 */
function renumberOrderedLists(view: EditorView, from: number, to: number): void {
  const changes = collectRenumberChanges(view.state, from, to)
  if (changes.length) view.dispatch({ changes })
}

/**
 * P15: pure renumber planner (renumberOrderedLists without the dispatch).
 * Exported for unit tests — given a state and a doc range, returns the
 * digit-replacement changes that make ordered-list numbering consecutive.
 */
export function collectRenumberChanges(state: EditorState, from: number, to: number): ChangeSpec[] {
  const tree = ensureSyntaxTree(state, to, 5000) ?? syntaxTree(state)
  const changes: { from: number; to: number; insert: string }[] = []
  tree.iterate({
    from,
    to,
    enter: (ref) => {
      if (ref.name !== 'OrderedList') return
      let expected: number | null = null
      for (let item = ref.node.firstChild; item; item = item.nextSibling) {
        if (item.name !== 'ListItem') continue
        const line = state.doc.lineAt(item.from)
        const m = /^(\s*)(\d+)(?=[.)])/.exec(line.text.slice(item.from - line.from))
        if (!m) continue
        const numFrom = item.from + m[1].length
        const numTo = numFrom + m[2].length
        if (expected == null) expected = +m[2]
        if (+m[2] !== expected)
          changes.push({ from: numFrom, to: numTo, insert: String(expected) })
        expected++
      }
    }
  })
  return changes
}
