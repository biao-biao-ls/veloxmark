import githubCss from 'highlight.js/styles/github.css?raw'
import githubDarkCss from 'highlight.js/styles/github-dark.css?raw'
import { EditorView, WidgetType } from '@codemirror/view'
import { t } from '../i18n'
import { toggleCodeBlockFold } from './livePreview/codeBlockUi'
import { BlockWidget, type BlockToolbarItem } from './blockWidget'
import { highlightCodeHtml, splitHighlightedLines } from './render-helpers'

// ---- highlight.js themes + code block widgets (P04/P24/P28/P29) -------------
// (2.5: scoped CSS injector, CodeBlockWidget and CodeLangChip moved verbatim
// from editor/widgets.ts.)

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

/**
 * Ensure the theme-scoped hljs CSS is in the document. Historically lazy on
 * first CodeBlockWidget render; P29 exports it so the focused-panel chip
 * triggers it too — token colors exist on the panel's first frame even when
 * no widget has rendered yet. Guarded: DOM-less unit tests import freely.
 */
export function ensureScopedCss(): void {
  if (scopedCssInjected) return
  scopedCssInjected = true
  injectScopedCss(githubCss, '.theme-light')
  injectScopedCss(githubDarkCss, '.theme-dark')
}

/** P24: UI options threaded from LivePreviewConfig into the code-block widget. */
export interface CodeBlockUiOptions {
  collapseLines: number
  showLineNumbers: boolean
  wrap: boolean
  expanded: boolean
  key: string
  /** wave④/P18-F6: i18n epoch — toolbar labels are t()-bound at toDOM; eq must
   * invalidate DOM when the UI language changes so labels re-render. */
  i18nEpoch?: number
}

// splitHighlightedLines moved to render-helpers.ts (2.2) — imported above.

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
      a.key === b.key &&
      (a.i18nEpoch ?? 0) === (b.i18nEpoch ?? 0)
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
      label: t('toolbar.copy'),
      title: t('codeBlock.copyTitle'),
      onClick: (btn) => void this.copyWithFeedback(this.code, btn, t('toast.copiedCode'))
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

/**
 * P28: language chip shown in place of the hidden ```lang fence line while a
 * fenced code block is focused (panel-edit state). Text is the raw lang id
 * (`text` fallback matches CodeBlockWidget's label contract); language names
 * are never translated, so identity is just the lang string.
 */
export class CodeLangChip extends WidgetType {
  constructor(readonly lang: string) {
    super()
  }
  eq(other: CodeLangChip): boolean {
    return other.lang === this.lang
  }
  toDOM(): HTMLElement {
    // P29: pull in the scoped hljs CSS — the focused panel can be on screen
    // before any CodeBlockWidget ever rendered, and token marks need colors
    // from the first frame.
    ensureScopedCss()
    const el = document.createElement('span')
    el.className = 'cm-md-code-src-chip'
    el.textContent = this.lang || 'text'
    return el
  }
}
