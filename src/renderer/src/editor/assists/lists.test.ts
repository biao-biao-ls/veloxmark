import { describe, expect, it } from 'vitest'
import { EditorState, type ChangeSpec } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { collectRenumberChanges, computeIndentChanges } from './lists'

function stateOf(doc: string, head = 0): EditorState {
  const state = EditorState.create({
    doc,
    selection: { anchor: head },
    extensions: [markdown()]
  })
  ensureSyntaxTree(state, doc.length, 50000)
  return state
}

function applyChanges(doc: string, changes: ChangeSpec[]): string {
  return EditorState.create({ doc }).update({ changes }).state.doc.toString()
}

describe('collectRenumberChanges', () => {
  it('makes a gappy ordered list consecutive', () => {
    const doc = '3. one\n7. two\n1. three\n'
    const state = stateOf(doc, 0)
    const changes = collectRenumberChanges(state, 0, doc.length)
    expect(applyChanges(doc, changes)).toBe('3. one\n4. two\n5. three\n')
  })

  it('renumbers multiple ordered lists independently', () => {
    // A paragraph between the lists keeps the parser honest: two OrderedList
    // nodes, each renumbered from its own first item. (Two lists separated by
    // only a blank line parse as one loose list — renumbering then continues
    // across the gap, which matches the lezer tree the product walks.)
    const doc = '1. a\n5. b\n\npara\n\n10. x\n11. y\n'
    const state = stateOf(doc, 0)
    const changes = collectRenumberChanges(state, 0, doc.length)
    expect(applyChanges(doc, changes)).toBe('1. a\n2. b\n\npara\n\n10. x\n11. y\n')
  })

  it('leaves already-consecutive lists untouched', () => {
    const doc = '1. a\n2. b\n3. c\n'
    const state = stateOf(doc, 0)
    expect(collectRenumberChanges(state, 0, doc.length)).toEqual([])
  })

  it('ignores unordered lists', () => {
    const doc = '- a\n- b\n'
    const state = stateOf(doc, 0)
    expect(collectRenumberChanges(state, 0, doc.length)).toEqual([])
  })
})

describe('computeIndentChanges', () => {
  it('indents the list item under the cursor (and its subtree lines)', () => {
    const doc = '- item one\n- item two\n'
    // Cursor on the second item.
    const state = stateOf(doc, doc.indexOf('item two'))
    const plan = computeIndentChanges(state, 1)
    expect(plan).not.toBeNull()
    expect(applyChanges(doc, plan!.changes)).toBe('- item one\n  - item two\n')
  })

  it('indents nested lines belonging to the item subtree', () => {
    const doc = '- parent\n  - child\n- sibling\n'
    const state = stateOf(doc, doc.indexOf('parent'))
    const plan = computeIndentChanges(state, 1)
    expect(applyChanges(doc, plan!.changes)).toBe('  - parent\n    - child\n- sibling\n')
  })

  it('dedents an indented item by one unit', () => {
    const doc = '- outer\n  - inner\n'
    const state = stateOf(doc, doc.indexOf('inner'))
    const plan = computeIndentChanges(state, -1)
    expect(applyChanges(doc, plan!.changes)).toBe('- outer\n- inner\n')
  })

  it('returns null when dedent is illegal (marker at column 0)', () => {
    const doc = '- top level\n'
    const state = stateOf(doc, 3)
    expect(computeIndentChanges(state, -1)).toBeNull()
  })

  it('returns null when the cursor is not in a list item', () => {
    const state = stateOf('plain paragraph text\n', 5)
    expect(computeIndentChanges(state, 1)).toBeNull()
  })
})
