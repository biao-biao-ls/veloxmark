import { parser as mdParser, GFM } from '@lezer/markdown'
import type { SyntaxNode, Tree } from '@lezer/common'
import { imageSizeMarkdown } from '../editor/markdown-image-ext'
import {
  flipTransform,
  highlightCodeHtml,
  parseImageMarkdown,
  renderKatexHtml,
  renderMermaid
} from '../editor/widgets'
import type { ThemeName } from '../editor/theme'

/**
 * Static-document renderer (P04 export).
 *
 * Walks the *same* GFM tree the live preview decorates (`@lezer/markdown` +
 * GFM, as used inside @codemirror/lang-markdown) and emits semantic HTML.
 * Unlike live preview there is no cursor-touched concept — markers are always
 * hidden and every block is rendered. KaTeX / mermaid / highlight.js go
 * through the shared helpers extracted from widgets.ts.
 *
 * Math uses the same regex strategy as livePreview/handlers.ts
 * (collectMathDecos): lezer has no math extension, so block math is detected
 * on paragraph text and inline math on text runs.
 */

export type ImageMode = 'embed' | 'relative'

export interface RenderDocOptions {
  /** Directory relative images resolve against (same as live preview baseDir). */
  baseDir: string
  /** Mermaid theme — follow the export theme choice. */
  theme: ThemeName
  /** Embed images as data URLs, or keep markdown srcs as relative paths. */
  imageMode: ImageMode
}

export async function renderDoc(markdown: string, opts: RenderDocOptions): Promise<string> {
  // Same extension stack as the live preview (setup.ts) — identical trees.
  const tree = mdParser.configure([GFM, imageSizeMarkdown]).parse(markdown)
  const ctx: RenderCtx = {
    doc: markdown,
    tree,
    opts,
    parts: []
  }
  await renderBlockChildren(tree.topNode, ctx)
  return ctx.parts.join('\n')
}

interface RenderCtx {
  doc: string
  tree: Tree
  opts: RenderDocOptions
  parts: string[]
}

function textOf(ctx: RenderCtx, node: SyntaxNode): string {
  return ctx.doc.slice(node.from, node.to)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Text run → escaped HTML with inline $math$ substituted (mirrors collectMathDecos). */
function renderTextRun(text: string): string {
  let out = ''
  let last = 0
  const re = /\$([^$\n]+?)\$/g
  for (const m of text.matchAll(re)) {
    const content = m[1]
    // Same guards as live preview: no padded / double-$ content.
    if (content !== content.trim() || content.includes('$$')) continue
    out += escapeHtml(text.slice(last, m.index))
    out += `<span class="export-math-inline">${renderKatexHtml(content, false)}</span>`
    last = m.index + m[0].length
  }
  out += escapeHtml(text.slice(last))
  return out
}

// ---- math block detection (paragraph level) ---------------------------------

interface MathBlock {
  tex: string
}

/** If `text` is exactly one $$…$$ block, return its TeX. */
function asMathBlock(text: string): MathBlock | null {
  const multi = /^[ \t]*\$\$[ \t]*\n([\s\S]+?)\n[ \t]*\$\$[ \t]*$/.exec(text)
  if (multi) return { tex: multi[1].trim() }
  const single = /^[ \t]*\$\$([^$\n]+)\$\$[ \t]*$/.exec(text)
  if (single) return { tex: single[1].trim() }
  return null
}

// ---- block dispatch ----------------------------------------------------------

async function renderBlockChildren(node: SyntaxNode, ctx: RenderCtx): Promise<void> {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    await renderBlock(child, ctx)
  }
}

