import type { EditorView } from '@codemirror/view'
import { getCtxRuntime, openContextMenu } from './ctxMenuStore'
import { detectAtCoords } from './detect'
import { buildContextMenu } from './menuSkeleton'

export {
  closeContextMenu,
  getContextMenuState,
  getCtxRuntime,
  openContextMenu,
  setCtxRuntime,
  subscribeContextMenu
} from './ctxMenuStore'
export { registerContextMenuOps, type CtxOpFactory } from './deltaRegistry'
export { buildContextMenu } from './menuSkeleton'
export type { TableDeltaDeps } from './opsTable'
export { tableDeltaItems } from './opsTable'


export function handleEditorContextMenu(view: EditorView, e: MouseEvent): void {
  if (!getCtxRuntime()) return
  const hit = detectAtCoords(view, e.clientX, e.clientY)
  const sel = view.state.selection.main
  if (sel.empty && sel.from !== hit.pos) {
    view.dispatch({ selection: { anchor: hit.pos } })
  }
  e.preventDefault()
  openContextMenu({ x: e.clientX, y: e.clientY, items: buildContextMenu(view, hit) })
}
