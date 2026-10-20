import type { EditorView } from '@codemirror/view'
import type { BlockHit, BlockKind, CtxMenuItem, CtxRuntime } from './types'


export type CtxOpFactory = (view: EditorView, hit: BlockHit, rt: CtxRuntime) => CtxMenuItem[]

export const blockDeltas = new Map<BlockKind, CtxOpFactory[]>()
if (typeof window !== 'undefined') {
  ;(window as unknown as { __veloxCtxDebug?: unknown }).__veloxCtxDebug = {
    deltaKinds: () => [...blockDeltas.keys()],
    deltaCount: (kind: string) => (blockDeltas.get(kind as BlockKind) ?? []).length
  }
}
export function registerContextMenuOps(kind: BlockKind, factory: CtxOpFactory): void {
  const list = blockDeltas.get(kind) ?? []
  list.push(factory)
  blockDeltas.set(kind, list)
}