async function renderBlock(node: SyntaxNode, ctx: RenderCtx): Promise<void> {
  const name = node.name

  const heading = /^ATXHeading([1-6])$/.exec(name)
  if (heading) {
    const level = Number(heading[1])
    // Skip the leading HeaderMark (#s); render the rest as inline.
    const mark = node.firstChild
    const contentFrom = mark && mark.name === 'HeaderMark' ? mark.to : node.from
    const inner = await renderInlineRange(contentFrom, node.to, node, ctx)
    ctx.parts.push(`<h${level}>${inner.trim()}</h${level}>`)
    return
  }

  const setext = /^SetextHeading([12])$/.exec(name)
  if (setext) {
    const level = Number(setext[1])
    const inner = await renderInlineChildren(node, ctx, (n) => n.name !== 'HeaderMark')
    ctx.parts.push(`<h${level}>${inner.trim()}</h${level}>`)
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
      const inner = await renderInlineChildren(node, ctx)
      ctx.parts.push(`<p>${inner}</p>`)
      return
    }
    case 'Blockquote': {
      const inner = new RenderCtxParts()
      const sub: RenderCtx = { ...ctx, parts: inner.parts }
      await renderBlockChildren(node, sub)
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

// ---- fenced code / mermaid ---------------------------------------------------

async function renderFencedCode(node: SyntaxNode, ctx: RenderCtx): Promise<string> {
  const infoNode = node.getChild('CodeInfo')
  const lang = infoNode ? textOf(ctx, infoNode).trim() : ''
  const textNode = node.getChild('CodeText')
  let code = textNode ? textOf(ctx, textNode) : ''
  if (code.startsWith('\n')) code = code.slice(1)
  if (code.endsWith('\n')) code = code.slice(0, -1)

  if (lang === 'mermaid') {
    try {
      const svg = await renderMermaid(code, ctx.opts.theme)
      return `<div class="export-mermaid">${svg}</div>`
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `<div class="export-mermaid"><div class="export-mermaid-error">Mermaid error: ${escapeHtml(message)}</div></div>`
    }
  }
  return codeBlockHtml(lang, highlightCodeHtml(code, lang))
}

function codeBlockHtml(lang: string, highlighted: string): string {
  const label = lang ? `<div class="export-code-lang">${escapeHtml(lang)}</div>` : ''
  return `<div class="export-code">${label}<pre><code class="hljs">${highlighted}</code></pre></div>`
}

// ---- lists -------------------------------------------------------------------

async function renderList(node: SyntaxNode, ctx: RenderCtx): Promise<string> {
  const ordered = node.name === 'OrderedList'
  let startAttr = ''
  if (ordered) {
    const firstMark = node.firstChild?.getChild('ListMark')
    if (firstMark) {
      const num = parseInt(textOf(ctx, firstMark), 10)
      if (Number.isFinite(num) && num !== 1) startAttr = ` start="${num}"`
    }
  }

  const items: string[] = []
  for (let item = node.firstChild; item; item = item.nextSibling) {
    if (item.name !== 'ListItem') continue
    items.push(await renderListItem(item, ctx))
  }
  const tag = ordered ? 'ol' : 'ul'
  return `<${tag}${startAttr}>\n${items.join('\n')}\n</${tag}>`
}

async function renderListItem(item: SyntaxNode, ctx: RenderCtx): Promise<string> {
  let checkbox = ''
  const content: string[] = []
  for (let child = item.firstChild; child; child = child.nextSibling) {
    switch (child.name) {
      case 'ListMark':
        break
      case 'Task': {
        // Task wraps TaskMarker + the item's inline content.
        const marker = child.getChild('TaskMarker')
        if (marker) {
          checkbox = `<input type="checkbox" disabled${textOf(ctx, marker).includes('x') ? ' checked' : ''}> `
        }
        content.push(await renderInlineChildren(child, ctx, (n) => n.name !== 'TaskMarker'))
        break
      }
      case 'Paragraph':
        // Tight-list item: emit the paragraph's inline content without <p>.
        content.push(await renderInlineChildren(child, ctx))
        break
      default:
        if (child.name === 'BulletList' || child.name === 'OrderedList') {
          content.push(await renderList(child, ctx))
        } else if (child.name === 'FencedCode') {
          content.push(await renderFencedCode(child, ctx))
        } else {
          content.push(await renderInlineChildren(child, ctx))
        }
        break
    }
  }
  return `<li>${checkbox}${content.join('')}</li>`
}

// ---- tables ------------------------------------------------------------------

async function renderTable(node: SyntaxNode, ctx: RenderCtx): Promise<string> {
  // Alignment row: the TableDelimiter line following TableHeader.
  const aligns: string[] = []
  let headerNode: SyntaxNode | null = null
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === 'TableHeader') headerNode = child
    else if (child.name === 'TableDelimiter' && aligns.length === 0) {
      // Splitting '|:--|--:|' yields ['', ':--', '--:', ''] — drop the empty
      // edge segments so aligns[i] lines up with cell index i.
      const segments = textOf(ctx, child)
        .split('|')
        .map((s) => s.trim())
        .filter((s, i, arr) => !(s === '' && (i === 0 || i === arr.length - 1)))
      for (const d of segments) {
        const left = d.startsWith(':')
        const right = d.endsWith(':')
        aligns.push(left && right ? 'center' : right ? 'right' : left ? 'left' : '')
      }
    }
  }

  const renderRow = async (row: SyntaxNode, isHeader: boolean): Promise<string> => {
    const cells: string[] = []
    let i = 0
    for (let cell = row.firstChild; cell; cell = cell.nextSibling) {
      if (cell.name !== 'TableCell') continue
      const inner = await renderInlineChildren(cell, ctx)
      const align = aligns[i] ? ` style="text-align:${aligns[i]}"` : ''
      cells.push(isHeader ? `<th${align}>${inner}</th>` : `<td${align}>${inner}</td>`)
      i++
    }
    return `<tr>${cells.join('')}</tr>`
  }

  const rows: string[] = []
  if (headerNode) rows.push(await renderRow(headerNode, true))
  const bodyRows: string[] = []
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === 'TableRow') bodyRows.push(await renderRow(child, false))
  }
  const head = rows.length ? `<thead>\n${rows.join('\n')}\n</thead>` : ''
  const body = bodyRows.length ? `<tbody>\n${bodyRows.join('\n')}\n</tbody>` : ''
  return `<table>${head}${body}</table>`
}

