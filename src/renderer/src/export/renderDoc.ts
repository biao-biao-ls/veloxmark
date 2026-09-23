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
import {
  ABBR_DEF_RE,
  ATTR_RE,
  DL_DEF_RE,
  FOOTNOTE_DEF_RE,
  type FootnoteDef,
  collectFootnoteDefs,
  escapeRegExp,
  parseAttrString,
  parseFrontMatter
} from '../editor/livePreview/extendedSyntax'
import {
  CALLOUT_ICON,
  calloutDisplayTitle,
  parseCalloutMarker,
  type CalloutMarker
} from '../editor/livePreview/callout'

/**
 * Static-document renderer (P04 export).
 *
 * Walks the *same* GFM tree the live preview decorates (`@lezer/markdown` +
 * GFM, as used inside @codemirror/lang-markdown) and emits semantic HTML.
 * Unlike live preview there is no cursor-touched concept — markers are always
 * hidden and every block is rendered. KaTeX / mermaid / highlight.js go
 * through the shared helpers extracted from widgets.ts.
 *
 * Math uses the same regex strategy as livePreview/handlers-math.ts
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
  // P11: strip front matter from the walked source; surface `title` as an h1.
  const fm = parseFrontMatter(markdown)
  const body = fm ? markdown.slice(fm.end) : markdown
  const tree = mdParser.configure([GFM, imageSizeMarkdown]).parse(body)

  // Footnote numbering is first-reference order in the body (defs excluded).
  const defs = collectFootnoteDefs(body)
  const footnoteNums = new Map<string, number>()
  const footnotes: FootnoteDef[] = []
  for (const def of defs.values()) {
    footnoteNums.set(def.id, def.num)
    footnotes.push(def)
  }
  footnotes.sort((a, b) => a.num - b.num)

  // Abbreviation definitions — titles attach to <abbr> usages in the body.
  const abbrs = new Map<string, string>()
  for (const line of body.split('\n')) {
    const m = ABBR_DEF_RE.exec(line)
    if (m && !abbrs.has(m[1])) abbrs.set(m[1], m[2].trim())
  }

  const ctx: RenderCtx = {
    doc: body,
    tree,
    opts,
    parts: [],
    footnoteNums,
    abbrs
  }
  if (fm?.summary.title) {
    ctx.parts.push(`<h1 class="export-fm-title">${escapeHtml(fm.summary.title)}</h1>`)
  }
  await renderBlockChildren(tree.topNode, ctx)
  if (footnotes.length) {
    const items = footnotes
      .map((def) => {
        const text = renderTextRun(def.text, ctx)
        const back = `<a href="#fnref-${escapeHtml(def.id)}" class="export-footnote-backref">↩</a>`
        return `<li id="fn-${escapeHtml(def.id)}">${text} ${back}</li>`
      })
      .join('\n')
    ctx.parts.push(`<hr class="export-footnotes-sep">\n<ol class="export-footnotes">\n${items}\n</ol>`)
  }
  return ctx.parts.join('\n')
}

interface RenderCtx {
  doc: string
  tree: Tree
  opts: RenderDocOptions
  parts: string[]
  /** Footnote id → display number (first-reference order). */
  footnoteNums: Map<string, number>
  /** Abbreviation id → expansion (from `*[id]: …` definition lines). */
  abbrs: Map<string, string>
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

/**
 * P21: strip the callout head line (marker + title) from the first rendered
 * part of a blockquote body — that content is re-homed into the export head
 * element. The head line and following body lines usually share one <p>
 * (soft line breaks), so only the head-line segment is removed.
 */
function dropCalloutHeadHtml(parts: string[], marker: CalloutMarker): string[] {
  const out = parts.slice()
  if (out.length === 0) return out
  const m = /^(<p[^>]*>)([\s\S]*)(<\/p>)$/.exec(out[0])
  if (!m) return out
  const text = m[2]
  const idx = text.indexOf(marker.markerText)
  if (idx === -1) return out
  const after = text.slice(idx + marker.markerText.length)
  // Body content starts after the first newline / <br> — everything before it
  // on the head segment is the title, consumed by export-callout-head.
  const nl = /(?:<br\s*\/?>|\n)([\s\S]*)$/.exec(after)
  const bodyRest = nl ? nl[1].replace(/^\s+/, '') : ''
  if (!bodyRest) {
    out.shift()
  } else {
    out[0] = m[1] + bodyRest + m[3]
  }
  return out
}

/**
 * Text run → escaped HTML with P11 inline substitutions (mirrors the live
 * preview regex passes): $math$, [^footnote], ==highlight==, ^sup^, ~sub~,
 * plus word-boundary abbreviation expansion in the plain gaps.
 */
