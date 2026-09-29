/**
 * macOS native menu contract guards (BE-02, menu:native-parity).
 *
 * The darwin template is main-process code, so the assertions source-scan
 * electron/menu/darwin.ts (same precedent as i18n.test.ts's literal scan):
 *
 *   1. command id set equals the frozen pre-reorder baseline (AC-FN-09) and
 *      insertTable/convertToTable appear exactly once (menu:insert-dedupe)
 *   2. every label reference (S.x / S['…']) resolves in both NATIVE_MENU_STRINGS
 *      languages — a missing key would render a raw key / undefined label
 *   3. menu-tree §3 group keys follow the target group order per menu
 *   4. the two locked no-accelerator verdicts hold (format submenu = CM6
 *      Mod-B/I/E; tab commands = before-input tab-aware routing)
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DARWIN_COMMAND_ACCELERATORS } from '../../../../electron/shared/commandAccelerators'
import { NATIVE_MENU_STRINGS } from '../../../../electron/shared/menuStrings'

const darwinSource = readFileSync(
  fileURLToPath(new URL('../../../../electron/menu/darwin.ts', import.meta.url)),
  'utf8'
)

/** Command ids referenced by commandItem(…) — the frozen native menu id set. */
function commandIds(source: string): string[] {
  return [...source.matchAll(/\bcommandItem\(\s*'([^']+)'/g)].map((m) => m[1])
}

/** Group label keys in template order (S['menu.grp.*'] references). */
function groupKeysInOrder(source: string): string[] {
  return [...source.matchAll(/S\[\s*'(menu\.grp\.[^']+)'\s*\]/g)].map((m) => m[1])
}

/** All NATIVE_MENU_STRINGS key references used by the template. */
function labelKeyRefs(source: string): string[] {
  const short = [...source.matchAll(/\bS\.([\w]+)\b/g)].map((m) => m[1])
  const namespaced = [...source.matchAll(/S\[\s*'([^']+)'\s*\]/g)].map((m) => m[1])
  return [...short, ...namespaced]
}

// Frozen baseline: command ids referenced by the darwin menu immediately before
// the menu-tree §3 regroup (BE-02). Presentation may move items between menus;
// the id set must not grow or shrink. If a later task deliberately changes the
// native id surface (e.g. BE-01 promoting zoom/devtools to commandItem), update
// this baseline in the same change.
const BASELINE_COMMAND_IDS = [
  'openPreferences',
  'newFile',
  'openFile',
  'openFolder',
  'quickOpen',
  'saveFile',
  'saveFileAs',
  'closeTab',
  'reopenClosedTab',
  'nextTab',
  'exportPdf',
  'exportHtml',
  'copyRichText',
  'copyAsHtml',
  'exportSelectionHtml',
  'insertTable',
  'convertToTable',
  'formatDocument',
  'bold',
  'italic',
  'inlineCode',
  'strikethrough',
  'highlight',
  'toggleOutline',
  'globalSearch',
  'toggleFocusMode',
  'toggleTypewriterMode',
  'toggleSourceMode',
  'toggleTypingAssists',
  'toggleWrapBareUrlOnPaste',
  'togglePasteHtmlToMd',
  'toggleTheme',
  'insertMermaidDiagram',
  'insertCallout',
  'showHelp'
]

// menu-tree §3 group inventory shared with FE-01 (renderer i18n menu.grp.*).
const GROUP_KEYS = [
  'menu.grp.newOpen',
  'menu.grp.save',
  'menu.grp.tabs',
  'menu.grp.export',
  'menu.grp.settings',
  'menu.grp.history',
  'menu.grp.clipboard',
  'menu.grp.findOrganize',
  'menu.grp.format',
  'menu.grp.selectionExport',
  'menu.grp.sidebarSearch',
  'menu.grp.fold',
  'menu.grp.mode',
  'menu.grp.inputAssist',
  'menu.grp.zoom',
  'menu.grp.devTheme',
  'menu.grp.table',
  'menu.grp.chartContainer'
]

// Expected group order in the template: File 5 groups, Edit 4 (历史 omitted —
// no native undo/redo), View 5 (折叠 omitted — no native fold items), Insert 2.
const EXPECTED_GROUP_ORDER = [
  'menu.grp.newOpen',
  'menu.grp.save',
  'menu.grp.tabs',
  'menu.grp.export',
  'menu.grp.settings',
  'menu.grp.clipboard',
  'menu.grp.findOrganize',
  'menu.grp.format',
  'menu.grp.selectionExport',
  'menu.grp.sidebarSearch',
  'menu.grp.mode',
  'menu.grp.inputAssist',
  'menu.grp.zoom',
  'menu.grp.devTheme',
  'menu.grp.table',
  'menu.grp.chartContainer'
]

// Locked verdicts (BE-02 核心流程 3): format submenu keys belong to the CM6
// keymap; tab commands route through the before-input tab-aware handler.
const NO_ACCEL_COMMAND_IDS = [
  'bold',
  'italic',
  'inlineCode',
  'strikethrough',
  'highlight',
  'closeTab',
  'reopenClosedTab',
  'nextTab'
]

describe('darwin menu contract (BE-02)', () => {
  it('command id set matches the frozen pre-reorder baseline (AC-FN-09)', () => {
    const actual = [...new Set(commandIds(darwinSource))].sort()
    const baseline = [...BASELINE_COMMAND_IDS].sort()
    expect(actual, `darwin command id drift: ${actual.join(', ')}`).toEqual(baseline)
  })

  it('insertTable/convertToTable appear once each (menu:insert-dedupe)', () => {
    for (const id of ['insertTable', 'convertToTable']) {
      const occurrences = commandIds(darwinSource).filter((x) => x === id).length
      expect(occurrences, `${id} should appear exactly once in the darwin template`).toBe(1)
    }
  })

  it('every label key reference resolves in NATIVE_MENU_STRINGS (en + zh)', () => {
    const missing: string[] = []
    for (const key of new Set(labelKeyRefs(darwinSource))) {
      if (!(key in NATIVE_MENU_STRINGS.en)) missing.push(`${key} (en)`)
      if (!(key in NATIVE_MENU_STRINGS.zh)) missing.push(`${key} (zh)`)
    }
    expect(missing, `unresolved native menu label keys: ${missing.join('; ')}`).toEqual([])
  })

  it('menu-tree §3 group keys exist in both languages (FE-01 inventory)', () => {
    const missing: string[] = []
    for (const key of GROUP_KEYS) {
      if (!(key in NATIVE_MENU_STRINGS.en)) missing.push(`${key} (en)`)
      if (!(key in NATIVE_MENU_STRINGS.zh)) missing.push(`${key} (zh)`)
    }
    expect(missing, `group key inventory drift: ${missing.join('; ')}`).toEqual([])
  })

  it('group headers follow the menu-tree §3 group order', () => {
    expect(groupKeysInOrder(darwinSource)).toEqual(EXPECTED_GROUP_ORDER)
  })

  it('format submenu and tab commands keep no native accelerator', () => {
    for (const id of NO_ACCEL_COMMAND_IDS) {
      expect(
        DARWIN_COMMAND_ACCELERATORS[id],
        `${id} must not carry a native accelerator (locked verdict)`
      ).toBeUndefined()
    }
  })
})