// ---- inline --------------------------------------------------------------------

/**
 * Render inline content of `container`, visiting children for which
 * `accept` returns true. Text between children goes through renderTextRun.
 */
async function renderInlineChildren(
  container: SyntaxNode,
  ctx: RenderCtx,
  accept: (n: SyntaxNode) => boolean = () => true
): Promise<string> {
  return renderInlineRange(container.from, container.to, container, ctx, accept)
}

async function renderInlineRange(
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
    if (child.from > cursor) out += renderTextRun(ctx.doc.slice(cursor, child.from))
    // Rejected children are consumed silently (URL text inside links, task
    // markers) — their source must not leak into the surrounding text gap.
    if (accept(child)) out += await renderInline(child, ctx)
    cursor = child.to
  }
  if (cursor < to) out += renderTextRun(ctx.doc.slice(cursor, to))
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
      return renderTextRun(textOf(ctx, node))
    }
  }
}

// ---- images --------------------------------------------------------------------

/**
 * Resolve an image src for export: embed mode inlines local files as data
 * URLs via main (no CORS issues with mdres://); relative mode keeps the
 * markdown src verbatim so it can live next to the exported HTML.
 */
async function resolveImageForExport(src: string, opts: RenderDocOptions): Promise<string> {
  if (opts.imageMode === 'relative') return src
  if (/^(data:)/i.test(src)) return src
  if (/^https?:/i.test(src)) return src // remote: keep URL (offline = broken, same as editor)
  try {
    return await window.api.readImageAsDataUrl(opts.baseDir, src)
  } catch {
    return src
  }
}
