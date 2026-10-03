import { app, Menu } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { GetWindow } from '../ipc/getWindow'
import { zoomBy } from '../ipc/window'
import { menuChannel, type RecentFileItem } from '../shared/api'
import { DARWIN_COMMAND_ACCELERATORS } from '../shared/commandAccelerators'
import { NATIVE_MENU_STRINGS } from '../shared/menuStrings'

/**
 * macOS native menu bar (2.18, moved from main.ts).
 *
 * Windows/Linux keep Menu.setApplicationMenu(null) — the renderer titlebar owns
 * all menus there. macOS is different: the menu bar is platform chrome, and a
 * null menu strips the system shortcuts (Cmd+Q/H/W/M, Edit roles like copy and
 * paste in plain <input>s). App-specific items forward to the channels the
 * renderer already listens on (see preload `onMenu`).
 *
 * App-command accelerators live in ../shared/commandAccelerators.ts (pure data;
 * dual-source guard: src/renderer/src/commands/shortcutSync.test.ts). Labels
 * and handlers stay in the renderer's command registry; every click forwards as
 * `menu:<id>` so the renderer dispatches through the same registry.
 *
 * Menu-owned state (recent files, checkbox set, ui language) lives here too —
 * main.ts injects window access via initDarwinMenu(getWindow).
 */

let getWindow: GetWindow = () => null

function sendMenu(channel: string): void {
  getWindow()?.webContents.send(channel)
}

// P03: recent files, pushed from the renderer (which owns the store) whenever
// the list changes so the native File > Open Recent submenu stays in sync.
let recentFiles: RecentFileItem[] = []

export function setRecentFiles(files: RecentFileItem[]): void {
  recentFiles = Array.isArray(files) ? files : []
  rebuildDarwinMenu()
}

/** Toggle ids currently ON, pushed by the renderer (app:setMenuCheckedIds). */
let nativeCheckedIds = new Set<string>()

export function setMenuCheckedIds(ids: string[]): void {
  nativeCheckedIds = new Set(Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [])
  rebuildDarwinMenu()
}

// ---- P14: native-menu language ----------------------------------------------
// The renderer resolves the language pref (system → zh/en) and pushes it here;
// we persist to userData so the menu built at startup (before the renderer is
// ready) already matches. Fallback chain: stored file → app locale → en.
// Labels: NATIVE_MENU_STRINGS moved to ../shared/menuStrings.ts (3.17, pure
// data; alignment guard: src/renderer/src/i18n/i18n.test.ts).
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
    // Missing paths stay listed but greyed out (parity with the in-app menu).
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
  // Preference-backed toggles render as checkboxes; renderer keeps the set live.
  const checkbox = NATIVE_CHECKBOX_COMMANDS.has(id)
  return {
    label,
    accelerator: DARWIN_COMMAND_ACCELERATORS[id],
    type: checkbox ? 'checkbox' : undefined,
    checked: checkbox ? nativeCheckedIds.has(id) : undefined,
    click: () => sendMenu(menuChannel(id))
  }
}

/**
 * menu-tree §3 semantic group label (BE-02, menu:native-parity). Native menus
 * have no header role, so a group name renders as a non-selectable disabled
 * row above its items — presentational only, never a command id.
 */
function groupHeader(label: string): Electron.MenuItemConstructorOptions {
  return { label, enabled: false }
}

/** Commands whose native-menu entry shows checkbox state (View menu toggles). */
const NATIVE_CHECKBOX_COMMANDS = new Set([
  'toggleFocusMode',
  'toggleTypewriterMode',
  'toggleSourceMode',
  'toggleTypingAssists',
  'toggleWrapBareUrlOnPaste',
  'togglePasteHtmlToMd'
])

// ---- menu-tree §3 grouping (BE-02, menu:native-parity) -----------------------
// Each top-level menu is grouped like menu-tree §3 (group label + within-group
// order are presentation only). Command id set and `menu:<id>` forwarding are
// frozen — regroup must not add or drop command items (AC-FN-09). Registered
// native-only differences (menu-tree 附录 A): App menu + Window menu are
// macOS system menus; File keeps the `close` role; Edit keeps paste-match /
// delete native roles and omits undo/redo (CM6 keymap owns history); View's
// fold group has no native items (foldAll/unfoldAll are not part of the frozen
// native id set).

type MenuStrings = Record<string, string>

/** App menu (macOS-only system menu, menu-tree 附录 A). */
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

