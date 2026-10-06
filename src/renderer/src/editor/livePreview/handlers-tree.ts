import type { SyntaxNodeRef } from '@lezer/common'
import type { Text } from '@codemirror/state'
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
    value: Decoration.line({
      class: `cm-md-heading cm-md-h${level}`,
      // Hover level-chip source of truth (render-zone.css .cm-md-heading::after
      // content: attr(data-heading-level)) — one "H{level}" construction point.
      attributes: { 'data-heading-level': `H${level}` }
    })
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

/**
 * TaskMarker node text is exactly `[x]` / `[X]` / `[ ]` (GFM). Done-mark
 * detection is case-insensitive, matching contextMenu/detect.ts
 * (`[xX]` → checked); write-back still normalizes to lowercase `'x'`.
 * Export keeps the same predicate (export/renderDoc/listTable.ts
 * `TASK_DONE_RE` — local mirror to avoid the widget import graph).
 */
export function isTaskDoneText(text: string): boolean {
  return /\[x\]/i.test(text)
}

/**
 * Trimmed text span of [from, to) — empty/whitespace-only runs yield null so
 * the strike never covers indentation (batch-J FE-06#5 first-line discipline,
 * now per line).
 */
function trimmedTextSpan(
  line: { from: number; text: string },
  from: number,
  to: number
): { from: number; to: number } | null {
  const seg = line.text.slice(Math.max(0, from - line.from), Math.max(0, to - line.from))
  const lead = seg.length - seg.trimStart().length
  const trail = seg.length - seg.trimEnd().length
  const textFrom = from + lead
  const textTo = to - trail
  return textFrom < textTo ? { from: textFrom, to: textTo } : null
}

/**
 * Done-strike spans for a completed task item: the marker line's tail plus
 * every continuation line of the item's *own* content blocks (trimmed per
 * line). Nested child list rows are skipped — they carry their own
 * TaskMarker state (FE-06 review #3: the strike must complete multi-line
 * items without bleeding into children).
 */
export function taskDoneTextSpans(node: SyntaxNodeRef, doc: Text): {
  from: number
  to: number
}[] {
  const spans: { from: number; to: number }[] = []
  const first = doc.lineAt(node.from)
  const push = (line: { from: number; text: string }, from: number, to: number): void => {
    const span = trimmedTextSpan(line, from, to)
    if (span) spans.push(span)
  }
  // Marker line: text after `[x]` only (the checkbox glyph itself stays unstruck).
  push(first, node.to, first.to)
  // Own-content lines: walk the parent ListItem (TaskMarker → Task → ListItem)
  // and skip any line inside a nested `List` child.
  const item = node.node.parent?.parent
  if (!item || item.name !== 'ListItem') return spans
  const nested: { from: number; to: number }[] = []
  for (let child = item.firstChild; child; child = child.nextSibling) {
    // Nested rows ride their own TaskMarker state — lezer names the list
    // kinds BulletList/OrderedList (no bare `List`).
    if (child.name === 'BulletList' || child.name === 'OrderedList') {
      nested.push({ from: child.from, to: child.to })
    }
  }
  for (let l = first; ; ) {
    if (l.to >= item.to || l.to >= doc.length) break
    const next = doc.lineAt(l.to + 1)
    if (!nested.some((r) => next.from < r.to && next.to > r.from)) {
      push(next, next.from, Math.min(next.to, item.to))
    }
    l = next
  }
  return spans
}

export function enterTaskMarker(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  // 5A: the checkbox replaces the bullet — kill the CSS marker on this line
  // (Typora semantics: task items show a checkbox, never a dot).
  const line = ctx.state.doc.lineAt(node.from)
  const text = nodeText(ctx.state, node)
  const checked = isTaskDoneText(text)
  // FE-06 ui_06 block C: completed items strike the line text through. The
  // strike rides a mark over the item TEXT only (batch-J FE-06#5) — a whole-
  // line class also struck the leading whitespace after the checkbox, leaving
  // a ~6px overhang left of the first glyph. The line class stays task-item
  // only so the marker suppression is independent of the done state.
  ctx.decos.push({
    from: line.from,
    to: line.from,
    value: Decoration.line({ class: 'cm-md-task-item' })
  })
  if (checked) {
    for (const span of taskDoneTextSpans(node, ctx.state.doc)) {
      ctx.decos.push({
        from: span.from,
        to: span.to,
        value: Decoration.mark({ class: 'cm-md-task-done' })
      })
    }
  }
  if (!ctx.touched(node.from, node.to)) {
    ctx.decos.push({
      from: node.from,
      to: node.to,
      value: Decoration.replace({
        widget: new TaskWidget(node.from, checked)
      })
    })
  }
  return false
}
