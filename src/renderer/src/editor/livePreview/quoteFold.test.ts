/**
 * IT-03 FE-08 — long-quote fold pure logic (AC-FN-16 / AC-PEND-09 / UI-IXD-14).
 *
 * Stage-1 gate coverage: 5 lines do not fold / 6 lines foldable, summary
 * truncation + 「N 行」 tail, stable block-id derivation. DOM-less only —
 * widgets are never rendered here (constitution).
 */
import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { Decoration } from '@codemirror/view'
import { setLang, t } from '../../i18n'
import type { PendingDeco } from './handlers-ctx'
import {
  QUOTE_FOLD_LINE_THRESHOLD,
  QUOTE_SUMMARY_MAX_CHARS,
  QuoteFoldCaretWidget,
  QuoteSummaryWidget,
  applyQuoteFoldDecos,
  collectQuoteFoldBlocks,
  collectQuoteFoldRanges,
  formatQuoteLines,
  getQuoteFoldedKeys,
  isQuoteFoldable,
  quoteFoldField,
  quoteFoldKey,
  quoteSummaryText,
  restoreQuoteFolds,
  toggleQuoteFold
} from './quoteFold'

const FIVE_LINES = ['> q1', '> q2', '> q3', '> q4', '> q5'].join('\n')
const SIX_LINES = ['> q1', '> q2', '> q3', '> q4', '> q5', '> q6'].join('\n')

function mkState(doc: string, folded: string[] = [], selection?: number) {
  let state = EditorState.create({
    doc,
    ...(selection != null ? { selection: { anchor: selection } } : { selection: { anchor: 0 } }),
    extensions: [markdown(), quoteFoldField]
  })
  if (folded.length > 0) {
    state = state.update({ effects: [restoreQuoteFolds.of(new Set(folded))] }).state
  }
  ensureSyntaxTree(state, state.doc.length, 50000)
  return state
}

describe('threshold: >5 render lines is foldable (AC-PEND-09)', () => {
  it('constant is 5 and lives in this module only', () => {
    expect(QUOTE_FOLD_LINE_THRESHOLD).toBe(5)
  })

  it('5 lines → not foldable', () => {
    expect(isQuoteFoldable(5)).toBe(false)
    expect(isQuoteFoldable(2)).toBe(false)
    expect(isQuoteFoldable(0)).toBe(false)
  })

  it('6 lines → foldable', () => {
    expect(isQuoteFoldable(6)).toBe(true)
    expect(isQuoteFoldable(20)).toBe(true)
  })
})

describe('quoteSummaryText: 「首行文本……」 truncation', () => {
  it('short first line stays whole inside 「」 without ellipsis', () => {
    expect(quoteSummaryText('架构评审结论')).toBe('「架构评审结论」')
  })

  it('long first line truncates at the max and appends ……', () => {
    const long = 'a'.repeat(QUOTE_SUMMARY_MAX_CHARS + 20)
    expect(quoteSummaryText(long)).toBe(`「${'a'.repeat(QUOTE_SUMMARY_MAX_CHARS)}……」`)
  })

  it('empty excerpt degrades to an empty quote pair (no throw)', () => {
    expect(quoteSummaryText('')).toBe('「」')
  })
})

describe('formatQuoteLines: 「N 行」 tail (hidden line count)', () => {
  it('zh renders the hidden line count tail', () => {
    setLang('zh')
    expect(formatQuoteLines(6)).toBe('6 行')
  })

  it('en renders the hidden line count tail', () => {
    setLang('en')
    expect(formatQuoteLines(6)).toBe('6 lines')
  })

  it('consumes the FE-01 template key unchanged', () => {
    setLang('zh')
    expect(t('render.fold.lines', { n: 3 })).toBe('3 行')
  })
})

