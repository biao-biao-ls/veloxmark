import { syntaxTree } from '@codemirror/language'
import { EditorView, WidgetType } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import hljs from 'highlight.js/lib/common'
import katex from 'katex'
import mermaid from 'mermaid'
import githubCss from 'highlight.js/styles/github.css?raw'
import githubDarkCss from 'highlight.js/styles/github-dark.css?raw'
import type { ThemeName } from './theme'

// ---- highlight.js themes, scoped under the app theme class ------------------
// Injected lazily on first widget render so importing this module in a
// DOM-less environment (buildDecorations for P15 snapshot tests) is safe.

function injectScopedCss(css: string, scope: string): void {
  const scoped = css.replaceAll('.hljs', `${scope} .hljs`)
  const style = document.createElement('style')
  style.textContent = scoped
  document.head.appendChild(style)
}

let scopedCssInjected = false

function ensureScopedCss(): void {
  if (scopedCssInjected) return
  scopedCssInjected = true
  injectScopedCss(githubCss, '.theme-light')
  injectScopedCss(githubDarkCss, '.theme-dark')
}

// ---- mermaid ---------------------------------------------------------------

const mermaidCache = new Map<string, string>()
let mermaidSeq = 0
let mermaidBaseInitialized = false

function ensureMermaidBase(): void {
  if (mermaidBaseInitialized) return
  mermaidBaseInitialized = true
  mermaid.initialize({
    startOnLoad: false,
    suppressErrorRendering: true,
    theme: 'neutral',
    fontFamily:
      "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, sans-serif"
  })
}

export function clearMermaidCache(): void {
  mermaidCache.clear()
}

export async function renderMermaid(code: string, theme: ThemeName): Promise<string> {
  ensureMermaidBase()
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

// ---- shared render helpers (P04 export reuses these for static DOM) --------

/**
 * Highlight `code` with highlight.js for `lang`; returns the innerHTML for a
 * `<code class="hljs">` element. Falls back to plain escaped text when the
 * language is unknown or highlighting throws.
 */
export function highlightCodeHtml(code: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang }).value
    } catch {
      // fall through to plain text
    }
  }
  const el = document.createElement('code')
  el.textContent = code
  return el.innerHTML
}

/** Render TeX to an HTML string (KaTeX); falls back to the raw source. */
export function renderKatexHtml(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false })
  } catch {
    const el = document.createElement(displayMode ? 'div' : 'span')
    el.textContent = tex
    return el.outerHTML
  }
}

// ---- widgets ----------------------------------------------------------------

/**
 * Base for block-level rendered widgets (code, mermaid, math, table).
 * Owns the click-to-source behavior (mousedown anywhere in the block puts
 * the cursor back at the block's source range) so subclasses only build DOM.
 */
export abstract class BlockWidget extends WidgetType {
  constructor(
    readonly sourceFrom: number,
    readonly sourceTo: number
  ) {
    super()
  }

  /** Attach click-to-source to the widget's root element (call once in toDOM). */
  protected mountClickToSource(el: HTMLElement, view: EditorView): void {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({
        selection: { anchor: this.sourceFrom },
        scrollIntoView: true
      })
    })
  }

  /** P06 hook point for a hover toolbar; subclasses will register items here. */
  protected registerToolbar(_el: HTMLElement): void {}

  ignoreEvent(): boolean {
    return false
  }
}

export class CodeBlockWidget extends BlockWidget {
  constructor(
    readonly code: string,
    readonly lang: string,
    sourceFrom: number,
    sourceTo: number
  ) {
    super(sourceFrom, sourceTo)
  }

  eq(other: CodeBlockWidget): boolean {
    return (
      other.code === this.code &&
      other.lang === this.lang &&
      other.sourceFrom === this.sourceFrom
    )
  }

  toDOM(view: EditorView): HTMLElement {
    ensureScopedCss()
    const wrap = document.createElement('div')
    wrap.className = 'cm-md-code-block'

    const label = document.createElement('div')
    label.className = 'cm-md-code-lang'
    label.textContent = this.lang || 'text'
    wrap.appendChild(label)

    const pre = document.createElement('pre')
    const codeEl = document.createElement('code')
    codeEl.className = 'hljs'
    codeEl.innerHTML = highlightCodeHtml(this.code, this.lang)
    pre.appendChild(codeEl)
    wrap.appendChild(pre)

    this.mountClickToSource(wrap, view)
    return wrap
  }
}

export class MermaidWidget extends BlockWidget {
  constructor(
    readonly code: string,
    sourceFrom: number,
    sourceTo: number,
    readonly theme: ThemeName
  ) {
    super(sourceFrom, sourceTo)
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

    this.mountClickToSource(wrap, view)
    return wrap
  }
}

export class MathBlockWidget extends BlockWidget {
  constructor(
    readonly tex: string,
    sourceFrom: number,
    sourceTo: number
  ) {
    super(sourceFrom, sourceTo)
  }

