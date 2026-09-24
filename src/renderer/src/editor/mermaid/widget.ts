import type { EditorView } from '@codemirror/view'
import { t } from '../../i18n'
import { openMermaidLightbox } from '../../components/mermaidLightboxBus'
import { BlockWidget } from '../blockWidget'
import type { ThemeName } from '../theme'
import { copyPngImage, exportPng, exportSvg } from './exportIo'
import { mountMermaidRender } from './renderHost'

export class MermaidWidget extends BlockWidget {
  constructor(
    readonly code: string,
    sourceFrom: number,
    sourceTo: number,
    readonly theme: ThemeName,
    /** wave④: i18n epoch — toolbar labels refresh on language switch. */
    readonly i18nEpoch: number = 0
  ) {
    super(sourceFrom, sourceTo)
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
    // 10A: svg/badge/error + last-good + render flow live in the shared render
    // host (mountMermaidRender) — same shell as MermaidPreviewWidget.
    const { svgHost } = mountMermaidRender({
      wrap,
      code: this.code,
      sourceFrom: this.sourceFrom,
      theme: this.theme,
      view
    })

    this.attachBlockToolbar(wrap, [
      {
        label: t('toolbar.copy'),
        title: t('mermaid.copySource'),
        onClick: (btn) => void this.copyWithFeedback(this.code, btn, t('toast.copiedMarkdown'))
      },
      {
        label: t('mermaid.svgLabel'),
        title: t('mermaid.svgTitle'),
        onClick: () => {
          const svgEl = svgHost.querySelector('svg')
          if (svgEl) void exportSvg(svgEl)
        }
      },
      {
        label: t('mermaid.png'),
        title: t('mermaid.pngTitle'),
        onClick: () => {
          const svgEl = svgHost.querySelector('svg')
          if (svgEl) void exportPng(svgEl)
        }
      },
      {
        label: t('mermaid.copyImage'),
        title: t('mermaid.copyImageTitle'),
        onClick: () => {
          const svgEl = svgHost.querySelector('svg')
          if (svgEl) void copyPngImage(svgEl)
        }
      }
    ])

    // svg-body click opens the fullscreen lightbox; clicks on padding,
    // the error bar or the placeholder still fall through to click-to-source.
    wrap.addEventListener('mousedown', (e) => {
      if (e.target instanceof Element && e.target.closest('svg') && !e.target.closest('.cm-md-block-toolbar')) {
        e.stopPropagation()
      }
    })
    wrap.addEventListener('click', (e) => {
      if (!(e.target instanceof Element)) return
      if (!e.target.closest('svg') || e.target.closest('.cm-md-block-toolbar')) return
      e.stopPropagation()
      const svgEl = svgHost.querySelector('svg')
      if (svgEl) openMermaidLightbox(svgEl.outerHTML)
    })

    return this.wrapWithGap(wrap, view)
  }
}
