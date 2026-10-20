import { buildEditCmds } from './editCmds'
import { buildFileCmds } from './fileCmds'
import { buildFormatCmds } from './formatCmds'
import { buildInsertCmds } from './insertCmds'
import { buildTabsCmds } from './tabsCmds'
import { buildViewCmds } from './viewCmds'
import type { Command, CommandOps } from './types'

export function buildCommands(ops: CommandOps): Command[] {
  return [
    ...buildFileCmds(ops),
    ...buildEditCmds(ops),
    ...buildFormatCmds(ops),
    ...buildTabsCmds(ops),
    ...buildViewCmds(ops),
    ...buildInsertCmds(ops)
  ]
}
