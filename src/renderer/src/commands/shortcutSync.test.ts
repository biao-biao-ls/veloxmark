/**
 * 快捷键双源一致性守护（2.12）—— renderer `Command.shortcut` 与
 * `electron/shared/commandAccelerators.ts`（darwin 原生菜单加速键）不得漂移。
 *
 * 派生规则：shortcut 的 `Ctrl+` → `Cmd+`（Electron accelerator 在 macOS 上的
 * 惯例写法），其余段不动；例外必须登记在 DERIVATION_EXCEPTIONS，并注明原因。
 * 正向：表中每个 entry 都必须与对应命令的 shortcut 派生一致。
 * 反向钉住：bold/italic/inlineCode 故意无加速键（CM6 keymap 拥有 Mod-B/I/E，
 * 原生加速键会抢注）——防止有人"顺手补上"。
 */
import { describe, expect, it } from 'vitest'
import { DARWIN_COMMAND_ACCELERATORS } from '../../../../electron/shared/commandAccelerators'
import { buildCommands } from './build'
import type { Command, CommandOps } from './types'

/** Documented deviations from `shortcut.replaceAll('Ctrl+', 'Cmd+')`. */
const DERIVATION_EXCEPTIONS: Record<string, { accelerator: string; reason: string }> = {
  copyRichText: {
    accelerator: 'CmdOrCtrl+Shift+C',
    reason: 'P20 registers CmdOrCtrl so the chord works on both modifiers in macOS'
  }
}

/** Intentionally accelerator-free (CM6 keymap owns the chords in-editor). */
const NO_ACCELERATOR_BY_DESIGN = ['bold', 'italic', 'inlineCode']

function stubOps(): CommandOps {
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

function derive(shortcut: string): string {
  return shortcut.replaceAll('Ctrl+', 'Cmd+')
}

describe('DARWIN_COMMAND_ACCELERATORS ↔ Command.shortcut', () => {
  const byId = new Map(buildCommands(stubOps()).map((c) => [c.id, c]))

  it('every accelerator entry points at a known command and matches its shortcut', () => {
    for (const [id, accelerator] of Object.entries(DARWIN_COMMAND_ACCELERATORS)) {
      const cmd: Command | undefined = byId.get(id)
      expect(cmd, `accelerator id "${id}" has no command`).toBeDefined()
      if (!cmd) continue
      const exception = DERIVATION_EXCEPTIONS[id]
      const expected = exception ? exception.accelerator : derive(cmd.shortcut ?? '')
      expect(accelerator, `accelerator for "${id}" drifted from shortcut "${cmd.shortcut}"`).toBe(
        expected
      )
    }
  })

  it('derivation exceptions are all still registered in the table', () => {
    for (const id of Object.keys(DERIVATION_EXCEPTIONS)) {
      expect(DARWIN_COMMAND_ACCELERATORS[id]).toBeDefined()
    }
  })

  it('inline-format chords intentionally have no native accelerator', () => {
    for (const id of NO_ACCELERATOR_BY_DESIGN) {
      expect(
        DARWIN_COMMAND_ACCELERATORS[id],
        `"${id}" must not gain an accelerator (CM6 keymap owns Mod chords in-editor)`
      ).toBeUndefined()
    }
  })
})
