type Opener = (svg: string) => void

let opener: Opener | null = null

export function openMermaidLightbox(svg: string): void {
  opener?.(svg)
}

export function registerMermaidLightbox(fn: Opener | null): void {
  opener = fn
}
