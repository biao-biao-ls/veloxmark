/**
 * Widget-side contextmenu entry (P27).
 *
 * Rendered-block widgets run with `WidgetType.ignoreEvent() === true` (a CM
 * cursor landing in the block's source range would collapse the widget), so
 * CM6 never routes their events through setup.ts's domEventHandlers. Each
 * widget therefore owns its own contextmenu listener — the same pattern as
 * table/widget.ts's td handler — and converges on the registry's
 * `buildContextMenu` surface.
 */
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