function renderTextRun(text: string, ctx?: RenderCtx): string {
  let out = ''
  let last = 0
  const re =
    /\$([^$\n]+?)\$|\[\^([^\]\s]+)\]|==([^=\n]+)==|\^([^\^\n]+?)\^|(?<!~)~([^~\n]+?)~(?!~)/g
  for (const m of text.matchAll(re)) {
    const gap = text.slice(last, m.index)
    const content = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5]
    if (m[1] !== undefined) {
      // Same guards as live preview: no padded / double-$ content.
      if (content !== content.trim() || content.includes('$$')) continue
    } else if (!content) {
      continue
    }
    out += escapeWithAbbrs(gap, ctx)
    if (m[1] !== undefined) {
      out += `<span class="export-math-inline">${renderKatexHtml(m[1], false)}</span>`
    } else if (m[2] !== undefined) {
      const id = m[2]
      const num = ctx?.footnoteNums.get(id)
      if (num != null) {
        out += `<sup class="export-footnote-ref" id="fnref-${escapeHtml(id)}"><a href="#fn-${escapeHtml(id)}">${num}</a></sup>`
      } else {
        out += `<sup class="export-footnote-ref">[${escapeHtml(id)}]</sup>`
      }
    } else if (m[3] !== undefined) {
      out += `<mark class="export-mark">${escapeWithAbbrs(m[3], ctx)}</mark>`
    } else if (m[4] !== undefined) {
      out += `<sup class="export-sup">${escapeWithAbbrs(m[4], ctx)}</sup>`
    } else if (m[5] !== undefined) {
      out += `<sub class="export-sub">${escapeWithAbbrs(m[5], ctx)}</sub>`
    }
    last = m.index + m[0].length
  }
  out += escapeWithAbbrs(text.slice(last), ctx)
  return out
}

/**
 * Escape plain text, expanding known abbreviations to <abbr title> — the
 * placeholder masking keeps replacements out of HTML-escaped tag soup.
 */
function escapeWithAbbrs(text: string, ctx?: RenderCtx): string {
  if (!ctx || ctx.abbrs.size === 0 || text === '') return escapeHtml(text)
  const keys = [...ctx.abbrs.keys()].sort((a, b) => b.length - a.length)
  const re = new RegExp(`(?<![\\w*])(${keys.map(escapeRegExp).join('|')})(?![\\w*])`, 'g')
  const slots: string[] = []
  const masked = text.replace(re, (_m, abbr: string) => {
    slots.push(abbr)
    return `${slots.length - 1}`
  })
  return escapeHtml(masked).replace(/(\d+)/g, (_m, i) => {
    const abbr = slots[Number(i)]
    return `<abbr title="${escapeHtml(ctx.abbrs.get(abbr) ?? '')}">${escapeHtml(abbr)}</abbr>`
  })
}

/** Trailing `{#id .class}` on a block's raw source → ` id="…" class="…"`. */
function attrsFromTrailing(raw: string): string {
  const m = ATTR_RE.exec(raw)
  if (!m) return ''
  const parsed = parseAttrString(m[1])
  const id = parsed.id ? ` id="${escapeHtml(parsed.id)}"` : ''
  const cls = parsed.classes.length ? ` class="${escapeHtml(parsed.classes.join(' '))}"` : ''
  return id + cls
}

/** Strip a trailing `{…}` attribute span from rendered inner HTML (escaped text). */
function stripTrailingAttrs(inner: string): string {
  return inner.replace(/\{((?:[#.][\w-]+[ \t]*)+)\}[ \t]*$/, '')
}

/** True when a block-level paragraph *starts* with `: ` (definition-list body). */
function isDefLineText(raw: string): boolean {
  return DL_DEF_RE.test(raw)
}

/**
 * Pandoc-style DL packed into ONE paragraph (`term\n: def1\n: def2`, no blank
 * lines — CommonMark keeps them in a single Paragraph; lezer has no DL node).
 * Returns term + definition texts when every non-empty line fits the shape.
 */
function splitDefinitionList(raw: string): { term: string; defs: string[]; termOffset: number; defOffsets: number[] } | null {
  const lines = raw.split('\n')
  const nonEmpty: { text: string; offset: number }[] = []
  let offset = 0
  for (const line of lines) {
    if (line.trim() !== '') nonEmpty.push({ text: line, offset })
    offset += line.length + 1
  }
  if (nonEmpty.length < 2) return null
  if (isDefLineText(nonEmpty[0].text)) return null
  const term = nonEmpty[0].text
  const t = term.trim()
  if (/^(#{1,6}\s|```|~~~|\||[-*+]\s|\d+\.\s|>)/.test(t)) return null
  if (FOOTNOTE_DEF_RE.test(term) || ABBR_DEF_RE.test(term)) return null
  const defs: string[] = []
  const defOffsets: number[] = [] // offset of each def's *content* (after marker)
  for (const { text, offset } of nonEmpty.slice(1)) {
    const m = DL_DEF_RE.exec(text)
    if (!m) return null
    defs.push(m[2])
    defOffsets.push(offset + (text.length - m[2].length))
  }
  return { term, defs, termOffset: nonEmpty[0].offset, defOffsets }
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
