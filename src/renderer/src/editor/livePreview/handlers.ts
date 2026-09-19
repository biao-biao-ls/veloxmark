import type { EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { Decoration } from '@codemirror/view'
import type { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import {
  CodeBlockWidget,
  FootnoteRefWidget,
  FrontMatterWidget,
  ImageWidget,
  InlineMathWidget,
  MathBlockWidget,
  MermaidWidget,
  TaskWidget,
  parseImageMarkdown
} from '../widgets'
import {
  ABBR_DEF_RE,
  DL_DEF_RE,
  FOOTNOTE_DEF_RE,
  FOOTNOTE_REF_RE,
  HIGHLIGHT_RE,
  SUB_RE,
  SUP_RE,
  collectFootnoteDefs,
  escapeRegExp,
  parseFrontMatter
} from './extendedSyntax'
import { TableWidget } from '../table/widget'
import { getTableEdit } from '../table/state'
import type { LivePreviewConfig } from './config'
import { extractLinkUrl, isBrokenCached, isSkippableHref } from './linkNav'

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
  /**
   * Line-granularity: any cursor/selection's line intersects [from, to].
   * Line-level markers only (ATX #, HR, quotes, tasks).
   */
  touched: (from: number, to: number) => boolean
  /** True when any cursor/selection lies inside the block [from, to]. */
  blockTouched: (from: number, to: number) => boolean
  /**
   * P09 mark-granularity: any selection range intersects closed [from, to].
   * Inline marks — delimiters show only while the cursor is on/in the span.
   */
  markTouched: (from: number, to: number) => boolean
}

const hide = Decoration.replace({})
const markEm = Decoration.mark({ class: 'cm-md-em' })
const markStrong = Decoration.mark({ class: 'cm-md-strong' })
const markDel = Decoration.mark({ class: 'cm-md-del' })
const markCode = Decoration.mark({ class: 'cm-md-inline-code' })
const markLink = Decoration.mark({ class: 'cm-md-link' })
/** P17: dashed red — the cache said this relative target does not exist. */
const markLinkBroken = Decoration.mark({ class: 'cm-md-link cm-md-link-broken' })

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
  // P09: delimiters show only while the cursor/selection is within the
  // parent emphasis span — both marks of a pair share one decision, and a
  // sibling mark on the same line is unaffected.
  const parent = node.node.parent
  if (!ctx.markTouched(parent ? parent.from : node.from, parent ? parent.to : node.to)) {
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
  // P09: same parent-span rule as enterEmphasisMark (parent = Strikethrough).
  const parent = node.node.parent
  if (!ctx.markTouched(parent ? parent.from : node.from, parent ? parent.to : node.to)) {
    ctx.decos.push({ from: node.from, to: node.to, value: hide })
  }
  return false
}

// ---- inline code ------------------------------------------------------------

export function enterInlineCode(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  ctx.decos.push({ from: node.from, to: node.to, value: markCode })
  // P09: backticks show only while the cursor/selection is within the span.
  if (!ctx.markTouched(node.from, node.to)) {
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
  // P11: `[^id]` parses as a GFM reference-link when a definition line exists
  // — leave those to collectExtendedDecos (superscript widget, not a link).
  if (/^\[\^[^\]\s]+\]$/.test(nodeText(ctx.state, node))) return false
  // P17: broken-link decoration — only meaningful with a baseDir and only
  // for path-like hrefs (external schemes / #anchors never mark broken).
  let mark = markLink
  const baseDir = ctx.config.baseDir
  if (baseDir) {
    const url = extractLinkUrl(ctx.state, node.node)
    if (url && !isSkippableHref(url) && isBrokenCached(baseDir, url)) {
      mark = markLinkBroken
    }
  }
  ctx.decos.push({ from: node.from, to: node.to, value: mark })
  // P09: brackets/URL show only while the cursor/selection is within the span.
  if (!ctx.markTouched(node.from, node.to)) {
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
  const end = doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to
  // P09: Typora rule — the marker shows only while the cursor sits on the
  // marker/indent; entering the item text hides it (the CSS ::before bullet
  // covers the hidden state). `end` is inclusive so a left-moving cursor
  // reveals the marker at its right edge instead of snapping over it.
  const shown = ctx.markTouched(line.from, end)
  if (!shown) {
    ctx.decos.push({ from: line.from, to: end, value: hide })
  }
  // While the source marker is visible, suppress the CSS bullet so the two
  // don't render side by side.
  const depthClass = `cm-md-list cm-md-list-d${listDepth(node)}`
  ctx.decos.push({
    from: line.from,
    to: line.from,
    value: Decoration.line({
      class: shown ? `${depthClass} cm-md-list-open` : depthClass
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
  const doc = ctx.state.doc
  const lineFrom = doc.lineAt(node.from).from
  const lineTo = doc.lineAt(node.to).to
  // P10: while a cell of THIS table is being edited the widget stays mounted
  // (cell-edit state drives the DOM); otherwise keep the V1 escape hatch —
  // a CM cursor inside the table range reveals the raw source.
  const edit = getTableEdit(ctx.state)
  const active = edit.active
  const isActive = active != null && active.tableFrom === lineFrom
  if (!isActive && ctx.blockTouched(node.from, node.to)) return false
  const source = ctx.state.sliceDoc(lineFrom, lineTo)
  ctx.decos.push({
    from: lineFrom,
    to: lineTo,
    value: Decoration.replace({
      widget: new TableWidget(source, lineFrom, lineTo, {
        active: isActive ? { row: active.row, col: active.col, caret: active.caret } : null,
        colWidths: edit.colWidths.get(lineFrom),
        theme: ctx.config.theme
      }),
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
/**
 * P15 perf: syntax nodes whose spans are opaque to the math/regex passes.
 * Collected once per buildDecorations call via a single tree walk; regex
 * matches that land inside any of these spans are skipped without the old
 * per-match `resolveInner` parent-chain walk.
 */
const MATH_SKIP_NODES = new Set(['InlineCode', 'FencedCode', 'CodeText', 'URL'])

export function collectMathDecos(
  ctx: BuildCtx,
  _resolveNode: (pos: number, side: -1 | 1) => SyntaxNode
): void {
  const { state, decos, blockTouched, markTouched } = ctx
  const doc = state.doc
  const mathBlockRanges: Array<[number, number]> = []

  // One iterate pass collects code/URL spans; enter:false skips their subtrees.
  const skipRanges: Array<[number, number]> = []
  syntaxTree(state).iterate({
    enter: (node) => {
      if (MATH_SKIP_NODES.has(node.name)) {
        skipRanges.push([node.from, node.to])
        return false
      }
      return true
    }
  })
  const inSkip = (start: number, end: number): boolean =>
    skipRanges.some(([a, b]) => start < b && end > a)

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
      if (inSkip(start, end)) continue
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
      if (inSkip(start, start + m[0].length)) continue
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
      // P15: skip math-looking text inside code/URL spans — one range test
      // replaces the old per-match resolveInner parent-chain walk.
      if (inSkip(start, end)) continue
      // P09: inline math follows the mark rule — a selection merely touching
      // the span reveals it; math *blocks* above stay block-granular.
      if (markTouched(start, end)) continue
      decos.push({
        from: start,
        to: end,
        value: Decoration.replace({ widget: new InlineMathWidget(content) })
      })
    }
  }
}

// ---- P11 extended syntax (regex pass; @lezer/markdown has no extensions) ------

/**
 * Front matter, footnotes, `==highlight==`, pandoc sub/sup, abbreviations,
 * definition lists and trailing `{#id .class}` attributes. Runs after the
 * tree pass (same contract as collectMathDecos) so `resolveNode` can skip
 * code / link / strikethrough interiors.
 */
export function collectExtendedDecos(
  ctx: BuildCtx,
  resolveNode: (pos: number, side: -1 | 1) => SyntaxNode
): void {
  const { state, decos, blockTouched, markTouched } = ctx
  const doc = state.doc
  const full = state.sliceDoc(0, doc.length)

  /** True when pos sits inside code / URL / link / image / strikethrough. */
  const inInlineSyntax = (pos: number, allowLink = false): boolean => {
    for (let p: SyntaxNode | null = resolveNode(pos, 1); p; p = p.parent) {
      const n = p.name
      if (
        n === 'InlineCode' ||
        n === 'FencedCode' ||
        n === 'CodeText' ||
        n === 'URL' ||
        n === 'Image' ||
        n === 'Strikethrough' ||
        n === 'HTMLTag' ||
        (!allowLink && n === 'Link')
      ) {
        return true
      }
    }
    return false
  }

  // ---- front matter -----------------------------------------------------------
  const fm = parseFrontMatter(full)
  const bodyFrom = fm ? fm.end : 0
  if (fm && !blockTouched(0, fm.end)) {
    decos.push({
      from: 0,
      to: fm.end,
      value: Decoration.replace({
        widget: new FrontMatterWidget(fm.summary, fm.yaml, 0, fm.end),
        block: true
      })
    })
  }

  // ---- footnotes ---------------------------------------------------------------
  const defs = collectFootnoteDefs(full)
  for (const def of defs.values()) {
    if (def.defFrom < bodyFrom) continue
    const lineFrom = doc.lineAt(def.defFrom).from
    // Hide the `[^id]:` marker when the cursor is off the line (P09 rule).
    const markerTo = def.defFrom + def.id.length + 4 // `[^id]:`
    if (!markTouched(def.defFrom, markerTo)) {
      decos.push({ from: def.defFrom, to: markerTo, value: hide })
    }
    decos.push({
      from: lineFrom,
      to: lineFrom,
      value: Decoration.line({ class: 'cm-md-footnote-def' })
    })
  }
  for (const m of full.matchAll(FOOTNOTE_REF_RE)) {
    const start = m.index
    const end = start + m[0].length
    if (end <= bodyFrom) continue
    // Not the `[^id]:` opening of a definition line itself.
    const lineStart = full.lastIndexOf('\n', start - 1) + 1
    if (full.startsWith(`[^${m[1]}]:`, lineStart)) continue
    // Footnote refs commonly parse as reference links — allow Link, skip code.
    if (inInlineSyntax(start, true)) continue
    if (markTouched(start, end)) continue
    const def = defs.get(m[1])
    decos.push({
      from: start,
      to: end,
      value: Decoration.replace({
        widget: new FootnoteRefWidget(m[1], def?.num, def?.defFrom)
      })
    })
  }

  // ---- ==highlight== / ^sup^ / ~sub~ -------------------------------------------
  const inlineMarkPass = (
    re: RegExp,
    markClass: string,
    delimLen: number,
    contentGroup = 1
  ): void => {
    for (const m of full.matchAll(re)) {
      const start = m.index
      const end = start + m[0].length
      if (end <= bodyFrom) continue
      if (inInlineSyntax(start)) continue
      if (delimLen === 1 && markClass === 'cm-md-sub') {
        // `~~strike~~` overlap guard (single-tilde regex can land inside).
        if (full[start - 1] === '~' || full[end] === '~') continue
      }
      if (!m[contentGroup]) continue
      decos.push({ from: start, to: end, value: Decoration.mark({ class: markClass }) })
      // P09 mark rule: delimiters reveal only while the span is touched.
      if (!markTouched(start, end)) {
        decos.push({ from: start, to: start + delimLen, value: hide })
        decos.push({ from: end - delimLen, to: end, value: hide })
      }
    }
  }
  inlineMarkPass(HIGHLIGHT_RE, 'cm-md-highlight', 2)
  inlineMarkPass(SUP_RE, 'cm-md-sup', 1)
  inlineMarkPass(SUB_RE, 'cm-md-sub', 1)

  // ---- abbreviations ------------------------------------------------------------
  const abbrDefs = new Map<string, string>()
  {
    const lines = full.split('\n')
    let offset = 0
    for (const line of lines) {
      const m = ABBR_DEF_RE.exec(line)
      if (m && offset >= bodyFrom) {
        if (!abbrDefs.has(m[1])) abbrDefs.set(m[1], m[2].trim())
        const lineFrom = offset
        decos.push({
          from: lineFrom,
          to: lineFrom,
          value: Decoration.line({ class: 'cm-md-abbr-def' })
        })
        const hideEnd = offset + 2 + m[1].length + 2 // `*[id]:`
        if (!markTouched(offset, hideEnd)) {
          decos.push({ from: offset, to: hideEnd, value: hide })
        }
      }
      offset += line.length + 1
    }
  }
  for (const [abbr, title] of abbrDefs) {
    if (!title) continue
    const re = new RegExp(`(?<![\\w*])${escapeRegExp(abbr)}(?![\\w*])`, 'g')
    for (const m of full.matchAll(re)) {
      const start = m.index
      if (start < bodyFrom) continue
      const lineStart = full.lastIndexOf('\n', start - 1) + 1
      const lineEnd = full.indexOf('\n', start)
      const line = full.slice(lineStart, lineEnd === -1 ? full.length : lineEnd)
      if (ABBR_DEF_RE.test(line)) continue
      if (inInlineSyntax(start)) continue
      decos.push({
        from: start,
        to: start + abbr.length,
        value: Decoration.mark({
          class: 'cm-md-abbr',
          attributes: { title }
        })
      })
    }
  }

  // ---- definition lists (`term` line + `: definition` lines) --------------------
  {
    const lines = full.split('\n')
    const lineFroms: number[] = []
    let offset = 0
    for (const line of lines) {
      lineFroms.push(offset)
      offset += line.length + 1
    }
    const isDefLine = (i: number): boolean => i >= 0 && i < lines.length && DL_DEF_RE.test(lines[i])
    for (let i = 0; i < lines.length; i++) {
      const m = DL_DEF_RE.exec(lines[i])
      if (!m) continue
      const from = lineFroms[i]
      if (from < bodyFrom) continue
      if (inInlineSyntax(from + m[1].length + 1)) continue
      // Skip footnote definition lines (`[^id]: …`) — handled above.
      if (FOOTNOTE_DEF_RE.test(lines[i])) continue
      const markerLen = lines[i].length - m[2].length // indent + `:` + spaces
      if (!markTouched(from, from + markerLen)) {
        decos.push({ from, to: from + markerLen, value: hide })
      }
      decos.push({
        from,
        to: from,
        value: Decoration.line({ class: 'cm-md-dl-def' })
      })
      // Term: nearest non-empty, non-def line above (walks a `: a`/`: b` chain).
      let j = i - 1
      while (j >= 0 && (lines[j].trim() === '' || isDefLine(j))) {
        if (lines[j].trim() === '' && j - 1 >= 0 && lines[j - 1].trim() === '') break
        j--
      }
      if (j >= 0 && !isDefLine(j) && lines[j].trim() !== '') {
        const term = lines[j]
        // Heuristic guards: fence/heading/table/list markers are not terms.
        if (!/^(#{1,6}\s|```|~~~|\||[-*+]\s|\d+\.\s|>)/.test(term.trim())) {
          const termFrom = lineFroms[j]
          if (termFrom >= bodyFrom && !FOOTNOTE_DEF_RE.test(term) && !ABBR_DEF_RE.test(term)) {
            decos.push({
              from: termFrom,
              to: termFrom,
              value: Decoration.line({ class: 'cm-md-dl-term' })
            })
          }
        }
      }
    }
  }

  // ---- trailing inline attributes `{#id .class}` --------------------------------
  for (const m of full.matchAll(/\{((?:[#.][\w-]+[ \t]*)+)\}[ \t]*(?=\n|$)/g)) {
    const start = m.index
    const end = start + m[0].length
    if (end <= bodyFrom) continue
    if (inInlineSyntax(start)) continue
    if (!markTouched(start, end)) {
      decos.push({ from: start, to: end, value: hide })
    }
  }
}
