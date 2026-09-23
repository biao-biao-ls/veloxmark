/**
 * Block-op delta registry（2C 自 registry.ts 平移）。
 *
 * `registerContextMenuOps(kind, factory)` lets block families attach delta
 * ops；`blockDeltas` 供 menuSkeleton 的 buildContextMenu 装配与 e2e 缝盘点。
 * `__veloxCtxDebug` 赋值是模块级副作用（probe 契约 — stable API），随本模块
 * 加载即安装，与拆分前 registry.ts 首次 import 时序等价。
 */
import type { EditorView } from '@codemirror/view'
import type { BlockHit, BlockKind, CtxMenuItem, CtxRuntime } from './types'

// ---- block-op registry -------------------------------------------------------

export type CtxOpFactory = (view: EditorView, hit: BlockHit, rt: CtxRuntime) => CtxMenuItem[]

export const blockDeltas = new Map<BlockKind, CtxOpFactory[]>()
// e2e seam: delta registration inventory (probe contract — stable API).
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
