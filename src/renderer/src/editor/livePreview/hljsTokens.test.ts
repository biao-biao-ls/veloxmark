import { describe, expect, it } from 'vitest'
import { HLJS_MAX_CONTENT, tokenRanges, walkHljsHtml } from './hljsTokens'

describe('hljsTokens.tokenRanges', () => {
  it('maps js keywords/strings/numbers to doc-relative ranges', () => {
    const code = 'const x = "hi"\n'
    const ranges = tokenRanges(code, 'js')
    expect(ranges.length).toBeGreaterThan(0)
    const kw = ranges.find((r) => r.className.includes('hljs-keyword'))
    expect(kw).toBeTruthy()
    expect(kw!.from).toBe(0)
    expect(code.slice(kw!.from, kw!.to)).toBe('const')
    const str = ranges.find((r) => r.className.includes('hljs-string'))
    expect(str).toBeTruthy()
    expect(code.slice(str!.from, str!.to)).toBe('"hi"')
  })

  it('decodes HTML entities when advancing offsets (<, >, & are routine in js)', () => {
    const code = 'if (a < b && c > d) x = 1'
    const ranges = tokenRanges(code, 'js')
    const kw = ranges.find((r) => r.className.includes('hljs-keyword'))
    expect(kw).toBeTruthy()
    expect(code.slice(kw!.from, kw!.to)).toBe('if')
    // Every range must slice back to non-empty, entity-free token text.
    for (const r of ranges) {
      expect(r.to).toBeGreaterThan(r.from)
      expect(r.to).toBeLessThanOrEqual(code.length)
      expect(code.slice(r.from, r.to).length).toBe(r.to - r.from)
    }
  })

  it('keeps multi-line tokens (block comments) as one range spanning the newline', () => {
    const code = '/* line1\nline2 */\nlet a = 1\n'
    const ranges = tokenRanges(code, 'js')
    const comment = ranges.find((r) => r.className.includes('hljs-comment'))
    expect(comment).toBeTruthy()
    expect(code.slice(comment!.from, comment!.to)).toBe('/* line1\nline2 */')
  })

  it('returns [] for unknown or empty language (panel falls back to plain)', () => {
    expect(tokenRanges('const x = 1', 'notalang')).toEqual([])
    expect(tokenRanges('const x = 1', '')).toEqual([])
  })

  it('returns [] above the soft content cap', () => {
    const big = 'const x = 1\n'.repeat(Math.ceil((HLJS_MAX_CONTENT + 10) / 12))
    expect(big.length).toBeGreaterThan(HLJS_MAX_CONTENT)
    expect(tokenRanges(big, 'js')).toEqual([])
  })

  it('caches by lang+code — repeated calls return the same array', () => {
    const code = 'const cached = true\n'
    const a = tokenRanges(code, 'js')
    const b = tokenRanges(code, 'js')
    expect(b).toBe(a)
  })
})

describe('hljsTokens.walkHljsHtml', () => {
  it('flattens nested span classes onto inner runs', () => {
    const html = 'a<span class="hljs-string"><span class="hljs-subst">b</span>c</span>d'
    const ranges = walkHljsHtml(html)
    expect(ranges).toEqual([
      { from: 1, to: 2, className: 'hljs-string hljs-subst' },
      { from: 2, to: 3, className: 'hljs-string' }
    ])
  })

  it('emits nothing for unclassed text and keeps offsets continuous', () => {
    const html = 'plain <span class="hljs-number">42</span> tail'
    const ranges = walkHljsHtml(html)
    expect(ranges).toEqual([{ from: 6, to: 8, className: 'hljs-number' }])
  })

  it('decodes named and numeric entities', () => {
    const html = '&lt;&amp;&#x27;<span class="hljs-keyword">x</span>'
    const ranges = walkHljsHtml(html)
    expect(ranges).toEqual([{ from: 3, to: 4, className: 'hljs-keyword' }])
  })
})
