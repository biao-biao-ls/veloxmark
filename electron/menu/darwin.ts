import { app, Menu } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { GetWindow } from '../ipc/getWindow'
import { zoomBy } from '../ipc/window'
import { menuChannel, type RecentFileItem } from '../shared/api'
import { DARWIN_COMMAND_ACCELERATORS } from '../shared/commandAccelerators'
import { NATIVE_MENU_STRINGS } from '../shared/menuStrings'


let getWindow: GetWindow = () => null

function sendMenu(channel: string): void {
  getWindow()?.webContents.send(channel)
}

let recentFiles: RecentFileItem[] = []

export function setRecentFiles(files: RecentFileItem[]): void {
  recentFiles = Array.isArray(files) ? files : []
  rebuildDarwinMenu()
}

let nativeCheckedIds = new Set<string>()

export function setMenuCheckedIds(ids: string[]): void {
  nativeCheckedIds = new Set(Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [])
  rebuildDarwinMenu()
}

type UiLang = 'zh' | 'en'

function uiLanguagePath(): string {
  return join(app.getPath('userData'), 'ui-language.json')
}

function readStoredUiLang(): UiLang | null {
  try {
    const raw = JSON.parse(readFileSync(uiLanguagePath(), 'utf8')) as { lang?: unknown }
    return raw.lang === 'zh' || raw.lang === 'en' ? raw.lang : null
  } catch {
    return null
  }
}

let uiLang: UiLang = 'en'

function initUiLang(): void {
  const stored = readStoredUiLang()
  if (stored) {
    uiLang = stored
  } else {
    uiLang = app.getLocale().toLowerCase().startsWith('zh') ? 'zh' : 'en'
  }
}

export function setUiLanguage(lang: UiLang): void {
  uiLang = lang
  try {
    writeFileSync(uiLanguagePath(), JSON.stringify({ lang: uiLang }), 'utf8')
  } catch (err) {
    console.error('[veloxmark] failed to persist ui language', err)
  }
  rebuildDarwinMenu()
}

function rebuildDarwinMenu(): void {
  if (process.platform === 'darwin') Menu.setApplicationMenu(buildDarwinMenu())
}

function recentFilesSubmenu(S: Record<string, string>): Electron.MenuItemConstructorOptions[] {
  if (recentFiles.length === 0) {
    return [{ label: S.noRecent, enabled: false }]
  }
  const items: Electron.MenuItemConstructorOptions[] = recentFiles.map((item) => ({
    label: basename(item.path),
    toolTip: item.path,
    enabled: item.exists,
    click: () => getWindow()?.webContents.send(menuChannel('openRecent'), item.path)
  }))
  items.push(
    { type: 'separator' },
    {
      label: S.clearMenu,
      click: () => getWindow()?.webContents.send(menuChannel('clearRecent'))
    }
  )
  return items
}

function commandItem(id: string, label: string): Electron.MenuItemConstructorOptions {
  const checkbox = NATIVE_CHECKBOX_COMMANDS.has(id)
  return {
    label,
    accelerator: DARWIN_COMMAND_ACCELERATORS[id],
    type: checkbox ? 'checkbox' : undefined,
    checked: checkbox ? nativeCheckedIds.has(id) : undefined,
    click: () => sendMenu(menuChannel(id))
  }
}

function groupHeader(label: string): Electron.MenuItemConstructorOptions {
  return { label, enabled: false }
}

const NATIVE_CHECKBOX_COMMANDS = new Set([
  'toggleFocusMode',
  'toggleTypewriterMode',
  'toggleSourceMode',
  'toggleTypingAssists',
  'toggleWrapBareUrlOnPaste',
  'togglePasteHtmlToMd'
])


type MenuStrings = Record<string, string>

function appMenu(S: MenuStrings): Electron.MenuItemConstructorOptions {
  return {
    label: S.app,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services', label: S.services },
      { type: 'separator' },
      { role: 'hide', label: S.hide },
      { role: 'hideOthers', label: S.hideOthers },
      { role: 'unhide', label: S.unhide },
      { type: 'separator' },
      commandItem('openPreferences', S.preferences),
      { type: 'separator' },
      { role: 'quit', label: S.quit }
    ]
  }
}

function fileMenu(S: MenuStrings): Electron.MenuItemConstructorOptions {
  return {
    label: S.file,
    submenu: [
      groupHeader(S['menu.grp.newOpen']),
      commandItem('newFile', S.newFile),
      commandItem('openFile', S.openFile),
      commandItem('openFolder', S.openFolder),
      commandItem('quickOpen', S.quickOpen),
      { label: S.openRecent, submenu: recentFilesSubmenu(S) },
      { type: 'separator' },
      groupHeader(S['menu.grp.save']),
      commandItem('saveFile', S.save),
      commandItem('saveFileAs', S.saveAs),
      { type: 'separator' },
      groupHeader(S['menu.grp.tabs']),
      commandItem('closeTab', S.closeTab),
      commandItem('reopenClosedTab', S.reopenClosedTab),
      commandItem('nextTab', S.nextTab),
      { type: 'separator' },
      groupHeader(S['menu.grp.export']),
      {
        label: S.export,
        submenu: [commandItem('exportPdf', S.pdf), commandItem('exportHtml', S.html)]
      },
      { type: 'separator' },
      groupHeader(S['menu.grp.settings']),
      commandItem('openPreferences', S.preferences),
      { type: 'separator' },
      { role: 'close', label: S.close }
    ]
  }
}

