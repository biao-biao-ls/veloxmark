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
  /** Flip state persisted as a `{flip=h|v|hv}` attribute after the parens. */
  flip?: 'h' | 'v' | 'hv'
}

/**
 * Image markdown with optional P05 attributes:
 * `![alt](src "title" =WxH){flip=h|v|hv}` — Typora/pandoc `=WxH` size inside
 * the parens, plus our brace-suffixed flip (h = horizontal, v = vertical).
 */
const IMAGE_MARKDOWN_RE =
  /^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?(?:\s+=(\d+)[xX](\d+))?\s*\)(?:\{flip=([hv]{1,2})\})?$/

export function parseImageMarkdown(text: string): ParsedImage | null {
  const m = IMAGE_MARKDOWN_RE.exec(text)
  if (!m) return null
  const parsed: ParsedImage = { alt: m[1], src: m[2] }
  if (m[4] && m[5]) {
    parsed.width = Number(m[4])
    parsed.height = Number(m[5])
  }
  if (m[6]) parsed.flip = m[6] as 'h' | 'v' | 'hv'
  return parsed
}

/** CSS transform for a flip state ('' when unflipped). Shared with export. */
export function flipTransform(flip: string | undefined): string {
  const parts: string[] = []
  if (flip?.includes('h')) parts.push('scaleX(-1)')
  if (flip?.includes('v')) parts.push('scaleY(-1)')
  return parts.join(' ')
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
 * Rewrite the image node containing `sourceFrom` with new size/flip
 * attributes (null clears them). Re-resolves the node through the syntax
 * tree so the write-back survives intermediate edits.
 */
function rewriteImageNode(
  view: EditorView,
  sourceFrom: number,
  next: { width?: number | null; height?: number | null; flip?: string | null }
): void {
  const state = view.state
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(sourceFrom, 1)
  while (node && node.name !== 'Image') node = node.parent
  if (!node) return
  const m = IMAGE_MARKDOWN_RE.exec(state.sliceDoc(node.from, node.to))
  if (!m) return
  const [, alt, src, title] = m
  const width = next.width !== undefined ? next.width : m[4] ? Number(m[4]) : null
  const height = next.height !== undefined ? next.height : m[5] ? Number(m[5]) : null
  const flip = next.flip !== undefined ? next.flip || null : m[6] || null
  const titlePart = title != null ? ` "${title}"` : ''
  const sizePart = width != null && height != null ? ` =${width}x${height}` : ''
  const flipPart = flip ? `{flip=${flip}}` : ''
  const insert = `![${alt}](${src}${titlePart}${sizePart})${flipPart}`
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
      // Explicit sizes win over the layout clamp — an upscale past the
      // container width must stay visible (matches Typora).
      img.style.maxWidth = 'none'
    }
    if (this.spec.flip) img.style.transform = flipTransform(this.spec.flip)
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
    // Keep events from reaching CM (cursor move / deselect) but NEVER
    // preventDefault on form controls: cancelling mousedown's default action
    // kills the range input's native thumb drag (buttons survive because they
    // fire on click, which is why only the slider felt broken).
    toolbar.addEventListener('mousedown', (e) => {
      e.stopPropagation()
      const t = e.target
      if (!(t instanceof Element && t.closest('input, button, select, textarea'))) {
        e.preventDefault()
      }
    })
    toolbar.addEventListener('click', (e) => e.stopPropagation())

    // Zoom sliders read better on a log scale: the thumb travels multiplicatively,
    // so 100% (original size) sits at the center of the track and each equal
    // step is an equal ratio, not an equal pixel delta. Track position 0-100
    // maps to 25%-400% via pos = 100·log4(pct/25)  ⇔  pct = 25·16^(pos/100).
    const PCT_MIN = 25
    const PCT_MAX = 400
    const RATIO = PCT_MAX / PCT_MIN // 16
    const posToPct = (pos: number): number =>
      Math.min(PCT_MAX, Math.max(PCT_MIN, Math.round(PCT_MIN * Math.pow(RATIO, pos / 100))))
    const pctToPos = (pct: number): number =>
      Math.min(
        100,
        Math.max(0, Math.round((100 * Math.log(pct / PCT_MIN)) / Math.log(RATIO)))
      )

    const pctOf = (w?: number): number =>
      img.naturalWidth && w ? Math.round((w / img.naturalWidth) * 100) : 100
    // The toolbar may be built from a STALE widget instance: eq() reuses this
    // DOM (and its listeners) across size/flip commits, so `this.spec` can
    // predate the latest source rewrite. The rendered element always carries
    // the committed state (applyStyle / flip toggles write it live), so derive
    // from it — reading spec here would reset a resized image to 100% on
    // re-select.
    const derivePct = (): number => {
      const nw = img.naturalWidth
      if (nw && img.style.width) {
        const w = Number.parseFloat(img.style.width)
        if (Number.isFinite(w) && w > 0) return Math.round((w / nw) * 100)
      }
      return pctOf(this.spec.width)
    }
    const deriveFlip = (): string => {
      const t = img.style.transform
      const h = t.includes('scaleX(-1)')
      const v = t.includes('scaleY(-1)')
      return h || v ? `${h ? 'h' : ''}${v ? 'v' : ''}` : (this.spec.flip ?? '')
    }
    const clampPct = (p: number): number => Math.min(PCT_MAX, Math.max(PCT_MIN, p))
    let pct = clampPct(derivePct())
    let flip = deriveFlip()

    const label = document.createElement('span')
    label.className = 'cm-md-image-toolbar-pct'
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = '0'
    slider.max = '100'
    slider.step = '1'
    slider.value = String(pctToPos(pct))
    // naturalWidth is 0 while the image is still loading — disable until then
    // (the load listener below re-enables it once it's ready).
    slider.disabled = img.naturalWidth === 0
    slider.title = 'Image size'

    const applyStyle = (p: number): void => {
      label.textContent = `${p}%`
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      if (!nw) return
      img.style.width = `${Math.round((nw * p) / 100)}px`
      img.style.height = nh ? `${Math.round((nh * p) / 100)}px` : ''
      img.style.maxWidth = 'none'
    }
    applyStyle(pct)

    slider.addEventListener('input', () => {
      pct = posToPct(Number(slider.value))
      applyStyle(pct)
    })
    slider.addEventListener('change', () => {
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      if (!nw) return
      const w = Math.max(1, Math.round((nw * pct) / 100))
      const h = nh ? Math.max(1, Math.round((nh * pct) / 100)) : null
      rewriteImageNode(view, this.sourceFrom, { width: w, height: h })
    })

    const flipBtn = (bit: 'h' | 'v', glyph: string, title: string): HTMLButtonElement => {
      const btn = document.createElement('button')
      btn.className = 'cm-md-image-toolbar-btn'
      btn.textContent = glyph
      btn.title = title
      if (flip.includes(bit)) btn.classList.add('active')
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        flip = flip.includes(bit)
          ? (flip.replace(bit, '') as typeof flip)
          : ((flip + bit) as typeof flip)
        // Deterministic order for hv regardless of toggle sequence.
        if (flip === 'vh') flip = 'hv'
        img.style.transform = flipTransform(flip)
        btn.classList.toggle('active', flip.includes(bit))
        rewriteImageNode(view, this.sourceFrom, { flip: flip || null })
      })
      return btn
    }

    const reset = document.createElement('button')
    reset.className = 'cm-md-image-toolbar-btn'
    reset.textContent = '1:1'
    reset.title = 'Reset to original size'
    reset.addEventListener('click', (e) => {
      e.preventDefault()
      pct = 100
      slider.value = String(pctToPos(100))
      applyStyle(100)
      rewriteImageNode(view, this.sourceFrom, { width: null, height: null })
    })

    toolbar.append(
      label,
      slider,
      flipBtn('h', '⇋', 'Flip horizontally'),
      flipBtn('v', '⤒', 'Flip vertically'),
      reset
    )

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

    // If the image loads while the toolbar is open, re-enable the slider.
    if (img.naturalWidth === 0) {
      img.addEventListener(
        'load',
        () => {
          if (toolbar.isConnected && slider.disabled) {
            slider.disabled = false
            // naturalWidth is only known now — re-derive before applying so a
            // committed size isn't overwritten with a stale percentage.
            pct = clampPct(derivePct())
            slider.value = String(pctToPos(pct))
            applyStyle(pct)
          }
        },
        { once: true }
      )
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
