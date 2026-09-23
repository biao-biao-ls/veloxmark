import { EditorView, WidgetType } from '@codemirror/view'
import type { FrontMatterSummary } from './livePreview/extendedSyntax'
import { t } from '../i18n'
import { attachWidgetContextMenu } from './contextMenu/widgetEntry'

// ---- P11 extended syntax widgets + GFM task checkbox ------------------------
// (2.6: FrontMatterWidget, FootnoteRefWidget, FootnoteDefBackWidget and
// TaskWidget moved verbatim from editor/widgets.ts.)

// ---- P11 extended syntax widgets ----------------------------------------------

/**
 * Collapsed YAML front-matter card. Clicking anywhere puts the cursor inside
 * the `---` source range — the blockTouched rule then drops the widget and
 * reveals the raw source, same edit loop as code blocks.
 */
export class FrontMatterWidget extends WidgetType {
  constructor(
    readonly summary: FrontMatterSummary,
    readonly yaml: string,
    readonly sourceFrom: number,
    readonly sourceTo: number,
    /** wave④: i18n epoch — card head/labels refresh on language switch. */
    readonly i18nEpoch: number = 0
  ) {
    super()
  }

  eq(other: FrontMatterWidget): boolean {
    return (
      other.yaml === this.yaml &&
      other.sourceFrom === this.sourceFrom &&
      (other.i18nEpoch ?? 0) === (this.i18nEpoch ?? 0)
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const outer = document.createElement('div')
    outer.className = 'cm-md-block-gap'
    const card = document.createElement('div')
    card.className = 'cm-md-frontmatter'

    const head = document.createElement('div')
    head.className = 'cm-md-frontmatter-head'
    head.textContent = t('fm.cardHead')
    card.appendChild(head)

    const bodyEl = document.createElement('div')
    bodyEl.className = 'cm-md-frontmatter-body'
    const s = this.summary
    const rows: Array<[string, string]> = []
    if (s.title) rows.push(['title', s.title])
    if (s.date) rows.push(['date', s.date])
    if (s.tags && s.tags.length) rows.push(['tags', s.tags.join(', ')])
    if (rows.length === 0) {
      // No recognized summary keys — show a compact key listing instead.
      const nLines = this.yaml.split(/\r?\n/).length
      const keys = s.keys.length ? s.keys.join(', ') : t('fm.lines', { n: nLines })
      rows.push([t('fm.keys'), keys])
    }
    for (const [k, v] of rows) {
      const kv = document.createElement('div')
      kv.className = 'cm-md-frontmatter-kv'
      const keyEl = document.createElement('span')
      keyEl.className = 'cm-md-frontmatter-key'
      keyEl.textContent = k
      const valEl = document.createElement('span')
      valEl.className = 'cm-md-frontmatter-val'
      valEl.textContent = v
      kv.appendChild(keyEl)
      kv.appendChild(valEl)
      bodyEl.appendChild(kv)
    }
    card.appendChild(bodyEl)
    outer.appendChild(card)

    outer.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      // Cursor into the YAML body → blockTouched → source shows for editing.
      view.dispatch({
        selection: { anchor: Math.min(this.sourceFrom + 4, this.sourceTo) },
        scrollIntoView: true
      })
      view.focus()
    })
    attachWidgetContextMenu(outer, view, this.sourceFrom)
    return outer
  }

  ignoreEvent(): boolean {
    return true
  }
}

/**
 * Footnote reference `[^id]` → superscript number. Click jumps to the
 * definition line when one exists.
 */
export class FootnoteRefWidget extends WidgetType {
  constructor(
    readonly id: string,
    readonly num: number | undefined,
    readonly defPos: number | undefined,
    /** wave④: i18n epoch — ref title tooltips refresh on language switch. */
    readonly i18nEpoch: number = 0
  ) {
    super()
  }

  eq(other: FootnoteRefWidget): boolean {
    return (
      other.id === this.id &&
      other.num === this.num &&
      other.defPos === this.defPos &&
      (other.i18nEpoch ?? 0) === (this.i18nEpoch ?? 0)
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('sup')
    el.className = 'cm-md-footnote-ref'
    el.textContent = this.num != null && this.num > 0 ? `[${this.num}]` : `[${this.id}]`
    if (this.defPos != null) {
      el.classList.add('cm-md-footnote-ref-clickable')
      el.title = t('footnote.goTo', { id: this.id })
      const defPos = this.defPos
      el.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        view.dispatch({
          selection: { anchor: defPos },
          effects: EditorView.scrollIntoView(defPos, { y: 'center' }),
          scrollIntoView: true
        })
        view.focus()
      })
    } else {
      el.title = t('footnote.missing', { id: this.id })
    }
    // No sourceFrom on this widget — the helper falls back to view.posAtDOM.
    attachWidgetContextMenu(el, view)
    return el
  }

  ignoreEvent(): boolean {
    return true
  }
}

// ---- footnote definition ↩ (UX-P11 F2) ---------------------------------------

/**
 * Trailing ↩ on a footnote definition line — Typora parity: jump back to the
 * first reference site in the document body.
 */
export class FootnoteDefBackWidget extends WidgetType {
  constructor(
    readonly id: string,
    readonly refPos: number,
    readonly i18nEpoch: number = 0
  ) {
    super()
  }

  eq(other: FootnoteDefBackWidget): boolean {
    return other.id === this.id && other.refPos === this.refPos && other.i18nEpoch === this.i18nEpoch
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-md-footnote-back'
    el.textContent = '↩'
    el.title = t('footnote.back')
    const refPos = this.refPos
    el.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      view.dispatch({
        selection: { anchor: refPos },
        effects: EditorView.scrollIntoView(refPos, { y: 'center' }),
        scrollIntoView: true
      })
      view.focus()
    })
    attachWidgetContextMenu(el, view)
    return el
  }

  ignoreEvent(): boolean {
    return true
  }
}

/** Interactive task-list checkbox; toggles the source `[x]` marker in place. */
export class TaskWidget extends WidgetType {
  constructor(
    readonly sourceFrom: number,
    readonly checked: boolean
  ) {
    super()
  }

  eq(other: TaskWidget): boolean {
    return other.sourceFrom === this.sourceFrom && other.checked === this.checked
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.className = 'cm-md-task'
    input.checked = this.checked
    input.addEventListener('mousedown', (e) => e.stopPropagation())
    input.addEventListener('change', () => {
      view.dispatch({
        changes: {
          from: this.sourceFrom + 1,
          to: this.sourceFrom + 2,
          insert: input.checked ? 'x' : ' '
        }
      })
    })
    return input
  }

  ignoreEvent(): boolean {
    return false
  }
}
