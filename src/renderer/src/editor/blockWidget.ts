import { EditorView, WidgetType } from '@codemirror/view'
import { t } from '../i18n'
import { judgeClickSemantics, type HitTarget } from './clickSemantics'
import { getCtxRuntime } from './contextMenu/registry'
import { attachWidgetContextMenu } from './contextMenu/widgetEntry'


export interface BlockToolbarItem {
  label: string
  title: string
  onClick: (btn: HTMLButtonElement) => void
}

export abstract class BlockWidget extends WidgetType {
  constructor(
    readonly sourceFrom: number,
    readonly sourceTo: number
  ) {
    super()
  }

  protected clickCaretAnchor(_view: EditorView): number {
    return this.sourceFrom
  }

  protected mountClickToSource(el: HTMLElement, view: EditorView, hitTarget: HitTarget): void {
    el.addEventListener('mousedown', (e) => {
      if (e.target instanceof Element && e.target.closest('.cm-md-block-toolbar')) return
      if (e.button !== 0) return
      e.preventDefault()
      const verdict = judgeClickSemantics({ hitTarget, selectionEmpty: true })
      if (verdict.kind !== 'edit') return
      view.dispatch({ selection: { anchor: this.clickCaretAnchor(view) }, scrollIntoView: true })
    })
  }

  protected wrapWithGap(el: HTMLElement, view: EditorView, hitTarget: HitTarget): HTMLElement {
    const outer = document.createElement('div')
    outer.className = 'cm-md-block-gap'
    outer.appendChild(el)
    this.mountClickToSource(outer, view, hitTarget)
    attachWidgetContextMenu(outer, view, this.sourceFrom)
    return outer
  }

  protected attachBlockToolbar(wrap: HTMLElement, items: BlockToolbarItem[]): HTMLElement {
    const bar = document.createElement('div')
    bar.className = 'cm-md-block-toolbar'
    for (const item of items) {
      const btn = document.createElement('button')
      btn.className = 'cm-md-block-toolbar-btn'
      btn.textContent = item.label
      btn.title = item.title
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
    return bar
  }

  protected async copyWithFeedback(text: string, btn: HTMLButtonElement, message: string): Promise<void> {
    const original = btn.textContent
    btn.textContent = '✓'
    btn.classList.add('copied')
    const restore = (): void => {
      btn.textContent = original
      btn.classList.remove('copied')
    }
    try {
      await window.api.clipboardWrite(text)
    } catch {
      restore()
      getCtxRuntime()?.toast(t('toast.copyFailed'))
      return
    }
    getCtxRuntime()?.toast(message)
    setTimeout(restore, 1000)
  }

  ignoreEvent(): boolean {
    return true
  }
}

export function fenceBodyCaretPos(view: EditorView, sourceFrom: number, sourceTo: number): number {
  const doc = view.state.doc
  const open = doc.lineAt(Math.min(sourceFrom, Math.max(0, doc.length - 1)))
  const close = doc.lineAt(Math.min(sourceTo, Math.max(0, doc.length - 1)))
  if (open.number + 1 < close.number) return doc.line(open.number + 1).to
  return sourceFrom
}