describe('quoteFoldKey: stable block-id derivation', () => {
  it('encodes depth + marker-stripped first-line text', () => {
    expect(quoteFoldKey(1, '架构评审结论：通过')).toBe('q:1:架构评审结论：通过')
    expect(quoteFoldKey(2, 'inner')).toBe('q:2:inner')
  })

  it('is position-independent: same block content at different offsets shares the key', () => {
    const a = mkState(`intro\n\n${SIX_LINES}\n`)
    const b = mkState(`much longer preamble line one\nline two\n\n\n${SIX_LINES}\n`)
    const [blockA] = collectQuoteFoldBlocks(a)
    const [blockB] = collectQuoteFoldBlocks(b)
    expect(blockA.from).not.toBe(blockB.from)
    expect(blockA.key).toBe(blockB.key)
    expect(blockA.key).toBe(quoteFoldKey(1, 'q1'))
  })
})

describe('collectQuoteFoldBlocks: block measurement + excerpt source', () => {
  it('a 5-line quote measures 5 lines (not foldable)', () => {
    const state = mkState(FIVE_LINES)
    const blocks = collectQuoteFoldBlocks(state)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].lines).toBe(5)
    expect(isQuoteFoldable(blocks[0].lines)).toBe(false)
  })

  it('a 6-line quote measures 6 lines (foldable)', () => {
    const state = mkState(SIX_LINES)
    const blocks = collectQuoteFoldBlocks(state)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].lines).toBe(6)
    expect(isQuoteFoldable(blocks[0].lines)).toBe(true)
    expect(blocks[0].from).toBe(0)
    expect(blocks[0].to).toBe(state.doc.length)
  })

  it('excerpt source is the marker-stripped first content line', () => {
    const state = mkState('>   架构评审结论：通过\n> b\n> c\n> d\n> e\n> f\n')
    const [block] = collectQuoteFoldBlocks(state)
    expect(block.firstLine).toBe('架构评审结论：通过')
  })

  it('skips empty-marker first lines and uses the first non-empty content line', () => {
    const state = mkState('>\n> actual excerpt\n> b\n> c\n> d\n> e\n')
    const [block] = collectQuoteFoldBlocks(state)
    expect(block.firstLine).toBe('actual excerpt')
  })

  it('callout blockquotes are excluded (P21 owns their fold)', () => {
    const state = mkState('> [!NOTE]\n> a\n> b\n> c\n> d\n> e\n> f\n')
    expect(collectQuoteFoldBlocks(state)).toEqual([])
  })

  it('nested quotes derive distinct depth-keyed ids', () => {
    const state = mkState('> outer\n> > inner\n> > x\n')
    const blocks = collectQuoteFoldBlocks(state)
    expect(blocks).toHaveLength(2)
    const outer = blocks.find((b) => b.depth === 1)
    const inner = blocks.find((b) => b.depth > 1)
    expect(outer?.key).toBe('q:1:outer')
    expect(inner?.key).toBe('q:2:inner')
  })

  it('plain paragraphs produce no blocks', () => {
    const state = mkState('hello\n\nworld\n')
    expect(collectQuoteFoldBlocks(state)).toEqual([])
  })
})

describe('collectQuoteFoldRanges: folded span + outermost filter', () => {
  it('a folded key yields a range spanning the whole block', () => {
    const doc = `tail\n\n${SIX_LINES}\n`
    const state = mkState(doc, [quoteFoldKey(1, 'q1')])
    const ranges = collectQuoteFoldRanges(state, getQuoteFoldedKeys(state))
    expect(ranges).toHaveLength(1)
    expect(ranges[0].key).toBe(quoteFoldKey(1, 'q1'))
    const first = state.doc.lineAt(doc.indexOf('q1'))
    const last = state.doc.lineAt(doc.indexOf('q6'))
    expect(ranges[0].from).toBe(first.from)
    expect(ranges[0].to).toBe(last.to)
    expect(ranges[0].lines).toBe(6)
    expect(ranges[0].firstLine).toBe('q1')
  })

  it('nested folded keys collapse to the outermost range', () => {
    const doc = '> outer\n> > inner\n> > x\n'
    const state = mkState(doc, [quoteFoldKey(1, 'outer'), quoteFoldKey(2, 'inner')])
    const ranges = collectQuoteFoldRanges(state, getQuoteFoldedKeys(state))
    expect(ranges).toHaveLength(1)
    expect(ranges[0].key).toBe(quoteFoldKey(1, 'outer'))
  })

  it('unfolded keys yield nothing', () => {
    const state = mkState(SIX_LINES)
    expect(collectQuoteFoldRanges(state, new Set(['q:1:missing']))).toEqual([])
  })
})

