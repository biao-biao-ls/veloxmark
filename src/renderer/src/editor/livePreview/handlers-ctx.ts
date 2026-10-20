import type { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import type { SyntaxNodeRef } from '@lezer/common'
import type { LivePreviewConfig } from './config'


export interface PendingDeco {
  from: number
  to: number
  value: Decoration
}

export interface BuildCtx {
  state: EditorState
  config: LivePreviewConfig
  decos: PendingDeco[]
  touched: (from: number, to: number) => boolean
  blockTouched: (from: number, to: number) => boolean
  markTouched: (from: number, to: number) => boolean
  calloutFoldRanges?: Array<{ from: number; to: number; key: string; lines: number }>
}

export const hide = Decoration.replace({})
export const markEm = Decoration.mark({ class: 'cm-md-em' })
export const markStrong = Decoration.mark({ class: 'cm-md-strong' })
export const markDel = Decoration.mark({ class: 'cm-md-del' })
export const markCode = Decoration.mark({ class: 'cm-md-inline-code' })
export const markLink = Decoration.mark({ class: 'cm-md-link' })
export const markLinkBroken = Decoration.mark({ class: 'cm-md-link cm-md-link-broken' })

export function nodeText(state: EditorState, node: SyntaxNodeRef): string {
  return state.sliceDoc(node.from, node.to)
}

export function listDepth(node: SyntaxNodeRef): number {
  let depth = 0
  for (let p = node.node.parent; p; p = p.parent) {
    if (p.name === 'BulletList' || p.name === 'OrderedList') depth++
  }
  return Math.min(Math.max(depth, 1), 6)
}

export function orderedListIndex(node: SyntaxNodeRef): number {
  const item = node.node.parent
  const list = item?.parent
  if (!item || !list) return 1
  let n = 0
  for (let child = list.firstChild; child; child = child.nextSibling) {
    if (child.name === 'ListItem') {
      n++
      if (child.from === item.from) return n
    }
  }
  return Math.max(n, 1)
}

export function quoteDepth(node: SyntaxNodeRef): number {
  let depth = 0
  for (let p = node.node.parent; p; p = p.parent) {
    if (p.name === 'Blockquote') depth++
  }
  return Math.min(Math.max(depth, 1), 4)
}

export function hideMarkerWithSpace(node: SyntaxNodeRef, ctx: BuildCtx, from?: number): void {
  const doc = ctx.state.doc
  const start = from ?? node.from
  const end = doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to
  ctx.decos.push({ from: start, to: end, value: hide })
}
