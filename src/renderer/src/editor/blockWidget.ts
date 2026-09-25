import { EditorView, WidgetType } from '@codemirror/view'
import { t } from '../i18n'
import { getCtxRuntime } from './contextMenu/registry'
import { attachWidgetContextMenu } from './contextMenu/widgetEntry'

// ---- widgets ----------------------------------------------------------------
// (2.1: BlockWidget base moved verbatim from editor/widgets.ts — shared by the
// code/mermaid/math widgets there and editor/table/widget.ts.)

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
    // ignoreEvent=true keeps CM6 out of the widget — the P27 menu needs its
    // own listener here (code-block / mermaid / math-block all land in wrapWithGap).
    attachWidgetContextMenu(outer, view, this.sourceFrom)
    return outer
  }

  /** Build the hover toolbar (top-right) and append it to `wrap`. Returns the
      bar so callers can dock extra cluster items into its flex row (11A-N2:
      hint chips are the rightmost corner element of the cluster). */
  protected attachBlockToolbar(wrap: HTMLElement, items: BlockToolbarItem[]): HTMLElement {
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
    return bar
  }

  /**
   * Copy `text` to the clipboard; flash a ✓ on `btn` AND raise a statusbar
   * toast (`message`). The flash is optimistic — it lands on the click
   * itself (professional toolbar feedback is immediate, not IPC-latency
   * delayed); a failed write restores the label and surfaces a failure toast.
   */
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

  /**
   * CM must not handle events inside rendered blocks: a cursor landing in
   * the block's source range would collapse the widget mid-selection.
   * Jump-to-source is driven explicitly by mountClickToSource instead.
   */
  ignoreEvent(): boolean {
    return true
  }
}
