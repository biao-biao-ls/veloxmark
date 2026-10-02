import { syntaxTree } from '@codemirror/language'
import { StateEffect, StateField, type EditorState } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import { extractOutline, type OutlineItem } from '../../outline/extract'
import { getLang, t } from '../../i18n'
import type { PendingDeco } from './handlers-ctx'

/**
 * P18 heading folds (IT-03 FE-07 hardens the presentation: inline fold-caret
 * at the heading text left + standalone gray summary line, ui_06 block D).
 *
 * UI-only state (never touches the markdown source — same contract as the
 * P10 tableEditField). Fold identity is `level:headingText` so edits that
 * shift positions do not orphan session-persisted folds.
 *
 * `collectFoldSections` / `collectFoldRanges` are pure and DOM-less at call
 * time → vitest in node. Fold replace decorations must come from a
 * StateField-provided set (CM6 rule), which is why livePreviewField rebuilds
 * through buildDecorations → applyHeadingFoldDecos.
 */

export function foldKey(level: number, text: string): string {
  return `${level}:${text}`
}

export interface FoldRange {
  /** End offset of the heading line (logical section start). */
  from: number
  /** Start offset of the next same-or-higher heading (or doc end). */
  to: number
  key: string
  level: number
  /** Hidden line count for the collapsed summary line. */
  lines: number
}

export const toggleFold = StateEffect.define<string>()
/** Remove specific keys (outline jump / explicit unfold) — idempotent. */
export const expandFolds = StateEffect.define<string[]>()
/** Replace the whole folded set (session restore on file open). */
export const restoreFolds = StateEffect.define<Set<string>>()

const EMPTY_KEYS: ReadonlySet<string> = new Set()

/**
 * Every foldable section (document order): heading line end → next heading of
 * the same or a higher level (doc end for trailing sections). The span covers
 * ALL sub-sections — nested headings and their bodies — which is the fold
 * granularity contract (AC-FN-15 判据 1). Sections without body lines are not
 * foldable and never appear (no caret, no summary).
 *
 * `outline` lets callers that already extracted the outline (applyHeadingFoldDecos
 * needs the items for carets too) reuse that single walk instead of re-extracting.
 */
export function collectFoldSections(
  state: EditorState,
  outline: OutlineItem[] = extractOutline(state)
): FoldRange[] {
  const items = outline
  const docLen = state.doc.length
  const ranges: FoldRange[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const headingLine = state.doc.lineAt(item.pos)
    const from = headingLine.to
    let to = docLen
    for (let j = i + 1; j < items.length; j++) {
      if (items[j].level <= item.level) {
        to = state.doc.lineAt(items[j].pos).from
        break
      }
    }
    if (to <= from) continue
    const endLineNo = state.doc.lineAt(Math.min(to, docLen)).number
    const lines = endLineNo - headingLine.number - 1
    if (lines <= 0) continue
    ranges.push({ from, to, key: foldKey(item.level, item.text), level: item.level, lines })
  }
  return ranges
}

/**
 * Folded sections with replace spans — outermost only (a nested folded key
 * rides its parent's replace; the key survives so re-expanding the parent
 * restores the nested fold). This outermost filter is the single 口径 —
 * applyHeadingFoldDecos reuses it (with precomputed `sections`) so the two
 * call sites cannot drift apart.
 */
export function collectFoldRanges(
  state: EditorState,
  foldedKeys: ReadonlySet<string>,
  sections: FoldRange[] = collectFoldSections(state)
): FoldRange[] {
  if (foldedKeys.size === 0) return []
  const ranges = sections.filter((r) => foldedKeys.has(r.key))
  return ranges.filter(
    (r) => !ranges.some((o) => o !== r && o.from <= r.from && o.to >= r.to)
  )
}

/**
 * Replace span for the summary widget: body lines only. The heading's trailing
 * newline and the section's separator newline stay visible, so the summary
 * renders as its own gray line under the heading (ui_06 fold-collapsed-line)
 * instead of joining the heading row. A one-blank-line body degenerates to a
 * point — the caller emits a plain widget there.
 */
