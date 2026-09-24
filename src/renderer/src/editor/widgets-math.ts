import { EditorView, WidgetType } from '@codemirror/view'
import { t } from '../i18n'
import { BlockWidget } from './blockWidget'
import { exitMathEdit } from './mathEdit'
import { renderKatexHtml } from './render-helpers'

// ---- math widgets (P04) -----------------------------------------------------
// (2.6: MathBlockWidget and InlineMathWidget moved verbatim from
// editor/widgets.ts.)

export class MathBlockWidget extends BlockWidget {
  constructor(
    readonly tex: string,
    sourceFrom: number,
    sourceTo: number,
    /** wave④: i18n epoch — toolbar labels refresh on language switch. */
    readonly i18nEpoch: number = 0
  ) {
    super(sourceFrom, sourceTo)
  }

  eq(other: MathBlockWidget): boolean {
    return (
      other.tex === this.tex &&
      other.sourceFrom === this.sourceFrom &&
      (other.i18nEpoch ?? 0) === (this.i18nEpoch ?? 0)
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('div')
    el.className = 'cm-md-math-block'
    el.innerHTML = renderKatexHtml(this.tex, true)
    // 8A hover hint chip (top-right, absolute — zero layout cost): signals
    // "click to edit source"; the click bubbles to wrapWithGap's
    // click-to-source (same semantics as clicking anywhere on the block).
    const chip = document.createElement('span')
    chip.className = 'cm-md-math-hover-chip'
    chip.textContent = `${t('math.chipLabel')} </>`
    chip.title = t('math.chipEnterTitle')
    el.appendChild(chip)
    this.attachBlockToolbar(el, [
      {
        label: t('toolbar.copy'),
        title: t('math.copyTitle'),
        onClick: (btn) => void this.copyWithFeedback(this.tex, btn, t('toast.copiedTex'))
      }
    ])
    return this.wrapWithGap(el, view)
  }
}

/**
 * 8B: live KaTeX preview trailing the focused source panel (dualPane
 * convention). Same render function as MathBlockWidget (same-shell contract)
 * — invalid TeX surfaces KaTeX's error markup while the source stays editable.
 */
export class MathPreviewWidget extends WidgetType {
  constructor(
    readonly tex: string,
    readonly i18nEpoch: number = 0
  ) {
    super()
  }

  eq(other: MathPreviewWidget): boolean {
    return other.tex === this.tex && (other.i18nEpoch ?? 0) === (this.i18nEpoch ?? 0)
  }

  toDOM(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'cm-md-math-preview'
    el.innerHTML = renderKatexHtml(this.tex, true)
    return el
  }

  ignoreEvent(): boolean {
    return true
  }
}

/**
 * 8B: 「公式 ✓」 exit chip on the focused source panel's first line (absolute
 * top-right — dualPane convention). Click (or Escape, see mathEdit.ts) leaves
 * the edit session: the cursor moves past the block and the pure rendered
 * widget returns on the next rebuild.
 */
export class MathEditChip extends WidgetType {
  constructor(readonly i18nEpoch: number = 0) {
    super()
  }

  eq(other: MathEditChip): boolean {
    return (other.i18nEpoch ?? 0) === (this.i18nEpoch ?? 0)
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-md-math-edit-chip'
    el.textContent = `${t('math.chipLabel')} ✓`
    el.title = t('math.chipExitTitle')
    el.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      exitMathEdit(view)
    })
    return el
  }

  ignoreEvent(): boolean {
    return true
  }
}

export class InlineMathWidget extends WidgetType {
  constructor(readonly tex: string) {
    super()
  }

  eq(other: InlineMathWidget): boolean {
    return other.tex === this.tex
  }

  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-md-math-inline'
    el.innerHTML = renderKatexHtml(this.tex, false)
    return el
  }

  ignoreEvent(): boolean {
    return false
  }
}
