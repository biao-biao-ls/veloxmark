import { syntaxTree } from '@codemirror/language'
import { EditorView, WidgetType } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import hljs from 'highlight.js/lib/common'
import katex from 'katex'
import mermaid from 'mermaid'
import githubCss from 'highlight.js/styles/github.css?raw'
import githubDarkCss from 'highlight.js/styles/github-dark.css?raw'
import type { ThemeName } from './theme'
import type { FrontMatterSummary } from './livePreview/extendedSyntax'
import { t } from '../i18n'
import { toggleCodeBlockFold } from './livePreview/codeBlockUi'
import { openMermaidLightbox } from '../components/mermaidLightboxBus'

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

// P15: mermaid.render is main-thread heavy — a large document full of
// diagrams would otherwise kick off dozens of concurrent renders on one
// rebuild. Cap concurrency at 2; excess callers queue FIFO.
const MERMAID_MAX_CONCURRENCY = 2
let mermaidActive = 0
const mermaidWaiters: Array<() => void> = []

async function acquireMermaidSlot(): Promise<void> {
  if (mermaidActive < MERMAID_MAX_CONCURRENCY) {
    mermaidActive++
    return
  }
  await new Promise<void>((resolve) => {
    mermaidWaiters.push(resolve)
  })
  // Slot was transferred to us by releaseMermaidSlot — already counted.
}

function releaseMermaidSlot(): void {
  const next = mermaidWaiters.shift()
  if (next) next()
  else mermaidActive--
}

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
  const key = `${theme}\n${code}`
  // Cache hits skip the queue entirely.
  const cached = mermaidCache.get(key)
  if (cached) return cached
  await acquireMermaidSlot()
  try {
    ensureMermaidBase()
    // Re-check: a queued predecessor may have rendered the same diagram.
    const again = mermaidCache.get(key)
    if (again) return again
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
  } finally {
    releaseMermaidSlot()
  }
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

/**
 * P16: rasterize a rendered SVG to a PNG data URL at `scale`× (default 2×,
 * matching the Typora-quality bar). Returns null when the canvas or the SVG
 * image fails to load.
 */
