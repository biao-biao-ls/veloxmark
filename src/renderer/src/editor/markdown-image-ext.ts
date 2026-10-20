import type { InlineContext, MarkdownConfig } from '@lezer/markdown'


const IMAGE_ATTR_RE =
  /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?(?:\s+=\s*(\d+)[xX](\d+))?\s*\)((?:\s*\{(?:flip=[hv]{1,2}|align=(?:left|center|right))\})*)/

export const imageSizeMarkdown: MarkdownConfig = {
  parseInline: [
    {
      name: 'SizedImage',
      before: 'Image',
      parse(cx: InlineContext, next: number, pos: number): number {
        if (next !== 33 ) return -1
        const rest = cx.slice(pos, cx.end)
        const m = IMAGE_ATTR_RE.exec(rest)
        if (!m || m.index !== 0) return -1
        const hasSize = m[3] !== undefined
        const hasAttrs = (m[5] ?? '').length > 0
        if (!hasSize && !hasAttrs) return -1
        return cx.addElement(cx.elt('Image', pos, pos + m[0].length))
      }
    }
  ]
}
