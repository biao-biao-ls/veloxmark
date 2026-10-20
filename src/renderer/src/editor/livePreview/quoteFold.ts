import { syntaxTree } from '@codemirror/language'
import { StateEffect, StateField, type EditorState } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import type { SyntaxNodeRef } from '@lezer/common'
import { getLang, t } from '../../i18n'
import { chevronEl } from '../../components/chevron'
import { parseCalloutMarker } from './callout'
import type { PendingDeco } from './handlers-ctx'

export const QUOTE_FOLD_LINE_THRESHOLD = 5

export const QUOTE_SUMMARY_MAX_CHARS = 40

export function isQuoteFoldable(lines: number): boolean {
  return lines > QUOTE_FOLD_LINE_THRESHOLD
}

export function quoteFoldKey(depth: number, firstLine: string): string {
  return `q:${depth}:${firstLine}`
}

export function stripQuoteMarkers(lineText: string): string {
  return lineText.replace(/^(?:\s*>)+[ \t]*/, '').trim()
}

export function quoteSummaryText(firstLine: string): string {
  const s = firstLine.trim()
  if (s.length <= QUOTE_SUMMARY_MAX_CHARS) return `「${s}」`
  return `「${s.slice(0, QUOTE_SUMMARY_MAX_CHARS)}……」`
}

export function formatQuoteLines(hiddenLines: number): string {
  return t('render.fold.lines', { n: hiddenLines })
}

export interface QuoteFoldBlock {
  from: number
  to: number
  key: string
  lines: number
  depth: number
  firstLine: string
}

function blockquoteDepth(node: SyntaxNodeRef): number {
  let depth = 1
  for (let p = node.node.parent; p; p = p.parent) {
    if (p.name === 'Blockquote') depth++
  }
  return Math.min(depth, 4)
}

function endLineOf(doc: EditorState['doc'], from: number, to: number) {
  const first = doc.lineAt(from)
  const end = doc.lineAt(to)
  if (end.from === to && end.number > first.number) return doc.lineAt(to - 1)
  return end
}

function excerptSourceOf(
  doc: EditorState['doc'],
  first: { from: number; to: number },
  last: { from: number; to: number }
): string {
  for (let l = doc.lineAt(first.from); ; l = doc.lineAt(l.to + 1)) {
    const stripped = stripQuoteMarkers(l.text)
    if (stripped !== '') return stripped
    if (l.to >= last.to || l.to >= doc.length) return ''
  }
}

export function collectQuoteFoldBlocks(state: EditorState): QuoteFoldBlock[] {
  const doc = state.doc
  const blocks: QuoteFoldBlock[] = []
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'Blockquote') return true
      const first = doc.lineAt(node.from)
      if (parseCalloutMarker(first.text)) return true
      const last = endLineOf(doc, node.from, node.to)
      const firstLine = excerptSourceOf(doc, first, last)
      const depth = blockquoteDepth(node)
      blocks.push({
        from: first.from,
        to: last.to,
        key: quoteFoldKey(depth, firstLine),
        lines: last.number - first.number + 1,
        depth,
        firstLine
      })
      return true
    }
  })
  return blocks
}

export function collectQuoteFoldRanges(
  state: EditorState,
  foldedKeys: ReadonlySet<string>,
  blocks: QuoteFoldBlock[] = collectQuoteFoldBlocks(state)
): QuoteFoldBlock[] {
  if (foldedKeys.size === 0) return []
  const ranges = blocks.filter((b) => foldedKeys.has(b.key))
  return ranges.filter((r) => !ranges.some((o) => o !== r && o.from <= r.from && o.to >= r.to))
}

export const toggleQuoteFold = StateEffect.define<string>()
export const restoreQuoteFolds = StateEffect.define<Set<string>>()

const EMPTY_KEYS: ReadonlySet<string> = new Set()

export const quoteFoldField = StateField.define<Set<string>>({
  create: () => new Set(),
  update(value, tr) {
    let next: Set<string> = value
    let mutated = false
    const mut = (): Set<string> => {
      if (!mutated) {
        next = new Set(value)
        mutated = true
      }
      return next
    }
    for (const e of tr.effects) {
      if (e.is(toggleQuoteFold)) {
        const s = mut()
        if (s.has(e.value)) s.delete(e.value)
        else s.add(e.value)
      } else if (e.is(restoreQuoteFolds)) {
        next = new Set(e.value)
        mutated = true
      }
    }
    if (tr.docChanged && next.size > 0) {
      const have = new Set(collectQuoteFoldBlocks(tr.state).map((b) => b.key))
      const s = mut()
      for (const k of [...s]) if (!have.has(k)) s.delete(k)
    }
    if (tr.selection && next.size > 0) {
      const ranges = collectQuoteFoldRanges(tr.state, next)
      for (const r of ranges) {
        if (tr.state.selection.ranges.some((sel) => sel.from < r.to && sel.to > r.from)) {
          mut().delete(r.key)
        }
      }
    }
    return next
  }
})

