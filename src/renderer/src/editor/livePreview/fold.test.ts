import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { buildDecorations } from './build'
import { DEFAULT_LIVE_PREVIEW_CONFIG } from './config'
import {
  FoldPlaceholder,
  collectFoldRanges,
  foldField,
  foldKey,
  getFoldedKeys,
  headingAtLine,
  restoreFolds,
  toggleFold
} from './fold'

const DOC = [
  '# H1 Alpha', // 1
  '',
  'intro alpha',
  '',
  '## H2 Beta', // 5
  '',
  'beta body 1',
  'beta body 2',
  'beta body 3',
  '',
  '### H3 Gamma', // 11
  '',
  'gamma body',
  '',
  '### H3 Delta', // 15
  '',
  'delta body',
  '',
  '## H2 Epsilon', // 19
  '',
  'epsilon body',
  '',
  '# H1 Zeta',
  '',
  'zeta body',
  ''
].join('\n')

function mkState(doc: string, folded: string[] = [], selection?: number) {
  let state = EditorState.create({
    doc,
    ...(selection != null ? { selection: { anchor: selection } } : { selection: { anchor: 0 } }),
    extensions: [markdown(), foldField]
  })
  if (folded.length > 0) {
    state = state.update({ effects: [restoreFolds.of(new Set(folded))] }).state
  }
  ensureSyntaxTree(state, state.doc.length, 50000)
  return state
}

describe('foldKey', () => {
  it('encodes level + heading text', () => {
    expect(foldKey(2, 'H2 Beta')).toBe('2:H2 Beta')
  })
})

describe('collectFoldRanges', () => {
  it('spans heading-line end to the next same-or-higher heading', () => {
    const state = mkState(DOC, ['2:H2 Beta'])
    const ranges = collectFoldRanges(state, getFoldedKeys(state))
    expect(ranges).toHaveLength(1)
    expect(ranges[0].key).toBe('2:H2 Beta')
    const headingLine = state.doc.lineAt(DOC.indexOf('## H2 Beta'))
    const nextH2 = state.doc.lineAt(DOC.indexOf('## H2 Epsilon'))
    expect(ranges[0].from).toBe(headingLine.to)
    expect(ranges[0].to).toBe(nextH2.from)
    // lines 6..18 hidden → 13
    expect(ranges[0].lines).toBe(13)
  })

  it('extends trailing headings to the document end', () => {
    const state = mkState(DOC, ['1:H1 Zeta'])
    const ranges = collectFoldRanges(state, getFoldedKeys(state))
    expect(ranges).toHaveLength(1)
    expect(ranges[0].to).toBe(state.doc.length)
    expect(ranges[0].lines).toBe(2) // blank + 'zeta body' (trailing newline line excluded)
  })

  it('keeps only the outermost range when parent and child are folded', () => {
    const state = mkState(DOC, ['2:H2 Beta', '3:H3 Gamma'])
    const ranges = collectFoldRanges(state, getFoldedKeys(state))
    expect(ranges.map((r) => r.key)).toEqual(['2:H2 Beta'])
  })

  it('skips headings with no body lines', () => {
    const doc = '## Empty\n## Next\n\ntext\n'
    const state = mkState(doc, ['2:Empty'])
    expect(collectFoldRanges(state, getFoldedKeys(state))).toEqual([])
  })

  it('computes from passed keys even without foldField in the state', () => {
    const bare = EditorState.create({ doc: DOC, extensions: [markdown()] })
    ensureSyntaxTree(bare, bare.doc.length, 50000)
    const ranges = collectFoldRanges(bare, new Set(['2:H2 Beta']))
    expect(ranges).toHaveLength(1)
    expect(ranges[0].key).toBe('2:H2 Beta')
  })
})

