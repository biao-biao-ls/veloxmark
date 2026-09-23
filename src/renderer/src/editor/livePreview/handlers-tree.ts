import type { SyntaxNodeRef } from '@lezer/common'
import { Decoration } from '@codemirror/view'
import {
  hide,
  hideMarkerWithSpace,
  listDepth,
  markCode,
  orderedListIndex,
  markDel,
  markEm,
  markLink,
  markLinkBroken,
  markStrong,
  nodeText,
  quoteDepth,
  type BuildCtx
} from './handlers-ctx'
import { TaskWidget } from '../widgets-extended'
import { ImageWidget } from '../image-widget'
import { parseImageMarkdown } from '../image-parse'
import { extractLinkUrl, isBrokenCached, isSkippableHref } from './linkNav'
import { calloutDisplayTitle, parseCalloutMarker } from './callout'
import { CalloutTitleWidget, calloutKey, isCalloutFolded } from './calloutFold'

/**
 * Tree-pass enter* handlers (split from handlers.ts, task 1D).
 *
 * Each `enter*` function handles one markdown node kind and returns whether
 * tree.iterate should descend into the node's children (parity with the
 * original single if-chain in buildDecorations).
 */
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
            ctx.config.imageEpoch,
            ctx.config.i18nEpoch ?? 0
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
  // While the source marker is visible, suppress the CSS marker so the two
  // don't render side by side. Ordered lists carry a build-time renumber in
  // data-vm-n (5A) — CSS counters can't reset across CM6's flat line DOM.
  const ordered = /^\d/.test(nodeText(ctx.state, node))
  const classes = ['cm-md-list', `cm-md-list-d${listDepth(node)}`]
  if (shown) classes.push('cm-md-list-open')
  if (ordered) classes.push('cm-md-list-ol')
  ctx.decos.push({
    from: line.from,
    to: line.from,
    value: Decoration.line({
      class: classes.join(' '),
      ...(ordered ? { attributes: { 'data-vm-n': String(orderedListIndex(node)) } } : {})
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

// ---- callouts (P21) ---------------------------------------------------------

/**
 * `> [!TYPE]` callout container styling on a Blockquote node. Always returns
 * true so children keep flowing through the normal handlers (QuoteMark `>`
 * hide, nested lists/code/links unchanged). A Blockquote whose first line is
 * not a callout marker produces zero decos here — acceptance ⑤.
 */
export function enterCallout(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  const doc = ctx.state.doc
  const line = doc.lineAt(node.from)
  const parsed = parseCalloutMarker(line.text)
  if (!parsed) return true
  const type = parsed.type
  const key = calloutKey(line.from, parsed)
  // Reveal the body while the cursor/selection is anywhere in the block —
  // P18-style auto-reveal without writing a fold override (moving away
  // re-collapses; the source `+/-` default stays intact).
  const sel = ctx.state.selection.main
  const selectionInside = sel.from <= node.to && sel.to >= node.from
  const folded = !selectionInside && isCalloutFolded(ctx.state, key, parsed)
  const hasBody = node.to > line.to

  const mFrom = line.from + parsed.markerStart
  const mTo = line.from + parsed.markerEnd
  // P09: `[!TYPE]` marker source shows while the cursor touches it.
  const markerShown = ctx.markTouched(mFrom, mTo)

  // Line classes across the whole block; folded body lines stay out of the
  // deco list (they fall inside the replace range pushed by build.ts).
  for (let l = line; ; ) {
    const isHead = l.from === line.from
    if (!(folded && hasBody && !isHead)) {
      const cls = isHead
        ? `cm-md-callout cm-md-callout-${type} cm-md-callout-head` +
          (markerShown ? ' cm-md-callout-src' : '')
        : `cm-md-callout cm-md-callout-${type}`
      ctx.decos.push({ from: l.from, to: l.from, value: Decoration.line({ class: cls }) })
    }
    if (l.to >= node.to || l.to >= doc.length) break
    l = doc.lineAt(l.to + 1)
  }

  // Marker hide + default-title widget. Custom source title needs only the
  // marker hidden (title text is already in the doc); otherwise the marker
  // range is replaced with the display title (default zh/en name, or the
  // raw TYPE for unknown markers).
  if (!markerShown) {
    if (parsed.title !== '') {
      ctx.decos.push({ from: mFrom, to: mTo, value: hide })
    } else {
      ctx.decos.push({
        from: mFrom,
        to: mTo,
        value: Decoration.replace({
          widget: new CalloutTitleWidget(calloutDisplayTitle(parsed), type)
        })
      })
    }
  }

  if (folded && hasBody) {
    let lines = 0
    for (let l = doc.lineAt(line.to + 1); ; ) {
      lines++
      if (l.to >= node.to || l.to >= doc.length) break
      l = doc.lineAt(l.to + 1)
    }
    ctx.calloutFoldRanges?.push({ from: line.to, to: node.to, key, lines })
  }
  return true
}

// ---- horizontal rule --------------------------------------------------------

export function enterHorizontalRule(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  const doc = ctx.state.doc
  const line = doc.lineAt(node.from)
  // UX-P01 F4: an unconfirmed trailing "---" (no line terminator yet —
  // e.g. mid-typing, or after a single undo of the Enter trigger) stays
  // plain text; the decoration appears only once the line is complete.
  if (line.to >= doc.length) return false
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
  // 5A: the checkbox replaces the bullet — kill the CSS marker on this line
  // (Typora semantics: task items show a checkbox, never a dot).
  const lineFrom = ctx.state.doc.lineAt(node.from).from
  ctx.decos.push({
    from: lineFrom,
    to: lineFrom,
    value: Decoration.line({ class: 'cm-md-task-item' })
  })
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