export function foldReplaceSpan(state: EditorState, r: FoldRange): { from: number; to: number } {
  const from = Math.min(r.from + 1, r.to)
  const to = r.to >= state.doc.length ? state.doc.length : r.to - 1
  return { from, to: Math.max(from, to) }
}

export const foldField = StateField.define<Set<string>>({
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
      if (e.is(toggleFold)) {
        const s = mut()
        if (s.has(e.value)) s.delete(e.value)
        else s.add(e.value)
      } else if (e.is(expandFolds)) {
        const s = mut()
        for (const k of e.value) s.delete(k)
      } else if (e.is(restoreFolds)) {
        next = new Set(e.value)
        mutated = true
      }
    }
    // Doc edits: drop keys whose heading no longer exists (text changed/deleted).
    if (tr.docChanged && next.size > 0) {
      const have = new Set(extractOutline(tr.state).map((i) => foldKey(i.level, i.text)))
      const s = mut()
      for (const k of [...s]) if (!have.has(k)) s.delete(k)
    }
    // Auto-expand: cursor/selection entering a collapsed range unfolds it
    // (search hits, outline jumps, arrow-key slides, cross-range drags).
    // tr.selection is only set on explicit selection transactions, so an
    // effect-only caret toggle never immediately re-expands. mut() runs
    // only when a key actually dies — set identity is a real change signal
    // for livePreviewField + the update listener's foldTouched gate.
    if (tr.selection && next.size > 0) {
      const ranges = collectFoldRanges(tr.state, next)
      for (const r of ranges) {
        if (tr.state.selection.ranges.some((sel) => sel.from < r.to && sel.to > r.from)) {
          mut().delete(r.key)
        }
      }
    }
    return next
  }
})

export function getFoldedKeys(state: EditorState): ReadonlySet<string> {
  return state.field(foldField, false) ?? EMPTY_KEYS
}

/** Heading whose node starts exactly at `pos`'s line (gutter/outlines). */
export function headingAtLine(state: EditorState, pos: number): OutlineItem | null {
  const items = extractOutline(state)
  const lineFrom = state.doc.lineAt(pos).from
  return items.find((i) => i.pos === lineFrom) ?? null
}

/** Heading at/before `pos` by exact start offset (outline items carry pos). */
export function headingAtPos(state: EditorState, pos: number): OutlineItem | null {
  return headingAtLine(state, pos)
}

// ---- decorations -------------------------------------------------------------

/**
 * Collapsed-section summary line: gray「（N 行内容已折叠 · 与大纲双向同步）」
 * on its own line under the heading (ui_06 fold-collapsed-line). Click toggles
 * the section back open. Language is part of identity (P18-F6 rule).
 */
export class FoldPlaceholder extends WidgetType {
  constructor(
    readonly key: string,
    readonly lines: number,
    /** wave④/P18-F6: UI language at build time — part of identity so a
     *  language flip (i18nEpoch bump → decoration rebuild) replaces the DOM
     *  instead of CM6 reusing the stale summary text. */
    readonly lang: string
  ) {
    super()
  }
  eq(other: FoldPlaceholder): boolean {
    return other.key === this.key && other.lines === this.lines && other.lang === this.lang
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-md-fold-summary'
    el.dataset.testid = 'heading-fold-summary'
    el.dataset.foldKey = this.key
    el.textContent = t('fold.collapsedLine', { n: this.lines })
    return el
  }
  ignoreEvent(): boolean {
    return false
  }
}

/**
 * Inline fold entry at the heading text left (ui_06 fold-caret): expanded ▾
 * (title「折叠本节」) / folded ▸ (title「展开本节」) — UI-IXD-06 caret direction.
 */
export class HeadingFoldCaretWidget extends WidgetType {
  constructor(
    readonly key: string,
    readonly folded: boolean,
    readonly lang: string
  ) {
    super()
  }
  eq(other: HeadingFoldCaretWidget): boolean {
    return other.key === this.key && other.folded === this.folded && other.lang === this.lang
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-md-fold-caret cm-md-heading-fold-caret'
    el.dataset.testid = 'heading-fold-caret'
    el.dataset.foldKey = this.key
    el.title = t(this.folded ? 'render.fold.expand' : 'render.fold.collapse')
    el.textContent = this.folded ? '▸' : '▾'
    return el
  }
  ignoreEvent(): boolean {
    return false
  }
}

