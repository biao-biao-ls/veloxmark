import type { SyntaxNode } from '@lezer/common'
import { syntaxTree } from '@codemirror/language'
import { Decoration } from '@codemirror/view'
import { type BuildCtx } from './handlers-ctx'
import { InlineMathWidget, MathBlockWidget } from '../widgets-math'

/**
 * Math regex pass (split from handlers.ts, task 1D). @lezer/markdown has no
 * math extension — this pass runs `$$…$$` block / single-line / `$…$` inline
 * matchAll over the whole document.
 *
 * ORDER CONTRACT: must run after the tree pass so `tree.resolveInner` can
 * skip math-looking text inside code nodes. (Parallel hand-maintained
 * implementation with export/renderDoc.ts renderTextRun — keep in sync.)
 */
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
          widget: new MathBlockWidget(m[2].trim(), start, end, ctx.config.i18nEpoch ?? 0),
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
          widget: new MathBlockWidget(
            m[2].trim(),
            start,
            start + m[0].length,
            ctx.config.i18nEpoch ?? 0
          ),
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
