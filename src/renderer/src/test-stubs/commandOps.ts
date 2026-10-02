/**
 * Test-only `CommandOps` stub（FE-02 抽出，供 commands 目录单测共用）。
 * 纯 no-op 装配：只为让 `buildCommands`/`buildMenus` 产出真实注册表形状，
 * 不承载任何行为断言。生产代码禁止 import 本文件。
 */
import type { CommandOps } from '../commands/types'

export function stubCommandOps(): CommandOps {
  const noop = (): void => {}
  const noopAsync = async (): Promise<void> => {}
  return {
    viewRef: { current: null },
    newFile: noopAsync,
    openFile: noopAsync,
    openFolder: noopAsync,
    saveFile: noopAsync,
    saveFileAs: async () => true,
    toggleTheme: noop,
    toggleOutline: noop,
    loadContent: noop,
    openPreferences: noop,
    openRecentFile: noopAsync,
    clearRecentFiles: noop,
    exportDocument: noop,
    openQuickOpen: noop,
    openGlobalSearch: noop,
    openMermaidInsert: noop,
    openCalloutInsert: noop,
    openTableInsert: noop,
    hasSelection: () => false,
    formatDocument: noop,
    nextTab: noop,
    closeTab: noop,
    reopenClosedTab: noop,
    getTabCount: () => 1,
    hasClosedTabs: () => false,
    showToast: noop,
    openLinkAtCursor: noop,
    copyLinkAddressAtCursor: noop
  }
}
