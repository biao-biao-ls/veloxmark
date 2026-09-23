import type { SyntaxNode } from '@lezer/common'
import {
  CALLOUT_ICON,
  calloutDisplayTitle,
  parseCalloutMarker
} from '../../editor/livePreview/callout'
import { ABBR_DEF_RE, DL_DEF_RE, FOOTNOTE_DEF_RE } from '../../editor/livePreview/extendedSyntax'
import { highlightCodeHtml, renderKatexHtml } from '../../editor/render-helpers'
import { escapeHtml, textOf, type RenderCtx } from './ctx'
import {
  attrsFromTrailing,
  isDefLineText,
  splitDefinitionList,
  stripTrailingAttrs
} from './blockAttrs'
import { dropCalloutHeadHtml } from './callout'
import { codeBlockHtml, renderFencedCode } from './code'
import { asMathBlock } from './inlineText'
import { renderInlineChildren, renderInlineRange } from './inline'
import { renderList, renderTable } from './listTable'

// ---- block dispatch (3.15) ----
// (3C: moved verbatim from export/renderDoc.ts.)

// ---- block dispatch ----------------------------------------------------------

export async function renderBlockChildren(node: SyntaxNode, ctx: RenderCtx): Promise<void> {
  let child = node.firstChild
  while (child) {
    const raw = textOf(ctx, child)

    // P11 definition/reference lines never render as body content.
    if (FOOTNOTE_DEF_RE.test(raw) || ABBR_DEF_RE.test(raw)) {
      child = child.nextSibling
      continue
    }
    // Generic link-reference definitions (`[foo]: url`) — dropped by browsers
    // too; footnote-shaped ones are handled above.
    if (/^\[[^\]\s]+\]:[ \t]*\S/.test(raw) && !raw.includes('\n')) {
      child = child.nextSibling
      continue
    }

    // P11 definition list: term paragraph followed by `: definition` paragraphs.
    if (child.name === 'Paragraph' && raw.trim() !== '' && !isDefLineText(raw)) {
      let sib = child.nextSibling
      const defParas: SyntaxNode[] = []
      while (sib && sib.name === 'Paragraph' && isDefLineText(textOf(ctx, sib))) {
        defParas.push(sib)
        sib = sib.nextSibling
      }
      const termTrim = raw.trim()
      const looksLikeTerm =
        !/^(#{1,6}\s|```|~~~|\||[-*+]\s|\d+\.\s|>)/.test(termTrim) &&
        !FOOTNOTE_DEF_RE.test(raw) &&
        !ABBR_DEF_RE.test(raw)
      if (defParas.length && looksLikeTerm) {
        ctx.parts.push(await renderDefinitionList(child, defParas, ctx))
        child = sib
        continue
      }
    }

    await renderBlock(child, ctx)
    child = child.nextSibling
  }
}

/** `term` paragraph + `: def` paragraphs → semantic <dl>. */
async function renderDefinitionList(
  termNode: SyntaxNode,
  defNodes: SyntaxNode[],
  ctx: RenderCtx
): Promise<string> {
  const termRaw = textOf(ctx, termNode)
  const termInner = stripTrailingAttrs(await renderInlineChildren(termNode, ctx))
  const termAttrs = attrsFromTrailing(termRaw)
  const defs: string[] = []
  for (const d of defNodes) {
    const raw = textOf(ctx, d)
    const m = DL_DEF_RE.exec(raw)
    const markerLen = m ? raw.length - m[2].length : 0
    const inner = await renderInlineRange(d.from + markerLen, d.to, d, ctx)
    const attrs = attrsFromTrailing(raw)
    defs.push(`<dd${attrs}>${stripTrailingAttrs(inner)}</dd>`)
  }
  return `<dl class="export-dl">\n<dt${termAttrs}>${termInner}</dt>\n${defs.join('\n')}\n</dl>`
}

