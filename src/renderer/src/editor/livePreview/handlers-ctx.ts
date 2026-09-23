import type { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import type { SyntaxNodeRef } from '@lezer/common'
import type { LivePreviewConfig } from './config'

/**
 * Shared contract for per-syntax decoration handlers (split from the original
 * handlers.ts, task 1D — see docs/specs/1D-split-handlers/spec.md).
 *
 * `BuildCtx` is built by build.ts and consumed by every handler module
 * (handlers-tree / handlers-code / handlers-math / handlers-extended). The
 * Decoration singletons and small tree utils live here as the single
 * ownership point.
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
  /**
   * P21: collapsed callout body ranges recorded by enterCallout; build.ts
   * filters overlapping decos then pushes the fold placeholders (CM6 forbids
   * overlapping replaces — same pattern as P18 heading folds).
   */
  calloutFoldRanges?: Array<{ from: number; to: number; key: string; lines: number }>
}

export const hide = Decoration.replace({})
export const markEm = Decoration.mark({ class: 'cm-md-em' })
export const markStrong = Decoration.mark({ class: 'cm-md-strong' })
export const markDel = Decoration.mark({ class: 'cm-md-del' })
export const markCode = Decoration.mark({ class: 'cm-md-inline-code' })
export const markLink = Decoration.mark({ class: 'cm-md-link' })
/** P17: dashed red — the cache said this relative target does not exist. */
export const markLinkBroken = Decoration.mark({ class: 'cm-md-link cm-md-link-broken' })

export function nodeText(state: EditorState, node: SyntaxNodeRef): string {
  return state.sliceDoc(node.from, node.to)
}

export function listDepth(node: SyntaxNodeRef): number {
  let depth = 0
  for (let p = node.node.parent; p; p = p.parent) {
    if (p.name === 'List') depth++
  }
  return Math.min(Math.max(depth, 1), 6)
}

export function quoteDepth(node: SyntaxNodeRef): number {
  let depth = 0
  for (let p = node.node.parent; p; p = p.parent) {
    if (p.name === 'Blockquote') depth++
  }
  return Math.min(Math.max(depth, 1), 4)
}

/** Hide a '#'/'> '/'- ' marker plus one trailing space when present. */
export function hideMarkerWithSpace(node: SyntaxNodeRef, ctx: BuildCtx, from?: number): void {
  const doc = ctx.state.doc
  const start = from ?? node.from
  const end = doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to
  ctx.decos.push({ from: start, to: end, value: hide })
}
