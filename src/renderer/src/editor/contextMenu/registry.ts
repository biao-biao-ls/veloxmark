/**
 * P27 context-menu registry — public surface (barrel) + editor-surface entry.
 *
 * `registerContextMenuOps(kind, factory)` lets block families attach delta
 * ops; `buildContextMenu(view, hit)` assembles the shared skeleton (剪切/
 * 拷贝/粘贴 → 复制为…▶ → 段落▶ → 格式▶ → 插入▶) plus those deltas. The menu
 * itself is stateless presentation — items carry ids + translated labels and
 * the React host (components/EditorContextMenu.tsx) renders what the store
 * holds. Zero business logic in the DOM.
 *
 * 实现按职责分四模块（2C 拆分），本文件只做 re-export + 编辑器面入口：
 *   ctxMenuStore.ts   runtime 桥 + menuState store（焦点归还合同）
 *   deltaRegistry.ts  block-op 注册表（registerContextMenuOps / __veloxCtxDebug）
 *   menuSkeleton.ts   共享骨架 + buildContextMenu + __veloxCtxLastHit 缝
 *   opsTable.ts       table-cell delta（P10 ops；模块级自举注册）
 * re-export 链保持全部消费方 import 零改动；opsTable/deltaRegistry 的模块级
 * 副作用随 barrel 首次加载触发（与拆分前 registry 直载时序等价）。
 */
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

// ---- entry: editor-surface contextmenu ---------------------------------------

/**
 * setup.ts domEventHandlers entry. Empty-selection → cursor-first (the menu
 * acts on the right-clicked block, not on a stale selection elsewhere).
 * NOTE: no scrollIntoView here — the host treats scroll as "close menu", so an
 * open that scrolls would race itself shut (e2e: useSel opens vanished).
 */
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