async function renderBlock(node: SyntaxNode, ctx: RenderCtx): Promise<void> {
  const name = node.name

  const heading = /^ATXHeading([1-6])$/.exec(name)
  if (heading) {
    const level = Number(heading[1])
    // Skip the leading HeaderMark (#s); render the rest as inline.
    const mark = node.firstChild
    const contentFrom = mark && mark.name === 'HeaderMark' ? mark.to : node.from
    const raw = textOf(ctx, node)
    const inner = await renderInlineRange(contentFrom, node.to, node, ctx)
    const attrs = attrsFromTrailing(raw)
    ctx.parts.push(`<h${level}${attrs}>${stripTrailingAttrs(inner).trim()}</h${level}>`)
    return
  }

  const setext = /^SetextHeading([12])$/.exec(name)
  if (setext) {
    const level = Number(setext[1])
    const raw = textOf(ctx, node)
    const inner = await renderInlineChildren(node, ctx, (n) => n.name !== 'HeaderMark')
    const attrs = attrsFromTrailing(raw)
    ctx.parts.push(`<h${level}${attrs}>${stripTrailingAttrs(inner).trim()}</h${level}>`)
    return
  }

  switch (name) {
    case 'Paragraph': {
      const raw = textOf(ctx, node)
      const math = asMathBlock(raw)
      if (math) {
        ctx.parts.push(
          `<div class="export-math-block">${renderKatexHtml(math.tex, true)}</div>`
        )
        return
      }
      // P11: pandoc definition list packed into a single paragraph.
      const dl = splitDefinitionList(raw)
      if (dl) {
        const termFrom = node.from + dl.termOffset
        const termTo = termFrom + dl.term.length
        const termInner = stripTrailingAttrs(await renderInlineRange(termFrom, termTo, node, ctx))
        const dds: string[] = []
        for (let i = 0; i < dl.defs.length; i++) {
          const dFrom = node.from + dl.defOffsets[i]
          const dTo = dFrom + dl.defs[i].length
          dds.push(`<dd>${stripTrailingAttrs(await renderInlineRange(dFrom, dTo, node, ctx))}</dd>`)
        }
        ctx.parts.push(`<dl class="export-dl">\n<dt>${termInner}</dt>\n${dds.join('\n')}\n</dl>`)
        return
      }
      const inner = await renderInlineChildren(node, ctx)
      const attrs = attrsFromTrailing(raw)
      ctx.parts.push(`<p${attrs}>${stripTrailingAttrs(inner)}</p>`)
      return
    }
    case 'Blockquote': {
      const firstLine = textOf(ctx, node).split('\n', 1)[0]
      const callout = parseCalloutMarker(firstLine)
      const inner = new RenderCtxParts()
      const sub: RenderCtx = { ...ctx, parts: inner.parts }
      await renderBlockChildren(node, sub)
      if (callout) {
        // P21: callout → styled div. Fold markers export expanded; the head
        // line's marker + title are consumed by export-callout-head, body
        // keeps everything after the first line (nested content rendered by
        // the normal walkers).
        const title = calloutDisplayTitle(callout)
        const icon = CALLOUT_ICON[callout.type]
        const bodyParts = dropCalloutHeadHtml(inner.parts, callout)
        const head = `<div class="export-callout-head">${icon} ${escapeHtml(title)}</div>`
        const body = bodyParts.length
          ? `<div class="export-callout-body">\n${bodyParts.join('\n')}\n</div>`
          : ''
        ctx.parts.push(
          `<div class="export-callout export-callout-${callout.type}">\n${head}\n${body}\n</div>`
        )
        return
      }
      ctx.parts.push(`<blockquote>\n${inner.parts.join('\n')}\n</blockquote>`)
      return
    }
    case 'FencedCode': {
      ctx.parts.push(await renderFencedCode(node, ctx))
      return
    }
    case 'CodeBlock': {
      // Indented code block — no info string.
      const code = textOf(ctx, node).replace(/\n$/, '')
      ctx.parts.push(codeBlockHtml('', highlightCodeHtml(code, '')))
      return
    }
    case 'HorizontalRule':
      ctx.parts.push('<hr>')
      return
    case 'BulletList':
    case 'OrderedList':
      ctx.parts.push(await renderList(node, ctx))
      return
    case 'Table':
      ctx.parts.push(await renderTable(node, ctx))
      return
    case 'HTMLBlock':
      // Pass raw HTML through — same as browsers/markdown spec.
      ctx.parts.push(textOf(ctx, node))
      return
    case 'Comment':
      return
    default:
      // Unknown block: render children (or nothing).
      if (node.firstChild) await renderBlockChildren(node, ctx)
      return
  }
}

// Small helper so blockquote can collect into a sub-list without string joins.
class RenderCtxParts {
  parts: string[] = []
}
