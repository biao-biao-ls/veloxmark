import { describe, expect, it } from 'vitest'
import { splitHighlightedLines } from './render-helpers'
import { codeBlockKey } from './livePreview/codeBlockUi'

describe('P24 splitHighlightedLines', () => {
  it('splits plain highlighted text on newlines', () => {
    expect(splitHighlightedLines('const a = 1\nconst b = 2')).toEqual([
      'const a = 1',
      'const b = 2'
    ])
  })

  it('closes spans crossing a newline and reopens them on the next line', () => {
    const html = '<span class="hljs-keyword">let</span> a\n<span class="hljs-string">x</span>'
    const lines = splitHighlightedLines(html)
    expect(lines).toEqual([
      '<span class="hljs-keyword">let</span> a',
      '<span class="hljs-string">x</span>'
    ])
  })

  it('handles a multi-line span (token crossing lines) without unbalanced tags', () => {
    const html = '<span class="hljs-comment">line1\nline2</span>\nline3'
    const lines = splitHighlightedLines(html)
    expect(lines).toEqual([
      '<span class="hljs-comment">line1</span>',
      '<span class="hljs-comment">line2</span>',
      'line3'
    ])
    for (const line of lines) {
      const open = (line.match(/<span/g) ?? []).length
      const close = (line.match(/<\/span>/g) ?? []).length
      expect(open).toBe(close)
    }
  })

  it('handles nested spans across lines', () => {
    const html = '<span class="a"><span class="b">x\ny</span>z</span>'
    const lines = splitHighlightedLines(html)
    expect(lines[0]).toBe('<span class="a"><span class="b">x</span></span>')
    expect(lines[1]).toBe('<span class="a"><span class="b">y</span>z</span>')
  })

  it('empty input yields a single empty line', () => {
    expect(splitHighlightedLines('')).toEqual([''])
  })
})

describe('P24 codeBlockKey', () => {
  it('is stable for identical content and differs otherwise', () => {
    expect(codeBlockKey('abc')).toBe(codeBlockKey('abc'))
    expect(codeBlockKey('abc')).not.toBe(codeBlockKey('abd'))
  })
})