describe('quoteFoldField: toggle / restore / auto-expand / stale drop', () => {
  it('toggle folds then unfolds a key (UI-IXD-14 two-state)', () => {
    let state = mkState(SIX_LINES)
    const key = quoteFoldKey(1, 'q1')
    state = state.update({ effects: toggleQuoteFold.of(key) }).state
    expect([...getQuoteFoldedKeys(state)]).toEqual([key])
    state = state.update({ effects: toggleQuoteFold.of(key) }).state
    expect(getQuoteFoldedKeys(state).size).toBe(0)
  })

  it('restore replaces the whole folded set', () => {
    let state = mkState(SIX_LINES, ['stale:1'])
    state = state.update({ effects: restoreQuoteFolds.of(new Set(['q:1:q1'])) }).state
    expect([...getQuoteFoldedKeys(state)]).toEqual(['q:1:q1'])
  })

  it('auto-expands when the selection enters a folded range (P18 discipline)', () => {
    const key = quoteFoldKey(1, 'q1')
    let state = mkState(SIX_LINES, [], 0)
    state = state.update({ effects: toggleQuoteFold.of(key) }).state
    expect(getQuoteFoldedKeys(state).size).toBe(1)
    // Explicit selection transaction into the folded span (search/outline jump).
    state = state.update({ selection: { anchor: SIX_LINES.indexOf('q3') } }).state
    expect(getQuoteFoldedKeys(state).size).toBe(0)
  })

  it('drops keys whose quote block vanished after a doc edit', () => {
    const key = quoteFoldKey(1, 'q1')
    let state = mkState(SIX_LINES, [key])
    expect(getQuoteFoldedKeys(state).has(key)).toBe(true)
    // Rewrite the first line — the content key no longer matches any block.
    state = state.update({ changes: { from: 0, to: 2, insert: '> z' } }).state
    expect(getQuoteFoldedKeys(state).size).toBe(0)
  })
})

describe('widget identity (eq discipline)', () => {
  it('QuoteSummaryWidget eq compares key/excerpt/lines/lang', () => {
    const a = new QuoteSummaryWidget('q:1:q1', '「q1……」', 6, 'zh')
    const b = new QuoteSummaryWidget('q:1:q1', '「q1……」', 6, 'zh')
    const c = new QuoteSummaryWidget('q:1:q1', '「q1……」', 7, 'zh')
    const d = new QuoteSummaryWidget('q:1:q1', '「q1……」', 6, 'en')
    expect(a.eq(b)).toBe(true)
    expect(a.eq(c)).toBe(false)
    expect(a.eq(d)).toBe(false)
    expect(a.ignoreEvent()).toBe(false)
  })

  it('QuoteFoldCaretWidget eq compares key/lang', () => {
    const a = new QuoteFoldCaretWidget('q:1:q1', 'zh')
    const b = new QuoteFoldCaretWidget('q:1:q1', 'zh')
    const c = new QuoteFoldCaretWidget('q:1:other', 'zh')
    expect(a.eq(b)).toBe(true)
    expect(a.eq(c)).toBe(false)
    expect(a.ignoreEvent()).toBe(false)
  })
})

/**
 * r3 replica-review must-fix (N1/N2) — block-edge vertical padding marks and
 * the folded host line's class contract. DOM-less: only the PendingDeco
 * stream is asserted (widgets are never rendered in unit tests).
 */
