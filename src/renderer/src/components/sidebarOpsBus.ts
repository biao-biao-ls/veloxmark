type Opener = (anchor: DOMRect) => void

let opener: Opener | null = null

export function openSidebarOps(anchor: DOMRect): void {
  opener?.(anchor)
}

export function registerSidebarOps(fn: Opener | null): void {
  opener = fn
}
