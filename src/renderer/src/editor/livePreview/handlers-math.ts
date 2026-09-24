import type { SyntaxNode } from '@lezer/common'
import { syntaxTree } from '@codemirror/language'
import { Decoration } from '@codemirror/view'
import { type BuildCtx } from './handlers-ctx'
import { InlineMathWidget, MathBlockWidget, MathEditChip, MathPreviewWidget } from '../widgets-math'
import { scanMath, type MathMatch } from './mathScan'
import { previewBelow } from './dualPane'

/**
 * Math regex pass (split from handlers.ts, task 1D). @lezer/markdown has no
 * math extension — this pass runs the shapes in `mathScan.ts` over the whole
 * document and turns them into decorations.
 *
 * ORDER CONTRACT: must run after the tree pass so `tree.resolveInner` can
 * skip math-looking text inside code nodes. (Parallel hand-maintained
 * implementation with export/renderDoc/inlineText.ts renderTextRun — keep in sync.)
 */
// ---- math (regex pass; @lezer/markdown has no math extension) ----------------

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

    for (const m of scanMath(text, from)) {
      if (inSkip(m.start, m.end)) continue
      if (m.kind === 'inline') {
        // P09: inline math follows the mark rule — a selection merely touching
        // the span reveals it; math *blocks* below stay block-granular.
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
      // 8B: cursor inside the block → source/preview dual pane instead of a
      // bare $$…$$ dump (P28 panel pattern — text stays document-editable).
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

/**
 * 8B focused-math panel decorations (live mode only — buildDecorations
 * early-returns for source mode before any handler runs). Mirrors P28's
 * buildFocusedCodePanel composition, per the dualPane convention:
 *
 * 1. Line classes per block line: panel chrome on every line, `-first`/`-last`
 *    caps (a single-line block gets both — CSS rules compose).
 * 2. 「公式 ✓」 exit chip on the first line (absolute top-right, zero layout).
 *    `$$` delimiters stay visible — they are the text being edited.
 * 3. Live KaTeX preview trailing the block (previewBelow).
 */
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

  const epoch = ctx.config.i18nEpoch ?? 0
  ctx.decos.push({
    from: first.from,
    to: first.from,
    value: Decoration.widget({ widget: new MathEditChip(epoch), side: 1 })
  })
  ctx.decos.push(previewBelow(Math.min(last.to + 1, doc.length), new MathPreviewWidget(m.content, epoch)))
}
