/**
 * Command-table Map cache（2.11）—— App `setCtxRuntime` 热路径用。
 *
 * 每次 runCommand/isCommandDisabled 调用重建全表 + `find(id)` 是 O(n) 分配；
 * 改为按 ops 身份缓存 `Map<id, Command>`：`commandOps` 每 render 新对象 →
 * 至多每 render 重建一次，run 闭包始终来自最新 ops（与逐次
 * `buildCommands(commandOpsRef.current)` 语义等价，只是摊销）。
 */
import { buildCommands } from './build'
import type { Command, CommandOps } from './types'

export interface CommandCache {
  get(id: string): Command | undefined
}

export function createCommandCache(getOps: () => CommandOps): CommandCache {
  let cached: { ops: CommandOps; byId: Map<string, Command> } | null = null
  return {
    get(id) {
      const ops = getOps()
      if (!cached || cached.ops !== ops) {
        cached = { ops, byId: new Map(buildCommands(ops).map((c) => [c.id, c])) }
      }
      return cached.byId.get(id)
    }
  }
}