describe('applyQuoteFoldDecos: block-edge padding marks (N2)', () => {
  const classHits = (decos: PendingDeco[]) =>
    decos
      .map((d) => ({
        from: d.from,
        to: d.to,
        class: (d.value.spec as { class?: string }).class
      }))
      .filter((h) => h.class != null)

  const paddingHits = (decos: PendingDeco[]) =>
    classHits(decos).filter((h) => /cm-md-quote-(first|last)/.test(h.class!))

  it('expanded block: cm-md-quote-first on the first line, cm-md-quote-last on the last', () => {
    const state = mkState(SIX_LINES)
    const decos: PendingDeco[] = []
    applyQuoteFoldDecos(decos, state, [])
    const first = state.doc.line(1)
    const last = state.doc.line(6)
    expect(paddingHits(decos)).toEqual([
      { from: first.from, to: first.from, class: 'cm-md-quote-first' },
      { from: last.from, to: last.from, class: 'cm-md-quote-last' }
    ])
  })

  it('single-line quote carries both edge marks on the same line (top+bottom = +8px)', () => {
    const state = mkState('> 短引用一行\n')
    const decos: PendingDeco[] = []
    applyQuoteFoldDecos(decos, state, [])
    const only = state.doc.lineAt(0)
    expect(paddingHits(decos)).toEqual([
      { from: only.from, to: only.from, class: 'cm-md-quote-first' },
      { from: only.from, to: only.from, class: 'cm-md-quote-last' }
    ])
  })

  it('callout blockquotes get no edge padding marks (P21 owns callout chrome)', () => {
    const state = mkState('> [!NOTE]\n> a\n> b\n> c\n> d\n> e\n')
    const decos: PendingDeco[] = []
    applyQuoteFoldDecos(decos, state, [])
    expect(paddingHits(decos)).toEqual([])
  })

  it('folded block: padding marks dropped, host line keeps bare cm-md-quote (no double padding)', () => {
    const state = mkState(SIX_LINES, [quoteFoldKey(1, 'q1')])
    const decos: PendingDeco[] = []
    applyQuoteFoldDecos(decos, state, [])
    expect(paddingHits(decos)).toEqual([])
    // Host line re-added with quote chrome only — border without N2 padding
    // (the summary widget carries its own 4px, design 4+20.8+4 = 28.8px).
    expect(classHits(decos)).toContainEqual({
      from: 0,
      to: 0,
      class: 'cm-md-quote cm-md-quote-d1'
    })
  })

  it('folded block: tree-pass decos at the range start are replaced, not leaked', () => {
    const state = mkState(SIX_LINES, [quoteFoldKey(1, 'q1')])
    const decos: PendingDeco[] = [
      {
        from: 0,
        to: 0,
        value: Decoration.line({ class: 'cm-md-quote cm-md-quote-d1 tree-extra' })
      }
    ]
    applyQuoteFoldDecos(decos, state, [])
    const atStart = classHits(decos).filter((h) => h.from === 0 && h.to === 0)
    expect(atStart).toEqual([{ from: 0, to: 0, class: 'cm-md-quote cm-md-quote-d1' }])
    const replaces = decos.filter((d) => d.to > d.from)
    expect(replaces).toHaveLength(1)
    expect((replaces[0].value.spec as { widget?: unknown }).widget).toBeInstanceOf(QuoteSummaryWidget)
  })

  it('nested blockquote marks its own first/last lines (inner block padding)', () => {
    // Blank quote line separates the inner block from the outer's tail line —
    // without it lezer's lazy continuation folds the tail into the inner
    // paragraph and the inner block bounds stretch to the block end.
    const state = mkState('> outer\n> > inner 1\n> > inner 2\n>\n> tail\n')
    const decos: PendingDeco[] = []
    applyQuoteFoldDecos(decos, state, [])
    const first = state.doc.line(1)
    const last = state.doc.line(5)
    const innerFirst = state.doc.line(2)
    const innerLast = state.doc.line(3)
    const hits = paddingHits(decos)
    expect(hits).toContainEqual({ from: first.from, to: first.from, class: 'cm-md-quote-first' })
    expect(hits).toContainEqual({ from: last.from, to: last.from, class: 'cm-md-quote-last' })
    expect(hits).toContainEqual({ from: innerFirst.from, to: innerFirst.from, class: 'cm-md-quote-first' })
    expect(hits).toContainEqual({ from: innerLast.from, to: innerLast.from, class: 'cm-md-quote-last' })
  })
})
