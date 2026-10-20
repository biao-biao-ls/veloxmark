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


export function enterHeading(level: number, node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  const line = ctx.state.doc.lineAt(node.from)
  ctx.decos.push({
    from: line.from,
    to: line.from,
    value: Decoration.line({
      class: `cm-md-heading cm-md-h${level}`,
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


export function enterEmphasisMark(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
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
  const parent = node.node.parent
  if (!ctx.markTouched(parent ? parent.from : node.from, parent ? parent.to : node.to)) {
    ctx.decos.push({ from: node.from, to: node.to, value: hide })
  }
  return false
}


export function enterInlineCode(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  ctx.decos.push({ from: node.from, to: node.to, value: markCode })
  if (!ctx.markTouched(node.from, node.to)) {
    for (let c = node.node.firstChild; c; c = c.nextSibling) {
      if (c.name === 'CodeMark') {
        ctx.decos.push({ from: c.from, to: c.to, value: hide })
      }
    }
  }
  return false
}


export function enterLink(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  if (/^\[\^[^\]\s]+\]$/.test(nodeText(ctx.state, node))) return false
  let mark = markLink
  const baseDir = ctx.config.baseDir
  if (baseDir) {
    const url = extractLinkUrl(ctx.state, node.node)
    if (url && !isSkippableHref(url) && isBrokenCached(baseDir, url)) {
      mark = markLinkBroken
    }
  }
  ctx.decos.push({ from: node.from, to: node.to, value: mark })
  if (!ctx.markTouched(node.from, node.to)) {
    for (let c = node.node.firstChild; c; c = c.nextSibling) {
      if (c.name === 'LinkMark' || c.name === 'URL') {
        ctx.decos.push({ from: c.from, to: c.to, value: hide })
      }
    }
  }
  return false
}


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


export function enterListMark(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  const doc = ctx.state.doc
  const line = doc.lineAt(node.from)
  const end = doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to
  const shown = ctx.markTouched(line.from, end)
  if (!shown) {
    ctx.decos.push({ from: line.from, to: end, value: hide })
  }
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


export function enterCallout(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  const doc = ctx.state.doc
  const line = doc.lineAt(node.from)
  const parsed = parseCalloutMarker(line.text)
  if (!parsed) return true
  const type = parsed.type
  const key = calloutKey(line.from, parsed)
  const sel = ctx.state.selection.main
  const selectionInside = sel.from <= node.to && sel.to >= node.from
  const folded = !selectionInside && isCalloutFolded(ctx.state, key, parsed)
  const hasBody = node.to > line.to

  const mFrom = line.from + parsed.markerStart
  const mTo = line.from + parsed.markerEnd
  const markerShown = ctx.markTouched(mFrom, mTo)

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


export function enterHorizontalRule(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  const doc = ctx.state.doc
  const line = doc.lineAt(node.from)
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

export function isTaskDoneText(text: string): boolean {
  return /\[x\]/i.test(text)
}

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
  push(first, node.to, first.to)
  const item = node.node.parent?.parent
  if (!item || item.name !== 'ListItem') return spans
  const nested: { from: number; to: number }[] = []
  for (let child = item.firstChild; child; child = child.nextSibling) {
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
  const line = ctx.state.doc.lineAt(node.from)
  const text = nodeText(ctx.state, node)
  const checked = isTaskDoneText(text)
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
