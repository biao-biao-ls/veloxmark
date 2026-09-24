import { EditorView, WidgetType } from '@codemirror/view'
import { t } from '../i18n'
import { BlockWidget } from './blockWidget'
import { exitMathEdit } from './mathEdit'
import { findMathBlockAt } from './livePreview/mathScan'
import { renderKatexChecked, renderKatexHtml } from './render-helpers'

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
    const rendered = renderKatexChecked(this.tex, true)
    el.innerHTML = rendered.html
    // 8C: error bar + jump-to-source (mermaid error-bar parity) — invalid TeX
    // only; valid renders keep zero extra DOM (same-shell contract).
    if (!rendered.ok) {
      const bar = document.createElement('div')
      bar.className = 'cm-md-math-error'
      bar.textContent = t('math.renderFailed')
      const jump = document.createElement('button')
      jump.type = 'button'
      jump.className = 'cm-md-math-jump'
      jump.textContent = t('math.jumpToSource')
      const stop = (e: Event): void => {
        e.preventDefault()
        e.stopPropagation()
      }
      jump.addEventListener('mousedown', stop)
      jump.addEventListener('click', (e) => {
        stop(e)
        // Stale-instance discipline: sourceFrom is a hint — the block start is
        // re-resolved against the CURRENT doc at click time (mathScan seam).
        const match = findMathBlockAt(view.state.sliceDoc(), this.sourceFrom)
        const anchor = match
          ? match.start
          : Math.min(this.sourceFrom, view.state.doc.length)
        view.dispatch({ selection: { anchor }, scrollIntoView: true })
        view.focus()
      })
      bar.appendChild(jump)
      el.appendChild(bar)
    }
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
