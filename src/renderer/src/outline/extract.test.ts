import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { extractOutline } from './extract'

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
