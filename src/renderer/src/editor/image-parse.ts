
export type ImageAlign = 'left' | 'center' | 'right'
export type ImageFlip = 'h' | 'v' | 'hv'

export interface ParsedImage {
  alt: string
  src: string
  title?: string
  width?: number
  height?: number
  align?: ImageAlign
  flip?: ImageFlip
}

const ATTR_GROUP = String.raw`\{(?:flip=[hv]{1,2}|align=(?:left|center|right))\}`

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

export function flipTransform(flip: string | undefined): string {
  const parts: string[] = []
  if (flip?.includes('h')) parts.push('scaleX(-1)')
  if (flip?.includes('v')) parts.push('scaleY(-1)')
  return parts.join(' ')
}

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
