import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { GFM } from '@lezer/markdown'
import type { SyntaxNode } from '@lezer/common'
import {
  clearLinkCache,
  collectLinkHrefs,
  extractLinkUrl,
  getBrokenHrefs,
  isBrokenCached,
  isSkippableHref,
  rememberLinkStatus
} from './linkNav'

function mkState(doc: string): EditorState {
  const state = EditorState.create({ doc, extensions: [markdown({ extensions: [GFM] })] })
  ensureSyntaxTree(state, doc.length, 50000)
  return state
}

function linkNodes(state: EditorState): SyntaxNode[] {
  const nodes: SyntaxNode[] = []
  syntaxTree(state).iterate({
    enter: (n) => {
      if (n.name === 'Link' || n.name === 'Autolink') nodes.push(n.node)
    }
  })
  return nodes
}

describe('extractLinkUrl', () => {
  it('reads the URL child of an inline link', () => {
    const state = mkState('see [B](./b.md) here\n')
    const node = linkNodes(state)[0]
    expect(node).toBeTruthy()
    expect(extractLinkUrl(state, node!)).toBe('./b.md')
  })

  it('keeps anchors and strips autolink angle brackets', () => {
    const state = mkState('[s](#安装步骤) and <https://example.com>\n')
    const nodes = linkNodes(state)
    expect(extractLinkUrl(state, nodes[0])).toBe('#安装步骤')
    const autolink = nodes.find((n) => n.name === 'Autolink')
    expect(autolink).toBeTruthy()
    expect(extractLinkUrl(state, autolink!)).toBe('https://example.com')
  })

  it('returns null when the link has no URL part', () => {
    const state = mkState('a [ref][missing] b\n')
    const node = linkNodes(state)[0]
    expect(node).toBeTruthy()
    expect(extractLinkUrl(state, node!)).toBeNull()
  })
})

describe('collectLinkHrefs', () => {
  it('gathers hrefs in document order, skipping nothing structural', () => {
    const state = mkState(
      '# T\n\n[B](./b.md)\n\n[sec](#安装步骤)\n\n[ext](https://example.com)\n'
    )
    expect(collectLinkHrefs(state)).toEqual(['./b.md', '#安装步骤', 'https://example.com'])
  })
})

describe('isSkippableHref', () => {
  it('flags schemes and pure anchors, not relative paths', () => {
    expect(isSkippableHref('https://example.com')).toBe(true)
    expect(isSkippableHref('mailto:x@y.z')).toBe(true)
    expect(isSkippableHref('#安装步骤')).toBe(true)
    expect(isSkippableHref('./b.md')).toBe(false)
    expect(isSkippableHref('./b.md#配置')).toBe(false)
  })
})

describe('link existence cache', () => {
  it('reports flips only when broken status actually changes', () => {
    clearLinkCache()
    expect(rememberLinkStatus('/ws', './b.md', true)).toBe(true) // first record, not broken
    expect(isBrokenCached('/ws', './b.md')).toBe(false)
    expect(rememberLinkStatus('/ws', './b.md', true)).toBe(false) // unchanged
    expect(rememberLinkStatus('/ws', './b.md', false)).toBe(true) // flipped to broken
    expect(isBrokenCached('/ws', './b.md')).toBe(true)
    expect(rememberLinkStatus('/ws', './b.md', false)).toBe(false)
  })

  it('keys entries per baseDir', () => {
    clearLinkCache()
    rememberLinkStatus('/ws-a', './x.md', false)
    rememberLinkStatus('/ws-b', './x.md', true)
    expect(isBrokenCached('/ws-a', './x.md')).toBe(true)
    expect(isBrokenCached('/ws-b', './x.md')).toBe(false)
    expect(getBrokenHrefs('/ws-a')).toEqual(['./x.md'])
    expect(getBrokenHrefs('/ws-b')).toEqual([])
  })

  it('clearLinkCache empties everything', () => {
    clearLinkCache()
    rememberLinkStatus('/ws', './gone.md', false)
    expect(isBrokenCached('/ws', './gone.md')).toBe(true)
    clearLinkCache()
    expect(isBrokenCached('/ws', './gone.md')).toBe(false)
  })
})
