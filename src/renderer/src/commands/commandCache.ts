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
