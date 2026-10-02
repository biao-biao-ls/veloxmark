// ---- image markdown parsing (P05 + IT-03 FE-04 ren-image:write-md) ----------
// Pure parse helpers — zero state; consumed by ImageWidget, the live-preview
// tree handler, the export renderer and imageEdit's write-back.

export type ImageAlign = 'left' | 'center' | 'right'
export type ImageFlip = 'h' | 'v' | 'hv'

/** Parsed `![alt](src "title" =WxH){flip=…}{align=…}` pieces. */
export interface ParsedImage {
  alt: string
  src: string
  /** Optional `"title"` inside the parens — preserved verbatim on write-back. */
  title?: string
  width?: number
  height?: number
  /** `{align=left|center|right}` suffix (IT-03 FE-04); absent = browser default. */
  align?: ImageAlign
  /** Flip state persisted as a `{flip=h|v|hv}` attribute after the parens. */
  flip?: ImageFlip
}

/**
 * Recognised `{key=value}` suffix groups. Unknown keys deliberately fail the
 * whole parse so their behaviour is unchanged from P05: the built-in Image
 * tokenizer keeps the `![a](src)` span and the brace text stays literal.
 */
const ATTR_GROUP = String.raw`\{(?:flip=[hv]{1,2}|align=(?:left|center|right))\}`

/**
 * Image markdown with optional P05/FE-04 attributes:
 * `![alt](src "title" =WxH){flip=h|v|hv}{align=left|center|right}`
 * — Typora/pandoc `=WxH` size inside the parens, plus our brace-suffixed
 * flip/align. Exported for write-backs that need the raw capture groups:
 *   1=alt 2=src 3=title 4=width 5=height 6=attrs tail
 *
 * The `=WxH` slot keeps its exact P05 acceptance (`\s+=` then two integers) —
 * read semantics for previously-parsed documents are unchanged; only the
 * optional attr tail was widened for `{align=…}` (FE-04 补齐).
 */
export const IMAGE_MARKDOWN_RE = new RegExp(
  String.raw`^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?(?:\s+=(\d+)[xX](\d+))?\s*\)((?:${ATTR_GROUP})*)$`
)

function parseAttrTail(tail: string): { align?: ImageAlign; flip?: ImageFlip } {
  const out: { align?: ImageAlign; flip?: ImageFlip } = {}
  for (const group of tail.match(/\{[^{}]*\}/g) ?? []) {
    const body = group.slice(1, -1)
    const eq = body.indexOf('=')
    if (eq < 0) continue
    const key = body.slice(0, eq)
    const val = body.slice(eq + 1)
    if (key === 'flip') out.flip = val as ImageFlip
    else if (key === 'align') out.align = val as ImageAlign
  }
  return out
}

export function parseImageMarkdown(text: string): ParsedImage | null {
  const m = IMAGE_MARKDOWN_RE.exec(text)
  if (!m) return null
  const parsed: ParsedImage = { alt: m[1], src: m[2] }
  if (m[3] !== undefined) parsed.title = m[3]
  if (m[4] && m[5]) {
    parsed.width = Number(m[4])
    parsed.height = Number(m[5])
  }
  const attrs = parseAttrTail(m[6] ?? '')
  if (attrs.align) parsed.align = attrs.align
  if (attrs.flip) parsed.flip = attrs.flip
  return parsed
}

/** CSS transform for a flip state ('' when unflipped). Shared with export. */
export function flipTransform(flip: string | undefined): string {
  const parts: string[] = []
  if (flip?.includes('h')) parts.push('scaleX(-1)')
  if (flip?.includes('v')) parts.push('scaleY(-1)')
  return parts.join(' ')
}

/**
 * Displayed width as a % of natural width — the single formula for the FE-04
 * edit float and the P05 zoom toolbar (previously two copies with different
 * fallbacks). Fallback 口径 (收口批 #8 定稿): live rendered `style.width`
 * first, then the source `=WxH` slot (`specWidth`), then 100. Non-positive /
 * non-finite candidates are skipped, never used as a divisor or dividend.
 */
export function deriveWidthPct(
  styleWidthCss: string | null | undefined,
  naturalWidth: number,
  specWidth?: number | null
): number {
  const nw = Number.isFinite(naturalWidth) && naturalWidth > 0 ? naturalWidth : 0
  const styled = Number.parseFloat(styleWidthCss ?? '')
  if (nw && Number.isFinite(styled) && styled > 0) return Math.round((styled / nw) * 100)
  if (nw && specWidth != null && Number.isFinite(specWidth) && specWidth > 0) {
    return Math.round((specWidth / nw) * 100)
  }
  return 100
}
