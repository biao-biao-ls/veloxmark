import { EditorView, WidgetType } from '@codemirror/view'
import hljs from 'highlight.js/lib/common'
import katex from 'katex'
import mermaid from 'mermaid'
import githubCss from 'highlight.js/styles/github.css?raw'
import githubDarkCss from 'highlight.js/styles/github-dark.css?raw'
import type { ThemeName } from './theme'

// ---- highlight.js themes, scoped under the app theme class ------------------

function injectScopedCss(css: string, scope: string): void {
  const scoped = css.replaceAll('.hljs', `${scope} .hljs`)
  const style = document.createElement('style')
  style.textContent = scoped
  document.head.appendChild(style)
}

injectScopedCss(githubCss, '.theme-light')
injectScopedCss(githubDarkCss, '.theme-dark')

// ---- mermaid ---------------------------------------------------------------

mermaid.initialize({
  startOnLoad: false,
  suppressErrorRendering: true,
  theme: 'neutral',
  fontFamily:
    "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, sans-serif"
})

const mermaidCache = new Map<string, string>()
let mermaidSeq = 0

export function clearMermaidCache(): void {
  mermaidCache.clear()
}

async function renderMermaid(code: string, theme: ThemeName): Promise<string> {
  const key = `${theme}\n${code}`
  const cached = mermaidCache.get(key)
  if (cached) return cached
  mermaid.initialize({
    startOnLoad: false,
    suppressErrorRendering: true,
    theme: theme === 'dark' ? 'dark' : 'neutral',
    fontFamily:
      "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, sans-serif"
  })
  const { svg } = await mermaid.render(`mmd-${mermaidSeq++}`, code)
  mermaidCache.set(key, svg)
  return svg
}

/**
 * Serialize a rendered mermaid <svg> and save it to a file chosen by the user.
 * Mermaid inlines its theme CSS into the SVG, so the output is self-contained.
 */
async function exportSvg(svgEl: SVGSVGElement): Promise<void> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  if (!clone.getAttribute('viewBox')) {
    const w = svgEl.clientWidth || Number(clone.getAttribute('width')) || 800
    const h = svgEl.clientHeight || Number(clone.getAttribute('height')) || 600
    clone.setAttribute('viewBox', `0 0 ${w} ${h}`)
  }
  const content = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone)
  const target = await window.api.showSaveDialog('diagram.svg', [
    { name: 'SVG', extensions: ['svg'] },
    { name: 'All Files', extensions: ['*'] }
  ])
  if (!target) return
  await window.api.writeFile(target, content)
}

// ---- widgets ----------------------------------------------------------------

export class CodeBlockWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly lang: string,
    readonly sourceFrom: number,
    readonly sourceTo: number
  ) {
    super()
  }

  eq(other: CodeBlockWidget): boolean {
    return (
      other.code === this.code &&
      other.lang === this.lang &&
      other.sourceFrom === this.sourceFrom
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cm-md-code-block'

    const label = document.createElement('div')
    label.className = 'cm-md-code-lang'
    label.textContent = this.lang || 'text'
    wrap.appendChild(label)

    const pre = document.createElement('pre')
    const codeEl = document.createElement('code')
    codeEl.className = 'hljs'
    if (this.lang && hljs.getLanguage(this.lang)) {
      try {
        codeEl.innerHTML = hljs.highlight(this.code, { language: this.lang }).value
      } catch {
        codeEl.textContent = this.code
      }
    } else {
      codeEl.textContent = this.code
    }
    pre.appendChild(codeEl)
    wrap.appendChild(pre)

    wrap.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({
        selection: { anchor: this.sourceFrom },
        scrollIntoView: true
      })
    })
    return wrap
  }

  ignoreEvent(): boolean {
    return false
  }
}

export class MermaidWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly sourceFrom: number,
    readonly sourceTo: number,
    readonly theme: ThemeName
  ) {
    super()
  }

  eq(other: MermaidWidget): boolean {
    return (
      other.code === this.code &&
      other.theme === this.theme &&
      other.sourceFrom === this.sourceFrom
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cm-md-mermaid'
    const body = document.createElement('div')
    body.className = 'cm-md-mermaid-body'
    body.textContent = 'Rendering diagram…'
    wrap.appendChild(body)

    const exportBtn = document.createElement('button')
    exportBtn.className = 'cm-md-mermaid-export'
    exportBtn.textContent = 'SVG'
    exportBtn.title = 'Export diagram as SVG'
    // keep the click from falling through to the "edit source" mousedown handler
    exportBtn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    exportBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const svgEl = body.querySelector('svg')
      if (svgEl) void exportSvg(svgEl)
    })
    wrap.appendChild(exportBtn)

    void renderMermaid(this.code, this.theme)
      .then((svg) => {
        body.innerHTML = svg
      })
      .catch((err: unknown) => {
        body.textContent = `Mermaid error: ${err instanceof Error ? err.message : String(err)}`
      })

    wrap.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({
        selection: { anchor: this.sourceFrom },
        scrollIntoView: true
      })
    })
    return wrap
  }

  ignoreEvent(): boolean {
    return false
  }
}

