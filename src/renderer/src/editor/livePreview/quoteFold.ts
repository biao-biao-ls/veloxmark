/**
 * IT-03 FE-08 long-quote folds (ren-quote:fold, PEND-09/Q10).
 *
 * UI-only state — never touches the markdown source (AC-RULE-14 / AC-FN-16
 * zero-byte contract, same as P18 fold.ts). Fold identity is
 * `q:{depth}:{marker-stripped first line}` so edits that shift positions do
 * not orphan session-persisted keys (mirrors fold.ts `level:text`); id drift
 * from real content edits is dropped silently by the field's docChanged
 * filter and by useQuoteFold's restore filter (STORE §3.2).
 *
 * Threshold: a quote block is foldable when its rendered line count is
 * strictly greater than QUOTE_FOLD_LINE_THRESHOLD (the single definition —
 * AC-PEND-09). Callout blockquotes (`> [!TYPE]`, P21) are excluded: the
 * callout fold owns their chrome.
 *
 * `collectQuoteFoldBlocks` / `collectQuoteFoldRanges` are pure and DOM-less
 * at call time → vitest in node. Fold replace decorations must come from a
 * StateField-provided set (CM6 rule) — livePreviewField reads quoteFoldField
 * on rebuild; no toast (PEND-15 lightweight ops).
 */
import { syntaxTree } from '@codemirror/language'
import { StateEffect, StateField, type EditorState } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import type { SyntaxNodeRef } from '@lezer/common'
import { getLang, t } from '../../i18n'
import { parseCalloutMarker } from './callout'
import type { PendingDeco } from './handlers-ctx'

/** Fold threshold in render lines — single definition (AC-PEND-09). */
export const QUOTE_FOLD_LINE_THRESHOLD = 5

/** Excerpt truncation width for the summary row's 「首行文本……」. */
export const QUOTE_SUMMARY_MAX_CHARS = 40

export function isQuoteFoldable(lines: number): boolean {
  return lines > QUOTE_FOLD_LINE_THRESHOLD
}

/** `q:{depth}:{first line}` — content-derived so position shifts keep ids. */
export function quoteFoldKey(depth: number, firstLine: string): string {
  return `q:${depth}:${firstLine}`
}

/** Strip leading `>` markers (nested included) + surrounding blanks. */
export function stripQuoteMarkers(lineText: string): string {
  return lineText.replace(/^(?:\s*>)+[ \t]*/, '').trim()
}

/** 「first line……」 — truncated with ellipsis past the max (AC-PEND-09). */
export function quoteSummaryText(firstLine: string): string {
  const s = firstLine.trim()
  if (s.length <= QUOTE_SUMMARY_MAX_CHARS) return `「${s}」`
  return `「${s.slice(0, QUOTE_SUMMARY_MAX_CHARS)}……」`
}

/**「N 行」 tail — hidden line count behind the summary row. */
export function formatQuoteLines(hiddenLines: number): string {
  return t('render.fold.lines', { n: hiddenLines })
}

export interface QuoteFoldBlock {
  /** First line start of the block (replace range start). */
  from: number
  /** Last line end of the block (replace range end). */
  to: number
  key: string
  /** Rendered line count — the threshold input and hidden-line count. */
  lines: number
  /** Blockquote nesting depth (1-based), for the fold key. */
  depth: number
  /** Marker-stripped first non-empty content line (excerpt + key source). */
  firstLine: string
}

/** 1-based depth of this Blockquote node (self + ancestor Blockquotes). */
function blockquoteDepth(node: SyntaxNodeRef): number {
  let depth = 1
  for (let p = node.node.parent; p; p = p.parent) {
    if (p.name === 'Blockquote') depth++
  }
  return Math.min(depth, 4)
}

/** Last line of [from, to] — node.to may sit at the start of the next line. */
function endLineOf(doc: EditorState['doc'], from: number, to: number) {
  const first = doc.lineAt(from)
  const end = doc.lineAt(to)
  if (end.from === to && end.number > first.number) return doc.lineAt(to - 1)
  return end
}

/** First non-empty marker-stripped line of the block (excerpt + key source). */
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

/** All non-callout Blockquote blocks with fold metadata (document order). */
export function collectQuoteFoldBlocks(state: EditorState): QuoteFoldBlock[] {
  const doc = state.doc
  const blocks: QuoteFoldBlock[] = []
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'Blockquote') return true
      const first = doc.lineAt(node.from)
      // P21 callouts own their fold chrome — never quote-foldable.
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