async function rasterizeSvgToPng(svgEl: SVGSVGElement, scale = 2): Promise<string | null> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const w = svgEl.clientWidth || Number(clone.getAttribute('width')) || 800
  const h = svgEl.clientHeight || Number(clone.getAttribute('height')) || 600
  if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${w} ${h}`)
  const svgText = new XMLSerializer().serializeToString(clone)
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`
  const img = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('svg image failed to load'))
      img.src = url
    })
  } catch {
    return null
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round((img.width || w) * scale))
  canvas.height = Math.max(1, Math.round((img.height || h) * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

/** P16: PNG export — 2× raster + native save dialog (default name diagram.png). */
async function exportPng(svgEl: SVGSVGElement): Promise<void> {
  const dataUrl = await rasterizeSvgToPng(svgEl, 2)
  if (!dataUrl) return
  const target = await mermaidIo.showSaveDialog('diagram.png', [
    { name: 'PNG', extensions: ['png'] },
    { name: 'All Files', extensions: ['*'] }
  ])
  if (!target) return
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  await mermaidIo.writeFileBase64(target, b64)
}

/** P16: Copy Image — PNG data URL onto the OS clipboard. */
async function copyPngImage(svgEl: SVGSVGElement): Promise<void> {
  const dataUrl = await rasterizeSvgToPng(svgEl, 2)
  if (!dataUrl) return
  await mermaidIo.clipboardWriteImage(dataUrl)
}

// ---- P16 export IO seam ------------------------------------------------------
// contextBridge's `window.api` is frozen (non-configurable, non-writable) in
// current Electron builds, so e2e suites inject capture stubs here instead —
// same test-hook convention as window.__veloxTable / __veloxEditor. Product
// code always falls through to window.api when no override is installed.

interface MermaidExportIo {
  showSaveDialog: (defaultPath?: string, filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
  writeFileBase64: (filePath: string, base64: string) => Promise<boolean>
  clipboardWriteImage: (dataUrl: string) => Promise<void>
}

let mermaidIoOverride: Partial<MermaidExportIo> | null = null

export function setMermaidExportIo(io: Partial<MermaidExportIo> | null): void {
  mermaidIoOverride = io
}

const mermaidIo: MermaidExportIo = {
  showSaveDialog: (defaultPath, filters) =>
    mermaidIoOverride?.showSaveDialog
      ? mermaidIoOverride.showSaveDialog(defaultPath, filters)
      : window.api.showSaveDialog(defaultPath, filters),
  writeFileBase64: (filePath, base64) =>
    mermaidIoOverride?.writeFileBase64
      ? mermaidIoOverride.writeFileBase64(filePath, base64)
      : window.api.writeFileBase64(filePath, base64),
  clipboardWriteImage: (dataUrl) =>
    mermaidIoOverride?.clipboardWriteImage
      ? mermaidIoOverride.clipboardWriteImage(dataUrl)
      : window.api.clipboardWriteImage(dataUrl)
}

// ---- P16 mermaid error-state memory -----------------------------------------
// Live preview recreates the widget whenever the fence text changes, so an
// in-DOM "old SVG" would be lost exactly when it is needed (user breaks the
// syntax). Remember the last good render per fence start; on failure the new
// widget shows that SVG dimmed instead of wiping the diagram.

interface MermaidGoodRender {
  svg: string
  code: string
  theme: ThemeName
}

const mermaidLastGood = new Map<number, MermaidGoodRender>()

function rememberMermaidGood(pos: number, entry: MermaidGoodRender): void {
  mermaidLastGood.set(pos, entry)
  // Bounded: drop oldest entries when the document churns a lot.
  if (mermaidLastGood.size > 64) {
    const first = mermaidLastGood.keys().next().value
    if (first !== undefined) mermaidLastGood.delete(first)
  }
}

/** Test hook / theme switch hook: clear remembered mermaid renders. */
export function clearMermaidLastGood(): void {
  mermaidLastGood.clear()
}

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

/** One button in a block widget's hover toolbar. */
export interface BlockToolbarItem {
  label: string
  title: string
  onClick: (btn: HTMLButtonElement) => void
}

/**
 * Base for block-level rendered widgets (code, mermaid, math, table).
 * Owns the click-to-source behavior (mousedown on the block's padding puts
 * the cursor back at the block's source range; hits on rendered content let
 * the browser's native selection work) plus the shared hover toolbar.
 */
export abstract class BlockWidget extends WidgetType {
  constructor(
    readonly sourceFrom: number,
    readonly sourceTo: number
  ) {
    super()
  }

  /**
   * Attach click-to-source to the widget's root element (call once in toDOM).
   *
   * Any click on the block — padding or rendered content — jumps back to the
   * source start. Native text selection inside the widget is impossible (it's
   * a contenteditable=false host; CM's DOMObserver maps any in-widget caret
   * back into the doc and collapses the block — probed and confirmed), so a
   * content-hit exception would only create dead clicks. The toolbar is the
   * one exemption: its buttons stopPropagation themselves.
   */
  protected mountClickToSource(el: HTMLElement, view: EditorView): void {
    el.addEventListener('mousedown', (e) => {
      if (e.target instanceof Element && e.target.closest('.cm-md-block-toolbar')) return
      e.preventDefault()
      view.dispatch({ selection: { anchor: this.sourceFrom }, scrollIntoView: true })
    })
  }

  /**
   * Wrap a block widget's visual box in an outer element that carries the
   * vertical gap as *padding*. CodeMirror measures only border boxes, so a
   * margin on the widget box itself would not be counted in the heightmap
   * and every line below the widget would click-map to the wrong position.
   * Click-to-source lives on the outer element: mousedowns on the inner box
   * bubble up, and toolbar buttons stopPropagation before they get here.
   */
  protected wrapWithGap(el: HTMLElement, view: EditorView): HTMLElement {
    const outer = document.createElement('div')
    outer.className = 'cm-md-block-gap'
    outer.appendChild(el)
    this.mountClickToSource(outer, view)
    return outer
  }

  /** Build the hover toolbar (top-right) and append it to `wrap`. */
  protected attachBlockToolbar(wrap: HTMLElement, items: BlockToolbarItem[]): void {
    const bar = document.createElement('div')
    bar.className = 'cm-md-block-toolbar'
    for (const item of items) {
      const btn = document.createElement('button')
      btn.className = 'cm-md-block-toolbar-btn'
      btn.textContent = item.label
      btn.title = item.title
      // Never let toolbar presses fall through to click-to-source.
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
      })
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        item.onClick(btn)
      })
      bar.appendChild(btn)
    }
    wrap.appendChild(bar)
  }

  /** Copy `text` to the clipboard; flash a ✓ on `btn` when it succeeds. */
  protected async copyWithFeedback(text: string, btn: HTMLButtonElement): Promise<void> {
    try {
      await window.api.clipboardWrite(text)
    } catch {
      return
    }
    const original = btn.textContent
    btn.textContent = '✓'
    btn.classList.add('copied')
    setTimeout(() => {
      btn.textContent = original
      btn.classList.remove('copied')
    }, 1000)
  }

  /**
   * CM must not handle events inside rendered blocks: a cursor landing in
   * the block's source range would collapse the widget mid-selection.
   * Jump-to-source is driven explicitly by mountClickToSource instead.
   */
  ignoreEvent(): boolean {
    return true
  }
}

