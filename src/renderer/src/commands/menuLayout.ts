/**
 * Menu-bar layout + assembly（2B 自 commands.ts 平移；FE-01 菜单信息架构重排）。
 *
 * MENU_LAYOUT 是菜单呈现层真源（menu:ia-reorder）：分组/位次/命名可重排，
 * 命令 id 为 e2e 缝硬契约（menu-tree §9 / AC-FN-09）字面量一个都不改。
 * 目标结构：文件 5 组 / 编辑 5 组 / 视图 6 组 / 插入 2 组 / 帮助单项（menu-tree §3）。
 */
import type { MenuDef, MenuItem } from '../components/MenuBar'
import { t } from '../i18n'
import { buildCommands } from './build'
import { fmtShortcut } from './shortcutDisplay'
import type { Command, CommandOps, RecentItem } from './types'

// ---- menu layout -----------------------------------------------------------

export type LayoutItem =
  | string
  | { recent: true }
  | { export: true }
  | { format: true }

export interface LayoutGroup {
  /** Semantic group title i18n key; omitted for single-item menus (Help). */
  labelKey?: string
  items: LayoutItem[]
}

export interface LayoutMenu {
  /** Root menu id (also the data-testid slug); label resolves via ROOT_LABEL_KEY. */
  menu: 'file' | 'edit' | 'view' | 'insert' | 'help'
  groups: LayoutGroup[]
}

const ROOT_LABEL_KEY = {
  file: 'menu.file',
  edit: 'menu.edit',
  view: 'menu.view',
  insert: 'menu.insert',
  help: 'menu.help'
} as const

export const MENU_LAYOUT: LayoutMenu[] = [
  {
    menu: 'file',
    groups: [
      {
        labelKey: 'menu.grp.newOpen',
        items: ['newFile', 'openFile', 'openFolder', 'quickOpen', { recent: true }]
      },
      { labelKey: 'menu.grp.save', items: ['saveFile', 'saveFileAs'] },
      { labelKey: 'menu.grp.tabs', items: ['closeTab', 'reopenClosedTab', 'nextTab'] },
      { labelKey: 'menu.grp.export', items: [{ export: true }] },
      { labelKey: 'menu.grp.settings', items: ['openPreferences'] }
    ]
  },
  {
    menu: 'edit',
    groups: [
      { labelKey: 'menu.grp.history', items: ['undo', 'redo'] },
      {
        labelKey: 'menu.grp.clipboard',
        items: ['cut', 'copy', 'paste', 'copyRichText', 'copyAsHtml', 'selectAll']
      },
      { labelKey: 'menu.grp.findOrganize', items: ['find', 'formatDocument'] },
      { labelKey: 'menu.grp.format', items: [{ format: true }] },
      { labelKey: 'menu.grp.selectionExport', items: ['exportSelectionHtml'] }
    ]
  },
  {
    menu: 'view',
    groups: [
      { labelKey: 'menu.grp.sidebarSearch', items: ['toggleOutline', 'globalSearch'] },
      { labelKey: 'menu.grp.fold', items: ['foldAll', 'unfoldAll'] },
      {
        labelKey: 'menu.grp.mode',
        items: ['toggleFocusMode', 'toggleTypewriterMode', 'toggleSourceMode']
      },
      {
        labelKey: 'menu.grp.inputAssist',
        items: ['toggleTypingAssists', 'toggleWrapBareUrlOnPaste', 'togglePasteHtmlToMd']
      },
      { labelKey: 'menu.grp.zoom', items: ['zoomIn', 'zoomOut', 'zoomReset'] },
      { labelKey: 'menu.grp.devTheme', items: ['toggleDevTools', 'toggleTheme'] }
    ]
  },
  {
    // menu:insert-dedupe — insertTable/convertToTable 迁自编辑菜单，插入域唯一份。
    menu: 'insert',
    groups: [
      { labelKey: 'menu.grp.table', items: ['insertTable', 'convertToTable'] },
      { labelKey: 'menu.grp.chartContainer', items: ['insertMermaidDiagram', 'insertCallout'] }
    ]
  },
  { menu: 'help', groups: [{ items: ['showHelp'] }] }
]

// ---- layout ↔ registry invariant (FE-01) -----------------------------------

/** Marker expansion ids — single source, also consumed by resolveItem below. */
const EXPORT_SUBMENU_IDS = ['exportPdf', 'exportHtml'] as const
const FORMAT_SUBMENU_IDS = ['bold', 'italic', 'inlineCode', 'strikethrough', 'highlight'] as const

/** Every command id MENU_LAYOUT references (special markers expanded). */
function layoutCommandIds(layout: readonly LayoutMenu[]): string[] {
  const ids: string[] = []
  for (const menu of layout) {
    for (const group of menu.groups) {
      for (const item of group.items) {
        if (typeof item === 'string') ids.push(item)
        else if ('export' in item) ids.push(...EXPORT_SUBMENU_IDS)
        else if ('format' in item) ids.push(...FORMAT_SUBMENU_IDS)
        // { recent: true } expands to ops-driven recent entries — no command ids.
      }
    }
  }
  return ids
}

