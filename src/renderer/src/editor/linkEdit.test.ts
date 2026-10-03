import { describe, expect, it } from 'vitest'
import { extractHrefFromLinkText, isValidLinkHref, rewriteLinkHref } from './linkEdit'

describe('rewriteLinkHref (ren-link:edit-url)', () => {
  it('only rewrites href, keeps anchor text', () => {
    expect(rewriteLinkHref('[text](https://example.com/old)', 'https://example.com/new')).toBe(
      '[text](https://example.com/new)'
    )
    expect(rewriteLinkHref('[t](https://example.com/a)', 'https://example.com/b')).toBe(
      '[t](https://example.com/b)'
    )
  })

  it('preserves title slot bytes', () => {
    expect(rewriteLinkHref('[t](https://example.com/a "my title")', 'https://example.com/b')).toBe(
      '[t](https://example.com/b "my title")'
    )
    expect(rewriteLinkHref("[t](a 'title')", 'https://example.com/b')).toBe(
      "[t](https://example.com/b 'title')"
    )
    expect(rewriteLinkHref('[t](a (title))', 'https://example.com/b')).toBe(
      '[t](https://example.com/b (title))'
    )
  })

  it('wraps paren URL in angle-bracket destination', () => {
    expect(rewriteLinkHref('[t](a)', 'https://example.com/x(y)')).toBe('[t](<https://example.com/x(y)>)')
  })

  it('wraps space URL in angle-bracket destination', () => {
    expect(rewriteLinkHref('[t](a)', 'https://example.com/a b')).toBe('[t](<https://example.com/a b>)')
  })

  it('round-trips escaped destinations with zero loss', () => {
    const src = '[t](a)'
    for (const href of [
      'https://example.com/x(y)',
      'https://example.com/a b',
      'https://example.com/a(b) c/d?e=1&f=2',
      'https://example.com/back\\slash'
    ]) {
      const out = rewriteLinkHref(src, href)
      expect(out, `rewrite failed for ${href}`).not.toBeNull()
      expect(extractHrefFromLinkText(out as string), `round-trip failed for ${href}`).toBe(href)
    }
  })

  it('rejects empty or whitespace-only href', () => {
    expect(rewriteLinkHref('[t](a)', '')).toBeNull()
    expect(rewriteLinkHref('[t](a)', '   ')).toBeNull()
    expect(rewriteLinkHref('[t](a)', '\t\n')).toBeNull()
  })

  it('rejects control-char href', () => {
    expect(rewriteLinkHref('[t](a)', 'https://example.com/\nx')).toBeNull()
  })

  it('rejects angle-bracket href', () => {
    expect(rewriteLinkHref('[t](a)', 'https://example.com/a<b>c')).toBeNull()
  })

  it('rewrites angle-bracket destination back to bare form', () => {
    expect(rewriteLinkHref('[t](<a b>)', 'https://example.com/c')).toBe('[t](https://example.com/c)')
  })

  it('keeps anchor text bytes with escapes and nested brackets', () => {
    expect(rewriteLinkHref('[a \\] b](x)', 'https://example.com/y')).toBe(
      '[a \\] b](https://example.com/y)'
    )
    expect(rewriteLinkHref('[a [b] c](x)', 'https://example.com/y')).toBe(
      '[a [b] c](https://example.com/y)'
    )
  })

  it('rewrites only outer href when image is nested inside link', () => {
    expect(rewriteLinkHref('[![alt](img.png)](https://example.com/old)', 'https://example.com/new')).toBe(
      '[![alt](img.png)](https://example.com/new)'
    )
  })

  it('rewrites autolink form', () => {
    expect(rewriteLinkHref('<https://example.com/old>', 'https://example.com/new')).toBe(
      '<https://example.com/new>'
    )
  })

  it('rejects autolink targets that bare form cannot carry', () => {
    expect(rewriteLinkHref('<https://example.com/old>', 'https://example.com/a b')).toBeNull()
    expect(rewriteLinkHref('<https://example.com/old>', 'https://example.com/a<b>')).toBeNull()
    expect(rewriteLinkHref('<https://example.com/old>', '')).toBeNull()
  })

  it('rejects non-link text', () => {
    expect(rewriteLinkHref('plain text', 'https://example.com/')).toBeNull()
    expect(rewriteLinkHref('[t][ref]', 'https://example.com/')).toBeNull()
    expect(rewriteLinkHref('![img](a)', 'https://example.com/')).toBeNull()
    expect(rewriteLinkHref('[t](a) trailing', 'https://example.com/')).toBeNull()
    expect(rewriteLinkHref('', 'https://example.com/')).toBeNull()
  })

  it('fills an empty destination', () => {
    expect(rewriteLinkHref('[t]()', 'https://example.com/x')).toBe('[t](https://example.com/x)')
    expect(extractHrefFromLinkText('[t]()')).toBeNull()
    expect(extractHrefFromLinkText('[t](  )')).toBeNull()
  })
})

describe('extractHrefFromLinkText', () => {
  it('reads bare destination as-is', () => {
    expect(extractHrefFromLinkText('[t](https://example.com/a)')).toBe('https://example.com/a')
    expect(extractHrefFromLinkText('[t](https://example.com/a "title")')).toBe('https://example.com/a')
  })

  it('strips angle-bracket destination wrapper', () => {
    expect(extractHrefFromLinkText('[t](<https://example.com/a b>)')).toBe('https://example.com/a b')
  })

  it('reads autolink inner', () => {
    expect(extractHrefFromLinkText('<https://example.com/a>')).toBe('https://example.com/a')
  })

  it('returns null for non-links', () => {
    expect(extractHrefFromLinkText('plain')).toBeNull()
    expect(extractHrefFromLinkText('[t][ref]')).toBeNull()
  })
})

describe('isValidLinkHref', () => {
  it('accepts non-empty href without control chars or angle brackets', () => {
    expect(isValidLinkHref('https://example.com/a')).toBe(true)
    expect(isValidLinkHref('./rel path/x.md')).toBe(true)
    expect(isValidLinkHref('#anchor')).toBe(true)
  })

  it('rejects empty, control-char or angle-bracket href', () => {
    expect(isValidLinkHref('')).toBe(false)
    expect(isValidLinkHref('  ')).toBe(false)
    expect(isValidLinkHref('https://example.com/\nx')).toBe(false)
    expect(isValidLinkHref('https://example.com/<x>')).toBe(false)
  })
})