describe('foldField', () => {
  it('toggleFold adds and removes keys', () => {
    let state = mkState(DOC)
    state = state.update({ effects: [toggleFold.of('2:H2 Beta')] }).state
    expect([...getFoldedKeys(state)]).toEqual(['2:H2 Beta'])
    state = state.update({ effects: [toggleFold.of('2:H2 Beta')] }).state
    expect([...getFoldedKeys(state)]).toEqual([])
  })

  it('auto-expands when the selection enters a collapsed range', () => {
    const state0 = mkState(DOC, ['2:H2 Beta'])
    const pos = DOC.indexOf('gamma body') + 3
    const state1 = state0.update({ selection: { anchor: pos } }).state
    expect([...getFoldedKeys(state1)]).toEqual([])
  })

  it('keeps the fold when the selection stays on the heading line', () => {
    const state0 = mkState(DOC, ['2:H2 Beta'])
    const pos = DOC.indexOf('## H2 Beta') + 3
    const state1 = state0.update({ selection: { anchor: pos } }).state
    expect([...getFoldedKeys(state1)]).toEqual(['2:H2 Beta'])
  })

  it('auto-expands when a selection spans across a collapsed range', () => {
    const state0 = mkState(DOC, ['3:H3 Delta'])
    const from = DOC.indexOf('intro alpha')
    const to = DOC.indexOf('epsilon body') + 5
    const state1 = state0.update({ selection: { anchor: from, head: to } }).state
    expect([...getFoldedKeys(state1)]).toEqual([])
  })

  it('drops keys whose heading text disappeared on doc change', () => {
    const state0 = mkState(DOC, ['2:H2 Beta'])
    const renameFrom = DOC.indexOf('## H2 Beta')
    const renameTo = renameFrom + '## H2 Beta'.length
    const state1 = state0
      .update({ changes: { from: renameFrom, to: renameTo, insert: '## H2 Renamed' } })
      .state
    expect([...getFoldedKeys(state1)]).toEqual([])
  })
})

describe('buildDecorations × folds', () => {
  it('emits a replace + FoldPlaceholder for a folded range', () => {
    const state = mkState(DOC, ['2:H2 Beta'])
    const set = buildDecorations(state, { ...DEFAULT_LIVE_PREVIEW_CONFIG })
    const hits: { from: number; to: number; widget: unknown }[] = []
    set.between(0, state.doc.length, (from, to, value) => {
      const spec = (value as { spec?: { widget?: unknown } }).spec
      if (spec?.widget) hits.push({ from, to, widget: spec.widget })
    })
    const placeholder = hits.find((h) => h.widget instanceof FoldPlaceholder)
    expect(placeholder).toBeTruthy()
    expect((placeholder!.widget as FoldPlaceholder).lines).toBe(13)
    expect((placeholder!.widget as FoldPlaceholder).key).toBe('2:H2 Beta')
    const range = collectFoldRanges(state, getFoldedKeys(state))[0]
    expect(placeholder!.from).toBe(range.from)
    expect(placeholder!.to).toBe(range.to)
  })

  it('drops inner decorations that would overlap the fold replace', () => {
    const state = mkState(DOC, ['2:H2 Beta'])
    const set = buildDecorations(state, { ...DEFAULT_LIVE_PREVIEW_CONFIG })
    const range = collectFoldRanges(state, getFoldedKeys(state))[0]
    let overlapping = 0
    set.between(0, state.doc.length, (from, to, value) => {
      const spec = (value as { spec?: { class?: string } }).spec
      if (!spec?.class) return
      if (from < range.to && to > range.from) overlapping++
    })
    expect(overlapping).toBe(0)
  })

  it('source mode renders no fold decorations (all content visible)', () => {
    const state = mkState(DOC, ['2:H2 Beta'])
    const set = buildDecorations(state, { ...DEFAULT_LIVE_PREVIEW_CONFIG, mode: 'source' })
    let count = 0
    set.between(0, state.doc.length, () => {
      count++
    })
    expect(count).toBe(0)
  })
})

describe('headingAtLine', () => {
  it('resolves the heading starting at a line', () => {
    const state = mkState(DOC)
    const pos = DOC.indexOf('## H2 Beta')
    expect(headingAtLine(state, pos)?.text).toBe('H2 Beta')
    expect(headingAtLine(state, DOC.indexOf('beta body 1'))).toBeNull()
  })
})
