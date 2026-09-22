/**
 * Tiny module-level bus between MermaidWidget (editor decorations, not React)
 * and the MermaidLightbox component mounted at the App root. Widgets call
 * `openMermaidLightbox(svg)`; the lightbox registers its setter on mount.
 * Singleton by construction — registering replaces any previous opener.
 */
type Opener = (svg: string) => void

let opener: Opener | null = null

export function openMermaidLightbox(svg: string): void {
  opener?.(svg)
}

export function registerMermaidLightbox(fn: Opener | null): void {
  opener = fn
}
