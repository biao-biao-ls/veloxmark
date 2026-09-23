import type { EditorView } from '@codemirror/view'
import { t } from '../../i18n'
import { openMermaidLightbox } from '../../components/mermaidLightboxBus'
import { BlockWidget } from '../blockWidget'
import type { ThemeName } from '../theme'
import { getMermaidLastGood, rememberMermaidGood } from './errMemory'
import { copyPngImage, exportPng, exportSvg } from './exportIo'
import { renderMermaid } from './render'

/**
 * P16: jump-to-source for a mermaid parse error. Mermaid messages carry
 * `Parse error on line N` (or `line N: …`) — N is 1-based within the fence
 * body. Returns the doc position when a line can be extracted.
 */
function mermaidErrorDocPos(view: EditorView, sourceFrom: number, msg: string): number | null {
  const m = /line\s+(\d+)/i.exec(msg)
  const state = view.state
  if (state.doc.length === 0 || sourceFrom >= state.doc.length) return null
  // Body starts on the line after the ```mermaid opener.
  const opener = state.doc.lineAt(Math.min(sourceFrom, state.doc.length - 1))
  const bodyStartLine = opener.number + 1
  const targetLine = m ? bodyStartLine + (Number(m[1]) - 1) : bodyStartLine
  const lineCount = state.doc.lines
  const clamped = Math.min(Math.max(targetLine, 1), lineCount)
  return state.doc.line(clamped).from
}

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
    const svgHost = document.createElement('div')
    svgHost.className = 'cm-md-mermaid-svg'
    const badge = document.createElement('div')
    badge.className = 'cm-md-mermaid-badge'
    badge.hidden = true
    const errorBar = document.createElement('div')
    errorBar.className = 'cm-md-mermaid-error'
    errorBar.hidden = true
    wrap.appendChild(svgHost)
    wrap.appendChild(badge)
    wrap.appendChild(errorBar)

    // Restore the last good render for this fence (if any) so a broken edit
    // dims the previous SVG instead of blanking the block.
    const prev = getMermaidLastGood(this.sourceFrom)
    const showPlaceholder = (): void => {
      svgHost.textContent = ''
      const ph = document.createElement('div')
      ph.className = 'cm-md-mermaid-placeholder'
      ph.textContent = t('mermaid.failed')
      svgHost.appendChild(ph)
    }
    if (prev && prev.svg) {
      svgHost.innerHTML = prev.svg
      svgHost.classList.add('is-dim')
      badge.hidden = false
      badge.textContent = t('mermaid.updating')
    } else if (this.code.trim() === '') {
      showPlaceholder()
    } else {
      svgHost.textContent = t('mermaid.rendering')
    }

    const setError = (msg: string): void => {
      errorBar.hidden = false
      errorBar.textContent = `${t('mermaid.errorLabel')}: ${msg}`
      const jump = document.createElement('button')
      jump.type = 'button'
      jump.className = 'cm-md-mermaid-jump'
      jump.textContent = t('mermaid.jumpToSource')
      jump.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
      })
      jump.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const pos = mermaidErrorDocPos(view, this.sourceFrom, msg)
        view.dispatch({ selection: { anchor: pos ?? this.sourceFrom }, scrollIntoView: true })
        view.focus()
      })
      errorBar.appendChild(jump)
      badge.hidden = true
    }

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

    void renderMermaid(this.code, this.theme)
      .then((svg) => {
        rememberMermaidGood(this.sourceFrom, { svg, code: this.code, theme: this.theme })
        svgHost.classList.remove('is-dim')
        svgHost.innerHTML = svg
        badge.hidden = true
        errorBar.hidden = true
        errorBar.textContent = ''
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        if (prev && prev.svg) {
          // Keep the old SVG visible-but-dimmed + error overlay (P16 ①).
          svgHost.innerHTML = prev.svg
          svgHost.classList.add('is-dim')
        } else {
          showPlaceholder()
        }
        setError(msg)
      })

    return this.wrapWithGap(wrap, view)
  }
}
