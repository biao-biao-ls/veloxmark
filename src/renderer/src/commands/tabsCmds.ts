/**
 * Tabs-domain commands（2B 自 commands.ts 平移，P26）。
 */
import type { Command, TabsCmdOps } from './types'

export function buildTabsCmds(ops: TabsCmdOps): Command[] {
  return [
    // ---- P26 tabs ----------------------------------------------------------
    {
      id: 'nextTab',
      label: 'cmd.nextTab',
      shortcut: 'Ctrl+Tab',
      bindGlobal: true,
      isDisabled: () => ops.getTabCount() < 2,
      run: () => ops.nextTab()
    },
    {
      id: 'closeTab',
      label: 'cmd.closeTab',
      shortcut: 'Ctrl+W',
      bindGlobal: true,
      run: () => ops.closeTab()
    },
    {
      id: 'reopenClosedTab',
      label: 'cmd.reopenClosedTab',
      shortcut: 'Ctrl+Shift+T',
      bindGlobal: true,
      isDisabled: () => !ops.hasClosedTabs(),
      run: () => ops.reopenClosedTab()
    }
  ]
}
