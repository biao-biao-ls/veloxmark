import { describe, expect, it } from 'vitest'
import { computeDocStats, EMPTY_STATS } from './stats'

describe('computeDocStats — Typora口径 (recorded in P14 docs)', () => {
  it('counts 100 CJK chars + 50 western tokens as 150 words', () => {
    const doc = '汉'.repeat(100) + ' ' + Array.from({ length: 50 }, (_, i) => `w${i + 1}`).join(' ')
    const stats = computeDocStats(doc)
    expect(stats.words).toBe(150)
    expect(stats.chars).toBe(doc.length)
    expect(stats.lines).toBe(1)
  })

  it('counts each CJK character as one word', () => {
    expect(computeDocStats('你好世界').words).toBe(4)
  })

  it('counts western tokens by whitespace, requiring a letter or digit', () => {
    expect(computeDocStats('hello world').words).toBe(2)
    // Pure punctuation tokens are skipped.
    expect(computeDocStats('--- !!! ...').words).toBe(0)
    // Mixed punct+word tokens count once.
    expect(computeDocStats('word, (other) 42!').words).toBe(3)
  })

  it('handles mixed CJK + latin in one line', () => {
    expect(computeDocStats('汉字 mixed 词 words').words).toBe(5)
  })

  it('reports lines/chars/paragraphs', () => {
    const doc = 'line one\n\nline two\n\n\n'
    const stats = computeDocStats(doc)
    expect(stats.lines).toBe(6)
    expect(stats.chars).toBe(doc.length)
    // v1口径: paragraphs = non-empty lines.
    expect(stats.paragraphs).toBe(2)
  })

  it('treats an empty document as one line', () => {
    expect(computeDocStats('')).toMatchObject({ lines: 1, words: 0, chars: 0, paragraphs: 0 })
  })
})

describe('EMPTY_STATS', () => {
  it('starts at line 1 col 1 with zero counts', () => {
    expect(EMPTY_STATS).toMatchObject({ line: 1, col: 1, selChars: 0, words: 0, chars: 0, lines: 1 })
  })
})
