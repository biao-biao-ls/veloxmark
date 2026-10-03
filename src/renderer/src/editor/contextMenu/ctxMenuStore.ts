/**
 * Context-menu runtime bridge + menu state store（2C 自 registry.ts 平移）。
 *
 * `setCtxRuntime` 由 App 装配（runCommand / clipboard / toast 反向桥）；
 * menuState 是无状态菜单的唯一宿主状态，React 壳（EditorContextMenu.tsx）
 * 经 subscribe 消费。closeContextMenu 携带焦点归还合同（见下）。
 */
import { focusEditorBody } from './popup'
import { hushLayers } from '../../hooks/useHushLayer'
import type { CtxMenuState, CtxRuntime } from './types'

// ---- runtime + store ---------------------------------------------------------

let runtime: CtxRuntime | null = null
export function setCtxRuntime(rt: CtxRuntime | null): void {
  runtime = rt
}
export function getCtxRuntime(): CtxRuntime | null {
  return runtime
}

let menuState: CtxMenuState | null = null
const listeners = new Set<() => void>()

export function getContextMenuState(): CtxMenuState | null {
  return menuState
}
export function subscribeContextMenu(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function emit(): void {
  for (const fn of [...listeners]) fn()
}
// FE-09: layering registration (glb-hush:one-shot) — the open ⋮/right-click
// menu is a 'menu' tier layer. close() routes back through closeContextMenu
// so bus-driven collapse keeps the focus-return contract below.
let hushOff: (() => void) | null = null

export function openContextMenu(state: CtxMenuState): void {
  menuState = state
  hushOff?.()
  hushOff = hushLayers.register({
    id: 'ctx-menu',
    tier: 'menu',
    close: () => closeContextMenu(),
    owns: (target) =>
      target instanceof Element && target.closest('.editor-context-menu, .velox-ctx-menu') != null
  })
  emit()
}
export function closeContextMenu(): void {
  if (!menuState) return
  menuState = null
  hushOff?.()
  hushOff = null
  emit()
  // Focus contract: return to the editor surface unless focus is somewhere
  // meaningful already (dialog, prefs panel, …).
  const active = document.activeElement as HTMLElement | null
  const meaningful =
    active != null &&
    active.isConnected &&
    active !== document.body &&
    active !== document.documentElement &&
    !active.closest?.('.editor-context-menu, .velox-ctx-menu')
  if (!meaningful) {
    focusEditorBody()
  }
}
