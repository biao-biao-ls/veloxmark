import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { buildDecorations } from './build'
import { DEFAULT_LIVE_PREVIEW_CONFIG } from './config'
import { extractOutline } from '../../outline/extract'
import {
  FoldPlaceholder,
  HeadingFoldCaretPlaceholderWidget,
  HeadingFoldCaretWidget,
  collectFoldRanges,
  collectFoldSections,
  expandFolds,
  foldField,
  foldKey,
  foldReplaceSpan,
  getFoldedKeys,
  headingAtLine,
  isPrimaryFoldButton,
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

/** Collect every widget decoration of type T from a built set. */
function widgetsOf<T>(set: ReturnType<typeof buildDecorations>, ctor: new (...args: never[]) => T): T[] {
  const hits: T[] = []
  set.between(0, Number.MAX_SAFE_INTEGER, (_from, _to, value) => {
    const widget = (value as { spec?: { widget?: unknown } }).spec?.widget
    if (widget instanceof ctor) hits.push(widget)
  })
  return hits
}

describe('foldKey', () => {
  it('encodes level + heading text', () => {
    expect(foldKey(2, 'H2 Beta')).toBe('2:H2 Beta')
  })
})

describe('collectFoldSections', () => {
  it('lists every foldable section — leaf and parent alike', () => {
    const state = mkState(DOC)
    const keys = collectFoldSections(state).map((s) => s.key)
    expect(keys).toEqual(['1:H1 Alpha', '2:H2 Beta', '3:H3 Gamma', '3:H3 Delta', '2:H2 Epsilon', '1:H1 Zeta'])
  })

  it('skips headings whose section has no body lines', () => {
    const doc = '## Empty\n## Next\n\ntext\n'
    const state = mkState(doc)
    expect(collectFoldSections(state).map((s) => s.key)).toEqual(['2:Next'])
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

  it('covers ALL sub-sections — nested headings and their bodies stay inside', () => {
    const state = mkState(DOC, ['2:H2 Beta'])
    const range = collectFoldRanges(state, getFoldedKeys(state))[0]
    // Nested H3 headings + bodies (AC-FN-15 判据 1: 折叠粒度=全部子章节).
    for (const marker of ['### H3 Gamma', 'gamma body', '### H3 Delta', 'delta body']) {
      const pos = DOC.indexOf(marker)
      expect(range.from, `${marker} must sit below the fold start`).toBeLessThan(pos)
      expect(range.to, `${marker} must sit before the fold end`).toBeGreaterThan(pos + marker.length)
    }
  })

  it('folds a single sub-section on its own (H3 range holds only its body)', () => {
    const state = mkState(DOC, ['3:H3 Gamma'])
    const ranges = collectFoldRanges(state, getFoldedKeys(state))
    expect(ranges).toHaveLength(1)
    const gammaLine = state.doc.lineAt(DOC.indexOf('### H3 Gamma'))
    const deltaLine = state.doc.lineAt(DOC.indexOf('### H3 Delta'))
    expect(ranges[0].from).toBe(gammaLine.to)
    expect(ranges[0].to).toBe(deltaLine.from)
    expect(ranges[0].lines).toBe(3) // '' + 'gamma body' + ''
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

  it('precomputed-sections path matches the default path (applyHeadingFoldDecos DRY, behavior-zero)', () => {
    const state = mkState(DOC, ['2:H2 Beta', '3:H3 Gamma'])
    const sections = collectFoldSections(state, extractOutline(state))
    const viaPrecomputed = collectFoldRanges(state, getFoldedKeys(state), sections)
    const viaDefault = collectFoldRanges(state, getFoldedKeys(state))
    expect(viaPrecomputed).toEqual(viaDefault)
    // Outermost 口径 unchanged: nested H3 still rides the parent replace.
    expect(viaPrecomputed.map((r) => r.key)).toEqual(['2:H2 Beta'])
  })
})

describe('foldReplaceSpan', () => {
  it('keeps the heading line break and the separator break visible', () => {
    const state = mkState(DOC, ['2:H2 Beta'])
    const range = collectFoldRanges(state, getFoldedKeys(state))[0]
    const headingLine = state.doc.lineAt(DOC.indexOf('## H2 Beta'))
    const nextH2 = state.doc.lineAt(DOC.indexOf('## H2 Epsilon'))
    const span = foldReplaceSpan(state, range)
    // Body-only: summary renders on its own gray line (ui_06 fold-collapsed-line).
    expect(span.from).toBe(headingLine.to + 1)
    expect(span.to).toBe(nextH2.from - 1)
  })

  it('degenerates to a point for a blank-line-only body', () => {
    const doc = '## H\n\n## Next\n'
    const state = mkState(doc, ['2:H'])
    const range = collectFoldRanges(state, getFoldedKeys(state))[0]
    expect(range.lines).toBe(1)
    const span = foldReplaceSpan(state, range)
    expect(span.from).toBe(span.to)
    expect(span.from).toBe(doc.indexOf('\n\n') + 1) // the blank body line's start
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

  it('drops the key of a deleted heading and keeps every other fold (IT-02 FE-09 失效清洗)', () => {
    const state0 = mkState(DOC, ['2:H2 Beta', '2:H2 Epsilon'])
    const delFrom = DOC.indexOf('## H2 Beta')
    const delTo = DOC.indexOf('beta body 1')
    const state1 = state0.update({ changes: { from: delFrom, to: delTo, insert: '' } }).state
    expect([...getFoldedKeys(state1)].sort()).toEqual(['2:H2 Epsilon'])
  })

  it('fold memory never mutates the document text (不写正文收口, AC-RULE-14)', () => {
    const original = DOC
    let state = mkState(original)
    expect(state.doc.toString()).toBe(original)
    // toggle fold on → off, wholesale restore, partial expand: display state only.
    state = state.update({ effects: [toggleFold.of('2:H2 Beta')] }).state
    expect(state.doc.toString()).toBe(original)
    state = state.update({ effects: [restoreFolds.of(new Set(['2:H2 Beta', '3:H3 Gamma']))] }).state
    expect(state.doc.toString()).toBe(original)
    state = state.update({ effects: [expandFolds.of(['2:H2 Beta'])] }).state
    expect(state.doc.toString()).toBe(original)
    // A heading rename is a user edit — the fold bookkeeping around it adds
    // nothing on top: the doc change is exactly the typed replacement.
    const renameFrom = DOC.indexOf('## H2 Beta')
    const renameTo = renameFrom + '## H2 Beta'.length
    const renamed = state.update({
      changes: { from: renameFrom, to: renameTo, insert: '## H2 Renamed' }
    }).state
    expect(renamed.doc.toString()).toBe(
      original.slice(0, renameFrom) + '## H2 Renamed' + original.slice(renameTo)
    )
  })
})

describe('buildDecorations × folds', () => {
  it('emits a replace + FoldPlaceholder on the body-only span', () => {
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
    const span = foldReplaceSpan(state, range)
    expect(placeholder!.from).toBe(span.from)
    expect(placeholder!.to).toBe(span.to)
  })

  it('emits a fold caret for every foldable heading (empty sections get none)', () => {
    const state = mkState(DOC)
    const set = buildDecorations(state, { ...DEFAULT_LIVE_PREVIEW_CONFIG })
    const carets = widgetsOf(set, HeadingFoldCaretWidget)
    expect(carets.map((c) => c.key)).toEqual([
      '1:H1 Alpha',
      '2:H2 Beta',
      '3:H3 Gamma',
      '3:H3 Delta',
      '2:H2 Epsilon',
      '1:H1 Zeta'
    ])
    expect(carets.every((c) => c.folded === false)).toBe(true)
  })

  it('emits an equal-width hidden placeholder caret on empty sections (left-edge alignment)', () => {
    // Empty sections are not foldable — no interactive caret — but their text
    // must share the same left edge as foldable siblings (caret box + gap slot).
    const doc = '## Empty\n## Next\n\ntext\n'
    const emptyState = mkState(doc)
    const emptySet = buildDecorations(emptyState, { ...DEFAULT_LIVE_PREVIEW_CONFIG })
    expect(widgetsOf(emptySet, HeadingFoldCaretWidget).map((c) => c.key)).toEqual(['2:Next'])
    const phs = widgetsOf(emptySet, HeadingFoldCaretPlaceholderWidget)
    expect(phs.map((p) => p.key)).toEqual(['2:Empty'])
    // Non-interactive: no fold key on the DOM node, so clicks pass through.
    expect(phs[0].ignoreEvent()).toBe(true)
  })

  it('placeholder sits at the same anchor as real carets (heading line start)', () => {
    const doc = '## Empty\n## Next\n\ntext\n'
    const state = mkState(doc)
    const set = buildDecorations(state, { ...DEFAULT_LIVE_PREVIEW_CONFIG })
    const anchors = new Map<string, number>()
    set.between(0, state.doc.length, (from, _to, value) => {
      const w = (value as { spec?: { widget?: unknown } }).spec?.widget
      if (w instanceof HeadingFoldCaretWidget || w instanceof HeadingFoldCaretPlaceholderWidget) {
        anchors.set((w as { key: string }).key, from)
      }
    })
    expect(anchors.get('2:Empty')).toBe(state.doc.lineAt(0).from)
    expect(anchors.get('2:Next')).toBe(state.doc.lineAt(doc.indexOf('## Next')).from)
  })

  it('keeps the heading caret while folded and drops nested-section carets', () => {
    const state = mkState(DOC, ['2:H2 Beta'])
    const set = buildDecorations(state, { ...DEFAULT_LIVE_PREVIEW_CONFIG })
    const carets = widgetsOf(set, HeadingFoldCaretWidget)
    const keys = carets.map((c) => c.key)
    expect(keys).toContain('2:H2 Beta')
    expect(carets.find((c) => c.key === '2:H2 Beta')!.folded).toBe(true)
    // Sub-sections ride the parent's replace — their carets must not survive.
    expect(keys).not.toContain('3:H3 Gamma')
    expect(keys).not.toContain('3:H3 Delta')
  })

  it('emits the summary as a point widget for a blank-line-only body', () => {
    const doc = '## H\n\n## Next\n'
    const state = mkState(doc, ['2:H'])
    const set = buildDecorations(state, { ...DEFAULT_LIVE_PREVIEW_CONFIG })
    const placeholders = widgetsOf(set, FoldPlaceholder)
    expect(placeholders).toHaveLength(1)
    expect(placeholders[0].key).toBe('2:H')
    expect(placeholders[0].lines).toBe(1)
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

describe('HeadingFoldCaretWidget', () => {
  it('eq() keys on key + folded + lang (DOM reuse across rebuilds)', () => {
    const a = new HeadingFoldCaretWidget('2:H2 Beta', false, 'zh')
    const b = new HeadingFoldCaretWidget('2:H2 Beta', false, 'zh')
    const folded = new HeadingFoldCaretWidget('2:H2 Beta', true, 'zh')
    const en = new HeadingFoldCaretWidget('2:H2 Beta', false, 'en')
    expect(a.eq(b)).toBe(true)
    expect(a.eq(folded)).toBe(false)
    expect(a.eq(en)).toBe(false)
    // Widget family discipline: events must reach the click extension.
    expect(a.ignoreEvent()).toBe(false)
    expect(new FoldPlaceholder('2:H2 Beta', 13, 'zh').ignoreEvent()).toBe(false)
  })

  it('placeholder eq() keys on key + lang and swallows events (non-clickable)', () => {
    const a = new HeadingFoldCaretPlaceholderWidget('2:Empty', 'zh')
    const b = new HeadingFoldCaretPlaceholderWidget('2:Empty', 'zh')
    const other = new HeadingFoldCaretPlaceholderWidget('2:Other', 'zh')
    const en = new HeadingFoldCaretPlaceholderWidget('2:Empty', 'en')
    expect(a.eq(b)).toBe(true)
    expect(a.eq(other)).toBe(false)
    expect(a.eq(en)).toBe(false)
    expect(a.ignoreEvent()).toBe(true)
  })
})

describe('foldClickExtension primary-button gate', () => {
  it('button=2 (right) / button=1 (middle) mousedown must not toggleFold — fall through', () => {
    // foldClickExtension mousedown first line:
    //   if (!isPrimaryFoldButton(event.button)) return false
    // so a right-click on the fold caret / summary reaches the body context
    // menu WITHOUT a fold toggle first (code-review IT-03 FE-07).
    expect(isPrimaryFoldButton(2)).toBe(false)
    expect(isPrimaryFoldButton(1)).toBe(false)
    expect(isPrimaryFoldButton(0)).toBe(true)
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
