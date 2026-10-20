import { EditorView, WidgetType } from '@codemirror/view'
import { hljsCss, texCss } from './syntaxColors'
import { t } from '../i18n'
import { langDisplayName, openCodeLangPicker, switchFenceLang } from './codeLangPicker'
import { toggleCodeBlockFold } from './livePreview/codeBlockUi'
import { BlockWidget, fenceBodyCaretPos } from './blockWidget'
import { highlightCodeHtml, splitHighlightedLines } from './render-helpers'



function injectScopedCss(css: string, scope: string): void {
  const scoped = css.replaceAll('.hljs', `${scope} .hljs`)
  const style = document.createElement('style')
  style.textContent = scoped
  document.head.appendChild(style)
}

let scopedCssInjected = false

export function ensureScopedCss(): void {
  if (scopedCssInjected) return
  scopedCssInjected = true
  injectScopedCss(hljsCss('light') + '\n' + texCss('light'), '.theme-light')
  injectScopedCss(hljsCss('dark') + '\n' + texCss('dark'), '.theme-dark')
}

export interface CodeBlockUiOptions {
  collapseLines: number
  showLineNumbers: boolean
  wrap: boolean
  expanded: boolean
  key: string
  i18nEpoch?: number
}


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

  protected clickCaretAnchor(view: EditorView): number {
    return fenceBodyCaretPos(view, this.sourceFrom, this.sourceTo)
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

    const badge = document.createElement('span')
    badge.className = 'cm-md-code-idle-chip'
    badge.textContent = langDisplayName(this.lang)
    wrap.appendChild(badge)

    const pre = document.createElement('pre')
    const codeEl = document.createElement('code')
    codeEl.className = 'hljs'
    const fullHtml = highlightCodeHtml(this.code, this.lang)
    const htmlLines = splitHighlightedLines(fullHtml)
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
    return this.wrapWithGap(wrap, view, 'code')
  }
}

export class CodeLangChip extends WidgetType {
  constructor(
    readonly lang: string,
    readonly fenceFrom: number,
    readonly i18nEpoch = 0
  ) {
    super()
  }
  eq(other: CodeLangChip): boolean {
    return (
      other.lang === this.lang &&
      other.fenceFrom === this.fenceFrom &&
      other.i18nEpoch === this.i18nEpoch
    )
  }
  ignoreEvent(): boolean {
    return true
  }
  toDOM(view: EditorView): HTMLElement {
    ensureScopedCss()
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'cm-md-code-src-chip'
    el.textContent = langDisplayName(this.lang)
    el.title = t('codeLang.title')
    const stop = (e: Event): void => {
      e.preventDefault()
      e.stopPropagation()
    }
    el.addEventListener('mousedown', stop)
    el.addEventListener('click', (e) => {
      stop(e)
      openCodeLangPicker(el, {
        current: this.lang,
        onPick: (id) => switchFenceLang(view, this.fenceFrom, id)
      })
    })
    return el
  }
}
