/**
 * buildCommands 装配（2B）：六域 builder 按固定序 concat。
 *
 * concat 序 file → edit → format → tabs → view → insert 是行为的一部分：
 * `matchGlobalShortcut` 顺序优先，`reopenClosedTab`（tabs，Ctrl+Shift+T）必须
 * 先于 `toggleTheme`（view，同键）——保持拆分前的遮蔽现状。
 */
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