/**
 * Module-load-time check: every layout id must exist in the command registry.
 * Builders only capture ops in closures (never call them while constructing),
 * so an empty placeholder materializes the static id set. A broken layout now
 * fails at import (startup console error) instead of white-screening the window
 * from inside useMenus' render path on every render.
 */
function assertLayoutMatchesRegistry(): void {
  const known = new Set(buildCommands({} as CommandOps).map((c) => c.id))
  for (const id of layoutCommandIds(MENU_LAYOUT)) {
    if (!known.has(id)) throw new Error(`menu layout references unknown command "${id}"`)
  }
}
assertLayoutMatchesRegistry()

/** Expand the registry + layout into the MenuBar's menu definitions. */
export function buildMenus(
  commands: Command[],
  isMac: boolean,
  recentItems: RecentItem[] = [],
  ops?: Pick<CommandOps, 'openRecentFile' | 'clearRecentFiles'>
): MenuDef[] {
  const byId = new Map(commands.map((c) => [c.id, c]))
  return MENU_LAYOUT.map((layout) => ({
    id: layout.menu,
    label: t(ROOT_LABEL_KEY[layout.menu]),
    // FE-01#2: ui_04 `.menu-panel.is-wide` (292px) is the File panel — the long
    // 「重新打开已关标签」 row (reopenClosedTab, with its shortcut slot) must stay
    // single-line. No key-chord literals here: AC-RULE-11 echoes derive from
    // Command.shortcut via fmtShortcut only.
    wide: layout.menu === 'file',
    items: flattenGroups(layout.groups, byId, isMac, recentItems, ops)
  }))
}

/** Groups → flat items: title row + members, one separator between groups. */
function flattenGroups(
  groups: LayoutGroup[],
  byId: Map<string, Command>,
  isMac: boolean,
  recentItems: RecentItem[],
  ops?: Pick<CommandOps, 'openRecentFile' | 'clearRecentFiles'>
): MenuItem[] {
  const items: MenuItem[] = []
  groups.forEach((group, index) => {
    if (index > 0) items.push({ separator: true })
    if (group.labelKey) items.push({ groupTitle: t(group.labelKey) })
    items.push(...group.items.map((item) => resolveItem(item, byId, isMac, recentItems, ops)))
  })
  return items
}

function resolveItem(
  item: LayoutItem,
  byId: Map<string, Command>,
  isMac: boolean,
  recentItems: RecentItem[],
  ops?: Pick<CommandOps, 'openRecentFile' | 'clearRecentFiles'>
): MenuItem {
  if (typeof item === 'object' && 'recent' in item) {
    return {
      testId: 'menu-open-recent',
      label: t('menu.openRecent'),
      submenu: buildRecentSubmenu(recentItems, ops)
    }
  }
  if (typeof item === 'object' && 'export' in item) {
    return {
      testId: 'menu-export',
      label: t('menu.export'),
      submenu: EXPORT_SUBMENU_IDS.map((id) => commandItem(id, byId, isMac))
    }
  }
  if (typeof item === 'object' && 'format' in item) {
    return {
      testId: 'menu-format',
      label: t('menu.format'),
      submenu: FORMAT_SUBMENU_IDS.map((id) => commandItem(id, byId, isMac))
    }
  }
  return commandItem(item, byId, isMac)
}

function commandItem(id: string, byId: Map<string, Command>, isMac: boolean): MenuItem {
  const cmd = byId.get(id)
  // Backstop only: assertLayoutMatchesRegistry() already gated the real
  // registry at module load. Still guards custom registries (tests) — and a
  // skip-undefined would silently corrupt the id-set contract (AC-FN-09).
  if (!cmd) throw new Error(`menu layout references unknown command "${id}"`)
  return {
    id: cmd.id,
    label: t(cmd.label),
    shortcut: cmd.shortcut ? fmtShortcut(cmd.shortcut, isMac) : undefined,
    checked: cmd.checked?.(),
    disabled: cmd.isDisabled?.(),
    action: cmd.run
  }
}

/** Open Recent children: validated entries (missing paths greyed) + Clear Menu. */
function buildRecentSubmenu(
  recentItems: RecentItem[],
  ops?: Pick<CommandOps, 'openRecentFile' | 'clearRecentFiles'>
): MenuItem[] {
  if (recentItems.length === 0) {
    return [{ testId: 'menu-no-recent', label: t('menu.noRecent'), disabled: true }]
  }
  const items: MenuItem[] = recentItems.map((item) => ({
    testId: 'menu-recent-entry',
    label: item.name,
    title: item.path,
    disabled: !item.exists,
    action: () => void ops?.openRecentFile(item.path)
  }))
  items.push({ separator: true })
  items.push({
    testId: 'menu-clear-recent',
    label: t('menu.clearMenu'),
    action: () => ops?.clearRecentFiles()
  })
  return items
}