export class MathBlockWidget extends WidgetType {
  constructor(
    readonly tex: string,
    readonly sourceFrom: number,
    readonly sourceTo: number
  ) {
    super()
  }

  eq(other: MathBlockWidget): boolean {
    return other.tex === this.tex && other.sourceFrom === this.sourceFrom
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('div')
    el.className = 'cm-md-math-block'
    try {
      katex.render(this.tex, el, { displayMode: true, throwOnError: false })
    } catch {
      el.textContent = this.tex
    }
    el.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({
        selection: { anchor: this.sourceFrom },
        scrollIntoView: true
      })
    })
    return el
  }

  ignoreEvent(): boolean {
    return false
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
    try {
      katex.render(this.tex, el, { displayMode: false, throwOnError: false })
    } catch {
      el.textContent = this.tex
    }
    return el
  }

  ignoreEvent(): boolean {
    return false
  }
}

export class ImageWidget extends WidgetType {
  private static cache = new Map<string, string>()

  constructor(
    readonly alt: string,
    readonly src: string,
    readonly baseDir: string
  ) {
    super()
  }

  eq(other: ImageWidget): boolean {
    return other.src === this.src && other.baseDir === this.baseDir
  }

  toDOM(): HTMLElement {
    const img = document.createElement('img')
    img.className = 'cm-md-image'
    img.alt = this.alt
    img.draggable = false

    const cacheKey = `${this.baseDir}\n${this.src}`
    const cached = ImageWidget.cache.get(cacheKey)
    if (cached) {
      img.src = cached
    } else {
      img.src = ''
      void window.api.resolveImageSrc(this.baseDir, this.src).then((resolved) => {
        ImageWidget.cache.set(cacheKey, resolved)
        img.src = resolved
      })
    }
    return img
  }

  ignoreEvent(): boolean {
    return false
  }
}

// ---- GFM tables ---------------------------------------------------------------

/** Render minimal inline markdown (**bold**, *italic*, `code`) as HTML. */
function renderInlineCell(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells: string[] = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\' && s[i + 1] === '|') {
      cur += '|'
      i++
    } else if (ch === '|') {
      cells.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur.trim())
  return cells
}

function alignmentOf(delimiter: string): string {
  const d = delimiter.trim()
  const left = d.startsWith(':')
  const right = d.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  if (left) return 'left'
  return ''
}

export class TableWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly sourceFrom: number,
    readonly sourceTo: number
  ) {
    super()
  }

  eq(other: TableWidget): boolean {
    return other.source === this.source && other.sourceFrom === this.sourceFrom
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cm-md-table-wrap'

    const lines = this.source.split('\n').filter((l) => l.trim() !== '')
    const table = document.createElement('table')
    table.className = 'cm-md-table'

    if (lines.length >= 2) {
      const headerCells = splitRow(lines[0])
      const delimiterCells = splitRow(lines[1])
      const aligns = headerCells.map((_, i) =>
        delimiterCells[i] ? alignmentOf(delimiterCells[i]) : ''
      )

      const thead = document.createElement('thead')
      const htr = document.createElement('tr')
      headerCells.forEach((cell, i) => {
        const th = document.createElement('th')
        th.innerHTML = renderInlineCell(cell)
        if (aligns[i]) th.style.textAlign = aligns[i]
        htr.appendChild(th)
      })
      thead.appendChild(htr)
      table.appendChild(thead)

      const tbody = document.createElement('tbody')
      for (let r = 2; r < lines.length; r++) {
        const cells = splitRow(lines[r])
        const tr = document.createElement('tr')
        for (let i = 0; i < headerCells.length; i++) {
          const td = document.createElement('td')
          td.innerHTML = renderInlineCell(cells[i] ?? '')
          if (aligns[i]) td.style.textAlign = aligns[i]
          tr.appendChild(td)
        }
        tbody.appendChild(tr)
      }
      table.appendChild(tbody)
    }

    wrap.appendChild(table)
    wrap.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({
        selection: { anchor: this.sourceFrom },
        scrollIntoView: true
      })
    })
    return wrap
  }

  ignoreEvent(): boolean {
    return false
  }
}
