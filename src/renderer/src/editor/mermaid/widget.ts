import type { EditorView } from '@codemirror/view'
import { t } from '../../i18n'
import { openMermaidLightbox } from '../../components/mermaidLightboxBus'
import { BlockWidget, fenceBodyCaretPos } from '../blockWidget'
import type { ThemeName } from '../theme'
import { mountMermaidRender } from './renderHost'

export class MermaidWidget extends BlockWidget {
  constructor(
    readonly code: string,
    sourceFrom: number,
    sourceTo: number,
    readonly theme: ThemeName,
    readonly i18nEpoch: number = 0
  ) {
    super(sourceFrom, sourceTo)
  }

  protected clickCaretAnchor(view: EditorView): number {
    return fenceBodyCaretPos(view, this.sourceFrom, this.sourceTo)
  }

  eq(other: MermaidWidget): boolean {
    return (
      other.code === this.code &&
      other.theme === this.theme &&
      other.sourceFrom === this.sourceFrom &&
      (other.i18nEpoch ?? 0) === (this.i18nEpoch ?? 0)
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cm-md-mermaid'
    const { svgHost } = mountMermaidRender({
      wrap,
      code: this.code,
      sourceFrom: this.sourceFrom,
      theme: this.theme,
      view
    })

    this.attachBlockToolbar(wrap, [
      {
        label: t('mermaid.fullscreen'),
        title: t('mermaid.fullscreenTitle'),
        onClick: () => {
          const svgEl = svgHost.querySelector('svg')
          if (svgEl) openMermaidLightbox(svgEl.outerHTML)
        }
      }
    ])

    return this.wrapWithGap(wrap, view, 'mermaid')
  }
}
