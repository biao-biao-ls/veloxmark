import type { InlineContext, MarkdownConfig } from '@lezer/markdown'

/**
 * Typora/pandoc `=WxH` image size attribute (P05).
 *
 * CommonMark — and stock @lezer/markdown — rejects `![a](src =100x50)`: the
 * unquoted trailing token breaks the link parse and the Image node collapses
 * to the 4-character `![a]` stub. This inline parser claims exactly the sized
 * form (it runs before the built-in link scan), producing a full-span Image
 * node; plain `![a](src)` images fall through to the default parse untouched.
 *
 * Shared by the live-preview markdown() config (setup.ts) and the export
 * renderer (export/renderDoc.ts) so both see identical trees.
 */

const IMAGE_WITH_SIZE_RE =
  /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s+=\s*(\d+)[xX](\d+)\s*\)/

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
        const m = IMAGE_WITH_SIZE_RE.exec(rest)
        if (!m || m.index !== 0) return -1
        return cx.addElement(cx.elt('Image', pos, pos + m[0].length))
      }
    }
  ]
}