function editMenu(S: MenuStrings): Electron.MenuItemConstructorOptions {
  return {
    label: S.edit,
    submenu: [
      groupHeader(S['menu.grp.clipboard']),
      { role: 'cut', label: S.cut },
      { role: 'copy', label: S.copy },
      { role: 'paste', label: S.paste },
      { role: 'pasteAndMatchStyle', label: S.pasteMatch },
      commandItem('copyRichText', S.copyRichText),
      commandItem('copyAsHtml', S.copyAsHtml),
      { role: 'delete', label: S.del },
      { role: 'selectAll', label: S.selectAll },
      { type: 'separator' },
      groupHeader(S['menu.grp.findOrganize']),
      commandItem('formatDocument', S.formatDocument),
      { type: 'separator' },
      groupHeader(S['menu.grp.format']),
      {
        label: S.format,
        submenu: [
          commandItem('bold', S.bold),
          commandItem('italic', S.italic),
          commandItem('inlineCode', S.inlineCode),
          commandItem('strikethrough', S.strikethrough),
          commandItem('highlight', S.highlight)
        ]
      },
      { type: 'separator' },
      groupHeader(S['menu.grp.selectionExport']),
      commandItem('exportSelectionHtml', S.exportSelectionHtml)
    ]
  }
}

function viewMenu(S: MenuStrings): Electron.MenuItemConstructorOptions {
  return {
    label: S.view,
    submenu: [
      groupHeader(S['menu.grp.sidebarSearch']),
      commandItem('toggleSidebar', S.toggleSidebar),
      commandItem('globalSearch', S.globalSearch),
      { type: 'separator' },
      groupHeader(S['menu.grp.mode']),
      commandItem('toggleFocusMode', S.focusMode),
      commandItem('toggleTypewriterMode', S.typewriterMode),
      commandItem('toggleSourceMode', S.sourceMode),
      { type: 'separator' },
      groupHeader(S['menu.grp.inputAssist']),
      commandItem('toggleTypingAssists', S.typingAssists),
      commandItem('toggleWrapBareUrlOnPaste', S.wrapBareUrls),
      commandItem('togglePasteHtmlToMd', S.pasteHtmlMd),
      { type: 'separator' },
      groupHeader(S['menu.grp.zoom']),
      {
        label: S.zoomIn,
        accelerator: DARWIN_COMMAND_ACCELERATORS.zoomIn,
        click: () => zoomBy(getWindow, 0.5)
      },
      {
        label: S.zoomOut,
        accelerator: DARWIN_COMMAND_ACCELERATORS.zoomOut,
        click: () => zoomBy(getWindow, -0.5)
      },
      {
        label: S.zoomReset,
        accelerator: DARWIN_COMMAND_ACCELERATORS.zoomReset,
        click: () => zoomBy(getWindow, 'reset')
      },
      { type: 'separator' },
      groupHeader(S['menu.grp.devTheme']),
      {
        label: S.devTools,
        accelerator: DARWIN_COMMAND_ACCELERATORS.toggleDevTools,
        click: () => getWindow()?.webContents.toggleDevTools()
      },
      commandItem('toggleTheme', S.toggleTheme)
    ]
  }
}

function insertMenu(S: MenuStrings): Electron.MenuItemConstructorOptions {
  return {
    label: S.insert,
    submenu: [
      groupHeader(S['menu.grp.table']),
      commandItem('insertTable', S.insertTable),
      commandItem('convertToTable', S.convertToTable),
      { type: 'separator' },
      groupHeader(S['menu.grp.chartContainer']),
      commandItem('insertMermaidDiagram', S.insertMermaidDiagram),
      commandItem('insertCallout', S.insertCallout)
    ]
  }
}

function windowMenu(S: MenuStrings): Electron.MenuItemConstructorOptions {
  return {
    label: S.window,
    submenu: [
      { role: 'minimize', label: S.minimize },
      { role: 'zoom', label: S.zoom },
      { type: 'separator' },
      { role: 'togglefullscreen', label: S.fullscreen },
      { type: 'separator' },
      { role: 'front', label: S.front }
    ]
  }
}

function helpMenu(S: MenuStrings): Electron.MenuItemConstructorOptions {
  return {
    label: S.help,
    submenu: [commandItem('showHelp', S.showHelp), { type: 'separator' }, commandItem('checkForUpdates', S.checkForUpdates)]
  }
}

function buildDarwinMenu(): Menu {
  const S = NATIVE_MENU_STRINGS[uiLang]
  return Menu.buildFromTemplate([
    appMenu(S),
    fileMenu(S),
    editMenu(S),
    viewMenu(S),
    insertMenu(S),
    windowMenu(S),
    helpMenu(S)
  ])
}

export function initDarwinMenu(getWindowFn: GetWindow): void {
  getWindow = getWindowFn
  initUiLang()
}

export function installApplicationMenu(): void {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(buildDarwinMenu())
  } else {
    Menu.setApplicationMenu(null)
  }
}
