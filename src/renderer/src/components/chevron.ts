/**
 * The one fold chevron — Lucide-style `>` (stroke, round caps), shared by the
 * React icon set (Icons.tsx ChevronIcon) and the CodeMirror DOM widgets
 * (fold.ts / quoteFold.ts carets). Direction is never a second glyph: the
 * chevron always draws `>`, and `.velox-chevron.is-open` (chrome.css) rotates
 * it 90° to point down. Collapsed = right, expanded = down — one icon, two
 * rotations (UX 折叠箭头: 弃实心三角，单箭头旋转).
 */
export const CHEVRON_PATH = 'M9 6l6 6-6 6'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** DOM twin of ChevronIcon for CodeMirror widgets (no React there). */
export function chevronEl(open = false): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('class', open ? 'velox-chevron is-open' : 'velox-chevron')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', CHEVRON_PATH)
  svg.append(path)
  return svg
}
