import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { extractOutline } from './extract'

/** Build a state with the markdown language and extract (small docs parse synchronously). */
function outlineOf(doc: string): { level: number; text: string }[] {
  const state = EditorState.create({ doc, extensions: [markdown()] })
  return extractOutline(state).map(({ level, text }) => ({ level, text }))
}

describe('extractOutline', () => {
  it('extracts ATX headings with levels and stripped markers', () => {
    expect(outlineOf('# One\n\n## Two\n\n### Three')).toEqual([
      { level: 1, text: 'One' },
      { level: 2, text: 'Two' },
      { level: 3, text: 'Three' }
    ])
  })

  it('strips trailing closing hashes', () => {
    expect(outlineOf('## Closed ##')).toEqual([{ level: 2, text: 'Closed' }])
  })

  it('extracts setext headings', () => {
    expect(outlineOf('Title\n=====\n\nSub\n---')).toEqual([
      { level: 1, text: 'Title' },
      { level: 2, text: 'Sub' }
    ])
  })

  it('ignores hashes inside code fences', () => {
    expect(outlineOf('# Real\n\n```\n# not a heading\n```')).toEqual([
      { level: 1, text: 'Real' }
    ])
  })

  it('returns positions pointing at the heading start', () => {
    const doc = '# One\n\ntext\n\n## Two'
    const state = EditorState.create({ doc, extensions: [markdown()] })
    const items = extractOutline(state)
    expect(items.map((i) => i.pos)).toEqual([0, doc.indexOf('## Two')])
  })
})
