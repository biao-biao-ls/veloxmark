import { focusEditorBody } from './popup'
import { hushLayers } from '../../hooks/useHushLayer'
import type { CtxMenuState, CtxRuntime } from './types'


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
