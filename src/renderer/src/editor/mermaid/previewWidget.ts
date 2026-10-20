import { EditorView, WidgetType } from '@codemirror/view'
import { openMermaidLightbox } from '../../components/mermaidLightboxBus'
import type { ThemeName } from '../theme'
import { mountMermaidRender } from './renderHost'

export class MermaidPreviewWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly sourceFrom: number,
    readonly sourceTo: number,
    readonly theme: ThemeName,
    readonly i18nEpoch: number = 0
  ) {
    super()
  }

  eq(other: MermaidPreviewWidget): boolean {
    return (
      other.code === this.code &&
      other.theme === this.theme &&
      other.sourceFrom === this.sourceFrom &&
      (other.i18nEpoch ?? 0) === (this.i18nEpoch ?? 0)
    )
  }

  ignoreEvent(): boolean {
    return true
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cm-md-mermaid cm-md-mermaid-preview'
    const { svgHost } = mountMermaidRender({
      wrap,
      code: this.code,
      sourceFrom: this.sourceFrom,
      theme: this.theme,
      view
    })
    wrap.addEventListener('mousedown', (e) => {
      if (e.target instanceof Element && e.target.closest('svg')) e.stopPropagation()
    })
    wrap.addEventListener('click', (e) => {
      if (!(e.target instanceof Element)) return
      if (!e.target.closest('svg') || e.target.closest('.cm-md-mermaid-jump')) return
      e.stopPropagation()
      const svgEl = svgHost.querySelector('svg')
      if (svgEl) openMermaidLightbox(svgEl.outerHTML)
    })
    return wrap
  }
}