/** P24: UI options threaded from LivePreviewConfig into the code-block widget. */
export interface CodeBlockUiOptions {
  collapseLines: number
  showLineNumbers: boolean
  wrap: boolean
  expanded: boolean
  key: string
}

/**
 * P24: span-aware highlighted-line splitter. hljs output wraps tokens in
 * <span>s that may cross line breaks; splitting on '\n' alone would leave
 * unbalanced tags and wreck the line-number layout. Close every open span at
 * a newline and reopen the active tag stack on the next line.
 */
export function splitHighlightedLines(html: string): string[] {
  const lines: string[] = []
  const stack: string[] = []
  let cur = ''
  let i = 0
  while (i < html.length) {
    const ch = html[i]
    if (ch === '<') {
      const end = html.indexOf('>', i)
      if (end === -1) {
        cur += html.slice(i)
        break
      }
      const tag = html.slice(i, end + 1)
      if (tag.startsWith('</')) stack.pop()
      else if (!tag.endsWith('/>')) stack.push(tag)
      cur += tag
      i = end + 1
    } else if (ch === '\n') {
      for (let k = 0; k < stack.length; k++) cur += '</span>'
      lines.push(cur)
      cur = stack.join('')
      i += 1
    } else {
      const nextNl = html.indexOf('\n', i)
      const nextTag = html.indexOf('<', i)
      let stop = html.length
      if (nextTag !== -1) stop = Math.min(stop, nextTag)
      if (nextNl !== -1) stop = Math.min(stop, nextNl)
      cur += html.slice(i, stop)
      i = stop
    }
  }
  lines.push(cur)
  return lines
}

/** P04/P24: fenced code widget — Copy (always the FULL code), optional line
 * collapse (expand memory per content hash), line numbers and soft wrap. */
export class CodeBlockWidget extends BlockWidget {
  constructor(
    readonly code: string,
    readonly lang: string,
    sourceFrom: number,
    sourceTo: number,
    readonly ui?: CodeBlockUiOptions
  ) {
    super(sourceFrom, sourceTo)
  }

  eq(other: CodeBlockWidget): boolean {
    if (
      other.code !== this.code ||
      other.lang !== this.lang ||
      other.sourceFrom !== this.sourceFrom
    ) {
      return false
    }
    const a = this.ui
    const b = other.ui
    if (!a && !b) return true
    if (!a || !b) return false
    return (
      a.collapseLines === b.collapseLines &&
      a.showLineNumbers === b.showLineNumbers &&
      a.wrap === b.wrap &&
      a.expanded === b.expanded &&
      a.key === b.key
    )
  }

