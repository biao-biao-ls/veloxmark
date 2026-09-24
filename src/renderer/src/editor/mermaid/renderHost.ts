import type { Text } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { t } from '../../i18n'
import type { ThemeName } from '../theme'
import { getMermaidLastGood, rememberMermaidGood } from './errMemory'
import { renderMermaid } from './render'

/**
 * P16: jump-to-source for a mermaid parse error. Mermaid messages carry
 * `Parse error on line N` (or `line N: …`) — N is 1-based within the fence
 * body. Returns the doc position when a line can be extracted.
 *
 * 10A: pure over `Text` (was view-bound) so the rendered widget and the
 * edit-preview share one implementation and unit tests can pin the line math.
 */
export function mermaidErrorDocPos(doc: Text, sourceFrom: number, msg: string): number | null {
  const m = /line\s+(\d+)/i.exec(msg)
  if (doc.length === 0 || sourceFrom >= doc.length) return null
  // Body starts on the line after the ```mermaid opener.
  const opener = doc.lineAt(Math.min(sourceFrom, doc.length - 1))
  const bodyStartLine = opener.number + 1
  const targetLine = m ? bodyStartLine + (Number(m[1]) - 1) : bodyStartLine
  const clamped = Math.min(Math.max(targetLine, 1), doc.lines)
  return doc.line(clamped).from
}

export interface MermaidRenderHost {
  svgHost: HTMLElement
}

export interface MountMermaidRenderOpts {
  wrap: HTMLElement
  code: string
  sourceFrom: number
  theme: ThemeName
  view: EditorView
}

/**
 * Shared mermaid render host (10A extraction from MermaidWidget.toDOM —
 * semantics preserved verbatim): svg host + badge + error bar assembly,
 * last-good restore, placeholder/rendering states, the error jump button and
 * the full renderMermaid then/catch flow. Both MermaidWidget (rendered state)
 * and MermaidPreviewWidget (focused edit dual pane) mount through this —
 * same-shell contract, and errMemory keyed by `sourceFrom` keeps last-good
 * continuity across the edit/render states of one fence. Callers own their
 * chrome around `wrap` (BlockWidget toolbar / lightbox listeners).
 */
export function mountMermaidRender(opts: MountMermaidRenderOpts): MermaidRenderHost {
  const { wrap, code, sourceFrom, theme, view } = opts
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
  const prev = getMermaidLastGood(sourceFrom)
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
  } else if (code.trim() === '') {
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
      const pos = mermaidErrorDocPos(view.state.doc, sourceFrom, msg)
      view.dispatch({ selection: { anchor: pos ?? sourceFrom }, scrollIntoView: true })
      view.focus()
    })
    errorBar.appendChild(jump)
    badge.hidden = true
  }

  void renderMermaid(code, theme)
    .then((svg) => {
      rememberMermaidGood(sourceFrom, { svg, code, theme })
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

  return { svgHost }
}
