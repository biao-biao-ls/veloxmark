import { syntaxTree } from '@codemirror/language'
import { StateEffect, StateField, type EditorState } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import { extractOutline, type OutlineItem } from '../../outline/extract'
import { getLang, t } from '../../i18n'
import { chevronEl } from '../../components/chevron'
import type { PendingDeco } from './handlers-ctx'


export function foldKey(level: number, text: string): string {
  return `${level}:${text}`
}

export interface FoldRange {
  from: number
  to: number
  key: string
  level: number
  lines: number
}

export const toggleFold = StateEffect.define<string>()
export const expandFolds = StateEffect.define<string[]>()
export const restoreFolds = StateEffect.define<Set<string>>()

const EMPTY_KEYS: ReadonlySet<string> = new Set()

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
    if (tr.docChanged && next.size > 0) {
      const have = new Set(extractOutline(tr.state).map((i) => foldKey(i.level, i.text)))
      const s = mut()
      for (const k of [...s]) if (!have.has(k)) s.delete(k)
    }
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

export function headingAtLine(state: EditorState, pos: number): OutlineItem | null {
  const items = extractOutline(state)
  const lineFrom = state.doc.lineAt(pos).from
  return items.find((i) => i.pos === lineFrom) ?? null
}

export function headingAtPos(state: EditorState, pos: number): OutlineItem | null {
  return headingAtLine(state, pos)
}


export class FoldPlaceholder extends WidgetType {
  constructor(
    readonly key: string,
    readonly lines: number,
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
    el.append(chevronEl(!this.folded))
    return el
  }
  ignoreEvent(): boolean {
    return false
  }
}

export function isPrimaryFoldButton(button: number): boolean {
  return button === 0
}

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

export function applyHeadingFoldDecos(decos: PendingDeco[], state: EditorState): void {
  const lang = getLang()
  const foldedKeys = getFoldedKeys(state)
  const items = extractOutline(state)
  const sections = collectFoldSections(state, items)
  const foldableAt = new Map<number, FoldRange>()
  for (const s of sections) foldableAt.set(state.doc.lineAt(s.from).from, s)

  for (const item of items) {
    const s = foldableAt.get(item.pos)
    if (!s) continue
    decos.push({
      from: item.pos,
      to: item.pos,
      value: Decoration.widget({
        widget: new HeadingFoldCaretWidget(s.key, foldedKeys.has(s.key), lang),
        side: -1
      })
    })
  }

  const outermost = collectFoldRanges(state, foldedKeys, sections)
  if (outermost.length === 0) return

  const kept = decos.filter((d) => !outermost.some((r) => d.from < r.to && d.to > r.from))
  decos.length = 0
  decos.push(...kept)
  for (const r of outermost) {
    const widget = new FoldPlaceholder(r.key, r.lines, lang)
    const span = foldReplaceSpan(state, r)
    if (span.to <= span.from) {
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
