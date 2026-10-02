/**
 * IT-03 FE-06 收口批 #4 — multi-line task done strike (ren-task:check).
 *
 * A completed multi-line task item must strike every own-content line
 * (trimmed), not just the marker line's text; nested child lists keep their
 * own rows (a child's state rides its own TaskMarker). DOM-less — only the
 * decoration specs produced by the tree pass are asserted (constitution).
 */
import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { GFM } from '@lezer/markdown'
import { Decoration } from '@codemirror/view'
import { buildDecorations } from './build'
import { DEFAULT_LIVE_PREVIEW_CONFIG } from './config'

interface MarkHit {
  from: number
  to: number
  className: string | undefined
}

function build(doc: string, selection: number) {
  const state = EditorState.create({
    doc,
    selection: { anchor: selection },
    // GFM mirrors editor/setup.ts — without it no TaskMarker node exists.
    extensions: [markdown({ extensions: [GFM] })]
  })
  ensureSyntaxTree(state, doc.length, 50000)
  const set = buildDecorations(state, DEFAULT_LIVE_PREVIEW_CONFIG)
  const hits: MarkHit[] = []
  set.between(0, state.doc.length, (from, to, value) => {
    const spec = (value as Decoration).spec as { class?: string }
    hits.push({ from, to, className: spec.class })
  })
  return { state, hits }
}

/** Trimmed text spans carrying the done strike. */
function doneSpans(doc: string, hits: MarkHit[]): { text: string }[] {
  return hits
    .filter((h) => h.className === 'cm-md-task-done')
    .map((h) => ({ text: doc.slice(h.from, h.to) }))
}

describe('enterTaskMarker: multi-line done strike (FE-06 review #3)', () => {
  it('strikes the marker line tail and every continuation line (trimmed)', () => {
    const doc = '- [x] first line\n  continued here\n\nend\n'
    const { hits } = build(doc, doc.indexOf('end'))
    expect(doneSpans(doc, hits)).toEqual([{ text: 'first line' }, { text: 'continued here' }])
  })

  it('strikes later own-content paragraphs of the item block too', () => {
    const doc = '- [x] para1\n\n  para2 tail\n\nend\n'
    const { hits } = build(doc, doc.indexOf('end'))
    expect(doneSpans(doc, hits)).toEqual([{ text: 'para1' }, { text: 'para2 tail' }])
  })

  it('never bleeds the strike into nested child list rows', () => {
    const doc = '- [x] parent text\n  - [ ] child text\n\nend\n'
    const { hits } = build(doc, doc.indexOf('end'))
    // Only the parent's own text is struck — the child row stays clean.
    expect(doneSpans(doc, hits)).toEqual([{ text: 'parent text' }])
  })

  it('trims per line — indentation never rides the strike', () => {
    const doc = '- [x] head\n    deep indent cont\n\nend\n'
    const { hits } = build(doc, doc.indexOf('end'))
    expect(doneSpans(doc, hits)).toEqual([{ text: 'head' }, { text: 'deep indent cont' }])
  })

  it('unchecked items strike nothing across their continuation lines', () => {
    const doc = '- [ ] open line\n  continued here\n\nend\n'
    const { hits } = build(doc, doc.indexOf('end'))
    expect(doneSpans(doc, hits)).toEqual([])
  })
})