  eq(other: MathBlockWidget): boolean {
    return other.tex === this.tex && other.sourceFrom === this.sourceFrom
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('div')
    el.className = 'cm-md-math-block'
    el.innerHTML = renderKatexHtml(this.tex, true)
    this.mountClickToSource(el, view)
    return el
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

// ---- images (P05) ------------------------------------------------------------

/** Parsed `![alt](src "title" =WxH)` pieces. */
export interface ParsedImage {
  alt: string
  src: string
  width?: number
  height?: number
}

/**
 * Parse an image markdown node: `![alt](src)`, optional `"title"`, and the
 * Typora/pandoc size attribute `=WxH` (either order: `=WxH` after the title).
 */
export function parseImageMarkdown(text: string): ParsedImage | null {
  const m =
    /^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?(?:\s+=(\d+)[xX](\d+))?\s*\)$/.exec(text)
  if (!m) return null
  const parsed: ParsedImage = { alt: m[1], src: m[2] }
  if (m[3] && m[4]) {
    parsed.width = Number(m[3])
    parsed.height = Number(m[4])
  }
  return parsed
}

interface CachedImage {
  src: string
  mtime: number | null
  absPath: string | null
}

/**
 * Resolution cache, keyed by baseDir + markdown src. Entries survive widget
 * recreations; invalidateImageCache() clears them (watcher / focus paths).
 */
const imageCache = new Map<string, CachedImage>()

/** Close every open image zoom toolbar (only one image is selected at a time). */
export function closeAllImageSelections(): void {
  for (const el of document.querySelectorAll('.cm-md-image-wrap.cm-md-image-selected')) {
    el.classList.remove('cm-md-image-selected')
    el.querySelector('.cm-md-image-toolbar')?.remove()
  }
}

/**
 * Drop all cached image resolutions. The next decoration rebuild re-resolves
 * every src (mtime-aware, with a cache-busting `v=` param) — wired to the
 * folder watcher's `image:changed` broadcast and window-focus revalidation.
 */
export function invalidateImageCache(): void {
  imageCache.clear()
}

/**
 * Rewrite the image node containing `sourceFrom` with a `=WxH` size suffix
 * (or drop the suffix when w/h are null). Re-resolves the node through the
 * syntax tree so the write-back survives intermediate edits.
 */
function writeImageSize(
  view: EditorView,
  sourceFrom: number,
  w: number | null,
  h: number | null
): void {
  const state = view.state
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(sourceFrom, 1)
  while (node && node.name !== 'Image') node = node.parent
  if (!node) return
  const text = state.sliceDoc(node.from, node.to)
  const m = /^!\[([^\]]*)\]\(([\s\S]*)\)$/.exec(text)
  if (!m) return
  const inner = m[2].replace(/\s+=\d+[xX]\d+\s*$/, '').trimEnd()
  const insert = w != null && h != null ? `![${m[1]}](${inner} =${w}x${h})` : `![${m[1]}](${inner})`
  view.dispatch({
    changes: { from: node.from, to: node.to, insert },
    userEvent: 'input.image.resize'
  })
}

export class ImageWidget extends WidgetType {
  constructor(
    readonly spec: ParsedImage,
    readonly baseDir: string,
    /** Source range of the ![…](…) node — anchor for size write-backs. */
    readonly sourceFrom: number,
    readonly sourceTo: number,
    /**
     * LivePreviewConfig.imageEpoch — part of identity so a cache invalidation
     * (watcher / focus) recreates the DOM and re-resolves the src. Without
     * this, CM's eq()-based DOM reuse would keep showing the stale image.
     */
    readonly epoch: number = 0
  ) {
    super()
  }

