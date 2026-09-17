import type { InlineContext, MarkdownConfig } from '@lezer/markdown'

/**
 * Typora/pandoc image attributes (P05):
 * ```
 * ![alt](src =100x50)          size (pandoc/Typora compatible)
 * ![alt](src =100x50){flip=hv} size + flip (VeloxMark extension)
 * ![alt](src){flip=v}          flip only
 * ```
 *
 * CommonMark — and stock @lezer/markdown — rejects `![a](src =100x50)`: the
 * unquoted trailing token breaks the link parse and the Image node collapses
 * to the 4-character `![a]` stub. This inline parser claims the attributed
 * forms (it runs before the built-in link scan), producing a full-span Image
 * node; plain `![a](src)` images fall through to the default parse untouched.
 *
 * `{flip=h|v|hv}` is our own non-standard suffix stored right after the
 * closing paren (the `=WxH` slot has no room for it); the renderer applies
 * it as a CSS transform, export writes it as inline style.
 *
 * Shared by the live-preview markdown() config (setup.ts) and the export
 * renderer (export/renderDoc.ts) so both see identical trees.
 */

const IMAGE_ATTR_RE =
  /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?(?:\s+=\s*(\d+)[xX](\d+))?\s*\)(?:\s*\{flip=([hv]{1,2})\})?/

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
        // Groups: 1=alt 2=src 3=width 4=height 5=flip.
        const hasSize = m[3] !== undefined
        const hasFlip = m[5] !== undefined
        if (!hasSize && !hasFlip) return -1
        return cx.addElement(cx.elt('Image', pos, pos + m[0].length))
      }
    }
  ]
}
