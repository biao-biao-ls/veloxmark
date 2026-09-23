import type { ThemeName } from '../theme'

// ---- P16 mermaid error-state memory -----------------------------------------
// Live preview recreates the widget whenever the fence text changes, so an
// in-DOM "old SVG" would be lost exactly when it is needed (user breaks the
// syntax). Remember the last good render per fence start; on failure the new
// widget shows that SVG dimmed instead of wiping the diagram.
// (2.3: moved verbatim from editor/widgets.ts. Module state mermaidLastGood
// lives HERE and only here — the widget reads it through getMermaidLastGood.)

export interface MermaidGoodRender {
  svg: string
  code: string
  theme: ThemeName
}

const mermaidLastGood = new Map<number, MermaidGoodRender>()

export function getMermaidLastGood(pos: number): MermaidGoodRender | undefined {
  return mermaidLastGood.get(pos)
}

export function rememberMermaidGood(pos: number, entry: MermaidGoodRender): void {
  mermaidLastGood.set(pos, entry)
  // Bounded: drop oldest entries when the document churns a lot.
  if (mermaidLastGood.size > 64) {
    const first = mermaidLastGood.keys().next().value
    if (first !== undefined) mermaidLastGood.delete(first)
  }
}
