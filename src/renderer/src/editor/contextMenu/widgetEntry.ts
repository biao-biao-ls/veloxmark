import type { EditorView } from '@codemirror/view'
import { detectAtPos } from './detect'
import { buildContextMenu, getCtxRuntime, openContextMenu } from './registry'

export function attachWidgetContextMenu(el: HTMLElement, view: EditorView, pos?: number): void {
  el.addEventListener('contextmenu', (e) => {
    if (!getCtxRuntime()) return
    e.preventDefault()
    e.stopPropagation()
    let p = pos
    if (p == null) {
      try {
        p = view.posAtDOM(el)
      } catch {
        p = 0
      }
    }
    const hit = detectAtPos(view, p)
    openContextMenu({ x: e.clientX, y: e.clientY, items: buildContextMenu(view, hit) })
  })
}
