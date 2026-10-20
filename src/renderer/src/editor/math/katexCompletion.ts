import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { findMathBlockAt } from '../livePreview/mathScan'
import { KATEX_COMPLETIONS } from './katexCommands'


const COMMAND_TRIGGER = /\\[a-zA-Z]*$/

export function katexCompletionSource(ctx: CompletionContext): CompletionResult | null {
  const text = ctx.state.sliceDoc(0, ctx.state.doc.length)
  if (!findMathBlockAt(text, ctx.pos)) return null
  const token = ctx.matchBefore(COMMAND_TRIGGER)
  if (!token) return null
  return {
    from: token.from,
    options: KATEX_COMPLETIONS,
    validFor: COMMAND_TRIGGER
  }
}
