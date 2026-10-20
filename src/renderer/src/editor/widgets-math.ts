import { EditorView, WidgetType } from '@codemirror/view'
import { t } from '../i18n'
import { BlockWidget } from './blockWidget'
import { exitMathEdit } from './mathEdit'
import { findMathBlockAt } from './livePreview/mathScan'
import { renderKatexChecked, renderKatexHtml } from './render-helpers'
import { ensureScopedCss } from './codeBlock-widget'


export class MathBlockWidget extends BlockWidget {
  constructor(
    readonly tex: string,
    sourceFrom: number,
    sourceTo: number,
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
    const chip = document.createElement('span')
    chip.className = 'cm-md-math-hover-chip'
    chip.textContent = `${t('math.chipLabel')} </>`
    chip.title = t('math.chipEnterTitle')
    el.appendChild(chip)
    return this.wrapWithGap(el, view, 'math')
  }
}

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

export class MathEditChip extends WidgetType {
  constructor(readonly i18nEpoch: number = 0) {
    super()
  }

  eq(other: MathEditChip): boolean {
    return (other.i18nEpoch ?? 0) === (this.i18nEpoch ?? 0)
  }

  toDOM(view: EditorView): HTMLElement {
    ensureScopedCss()
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
