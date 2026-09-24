/**
 * 6D: tiny module-level bus for the「操作」panel (mermaidLightboxBus 同构,
 * 宪法好模式). Bottom-bar triggers call `openSidebarOps(rect)`; the panel
 * registers its opener on mount — singleton by construction, so at most one
 * ops panel exists and a second trigger press toggles it closed. Mutual
 * exclusion with other popups (TreeMenu) comes from outside-mousedown dismiss.
 */
type Opener = (anchor: DOMRect) => void

let opener: Opener | null = null

export function openSidebarOps(anchor: DOMRect): void {
  opener?.(anchor)
}

export function registerSidebarOps(fn: Opener | null): void {
  opener = fn
}
