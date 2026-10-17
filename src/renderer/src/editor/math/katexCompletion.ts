import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { findMathBlockAt } from '../livePreview/mathScan'
import { KATEX_COMPLETIONS } from './katexCommands'

// ---- step ④: KaTeX command completion (gated to math blocks) ---------------
// Registered via EditorState.languageData `autocomplete` (aggregates with the
// nested-language sources) — self-gating keeps it inert outside `$$…$$`
// blocks. Inline `$…$` is intentionally excluded (findMathBlockAt never
// reports inline as a block; popping a list mid-prose would be noise).

const COMMAND_TRIGGER = /\\[a-zA-Z]*$/

export function katexCompletionSource(ctx: CompletionContext): CompletionResult | null {
  const text = ctx.state.sliceDoc(0, ctx.state.doc.length)
  if (!findMathBlockAt(text, ctx.pos)) return null
  const token = ctx.matchBefore(COMMAND_TRIGGER)
  if (!token) return null
  // `token.from` is the backslash — options replace from there, so accepting
  // a completion swaps the whole \command.
  return {
    from: token.from,
    options: KATEX_COMPLETIONS,
    validFor: COMMAND_TRIGGER
  }
}
