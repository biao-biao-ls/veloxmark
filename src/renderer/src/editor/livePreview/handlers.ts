import type { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import type { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import {
  CodeBlockWidget,
  ImageWidget,
  InlineMathWidget,
  MathBlockWidget,
  MermaidWidget,
  TableWidget,
  TaskWidget,
  parseImageMarkdown
} from '../widgets'
import type { LivePreviewConfig } from './config'

/**
 * Per-syntax decoration handlers.
 *
 * Each `enter*` function handles one markdown node kind and returns whether
 * tree.iterate should descend into the node's children (parity with the
 * original single if-chain in buildDecorations).
 */

export interface PendingDeco {
  from: number
  to: number
  value: Decoration
}

export interface BuildCtx {
  state: EditorState
  config: LivePreviewConfig
  decos: PendingDeco[]
  /** True when any cursor/selection touches the half-open range [from, to]. */
  touched: (from: number, to: number) => boolean
  /** True when any cursor/selection lies inside the block [from, to]. */
  blockTouched: (from: number, to: number) => boolean
}

const hide = Decoration.replace({})
const markEm = Decoration.mark({ class: 'cm-md-em' })
const markStrong = Decoration.mark({ class: 'cm-md-strong' })
const markDel = Decoration.mark({ class: 'cm-md-del' })
const markCode = Decoration.mark({ class: 'cm-md-inline-code' })
const markLink = Decoration.mark({ class: 'cm-md-link' })

function nodeText(state: EditorState, node: SyntaxNodeRef): string {
  return state.sliceDoc(node.from, node.to)
}

function listDepth(node: SyntaxNodeRef): number {
  let depth = 0
  for (let p = node.node.parent; p; p = p.parent) {
    if (p.name === 'List') depth++
  }
  return Math.min(Math.max(depth, 1), 6)
}

function quoteDepth(node: SyntaxNodeRef): number {
  let depth = 0
  for (let p = node.node.parent; p; p = p.parent) {
    if (p.name === 'Blockquote') depth++
  }
  return Math.min(Math.max(depth, 1), 4)
}

/** Hide a '#'/'> '/'- ' marker plus one trailing space when present. */
function hideMarkerWithSpace(node: SyntaxNodeRef, ctx: BuildCtx, from?: number): void {
  const doc = ctx.state.doc
  const start = from ?? node.from
  const end = doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to
  ctx.decos.push({ from: start, to: end, value: hide })
}

// ---- headings ---------------------------------------------------------------

export function enterHeading(level: number, node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  const line = ctx.state.doc.lineAt(node.from)
  ctx.decos.push({
    from: line.from,
    to: line.from,
    value: Decoration.line({ class: `cm-md-heading cm-md-h${level}` })
  })
  return true
}

export function enterHeaderMark(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  if (!ctx.touched(node.from, node.to)) {
    hideMarkerWithSpace(node, ctx)
  }
  return false
}

// ---- emphasis / strong / strikethrough --------------------------------------

export function enterEmphasisMark(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  if (!ctx.touched(node.from, node.to)) {
    ctx.decos.push({ from: node.from, to: node.to, value: hide })
  }
  return false
}

export function enterInlineMark(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  const name = node.node.name
  const value =
    name === 'Emphasis' ? markEm : name === 'StrongEmphasis' ? markStrong : markDel
  ctx.decos.push({ from: node.from, to: node.to, value })
  return true
}

export function enterStrikethroughMark(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  if (!ctx.touched(node.from, node.to)) {
    ctx.decos.push({ from: node.from, to: node.to, value: hide })
  }
  return false
}

// ---- inline code ------------------------------------------------------------

export function enterInlineCode(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  ctx.decos.push({ from: node.from, to: node.to, value: markCode })
  if (!ctx.touched(node.from, node.to)) {
    for (let c = node.node.firstChild; c; c = c.nextSibling) {
      if (c.name === 'CodeMark') {
        ctx.decos.push({ from: c.from, to: c.to, value: hide })
      }
    }
  }
  return false
}

// ---- links ------------------------------------------------------------------

export function enterLink(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  ctx.decos.push({ from: node.from, to: node.to, value: markLink })
  if (!ctx.touched(node.from, node.to)) {
    for (let c = node.node.firstChild; c; c = c.nextSibling) {
      if (c.name === 'LinkMark' || c.name === 'URL') {
        ctx.decos.push({ from: c.from, to: c.to, value: hide })
      }
    }
  }
  return false
}

// ---- images -----------------------------------------------------------------

/**
 * Image renderer (P05):
 * ```
 * ![alt](src)
 * ![alt](src =WxH)
 * ![alt](src =WxH){flip=hv}
 * ```
 * Always a widget — broken images show a dashed placeholder.
 *
 * Collapse rule (deliberately different from blockTouched's inclusive test):
 * the widget hides only when the selection lies strictly inside the image
 * span. A cursor sitting exactly on the node edges — the state a pasted image
 * is left in, and the state needed to click it — keeps the widget rendered.
 */
export function enterImage(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  const inside = ctx.state.selection.ranges.some(
    (r) =>
      (r.from > node.from && r.from < node.to) ||
      (r.to > node.from && r.to < node.to)
  )
  if (!inside) {
    const parsed = parseImageMarkdown(nodeText(ctx.state, node))
    if (parsed) {
      ctx.decos.push({
        from: node.from,
        to: node.to,
        value: Decoration.replace({
          widget: new ImageWidget(
            parsed,
            ctx.config.baseDir,
            node.from,
            node.to,
            ctx.config.imageEpoch
          )
        })
      })
    }
  }
  return false
}

// ---- lists ------------------------------------------------------------------

export function enterListMark(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  const doc = ctx.state.doc
  const line = doc.lineAt(node.from)
  if (!ctx.touched(line.from, node.to)) {
    const end = doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to
    ctx.decos.push({ from: line.from, to: end, value: hide })
  }
  ctx.decos.push({
    from: line.from,
    to: line.from,
    value: Decoration.line({
      class: `cm-md-list cm-md-list-d${listDepth(node)}`
    })
  })
  return false
}

// ---- blockquotes ------------------------------------------------------------

export function enterQuoteMark(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  const doc = ctx.state.doc
  const line = doc.lineAt(node.from)
  if (!ctx.touched(line.from, node.to)) {
    const end = doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to
    ctx.decos.push({ from: line.from, to: end, value: hide })
  }
  ctx.decos.push({
    from: line.from,
    to: line.from,
    value: Decoration.line({ class: `cm-md-quote cm-md-quote-d${quoteDepth(node)}` })
  })
  return false
}

// ---- tables -----------------------------------------------------------------

export function enterTable(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  if (ctx.blockTouched(node.from, node.to)) return false
  const doc = ctx.state.doc
  const lineFrom = doc.lineAt(node.from).from
  const lineTo = doc.lineAt(node.to).to
  const source = ctx.state.sliceDoc(lineFrom, lineTo)
  ctx.decos.push({
    from: lineFrom,
    to: lineTo,
    value: Decoration.replace({
      widget: new TableWidget(source, node.from, node.to),
      block: true
    })
  })
  return false
}

// ---- fenced code / mermaid --------------------------------------------------

export function enterFencedCode(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  if (ctx.blockTouched(node.from, node.to)) return false
  const state = ctx.state
  const infoNode = node.node.getChild('CodeInfo')
  const lang = infoNode ? state.sliceDoc(infoNode.from, infoNode.to).trim() : ''
  const textNode = node.node.getChild('CodeText')
  let code = textNode ? state.sliceDoc(textNode.from, textNode.to) : ''
  if (code.startsWith('\n')) code = code.slice(1)
  if (code.endsWith('\n')) code = code.slice(0, -1)

  const doc = state.doc
  const lineFrom = doc.lineAt(node.from).from
  const lineTo = doc.lineAt(node.to).to
  const widget =
    lang === 'mermaid'
      ? new MermaidWidget(code, node.from, node.to, ctx.config.theme)
      : new CodeBlockWidget(code, lang, node.from, node.to)
  ctx.decos.push({
    from: lineFrom,
    to: lineTo,
    value: Decoration.replace({ widget, block: true })
  })
  return false
}

// ---- horizontal rule --------------------------------------------------------

export function enterHorizontalRule(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  const doc = ctx.state.doc
  const line = doc.lineAt(node.from)
  if (!ctx.touched(line.from, node.to)) {
    ctx.decos.push({ from: node.from, to: node.to, value: hide })
  }
  ctx.decos.push({
    from: line.from,
    to: line.from,
    value: Decoration.line({ class: 'cm-md-hr' })
  })
  return false
}

// ---- task list checkboxes ---------------------------------------------------

export function enterTaskMarker(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  if (!ctx.touched(node.from, node.to)) {
    const text = nodeText(ctx.state, node)
    ctx.decos.push({
      from: node.from,
      to: node.to,
      value: Decoration.replace({
        widget: new TaskWidget(node.from, text.includes('x'))
      })
    })
  }
  return false
}

// ---- math (regex pass; @lezer/markdown has no math extension) ----------------

/**
 * Scan the whole document for $$-blocks and $inline$ math. Appends
 * decorations to the context. Must run after the tree pass so
 * `tree.resolveInner` can skip math-looking text inside code nodes.
 */
export function collectMathDecos(
  ctx: BuildCtx,
  resolveNode: (pos: number, side: -1 | 1) => SyntaxNode
): void {
  const { state, decos, blockTouched } = ctx
  const doc = state.doc
  const mathBlockRanges: Array<[number, number]> = []

  for (const range of [{ from: 0, to: doc.length }]) {
    const { from, to } = range
    const text = state.sliceDoc(from, to)

    // multi-line: $$ on its own lines
    const multiRe = /^([ \t]*\$\$[ \t]*\n)([\s\S]+?)(\n[ \t]*\$\$[ \t]*)$/gm
    for (const m of text.matchAll(multiRe)) {
      const start = from + m.index!
      const end = start + m[0].length
      const lineFrom = doc.lineAt(start).from
      const lineTo = doc.lineAt(end - 1).to
      mathBlockRanges.push([lineFrom, lineTo])
      if (blockTouched(lineFrom, lineTo)) continue
      decos.push({
        from: lineFrom,
        to: lineTo,
        value: Decoration.replace({
          widget: new MathBlockWidget(m[2].trim(), start, end),
          block: true
        })
      })
    }

    // single-line: $$formula$$
    const singleRe = /^([ \t]*)\$\$([^$\n]+)\$\$[ \t]*$/gm
    for (const m of text.matchAll(singleRe)) {
      const start = from + m.index!
      const lineFrom = doc.lineAt(start).from
      const lineTo = doc.lineAt(start + m[0].length - 1).to
      if (mathBlockRanges.some(([a, b]) => lineFrom <= b && lineTo >= a)) continue
      mathBlockRanges.push([lineFrom, lineTo])
      if (blockTouched(lineFrom, lineTo)) continue
      decos.push({
        from: lineFrom,
        to: lineTo,
        value: Decoration.replace({
          widget: new MathBlockWidget(m[2].trim(), start, start + m[0].length),
          block: true
        })
      })
    }

    // inline: $tex$ — not inside code, not $$, content has no leading/trailing space
    const inlineRe = /\$([^$\n]+?)\$/g
    for (const m of text.matchAll(inlineRe)) {
      const start = from + m.index!
      const end = start + m[0].length
      const content = m[1]
      if (content !== content.trim()) continue
      if (content.includes('$$')) continue
      if (mathBlockRanges.some(([a, b]) => start <= b && end >= a)) continue
      // skip math-looking text inside code nodes
      const chain = resolveNode(start, 1)
      let inCode = false
      for (let p: SyntaxNode | null = chain; p; p = p.parent) {
        if (
          p.name === 'InlineCode' ||
          p.name === 'FencedCode' ||
          p.name === 'CodeText' ||
          p.name === 'URL'
        ) {
          inCode = true
          break
        }
      }
      if (inCode) continue
      if (blockTouched(start, end)) continue
      decos.push({
        from: start,
        to: end,
        value: Decoration.replace({ widget: new InlineMathWidget(content) })
      })
    }
  }
}
