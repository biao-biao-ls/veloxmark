import { describe, expect, it } from 'vitest'
import { Text } from '@codemirror/state'
import { mermaidErrorDocPos } from './renderHost'

// doc lines: 1 ```mermaid / 2 graph TD / 3   A --> B / 4   bad( / 5 ```
const doc = Text.of(['```mermaid', 'graph TD', '  A --> B', '  bad(', '```'])
const fenceFrom = 0

describe('mermaidErrorDocPos', () => {
  it('maps "line N" in the message to fence body line N (1-based)', () => {
    // body line 2 = doc line 3 ("  A --> B")
    expect(mermaidErrorDocPos(doc, fenceFrom, 'Parse error on line 2')).toBe(doc.line(3).from)
    expect(mermaidErrorDocPos(doc, fenceFrom, 'line 1: foo')).toBe(doc.line(2).from)
  })

  it('falls back to the body first line when no line number is present', () => {
    expect(mermaidErrorDocPos(doc, fenceFrom, 'Syntax error in text')).toBe(doc.line(2).from)
  })

  it('clamps out-of-range line numbers into the document', () => {
    expect(mermaidErrorDocPos(doc, fenceFrom, 'Parse error on line 999')).toBe(doc.line(5).from)
    // line 0 → targetLine = bodyStart - 1 → clamped to doc line 1
    expect(mermaidErrorDocPos(doc, fenceFrom, 'Parse error on line 0')).toBe(doc.line(1).from)
  })

  it('uses the opener line at sourceFrom as the body origin', () => {
    // Same fence shifted by a prefix line: body origin follows sourceFrom.
    const shifted = Text.of(['intro', '```mermaid', 'graph TD', 'oops'])
    const from = shifted.line(2).from
    expect(mermaidErrorDocPos(shifted, from, 'Parse error on line 1')).toBe(shifted.line(3).from)
  })

  it('guards empty docs and out-of-range sourceFrom', () => {
    // CM docs always have ≥1 line; the empty-doc shape is one empty line.
    expect(mermaidErrorDocPos(Text.of(['']), 0, 'Parse error on line 1')).toBeNull()
    expect(mermaidErrorDocPos(doc, doc.length, 'Parse error on line 1')).toBeNull()
  })
})
