import type { SyntaxNode } from '@lezer/common'
import { syntaxTree } from '@codemirror/language'
import { Decoration } from '@codemirror/view'
import { type BuildCtx } from './handlers-ctx'
import { InlineMathWidget, MathBlockWidget, MathEditChip, MathPreviewWidget } from '../widgets-math'
import { scanMath, type MathMatch } from './mathScan'
import { previewBelow } from './dualPane'
import { texTokenRanges } from '../math/texStream'


const MATH_SKIP_NODES = new Set(['InlineCode', 'FencedCode', 'CodeText', 'URL'])

export function collectMathDecos(
  ctx: BuildCtx,
  _resolveNode: (pos: number, side: -1 | 1) => SyntaxNode
): void {
  const { state, decos, blockTouched, markTouched } = ctx
  const doc = state.doc

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

    for (const m of scanMath(text, from)) {
      if (inSkip(m.start, m.end)) continue
      if (m.kind === 'inline') {
        if (markTouched(m.start, m.end)) continue
        decos.push({
          from: m.start,
          to: m.end,
          value: Decoration.replace({ widget: new InlineMathWidget(m.content) })
        })
        continue
      }
      const lineFrom = doc.lineAt(m.start).from
      const lineTo = doc.lineAt(m.end - 1).to
      if (blockTouched(lineFrom, lineTo)) {
        buildFocusedMathPanel(m, lineFrom, lineTo, ctx)
        continue
      }
      decos.push({
        from: lineFrom,
        to: lineTo,
        value: Decoration.replace({
          widget: new MathBlockWidget(m.content, m.start, m.end, ctx.config.i18nEpoch ?? 0),
          block: true
        })
      })
    }
  }
}

function buildFocusedMathPanel(
  m: MathMatch,
  lineFrom: number,
  lineTo: number,
  ctx: BuildCtx
): void {
  const doc = ctx.state.doc
  const first = doc.lineAt(lineFrom)
  const last = doc.lineAt(lineTo)

  for (let line = first; ; line = doc.lineAt(line.to + 1)) {
    const isFirst = line.from === first.from
    const isLast = line.from === last.from
    const cls =
      'cm-md-math-src' +
      (isFirst ? ' cm-md-math-src-first' : '') +
      (!isFirst && !isLast ? ' cm-md-math-src-body' : '') +
      (isLast ? ' cm-md-math-src-last' : '')
    ctx.decos.push({ from: line.from, to: line.from, value: Decoration.line({ class: cls }) })
    if (isLast) break
  }

  const blockFrom = first.from
  const blockTo = last.to
  const src = ctx.state.sliceDoc(blockFrom, blockTo)
  for (const r of texTokenRanges(src)) {
    ctx.decos.push({
      from: blockFrom + r.from,
      to: blockFrom + r.to,
      value: Decoration.mark({ class: r.className })
    })
  }

  const epoch = ctx.config.i18nEpoch ?? 0
  ctx.decos.push({
    from: first.from,
    to: first.from,
    value: Decoration.widget({ widget: new MathEditChip(epoch), side: 1 })
  })
  ctx.decos.push(previewBelow(Math.min(last.to + 1, doc.length), new MathPreviewWidget(m.content, epoch)))
}
