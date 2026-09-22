import { syntaxTree } from '@codemirror/language'
import { StateEffect, StateField, type EditorState } from '@codemirror/state'
import { Decoration, EditorView, GutterMarker, WidgetType, gutter } from '@codemirror/view'
import { extractOutline, type OutlineItem } from '../../outline/extract'
import { t } from '../../i18n'
import { getLivePreviewConfig } from './config'

/**
 * P18 heading folds.
 *
 * UI-only state (never touches the markdown source — same contract as the
 * P10 tableEditField). Fold identity is `level:headingText` so edits that
 * shift positions do not orphan session-persisted folds.
 *
 * `collectFoldRanges` is pure and DOM-less at call time → vitest in node.
 * Fold replace decorations must come from a StateField-provided set
 * (CM6 rule), which is why livePreviewField reads this field on rebuild.
 */

export function foldKey(level: number, text: string): string {
  return `${level}:${text}`
}

export interface FoldRange {
  /** End offset of the heading line (placeholder anchors here). */
  from: number
  /** Start offset of the next same-or-higher heading (or doc end). */
  to: number
  key: string
  level: number
  /** Hidden line count for the `⋯ N` placeholder. */
  lines: number
}

export const toggleFold = StateEffect.define<string>()
/** Remove specific keys (outline jump / explicit unfold) — idempotent. */
export const expandFolds = StateEffect.define<string[]>()
/** Replace the whole folded set (session restore on file open). */
export const restoreFolds = StateEffect.define<Set<string>>()

const EMPTY_KEYS: ReadonlySet<string> = new Set()

/**
 * Collapsed sections for `foldedKeys`: heading line end → next heading of
 * the same or a higher level (doc end for trailing sections). Nested folded
 * keys inside an already-folded range are dropped — the parent hides them.
 */
export function collectFoldRanges(state: EditorState, foldedKeys: ReadonlySet<string>): FoldRange[] {
  if (foldedKeys.size === 0) return []
  const items = extractOutline(state)
  const docLen = state.doc.length
  const ranges: FoldRange[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const key = foldKey(item.level, item.text)
    if (!foldedKeys.has(key)) continue
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
    ranges.push({ from, to, key, level: item.level, lines })
  }
  return ranges.filter(
    (r) => !ranges.some((o) => o !== r && o.from <= r.from && o.to >= r.to)
  )
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
    // effect-only gutter toggle never immediately re-expands. mut() runs
    // only when a key actually dies — set identity is a real change signal
    // for livePreviewField + the fold gutter's lineMarkerChange.
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

/** Line-end grey `⋯ N 行` chip; click toggles the section back open. */
export class FoldPlaceholder extends WidgetType {
  constructor(
    readonly key: string,
    readonly lines: number,
    /** wave④/P18-F6: UI language at build time — part of identity so a
     *  language flip (i18nEpoch bump → decoration rebuild) replaces the DOM
     *  instead of CM6 reusing the stale chip text. */
    readonly lang: string
  ) {
    super()
  }
  eq(other: FoldPlaceholder): boolean {
    return other.key === this.key && other.lines === this.lines && other.lang === this.lang
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-md-fold-placeholder'
    el.dataset.foldKey = this.key
    el.textContent = t('fold.placeholder', { n: this.lines })
    return el
  }
  ignoreEvent(): boolean {
    return false
  }
}

export const foldPlaceholderClickExtension = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target as HTMLElement | null
    const el = target?.closest?.('.cm-md-fold-placeholder') as HTMLElement | null
    if (!el?.dataset.foldKey) return false
    view.dispatch({ effects: toggleFold.of(el.dataset.foldKey) })
    return true
  }
})

// ---- gutter ------------------------------------------------------------------

class FoldArrowMarker extends GutterMarker {
  constructor(
    readonly key: string,
    readonly folded: boolean
  ) {
    super()
  }
  eq(other: FoldArrowMarker): boolean {
    return other.key === this.key && other.folded === this.folded
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-md-fold-arrow' + (this.folded ? ' is-folded' : '')
    el.dataset.foldKey = this.key
    el.textContent = this.folded ? '▾' : '▸'
    el.title = t('fold.toggle')
    return el
  }
}

export const foldGutterExtension = gutter({
  class: 'cm-fold-gutter cm-md-fold-gutter',
  lineMarker(view, block) {
    const { state } = view
    if (getLivePreviewConfig(state).mode === 'source') return null
    const item = headingAtLine(state, block.from)
    if (!item) return null
    const key = foldKey(item.level, item.text)
    return new FoldArrowMarker(key, getFoldedKeys(state).has(key))
  },
  lineMarkerChange(update) {
    return (
      update.docChanged ||
      syntaxTree(update.startState) !== syntaxTree(update.state) ||
      getFoldedKeys(update.startState) !== getFoldedKeys(update.state) ||
      getLivePreviewConfig(update.startState).mode !==
        getLivePreviewConfig(update.state).mode
    )
  },
  domEventHandlers: {
    mousedown(view, block) {
      if (getLivePreviewConfig(view.state).mode === 'source') return false
      const item = headingAtLine(view.state, block.from)
      if (!item) return false
      view.dispatch({ effects: toggleFold.of(foldKey(item.level, item.text)) })
      return true
    }
  }
})
