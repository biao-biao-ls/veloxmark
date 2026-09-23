/**
 * Menu-bar layout + assembly（2B 自 commands.ts 平移）。
 */
import type { MenuDef, MenuItem } from '../components/MenuBar'
import { t } from '../i18n'
import { fmtShortcut } from './shortcutDisplay'
import type { Command, CommandOps, RecentItem } from './types'

// ---- menu layout -----------------------------------------------------------

type LayoutItem =
  | string
  | { separator: true }
  | { recent: true }
  | { export: true }
  | { format: true }

const MENU_LAYOUT: { label: string; items: LayoutItem[] }[] = [
  {
    label: 'menu.file',
    items: [
      'newFile',
      'openFile',
      'openFolder',
      'quickOpen',
      { recent: true },
      { separator: true },
      'saveFile',
      'saveFileAs',
      { separator: true },
      'closeTab',
      'reopenClosedTab',
      'nextTab',
      { separator: true },
      { export: true },
      { separator: true },
      'openPreferences'
    ]
  },
  {
    label: 'menu.edit',
    items: [
      'undo',
      'redo',
      { separator: true },
      'cut',
      'copy',
      'paste',
      'copyRichText',
      'copyAsHtml',
      'selectAll',
      { separator: true },
      'find',
      'formatDocument',
      { separator: true },
      { format: true },
      { separator: true },
      'exportSelectionHtml',
      { separator: true },
      'insertTable',
      'convertToTable'
    ]
  },
  {
    label: 'menu.view',
    items: [
      'toggleOutline',
      { separator: true },
      'foldAll',
      'unfoldAll',
      { separator: true },
      'globalSearch',
      { separator: true },
      'toggleFocusMode',
      'toggleTypewriterMode',
      'toggleSourceMode',
      { separator: true },
      'toggleTypingAssists',
      'toggleWrapBareUrlOnPaste',
      'togglePasteHtmlToMd',
      { separator: true },
      'zoomIn',
      'zoomOut',
      'zoomReset',
      { separator: true },
      'toggleDevTools',
      { separator: true },
      'toggleTheme'
    ]
  },
  { label: 'menu.insert', items: ['insertMermaidDiagram', 'insertCallout', 'insertTable'] },
  { label: 'menu.help', items: ['showHelp'] }
]

/** Expand the registry + layout into the MenuBar's menu definitions. */
export function buildMenus(
  commands: Command[],
  isMac: boolean,
  recentItems: RecentItem[] = [],
  ops?: Pick<CommandOps, 'openRecentFile' | 'clearRecentFiles'>
): MenuDef[] {
  const byId = new Map(commands.map((c) => [c.id, c]))
  return MENU_LAYOUT.map((menu) => ({
    label: t(menu.label),
    items: menu.items.map((item): MenuItem => {
      if (typeof item === 'object' && 'separator' in item) return { separator: true }
      if (typeof item === 'object' && 'recent' in item) {
        return { label: t('menu.openRecent'), submenu: buildRecentSubmenu(recentItems, ops) }
      }
      if (typeof item === 'object' && 'export' in item) {
        return {
          label: t('menu.export'),
          submenu: ['exportPdf', 'exportHtml'].map((id) => {
            const cmd = byId.get(id)
            if (!cmd) throw new Error(`export submenu references unknown command "${id}"`)
            return { label: t(cmd.label), action: cmd.run }
          })
        }
      }
      if (typeof item === 'object' && 'format' in item) {
        return {
          label: t('menu.format'),
          submenu: [
            'bold',
            'italic',
            'inlineCode',
            'strikethrough',
            'highlight'
          ].map((id) => {
            const cmd = byId.get(id)
            if (!cmd) throw new Error(`format submenu references unknown command "${id}"`)
            return {
              label: t(cmd.label),
              shortcut: cmd.shortcut ? fmtShortcut(cmd.shortcut, isMac) : undefined,
              action: cmd.run
            }
          })
        }
      }
      const cmd = byId.get(item)
      if (!cmd) throw new Error(`menu layout references unknown command "${item}"`)
      return {
        label: t(cmd.label),
        shortcut: cmd.shortcut ? fmtShortcut(cmd.shortcut, isMac) : undefined,
        checked: cmd.checked?.(),
        disabled: cmd.isDisabled?.(),
        action: cmd.run
      }
    })
  }))
}

/** Open Recent children: validated entries (missing paths greyed) + Clear Menu. */
function buildRecentSubmenu(
  recentItems: RecentItem[],
  ops?: Pick<CommandOps, 'openRecentFile' | 'clearRecentFiles'>
): MenuItem[] {
  if (recentItems.length === 0) return [{ label: t('menu.noRecent'), disabled: true }]
  const items: MenuItem[] = recentItems.map((item) => ({
    label: item.name,
    title: item.path,
    disabled: !item.exists,
    action: () => void ops?.openRecentFile(item.path)
  }))
  items.push({ separator: true })
  items.push({ label: t('menu.clearMenu'), action: () => ops?.clearRecentFiles() })
  return items
}