/** File menu — 新建与打开 / 保存 / 标签页 / 导出 / 设置 (+ macOS close role). */
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
      // P26 tab commands. No accelerator entries: Cmd/Ctrl+W is routed by
      // the before-input handler in main.ts (tab-aware), Cmd/Ctrl+Tab and
      // Cmd+Shift+T are bound in the renderer command registry.
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
      // Same command id as the App-menu entry (menu-tree §3.1 设置 group;
      // id set unchanged — `openPreferences` was already in the native menu).
      commandItem('openPreferences', S.preferences),
      { type: 'separator' },
      { role: 'close', label: S.close }
    ]
  }
}

/**
 * Edit menu — 剪贴板 / 查找与整理 / 格式 / 选区导出.
 * menu-tree §3.2's 历史 group (undo/redo) is intentionally absent: a native
 * accelerator would intercept Cmd+Z/Y before CodeMirror, and native undo
 * fights CM6's transaction history (registered native difference).
 */
function editMenu(S: MenuStrings): Electron.MenuItemConstructorOptions {
  return {
    label: S.edit,
    submenu: [
      groupHeader(S['menu.grp.clipboard']),
      { role: 'cut', label: S.cut },
      { role: 'copy', label: S.copy },
      { role: 'paste', label: S.paste },
      { role: 'pasteAndMatchStyle', label: S.pasteMatch },
      // P20 — rendered by the same command registry as the in-app menu.
      commandItem('copyRichText', S.copyRichText),
      commandItem('copyAsHtml', S.copyAsHtml),
      { role: 'delete', label: S.del },
      { role: 'selectAll', label: S.selectAll },
      { type: 'separator' },
      groupHeader(S['menu.grp.findOrganize']),
      commandItem('formatDocument', S.formatDocument),
      { type: 'separator' },
      groupHeader(S['menu.grp.format']),
      // P27/UX-P01: Format submenu — same command ids as the in-app Edit ▶
      // Format menu and the CM6 keymap. No native accelerators on purpose:
      // Mod-B/I/E belong to the editor keymap (see DARWIN_COMMAND_ACCELERATORS).
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

/**
 * View menu — 侧栏与搜索 / 模式 / 输入辅助 / 缩放 / 开发与主题.
 * menu-tree §3.3's 折叠 group (foldAll/unfoldAll) has no native items: those
 * ids are not part of the frozen native menu id set (registered difference).
 */
function viewMenu(S: MenuStrings): Electron.MenuItemConstructorOptions {
  return {
    label: S.view,
    submenu: [
      groupHeader(S['menu.grp.sidebarSearch']),
      commandItem('toggleOutline', S.toggleOutline),
      commandItem('globalSearch', S.globalSearch),
      { type: 'separator' },
      groupHeader(S['menu.grp.mode']),
      commandItem('toggleFocusMode', S.focusMode),
      commandItem('toggleTypewriterMode', S.typewriterMode),
      commandItem('toggleSourceMode', S.sourceMode),
      { type: 'separator' },
      // UX-P01-F8: typing-assist toggles — same registry as the in-app menu.
      groupHeader(S['menu.grp.inputAssist']),
      commandItem('toggleTypingAssists', S.typingAssists),
      commandItem('toggleWrapBareUrlOnPaste', S.wrapBareUrls),
      commandItem('togglePasteHtmlToMd', S.pasteHtmlMd),
      { type: 'separator' },
      // Zoom/devtools run in main directly — no renderer round-trip. Their
      // accelerators derive from DARWIN_COMMAND_ACCELERATORS (accel:single-source);
      // a missing map entry simply shows no chord.
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

/**
 * Insert menu — 表格 / 图表与容器 (menu:insert-dedupe: insertTable and
 * convertToTable live here only; the Edit-menu copies are gone).
 */
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

/** Window menu (macOS-only system menu, menu-tree 附录 A). */
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

/** Help menu — single item (menu-tree §3.5: 不过度设计, no group header). */
function helpMenu(S: MenuStrings): Electron.MenuItemConstructorOptions {
  return {
    label: S.help,
    submenu: [commandItem('showHelp', S.showHelp)]
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

/** Wire window access + resolve the startup language (call once at whenReady). */
export function initDarwinMenu(getWindowFn: GetWindow): void {
  getWindow = getWindowFn
  initUiLang()
}

/** Startup menu install: darwin gets the native menu, others get null. */
export function installApplicationMenu(): void {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(buildDarwinMenu())
  } else {
    Menu.setApplicationMenu(null)
  }
}