  toDOM(view: EditorView): HTMLElement {
    ensureScopedCss()
    const lines = this.code.split('\n')
    const threshold = this.ui?.collapseLines ?? 0
    const collapsed = threshold > 0 && lines.length > threshold && !this.ui?.expanded

    const wrap = document.createElement('div')
    wrap.className = 'cm-md-code-block'
    if (this.ui?.wrap) wrap.classList.add('cm-md-code-block-wrap')
    if (collapsed) wrap.classList.add('cm-md-code-block-collapsed')

    const label = document.createElement('div')
    label.className = 'cm-md-code-lang'
    label.textContent = this.lang || 'text'
    wrap.appendChild(label)

    const pre = document.createElement('pre')
    const codeEl = document.createElement('code')
    codeEl.className = 'hljs'
    const fullHtml = highlightCodeHtml(this.code, this.lang)
    const htmlLines = splitHighlightedLines(fullHtml)
    // Collapsed blocks render the FIRST `threshold` lines, so numbering 1..N
    // is correct in both states (expanded numbers the full range 1..total).
    const visible = collapsed ? htmlLines.slice(0, threshold) : htmlLines
    if (this.ui?.showLineNumbers) {
      codeEl.classList.add('cm-md-code-lines')
      codeEl.innerHTML = visible
        .map(
          (h, i) =>
            `<span class="cm-md-code-line"><span class="cm-md-code-line-no">${i + 1}</span><span class="cm-md-code-line-src">${h}</span></span>`
        )
        .join('')
    } else {
      codeEl.innerHTML = visible.join('\n')
    }
    pre.appendChild(codeEl)
    wrap.appendChild(pre)

    const items: BlockToolbarItem[] = []
    // P24: Fold re-collapses an expanded long block (memory key cleared).
    if (!collapsed && threshold > 0 && lines.length > threshold && this.ui) {
      const ui = this.ui
      items.push({
        label: t('codeBlock.fold'),
        title: t('codeBlock.fold'),
        onClick: () => {
          view.dispatch({ effects: toggleCodeBlockFold.of({ key: ui.key, expanded: false }) })
        }
      })
    }
    items.push({
      label: 'Copy',
      title: 'Copy code',
      onClick: (btn) => void this.copyWithFeedback(this.code, btn)
    })
    this.attachBlockToolbar(wrap, items)

    // P24: expander chip — revealed lines on click. stopPropagation keeps the
    // press away from wrapWithGap's click-to-source listener.
    if (collapsed && this.ui) {
      const hidden = lines.length - threshold
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'cm-md-code-expander'
      btn.textContent = t('codeBlock.expand', { n: hidden })
      const stop = (e: Event) => {
        e.stopPropagation()
        e.preventDefault()
      }
      btn.addEventListener('mousedown', stop)
      btn.addEventListener('click', (e) => {
        stop(e)
        view.dispatch({ effects: toggleCodeBlockFold.of({ key: this.ui!.key, expanded: true }) })
      })
      wrap.appendChild(btn)
    }
    return this.wrapWithGap(wrap, view)
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
    const prev = mermaidLastGood.get(this.sourceFrom)
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
        label: 'Copy',
        title: 'Copy mermaid source',
        onClick: (btn) => void this.copyWithFeedback(this.code, btn)
      },
      {
        label: 'SVG',
        title: 'Export diagram as SVG',
        onClick: () => {
          const svgEl = svgHost.querySelector('svg')
          if (svgEl) void exportSvg(svgEl)
        }
      },
      {
        label: t('mermaid.png'),
        title: 'Export diagram as PNG (2x)',
        onClick: () => {
          const svgEl = svgHost.querySelector('svg')
          if (svgEl) void exportPng(svgEl)
        }
      },
      {
        label: t('mermaid.copyImage'),
        title: 'Copy diagram image to clipboard',
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
    this.attachBlockToolbar(el, [
      {
        label: 'Copy',
        title: 'Copy TeX source',
        onClick: (btn) => void this.copyWithFeedback(this.tex, btn)
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

// ---- P11 extended syntax widgets ----------------------------------------------

/**
 * Collapsed YAML front-matter card. Clicking anywhere puts the cursor inside
 * the `---` source range — the blockTouched rule then drops the widget and
 * reveals the raw source, same edit loop as code blocks.
 */
export class FrontMatterWidget extends WidgetType {
  constructor(
    readonly summary: FrontMatterSummary,
    readonly yaml: string,
    readonly sourceFrom: number,
    readonly sourceTo: number
  ) {
    super()
  }

  eq(other: FrontMatterWidget): boolean {
    return other.yaml === this.yaml && other.sourceFrom === this.sourceFrom
  }

  toDOM(view: EditorView): HTMLElement {
    const outer = document.createElement('div')
    outer.className = 'cm-md-block-gap'
    const card = document.createElement('div')
    card.className = 'cm-md-frontmatter'

    const head = document.createElement('div')
    head.className = 'cm-md-frontmatter-head'
    head.textContent = 'Front Matter'
    card.appendChild(head)

    const bodyEl = document.createElement('div')
    bodyEl.className = 'cm-md-frontmatter-body'
    const s = this.summary
    const rows: Array<[string, string]> = []
    if (s.title) rows.push(['title', s.title])
    if (s.date) rows.push(['date', s.date])
    if (s.tags && s.tags.length) rows.push(['tags', s.tags.join(', ')])
    if (rows.length === 0) {
      // No recognized summary keys — show a compact key listing instead.
      const keys = s.keys.length ? s.keys.join(', ') : this.yaml.split(/\r?\n/).length + ' lines'
      rows.push(['keys', keys])
    }
    for (const [k, v] of rows) {
      const kv = document.createElement('div')
      kv.className = 'cm-md-frontmatter-kv'
      const keyEl = document.createElement('span')
      keyEl.className = 'cm-md-frontmatter-key'
      keyEl.textContent = k
      const valEl = document.createElement('span')
      valEl.className = 'cm-md-frontmatter-val'
      valEl.textContent = v
      kv.appendChild(keyEl)
      kv.appendChild(valEl)
      bodyEl.appendChild(kv)
    }
    card.appendChild(bodyEl)
    outer.appendChild(card)

    outer.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      // Cursor into the YAML body → blockTouched → source shows for editing.
      view.dispatch({
        selection: { anchor: Math.min(this.sourceFrom + 4, this.sourceTo) },
        scrollIntoView: true
      })
      view.focus()
    })
    return outer
  }

  ignoreEvent(): boolean {
    return true
  }
}

/**
 * Footnote reference `[^id]` → superscript number. Click jumps to the
 * definition line when one exists.
 */
export class FootnoteRefWidget extends WidgetType {
  constructor(
    readonly id: string,
    readonly num: number | undefined,
    readonly defPos: number | undefined
  ) {
    super()
  }

  eq(other: FootnoteRefWidget): boolean {
    return other.id === this.id && other.num === this.num && other.defPos === this.defPos
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('sup')
    el.className = 'cm-md-footnote-ref'
    el.textContent = this.num != null && this.num > 0 ? `[${this.num}]` : `[${this.id}]`
    if (this.defPos != null) {
      el.classList.add('cm-md-footnote-ref-clickable')
      el.title = `跳转到脚注 [^${this.id}]`
      const defPos = this.defPos
      el.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        view.dispatch({
          selection: { anchor: defPos },
          effects: EditorView.scrollIntoView(defPos, { y: 'center' }),
          scrollIntoView: true
        })
        view.focus()
      })
    } else {
      el.title = `未找到脚注定义 [^${this.id}]`
    }
    return el
  }

  ignoreEvent(): boolean {
    return true
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
// P10: interactive TableWidget moved to editor/table/widget.ts (cell editing,
// row/col ops). Rendering helpers (renderInlineCell, parse/format) live in
// editor/table/parse.ts.

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