/**
 * Folded blocks with replace spans — outermost only (a nested folded key
 * rides its parent's replace; the key survives so re-expanding the parent
 * restores the nested fold). This outermost filter is the single 口径 —
 * applyQuoteFoldDecos reuses it (with precomputed `blocks`) so the two call
 * sites cannot drift apart (fold.ts collectFoldRanges discipline).
 */
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
/** Replace the whole folded set (session restore on file open). */
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
    // Doc edits: drop keys whose quote block vanished (first line edited /
    // block deleted). Silent drop — STORE §3.2 id-drift contract.
    if (tr.docChanged && next.size > 0) {
      const have = new Set(collectQuoteFoldBlocks(tr.state).map((b) => b.key))
      const s = mut()
      for (const k of [...s]) if (!have.has(k)) s.delete(k)
    }
    // Auto-expand (P18 discipline): an explicit selection entering a folded
    // range unfolds it (search hits, outline jumps, arrow-key slides).
    // tr.selection is only set on explicit selection transactions, so an
    // effect-only toggle never immediately re-expands.
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

// ---- decorations -------------------------------------------------------------

/**
 * Folded summary row: fold-caret ▸ + 「first line……」 + 「N 行」 tail +
 * ▸ 展开还原 entry (ui_06 block E / task page-elements). Click anywhere on
 * the row expands (UI-IXD-14). Language is part of identity (P18-F6 rule).
 */
export class QuoteSummaryWidget extends WidgetType {
  constructor(
    readonly key: string,
    /** Pre-composed 「first line……」 excerpt (quoteSummaryText). */
    readonly excerpt: string,
    /** Hidden line count — the「N 行」tail input. */
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
    caret.textContent = '▸'
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
    restore.textContent = `▸ ${t('render.fold.restore')}`
    row.append(restore)
    return row
  }
  ignoreEvent(): boolean {
    return false
  }
}

/** Expanded-state fold entry ▾ (title「折叠本节」) at the block's first line end. */
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
    el.textContent = '▾'
    return el
  }
  ignoreEvent(): boolean {
    return false
  }
}

/** Row / caret click toggles the block fold (folded row click = expand). */
export const quoteFoldClickExtension = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target as HTMLElement | null
    const el = target?.closest?.('[data-quote-fold-key]') as HTMLElement | null
    if (!el?.dataset.quoteFoldKey) return false
    view.dispatch({ effects: toggleQuoteFold.of(el.dataset.quoteFoldKey) })
    return true
  }
})

/**
 * build.ts tail hook (after the tree + regex passes, after callout folds,
 * before heading folds): foldable-block carets, folded-range overlap filter,
 * summary replaces. CM6 forbids overlapping replace decorations — the
 * P18/P21 pattern: filter inner decos first, then push replaces.
 *
 * Quote blocks inside a collapsed callout body are skipped (the callout
 * replace already covers them); a folded quote that *contains* a collapsed
 * callout absorbs that placeholder via the overlap filter (outer wins).
 */
export function applyQuoteFoldDecos(
  decos: PendingDeco[],
  state: EditorState,
  calloutFoldRanges: ReadonlyArray<{ from: number; to: number }>
): void {
  const lang = getLang()
  const foldedKeys = getQuoteFoldedKeys(state)
  // One syntax-tree walk per rebuild (fold.ts precompute discipline): the
  // callout-filtered block list feeds both the caret/edge marks and the
  // outermost fold filter — a second collect here is the drift surface this
  // hook is required to avoid.
  const blocks = collectQuoteFoldBlocks(state).filter(
    (b) => !calloutFoldRanges.some((r) => b.from >= r.from && b.to <= r.to)
  )
  const foldedRanges = collectQuoteFoldRanges(state, foldedKeys, blocks)

  // Carets first — the filter below drops any that land inside a folded range
  // (nested blocks), same as callout body line classes.
  for (const b of blocks) {
    if (!isQuoteFoldable(b.lines) || foldedKeys.has(b.key)) continue
    decos.push({
      from: state.doc.lineAt(b.from).to,
      to: state.doc.lineAt(b.from).to,
      value: Decoration.widget({ widget: new QuoteFoldCaretWidget(b.key, lang), side: 1 })
    })
  }

  // r3 N2: block-edge vertical padding (design .md-quote 4px top/bottom —
  // CM6 line boxes can't carry container padding, so it rides the block's
  // first/last lines). Folded blocks drop theirs in the filter below — the
  // summary widget carries its own 4px (4+20.8+4 = 28.8px, no double pad).
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
    // `d.from === r.from` extends the P18 overlap rule over zero-length line
    // decos sitting exactly at the range start (the host line's tree classes):
    // the host is re-added below with quote chrome only, so first/last padding
    // marks never double up with the summary row's own padding.
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
