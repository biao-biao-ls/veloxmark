import type { MenuDef, MenuItem } from '../components/MenuBar'
import { t } from '../i18n'
import { buildCommands } from './build'
import { fmtShortcut } from './shortcutDisplay'
import type { Command, CommandOps, RecentItem } from './types'


export type LayoutItem =
  | string
  | { recent: true }
  | { export: true }
  | { format: true }

export interface LayoutGroup {
  labelKey?: string
  items: LayoutItem[]
}

export interface LayoutMenu {
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
      { labelKey: 'menu.grp.sidebarSearch', items: ['toggleSidebar', 'globalSearch'] },
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
    menu: 'insert',
    groups: [
      { labelKey: 'menu.grp.table', items: ['insertTable', 'convertToTable'] },
      { labelKey: 'menu.grp.chartContainer', items: ['insertMermaidDiagram', 'insertCallout'] }
    ]
  },
  { menu: 'help', groups: [{ items: ['showHelp'] }] }
]


const EXPORT_SUBMENU_IDS = ['exportPdf', 'exportHtml'] as const
const FORMAT_SUBMENU_IDS = ['bold', 'italic', 'inlineCode', 'strikethrough', 'highlight'] as const

function layoutCommandIds(layout: readonly LayoutMenu[]): string[] {
  const ids: string[] = []
  for (const menu of layout) {
    for (const group of menu.groups) {
      for (const item of group.items) {
        if (typeof item === 'string') ids.push(item)
        else if ('export' in item) ids.push(...EXPORT_SUBMENU_IDS)
        else if ('format' in item) ids.push(...FORMAT_SUBMENU_IDS)
      }
    }
  }
  return ids
}

function assertLayoutMatchesRegistry(): void {
  const known = new Set(buildCommands({} as CommandOps).map((c) => c.id))
  for (const id of layoutCommandIds(MENU_LAYOUT)) {
    if (!known.has(id)) throw new Error(`menu layout references unknown command "${id}"`)
  }
}
assertLayoutMatchesRegistry()

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
    wide: layout.menu === 'file',
    items: flattenGroups(layout.groups, byId, isMac, recentItems, ops)
  }))
}

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
