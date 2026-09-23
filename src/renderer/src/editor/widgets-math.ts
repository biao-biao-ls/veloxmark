import { EditorView, WidgetType } from '@codemirror/view'
import { t } from '../i18n'
import { BlockWidget } from './blockWidget'
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
