import type { InlineContext, MarkdownConfig } from '@lezer/markdown'

/**
 * Typora/pandoc image attributes (P05 + IT-03 FE-04):
 * ```
 * ![alt](src =100x50)                  size (pandoc/Typora compatible)
 * ![alt](src =100x50){flip=hv}         size + flip (VeloxMark extension)
 * ![alt](src){flip=v}                  flip only
 * ![alt](src =100x50){align=center}    size + align (FE-04)
 * ![alt](src){flip=h}{align=right}     flip + align, either order
 * ```
 *
 * CommonMark — and stock @lezer/markdown — rejects `![a](src =100x50)`: the
 * unquoted trailing token breaks the link parse and the Image node collapses
 * to the 4-character `![a]` stub. This inline parser claims the attributed
 * forms (it runs before the built-in link scan), producing a full-span Image
 * node; plain `![a](src)` images fall through to the default parse untouched.
 *
 * `{flip=…}` / `{align=…}` are our own non-standard suffixes stored right
 * after the closing paren (the `=WxH` slot has no room for them); the
 * renderer turns flip into a CSS transform and align into wrapper placement,
 * export mirrors both. The tail accepts **any number** of those groups in any
 * order so a write-back that appends `{align=…}` to a `{flip=…}` image still
 * yields one Image node spanning the whole construct (FE-04 补齐 — read
 * semantics for size/flip are byte-identical to P05).
 *
 * Shared by the live-preview markdown() config (setup.ts) and the export
 * renderer (export/renderDoc/) so both see identical trees.
 */

const IMAGE_ATTR_RE =
  /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?(?:\s+=\s*(\d+)[xX](\d+))?\s*\)((?:\s*\{(?:flip=[hv]{1,2}|align=(?:left|center|right))\})*)/

export const imageSizeMarkdown: MarkdownConfig = {
  parseInline: [
    {
      name: 'SizedImage',
      // Must run before the built-in Image tokenizer, which claims `![` as an
      // opening delimiter and would otherwise consume the position first.
      before: 'Image',
      parse(cx: InlineContext, next: number, pos: number): number {
        if (next !== 33 /* ! */) return -1
        const rest = cx.slice(pos, cx.end)
        const m = IMAGE_ATTR_RE.exec(rest)
        if (!m || m.index !== 0) return -1
        // Only claim attributed images; plain ![a](src) stays with the
        // built-in tokenizer (identical node, but keep the parse contract).
        // Groups: 1=alt 2=src 3=width 4=height 5=attrs tail.
        const hasSize = m[3] !== undefined
        const hasAttrs = (m[5] ?? '').length > 0
        if (!hasSize && !hasAttrs) return -1
        return cx.addElement(cx.elt('Image', pos, pos + m[0].length))
      }
    }
  ]
}