  /**
   * Width/height intentionally NOT compared: the slider commits a source edit
   * which rebuilds the widget, and keeping the DOM (toolbar open, style
   * already applied live) is the better UX. Size changes made in source mode
   * still land because those edits move the node and force a recreate.
   */
  eq(other: ImageWidget): boolean {
    return (
      other.spec.src === this.spec.src &&
      other.spec.alt === this.spec.alt &&
      other.baseDir === this.baseDir &&
      other.sourceFrom === this.sourceFrom &&
      other.epoch === this.epoch
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className = 'cm-md-image-wrap'

    const img = document.createElement('img')
    img.className = 'cm-md-image'
    img.alt = this.spec.alt
    img.draggable = false
    if (this.spec.width) {
      img.style.width = `${this.spec.width}px`
      if (this.spec.height) img.style.height = `${this.spec.height}px`
    }
    wrap.appendChild(img)

    // Broken/missing image: placeholder with the alt text, never a blank hole.
    img.addEventListener('error', () => {
      if (!img.getAttribute('src') || wrap.classList.contains('cm-md-image-broken')) return
      wrap.classList.add('cm-md-image-broken')
      const ph = document.createElement('span')
      ph.className = 'cm-md-image-placeholder'
      ph.textContent = this.spec.alt || 'Image not found'
      wrap.appendChild(ph)
      img.remove()
    })

    this.mountResolvedSrc(img)
    this.mountSelection(wrap, img, view)
    return wrap
  }

  private cacheKey(): string {
    return `${this.baseDir}\n${this.spec.src}`
  }

  private mountResolvedSrc(img: HTMLImageElement): void {
    const key = this.cacheKey()
    const cached = imageCache.get(key)
    if (cached) {
      img.src = cached.src
      return
    }
    void window.api.resolveImageSrc(this.baseDir, this.spec.src).then((resolved) => {
      imageCache.set(key, resolved)
      img.src = resolved.src
    })
  }

  /** Click-to-select: open the zoom toolbar without collapsing to source. */
  private mountSelection(wrap: HTMLElement, img: HTMLImageElement, view: EditorView): void {
    img.addEventListener('mousedown', (e) => {
      // Keep CM from moving the cursor into the source (which would reveal it).
      e.preventDefault()
      e.stopPropagation()
    })
    img.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (wrap.classList.contains('cm-md-image-selected')) return
      closeAllImageSelections()
      wrap.classList.add('cm-md-image-selected')
      wrap.appendChild(this.buildToolbar(img, view))
    })
  }

  private buildToolbar(img: HTMLImageElement, view: EditorView): HTMLElement {
    const toolbar = document.createElement('div')
    toolbar.className = 'cm-md-image-toolbar'
    // Clicks inside the toolbar must not reach CM (cursor move / deselect).
    toolbar.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    toolbar.addEventListener('click', (e) => e.stopPropagation())

    const naturalW = img.naturalWidth
    const naturalH = img.naturalHeight
    const pctOf = (w?: number): number =>
      naturalW && w ? Math.round((w / naturalW) * 100) : 100
    let pct = pctOf(this.spec.width)

    const label = document.createElement('span')
    label.className = 'cm-md-image-toolbar-pct'
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = '25'
    slider.max = '400'
    slider.step = '5'
    slider.value = String(Math.min(400, Math.max(25, pct)))
    slider.disabled = naturalW === 0
    slider.title = 'Image size'

    const applyStyle = (p: number): void => {
      label.textContent = `${p}%`
      if (!naturalW) return
      img.style.width = `${Math.round((naturalW * p) / 100)}px`
      img.style.height = naturalH
        ? `${Math.round((naturalH * p) / 100)}px`
        : ''
    }
    applyStyle(pct)

    slider.addEventListener('input', () => applyStyle(Number(slider.value)))
    slider.addEventListener('change', () => {
      pct = Number(slider.value)
      if (!naturalW) return
      const w = Math.max(1, Math.round((naturalW * pct) / 100))
      const h = naturalH ? Math.max(1, Math.round((naturalH * pct) / 100)) : null
      writeImageSize(view, this.sourceFrom, w, h)
    })

    const reset = document.createElement('button')
    reset.className = 'cm-md-image-toolbar-btn'
    reset.textContent = '↺'
    reset.title = 'Reset to original size'
    reset.addEventListener('click', (e) => {
      e.preventDefault()
      writeImageSize(view, this.sourceFrom, null, null)
    })

    toolbar.append(label, slider, reset)

    // "Show in file manager" only for local files.
    const cached = imageCache.get(this.cacheKey())
    if (cached?.absPath) {
      const reveal = document.createElement('button')
      reveal.className = 'cm-md-image-toolbar-btn'
      reveal.textContent = '⏏'
      reveal.title = 'Show in file manager'
      reveal.addEventListener('click', (e) => {
        e.preventDefault()
        window.api.showItemInFolder(cached.absPath!)
      })
      toolbar.appendChild(reveal)
    }
    return toolbar
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

export class TableWidget extends BlockWidget {
  constructor(
    readonly source: string,
    sourceFrom: number,
    sourceTo: number
  ) {
    super(sourceFrom, sourceTo)
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
    this.mountClickToSource(wrap, view)
    return wrap
  }
}

/** Interactive task-list checkbox; toggles the source `[x]` marker in place. */
export class TaskWidget extends WidgetType {
  constructor(
    readonly sourceFrom: number,
    readonly checked: boolean
  ) {
    super()
  }

  eq(other: TaskWidget): boolean {
    return other.sourceFrom === this.sourceFrom && other.checked === this.checked
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.className = 'cm-md-task'
    input.checked = this.checked
    input.addEventListener('mousedown', (e) => e.stopPropagation())
    input.addEventListener('change', () => {
      view.dispatch({
        changes: {
          from: this.sourceFrom + 1,
          to: this.sourceFrom + 2,
          insert: input.checked ? 'x' : ' '
        }
      })
    })
    return input
  }

  ignoreEvent(): boolean {
    return false
  }
}
