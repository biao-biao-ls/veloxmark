import { EditorView, WidgetType } from '@codemirror/view'
import { openMermaidLightbox } from '../../components/mermaidLightboxBus'
import type { ThemeName } from '../theme'
import { mountMermaidRender } from './renderHost'

/**
 * 10A focused-mermaid dual pane: live preview trailing the P28 source panel
 * (mounted via livePreview/dualPane `previewBelow`).
 *
 * Plain WidgetType on purpose — NOT BlockWidget: wrapWithGap's click-to-source
 * would yank the caret back to the fence head while the user is editing the
 * source right above. The preview is a display surface: `ignoreEvent` keeps
 * clicks from moving the document cursor (P09 reveal state is untouched), the
 * error bar keeps its own jump button, and svg click opens the lightbox —
 * same as the rendered state. Render shell (svg/badge/last-good/error bar) is
 * mountMermaidRender, shared with MermaidWidget.
 */
export class MermaidPreviewWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly sourceFrom: number,
    readonly sourceTo: number,
    readonly theme: ThemeName,
    /** wave④: i18n epoch — error-bar labels refresh on language switch. */
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
