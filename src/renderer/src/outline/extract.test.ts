import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { extractOutline, findHeadingBySlug, slugify } from './extract'

function outlineOf(doc: string) {
  const state = EditorState.create({ doc, extensions: [markdown()] })
  ensureSyntaxTree(state, doc.length, 50000)
  return extractOutline(state)
}

describe('extractOutline', () => {
  it('collects ATX headings with level/text/pos', () => {
    const doc = '# Title\n\nbody\n\n## Section A\n\ntext\n\n### Deep\n'
    const items = outlineOf(doc)
    expect(items.map((i) => [i.level, i.text])).toEqual([
      [1, 'Title'],
      [2, 'Section A'],
      [3, 'Deep']
    ])
    expect(items[0].pos).toBe(0)
    expect(items[1].pos).toBe(doc.indexOf('## Section A'))
  })

  it('strips closing hash markers and trims', () => {
    expect(outlineOf('## Trailing hashes ##\n')[0].text).toBe('Trailing hashes')
  })

  it('collects setext headings', () => {
    const doc = 'Setext One\n==========\n\nbody\n\nSetext Two\n----------\n'
    const items = outlineOf(doc)
    expect(items.map((i) => [i.level, i.text])).toEqual([
      [1, 'Setext One'],
      [2, 'Setext Two']
    ])
  })

  it('ignores hashes inside fenced code', () => {
    const items = outlineOf('# Real\n\n```bash\n# not a heading\n```\n\n## Also Real\n')
    expect(items.map((i) => i.text)).toEqual(['Real', 'Also Real'])
  })

  it('returns empty for a document without headings', () => {
    expect(outlineOf('just text\nmore text\n')).toEqual([])
  })
})

describe('slugify (P17 GitHub rules)', () => {
  it('lowercases and converts spaces to hyphens', () => {
    expect(slugify('Getting Started')).toBe('getting-started')
  })

  it('strips punctuation but keeps CJK / digits / hyphens', () => {
    expect(slugify('安装步骤')).toBe('安装步骤')
    expect(slugify('Step 2: Install!')).toBe('step-2-install')
    expect(slugify('a_b-c')).toBe('a_b-c')
  })

  it('drops punctuation without collapsing surrounding spaces (GitHub parity)', () => {
    expect(slugify('A & B')).toBe('a--b')
  })

  it('trims outer whitespace', () => {
    expect(slugify('  padded  ')).toBe('padded')
  })
})

describe('findHeadingBySlug (P17)', () => {
  const items = [
    { level: 2, text: '安装步骤', pos: 10 },
    { level: 2, text: 'Config', pos: 40 },
    { level: 2, text: 'Config', pos: 80 },
    { level: 3, text: 'Nested One', pos: 120 }
  ]

  it('matches CJK anchors directly', () => {
    expect(findHeadingBySlug(items, '安装步骤')?.pos).toBe(10)
    expect(findHeadingBySlug(items, '#安装步骤')?.pos).toBe(10)
  })

  it('disambiguates duplicate headings with -n suffixes', () => {
    expect(findHeadingBySlug(items, 'config')?.pos).toBe(40)
    expect(findHeadingBySlug(items, 'config-1')?.pos).toBe(80)
    expect(findHeadingBySlug(items, 'config-2')).toBeNull()
  })

  it('is case-insensitive and handles nested slugs', () => {
    expect(findHeadingBySlug(items, 'Nested-One')?.pos).toBe(120)
    expect(findHeadingBySlug(items, 'nested-one')?.pos).toBe(120)
  })

  it('returns null for unknown or empty slugs', () => {
    expect(findHeadingBySlug(items, 'missing')).toBeNull()
    expect(findHeadingBySlug(items, '#')).toBeNull()
  })
})