/**
 * Equal-width inert slot for headings with no foldable body (empty sections).
 * Reserves the caret box + gap so every heading shares one text left edge —
 * without it the empty-section title drifts left by the caret width (18px +
 * 8px gap). `visibility: hidden` keeps the box; no fold key means no toggle.
 */
export class HeadingFoldCaretPlaceholderWidget extends WidgetType {
  constructor(
    readonly key: string,
    readonly lang: string
  ) {
    super()
  }
  eq(other: HeadingFoldCaretPlaceholderWidget): boolean {
    return other.key === this.key && other.lang === this.lang
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-md-fold-caret cm-md-heading-fold-caret cm-md-heading-fold-caret-phantom'
    el.dataset.testid = 'heading-fold-caret-phantom'
    el.setAttribute('aria-hidden', 'true')
    el.textContent = '▾'
    return el
  }
  ignoreEvent(): boolean {
    return true
  }
}

/**
 * Primary-button-only gate for fold caret/summary clicks (repo convention:
 * table/widget.ts, useHushLayer.ts). Right/middle clicks must fall through
 * untouched — the context menu / autoscroll keep their usual targets and a
 * fold toggle must never precede them (code-review IT-03 FE-07).
 */
export function isPrimaryFoldButton(button: number): boolean {
  return button === 0
}

/** Caret / summary click toggles the section — never moves the cursor. */
export const foldClickExtension = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (!isPrimaryFoldButton(event.button)) return false
    const target = event.target as HTMLElement | null
    const el = target?.closest?.('[data-fold-key]') as HTMLElement | null
    if (!el?.dataset.foldKey) return false
    event.preventDefault()
    view.dispatch({ effects: toggleFold.of(el.dataset.foldKey) })
    return true
  }
})

/**
 * build.ts tail hook (after the tree + regex passes, after callout/quote
 * folds): foldable-section carets, equal-width placeholders on empty sections,
 * folded-range overlap filter, summary replaces. CM6 forbids overlapping
 * replace decorations — the P18/P21 pattern: filter inner decos first, then
 * push replaces. Carets of nested sections inside a folded parent ride that
 * replace and are dropped by the same filter; the folded section's own caret
 * stays (heading row is kept).
 */
export function applyHeadingFoldDecos(decos: PendingDeco[], state: EditorState): void {
  const lang = getLang()
  const foldedKeys = getFoldedKeys(state)
  // One outline walk feeds both sections and carets (collectFoldSections used
  // to re-extract internally, then this loop extracted again).
  const items = extractOutline(state)
  const sections = collectFoldSections(state, items)
  const foldableAt = new Map<number, FoldRange>()
  for (const s of sections) foldableAt.set(state.doc.lineAt(s.from).from, s)

  // Every heading keeps the caret slot: interactive caret on foldable ones,
  // hidden equal-width placeholder on empty ones — one shared text left edge.
  for (const item of items) {
    const s = foldableAt.get(item.pos)
    const widget = s
      ? new HeadingFoldCaretWidget(s.key, foldedKeys.has(s.key), lang)
      : new HeadingFoldCaretPlaceholderWidget(foldKey(item.level, item.text), lang)
    decos.push({
      from: item.pos,
      to: item.pos,
      value: Decoration.widget({ widget, side: -1 })
    })
  }

  // Outermost filter via collectFoldRanges — single 口径, no second copy to drift.
  const outermost = collectFoldRanges(state, foldedKeys, sections)
  if (outermost.length === 0) return

  const kept = decos.filter((d) => !outermost.some((r) => d.from < r.to && d.to > r.from))
  decos.length = 0
  decos.push(...kept)
  for (const r of outermost) {
    const widget = new FoldPlaceholder(r.key, r.lines, lang)
    const span = foldReplaceSpan(state, r)
    if (span.to <= span.from) {
      // Blank-line-only body: the replace would be empty (CM6 rejects point
      // replaces) — anchor a plain widget on the blank line instead.
      decos.push({
        from: span.from,
        to: span.from,
        value: Decoration.widget({ widget, side: 1 })
      })
    } else {
      decos.push({ from: span.from, to: span.to, value: Decoration.replace({ widget }) })
    }
  }
}
