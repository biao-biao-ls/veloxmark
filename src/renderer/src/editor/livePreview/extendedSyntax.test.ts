import { describe, expect, it } from 'vitest'
import {
  HIGHLIGHT_RE,
  SUB_RE,
  SUP_RE,
  collectFootnoteDefs,
  parseAttrString,
  parseFrontMatter,
  summarizeYaml
} from './extendedSyntax'

describe('parseFrontMatter', () => {
  it('parses a closed --- block at the doc head', () => {
    const doc = '---\ntitle: Hello\ndate: 2024-01-01\n---\n\n# Body\n'
    const fm = parseFrontMatter(doc)
    expect(fm).not.toBeNull()
    expect(fm!.yaml).toBe('title: Hello\ndate: 2024-01-01')
    // end covers the closing fence line; everything after it is body.
    expect(doc.slice(fm!.end)).toBe('\n# Body\n')
    expect(fm!.summary.title).toBe('Hello')
    expect(fm!.summary.date).toBe('2024-01-01')
  })

  it('returns null without a closing fence', () => {
    expect(parseFrontMatter('---\ntitle: open\n# Body\n')).toBeNull()
    expect(parseFrontMatter('# just a doc\n')).toBeNull()
  })

  it('respects the scan limit', () => {
    const doc = `${'x'.repeat(5000)}\n---\ntitle: late\n---\n`
    expect(parseFrontMatter(doc, 4096)).toBeNull()
  })
})

describe('summarizeYaml', () => {
  it('collects inline array tags and key order', () => {
    const s = summarizeYaml('title: T\ntags: [a, b, "c"]\nauthor: me\n')
    expect(s.keys).toEqual(['title', 'tags', 'author'])
    expect(s.title).toBe('T')
    expect(s.tags).toEqual(['a', 'b', 'c'])
  })

  it('collects block-array tags', () => {
    const s = summarizeYaml('tags:\n  - one\n  - two\n')
    expect(s.tags).toEqual(['one', 'two'])
  })
})

describe('collectFootnoteDefs', () => {
  it('numbers definitions by first-reference order', () => {
    const doc = 'text [^b] more [^a] again [^b]\n\n[^a]: def A\n[^b]: def B\n[^c]: unreferenced\n'
    const defs = collectFootnoteDefs(doc)
    expect(defs.get('b')!.num).toBe(1)
    expect(defs.get('a')!.num).toBe(2)
    // Unreferenced definitions get numbers after referenced ones.
    expect(defs.get('c')!.num).toBe(3)
    expect(defs.get('a')!.text).toBe('def A')
  })

  it('records definition source ranges', () => {
    const doc = 'para\n\n[^n]: note text\n'
    const defs = collectFootnoteDefs(doc)
    const d = defs.get('n')!
    expect(doc.slice(d.defFrom, d.defTo)).toBe('[^n]: note text')
  })
})

describe('inline extended regexes', () => {
  it('HIGHLIGHT_RE matches ==text==', () => {
    expect('a ==hi== b'.match(HIGHLIGHT_RE)).toEqual(['==hi=='])
  })

  it('SUP_RE matches pandoc superscripts (content may contain spaces)', () => {
    expect('x^2^'.match(SUP_RE)).toEqual(['^2^'])
    // Documented behavior: the product regex also accepts spaced content —
    // the visual mark covers `^ b ^`; only newlines break a pair.
    expect('a ^ b ^ c'.match(SUP_RE)).toEqual(['^ b ^'])
    expect('a^\nb^'.match(SUP_RE)).toBeNull()
  })

  it('SUB_RE matches H~2~O but not ~~del~~', () => {
    expect('H~2~O'.match(SUB_RE)).toEqual(['~2~'])
    expect('~~gone~~'.match(SUB_RE)).toBeNull()
  })
})

describe('parseAttrString', () => {
  it('parses {#id .class} tokens', () => {
    expect(parseAttrString('#intro .lead .wide')).toEqual({ id: 'intro', classes: ['lead', 'wide'] })
    expect(parseAttrString('.only-class')).toEqual({ id: null, classes: ['only-class'] })
    expect(parseAttrString('#only-id')).toEqual({ id: 'only-id', classes: [] })
  })
})
