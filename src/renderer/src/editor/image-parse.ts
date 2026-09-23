// ---- image markdown parsing (P05) -------------------------------------------
// (2.2: pure parse helpers moved verbatim from editor/widgets.ts — zero state;
// consumed by ImageWidget and export/renderDoc.)

/** Parsed `![alt](src "title" =WxH)` pieces. */
export interface ParsedImage {
  alt: string
  src: string
  width?: number
  height?: number
  /** Flip state persisted as a `{flip=h|v|hv}` attribute after the parens. */
  flip?: 'h' | 'v' | 'hv'
}

/**
 * Image markdown with optional P05 attributes:
 * `![alt](src "title" =WxH){flip=h|v|hv}` — Typora/pandoc `=WxH` size inside
 * the parens, plus our brace-suffixed flip (h = horizontal, v = vertical).
 * Exported for rewriteImageNode's write-back (needs the raw capture groups).
 */
export const IMAGE_MARKDOWN_RE =
  /^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?(?:\s+=(\d+)[xX](\d+))?\s*\)(?:\{flip=([hv]{1,2})\})?$/

export function parseImageMarkdown(text: string): ParsedImage | null {
  const m = IMAGE_MARKDOWN_RE.exec(text)
  if (!m) return null
  const parsed: ParsedImage = { alt: m[1], src: m[2] }
  if (m[4] && m[5]) {
    parsed.width = Number(m[4])
    parsed.height = Number(m[5])
  }
  if (m[6]) parsed.flip = m[6] as 'h' | 'v' | 'hv'
  return parsed
}

/** CSS transform for a flip state ('' when unflipped). Shared with export. */
export function flipTransform(flip: string | undefined): string {
  const parts: string[] = []
  if (flip?.includes('h')) parts.push('scaleX(-1)')
  if (flip?.includes('v')) parts.push('scaleY(-1)')
  return parts.join(' ')
}