export function getQuoteFoldedKeys(state: EditorState): ReadonlySet<string> {
  return state.field(quoteFoldField, false) ?? EMPTY_KEYS
}


export class QuoteSummaryWidget extends WidgetType {
  constructor(
    readonly key: string,
    readonly excerpt: string,
    readonly hiddenLines: number,
    readonly lang: string
  ) {
    super()
  }
  eq(other: QuoteSummaryWidget): boolean {
    return (
      other.key === this.key &&
      other.excerpt === this.excerpt &&
      other.hiddenLines === this.hiddenLines &&
      other.lang === this.lang
    )
  }
  toDOM(): HTMLElement {
    const row = document.createElement('span')
    row.className = 'cm-md-quote-fold'
    row.dataset.quoteFoldKey = this.key

    const caret = document.createElement('span')
    caret.className = 'cm-md-fold-caret'
    caret.dataset.testid = 'quote-fold-caret'
    caret.title = t('render.fold.restore')
    caret.append(chevronEl(false))
    row.append(caret)

    const summary = document.createElement('span')
    summary.className = 'cm-md-quote-summary'
    summary.dataset.testid = 'quote-fold-summary'
    summary.textContent = this.excerpt
    row.append(summary)

    const tail = document.createElement('span')
    tail.className = 'cm-md-quote-lines'
    tail.textContent = formatQuoteLines(this.hiddenLines)
    row.append(tail)

    const restore = document.createElement('span')
    restore.className = 'cm-md-quote-restore'
    restore.dataset.testid = 'quote-fold-restore'
    restore.title = t('render.fold.restore')
    restore.append(chevronEl(false), document.createTextNode(t('render.fold.restore')))
    row.append(restore)
    return row
  }
  ignoreEvent(): boolean {
    return false
  }
}

export class QuoteFoldCaretWidget extends WidgetType {
  constructor(
    readonly key: string,
    readonly lang: string
  ) {
    super()
  }
  eq(other: QuoteFoldCaretWidget): boolean {
    return other.key === this.key && other.lang === this.lang
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-md-fold-caret cm-md-quote-caret'
    el.dataset.testid = 'quote-fold-caret'
    el.dataset.quoteFoldKey = this.key
    el.title = t('render.fold.collapse')
    el.append(chevronEl(true))
    return el
  }
  ignoreEvent(): boolean {
    return false
  }
}

export const quoteFoldClickExtension = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target as HTMLElement | null
    const el = target?.closest?.('[data-quote-fold-key]') as HTMLElement | null
    if (!el?.dataset.quoteFoldKey) return false
    view.dispatch({ effects: toggleQuoteFold.of(el.dataset.quoteFoldKey) })
    return true
  }
})

export function applyQuoteFoldDecos(
  decos: PendingDeco[],
  state: EditorState,
  calloutFoldRanges: ReadonlyArray<{ from: number; to: number }>
): void {
  const lang = getLang()
  const foldedKeys = getQuoteFoldedKeys(state)
  const blocks = collectQuoteFoldBlocks(state).filter(
    (b) => !calloutFoldRanges.some((r) => b.from >= r.from && b.to <= r.to)
  )
  const foldedRanges = collectQuoteFoldRanges(state, foldedKeys, blocks)

  for (const b of blocks) {
    if (!isQuoteFoldable(b.lines) || foldedKeys.has(b.key)) continue
    decos.push({
      from: state.doc.lineAt(b.from).to,
      to: state.doc.lineAt(b.from).to,
      value: Decoration.widget({ widget: new QuoteFoldCaretWidget(b.key, lang), side: 1 })
    })
  }

  for (const b of blocks) {
    const lastLine = state.doc.lineAt(b.to)
    decos.push({
      from: b.from,
      to: b.from,
      value: Decoration.line({ class: 'cm-md-quote-first' })
    })
    decos.push({
      from: lastLine.from,
      to: lastLine.from,
      value: Decoration.line({ class: 'cm-md-quote-last' })
    })
  }

  if (foldedRanges.length > 0) {
    const kept = decos.filter(
      (d) => !foldedRanges.some((r) => (d.from < r.to && d.to > r.from) || d.from === r.from)
    )
    decos.length = 0
    decos.push(...kept)
    for (const r of foldedRanges) {
      decos.push({
        from: r.from,
        to: r.from,
        value: Decoration.line({ class: `cm-md-quote cm-md-quote-d${r.depth}` })
      })
      decos.push({
        from: r.from,
        to: r.to,
        value: Decoration.replace({
          widget: new QuoteSummaryWidget(r.key, quoteSummaryText(r.firstLine), r.lines, lang)
        })
      })
    }
  }
}
