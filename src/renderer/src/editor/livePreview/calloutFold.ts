import type { EditorState } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'
import { EditorView, WidgetType } from '@codemirror/view'
import { t } from '../../i18n'
import { parseCalloutMarker, type CalloutMarker } from './callout'

export function calloutKey(from: number, marker: Pick<CalloutMarker, 'rawType'>): string {
  return `${from}|${marker.rawType}`
}

export const toggleCalloutFold = StateEffect.define<{ key: string; folded: boolean }>()

export const calloutFoldField = StateField.define<Map<string, boolean>>({
  create: () => new Map(),
  update(value, tr) {
    let next = value
    for (const e of tr.effects) {
      if (e.is(toggleCalloutFold)) {
        const m = new Map(next)
        m.set(e.value.key, e.value.folded)
        next = m
      }
    }
    if (tr.docChanged && next.size > 0) {
      const m = new Map<string, boolean>()
      for (const [key, folded] of next) {
        const sep = key.indexOf('|')
        const from = Number(key.slice(0, sep))
        const rawType = key.slice(sep + 1)
        try {
          const mapped = tr.changes.mapPos(from, 1)
          const line = tr.state.doc.lineAt(mapped)
          const parsed = parseCalloutMarker(line.text)
          if (parsed && parsed.rawType === rawType) {
            m.set(`${mapped}|${rawType}`, folded)
          }
        } catch {
        }
      }
      next = m
    }
    return next
  }
})

export function getCalloutFoldOverrides(state: EditorState): ReadonlyMap<string, boolean> {
  return state.field(calloutFoldField, false) ?? new Map()
}

export function isCalloutFolded(state: EditorState, key: string, parsed: CalloutMarker): boolean {
  const overrides = getCalloutFoldOverrides(state)
  const v = overrides.get(key)
  if (v !== undefined) return v
  return parsed.fold === 'closed'
}

export class CalloutTitleWidget extends WidgetType {
  constructor(
    readonly title: string,
    readonly type: string
  ) {
    super()
  }
  eq(other: CalloutTitleWidget): boolean {
    return other.title === this.title && other.type === this.type
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = `cm-md-callout-title cm-md-callout-title-${this.type}`
    el.textContent = this.title
    return el
  }
  ignoreEvent(): boolean {
    return false
  }
}

export class CalloutFoldPlaceholder extends WidgetType {
  constructor(
    readonly key: string,
    readonly lines: number,
    readonly lang: string
  ) {
    super()
  }
  eq(other: CalloutFoldPlaceholder): boolean {
    return other.key === this.key && other.lines === this.lines && other.lang === this.lang
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-md-callout-fold-text'
    el.dataset.calloutKey = this.key
    el.textContent = t('callout.foldPlaceholder', { n: this.lines })
    return el
  }
  ignoreEvent(): boolean {
    return false
  }
}

const ICON_ZONE_PX = 28

export const calloutClickExtension = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target as HTMLElement | null
    const headEl = target?.closest?.('.cm-md-callout-head') as HTMLElement | null
    const chipEl = target?.closest?.('.cm-md-callout-fold-text') as HTMLElement | null
    if (!headEl && !chipEl) return false
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos == null) return false
    const line = view.state.doc.lineAt(pos)
    const parsed = parseCalloutMarker(line.text)
    if (!parsed) return false
    const key = calloutKey(line.from, parsed)
    const folded = isCalloutFolded(view.state, key, parsed)
    let toggle = false
    if (chipEl) toggle = true
    else if (headEl) {
      if (folded) toggle = true
      else {
        const rect = headEl.getBoundingClientRect()
        toggle = event.clientX - rect.left < ICON_ZONE_PX
      }
    }
    if (!toggle) return false
    view.dispatch({
      effects: toggleCalloutFold.of({ key, folded: !folded }),
      selection: { anchor: pos },
      scrollIntoView: true
    })
    return true
  }
})
