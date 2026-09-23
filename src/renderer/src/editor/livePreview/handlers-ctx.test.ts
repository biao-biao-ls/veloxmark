import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { listDepth, orderedListIndex } from './handlers-ctx'

/** Collect (index, depth) for every ordered ListMark in document order. */
function orderedMarks(doc: string): Array<{ index: number; depth: number }> {
  const state = EditorState.create({ doc, extensions: [markdown()] })
  ensureSyntaxTree(state, doc.length, 50000)
  const out: Array<{ index: number; depth: number }> = []
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'ListMark') return
      const text = state.sliceDoc(node.from, node.to)
      if (!/^\d/.test(text)) return
      out.push({ index: orderedListIndex(node), depth: listDepth(node) })
    }
  })
  return out
}

describe('orderedListIndex (5A)', () => {
  it('numbers a flat ordered list 1..n', () => {
    expect(orderedMarks('1. a\n1. b\n1. c\n').map((m) => m.index)).toEqual([1, 2, 3])
  })

  it('renumbers nested lists within their own parent', () => {
    // Document order: outer 1, inner 1, inner 2, outer 2.
    expect(orderedMarks('1. a\n   1. x\n   1. y\n1. b\n')).toEqual([
      { index: 1, depth: 1 },
      { index: 1, depth: 2 },
      { index: 2, depth: 2 },
      { index: 2, depth: 1 }
    ])
  })

  it('skips blank lines inside loose lists', () => {
    expect(orderedMarks('1. a\n\n1. b\n').map((m) => m.index)).toEqual([1, 2])
  })

  it('is not disturbed by interleaved unordered children', () => {
    // The inner `- x` is an unordered ListMark (filtered out); outer keeps 1, 2.
    expect(orderedMarks('1. a\n   - x\n1. b\n').map((m) => m.index)).toEqual([1, 2])
  })
})
