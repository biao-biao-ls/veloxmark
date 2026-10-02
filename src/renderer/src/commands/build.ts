/**
 * buildCommands 装配（2B）：六域 builder 按固定序 concat。
 *
 * concat 序 file → edit → format → tabs → view → insert 是行为契约（固定不变）：
 * `matchGlobalShortcut` 按注册序优先命中。Q6 撤键后同键遮蔽前提已消除——
 * `reopenClosedTab`（tabs）是其快捷键的唯一归属，`toggleTheme`（view）已无
 * 键位；顺序仍须稳定（测试/回显按序取值），只是不再承担遮蔽职责。
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
