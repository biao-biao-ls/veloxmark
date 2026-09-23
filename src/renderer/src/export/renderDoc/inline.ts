import type { SyntaxNode } from '@lezer/common'
import { flipTransform, parseImageMarkdown } from '../../editor/image-parse'
import { escapeHtml, textOf, type RenderCtx } from './ctx'
import { resolveImageForExport } from './image'
import { renderTextRun } from './inlineText'

// ---- inline (3.15) ----
// (3C: moved verbatim from export/renderDoc.ts.)

// ---- inline --------------------------------------------------------------------

/**
 * Render inline content of `container`, visiting children for which
 * `accept` returns true. Text between children goes through renderTextRun.
 */
export async function renderInlineChildren(
  container: SyntaxNode,
  ctx: RenderCtx,
  accept: (n: SyntaxNode) => boolean = () => true
): Promise<string> {
  return renderInlineRange(container.from, container.to, container, ctx, accept)
}

export async function renderInlineRange(
  from: number,
  to: number,
  container: SyntaxNode,
  ctx: RenderCtx,
  accept: (n: SyntaxNode) => boolean = () => true
): Promise<string> {
  let out = ''
  let cursor = from
  for (let child = container.firstChild; child; child = child.nextSibling) {
    if (child.from < from || child.to > to) continue
    if (child.from > cursor) out += renderTextRun(ctx.doc.slice(cursor, child.from), ctx)
    // Rejected children are consumed silently (URL text inside links, task
    // markers) — their source must not leak into the surrounding text gap.
    if (accept(child)) out += await renderInline(child, ctx)
    cursor = child.to
  }
  if (cursor < to) out += renderTextRun(ctx.doc.slice(cursor, to), ctx)
  return out
}

async function renderInline(node: SyntaxNode, ctx: RenderCtx): Promise<string> {
  switch (node.name) {
    // Marks are syntax furniture — never rendered.
    case 'EmphasisMark':
    case 'StrikethroughMark':
    case 'CodeMark':
    case 'LinkMark':
    case 'URL':
    case 'HeaderMark':
      return ''
    case 'Emphasis':
      return `<em>${await renderInlineChildren(node, ctx)}</em>`
    case 'StrongEmphasis':
      return `<strong>${await renderInlineChildren(node, ctx)}</strong>`
    case 'Strikethrough':
      return `<del>${await renderInlineChildren(node, ctx)}</del>`
    case 'InlineCode': {
      // Children are CodeMarks + text; strip marks, escape the code.
      let code = ''
      for (let c = node.firstChild; c; c = c.nextSibling) {
        if (c.name !== 'CodeMark') code += textOf(ctx, c)
      }
      if (!code) code = textOf(ctx, node).replace(/`/g, '')
      return `<code>${escapeHtml(code)}</code>`
    }
    case 'Link': {
      // P11: `[^id]` reference-links are footnote refs — render as superscript.
      const whole = textOf(ctx, node)
      const fn = /^\[\^([^\]\s]+)\]$/.exec(whole)
      if (fn) return renderTextRun(whole, ctx)
      const url = node.getChild('URL')
      const href = url ? textOf(ctx, url) : ''
      const inner = await renderInlineChildren(node, ctx, (n) => n.name !== 'URL')
      return `<a href="${escapeHtml(href)}">${inner}</a>`
    }
    case 'Autolink': {
      const url = node.getChild('URL')
      const href = url ? textOf(ctx, url) : textOf(ctx, node).replace(/^<|>$/g, '')
      return `<a href="${escapeHtml(href)}">${escapeHtml(href)}</a>`
    }
    case 'Image': {
      const parsed = parseImageMarkdown(textOf(ctx, node))
      if (!parsed) return escapeHtml(textOf(ctx, node))
      const src = await resolveImageForExport(parsed.src, ctx.opts)
      // P05: keep the Typora/pandoc =WxH size attribute in the export.
      const size =
        parsed.width && parsed.height
          ? ` width="${parsed.width}" height="${parsed.height}"`
          : ''
      // P05: flip is a VeloxMark extension — export it as a CSS transform.
      const style = parsed.flip ? ` style="transform:${flipTransform(parsed.flip)}"` : ''
      return `<img alt="${escapeHtml(parsed.alt)}" src="${escapeHtml(src)}"${size}${style}>`
    }
    case 'HardBreak':
      return '<br>'
    case 'Escape':
      return escapeHtml(textOf(ctx, node).slice(1))
    case 'HTMLTag':
      return textOf(ctx, node)
    default: {
      if (node.firstChild) return renderInlineChildren(node, ctx)
      return renderTextRun(textOf(ctx, node), ctx)
    }
  }
}
