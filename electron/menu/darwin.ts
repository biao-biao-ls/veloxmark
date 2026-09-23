import { app, Menu } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { GetWindow } from '../ipc/getWindow'
import { zoomBy } from '../ipc/window'
import { menuChannel, type RecentFileItem } from '../shared/api'
import { DARWIN_COMMAND_ACCELERATORS } from '../shared/commandAccelerators'

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
type UiLang = 'zh' | 'en'
const NATIVE_MENU_STRINGS: Record<UiLang, Record<string, string>> = {
  en: {
    app: 'VeloxMark', services: 'Services', hide: 'Hide VeloxMark', hideOthers: 'Hide Others',
    unhide: 'Show All', quit: 'Quit VeloxMark', preferences: 'Preferences…',
    file: 'File', newFile: 'New', openFile: 'Open…', openFolder: 'Open Folder…',
    quickOpen: 'Quick Open…', openRecent: 'Open Recent', noRecent: 'No Recent Files',
    clearMenu: 'Clear Menu', save: 'Save', saveAs: 'Save As…', export: 'Export',
    pdf: 'PDF…', html: 'HTML…', close: 'Close', closeTab: 'Close Tab', reopenClosedTab: 'Reopen Closed Tab', nextTab: 'Next Tab',
    edit: 'Edit', cut: 'Cut', copy: 'Copy', paste: 'Paste', pasteMatch: 'Paste and Match Style',
    del: 'Delete', selectAll: 'Select All',
    copyRichText: 'Copy as Rich Text', copyAsHtml: 'Copy as HTML',
    exportSelectionHtml: 'Export Selection as HTML…',
    insertTable: 'Insert Table…', convertToTable: 'Convert Selection to Table…',
    formatDocument: 'Format Document',
    format: 'Format', bold: 'Bold', italic: 'Italic', inlineCode: 'Inline Code',
    strikethrough: 'Strikethrough', highlight: 'Highlight',
    view: 'View', toggleOutline: 'Toggle Outline', globalSearch: 'Search in Folder…',
    focusMode: 'Focus Mode', typewriterMode: 'Typewriter Mode', sourceMode: 'Source Mode',
    typingAssists: 'Typing Assists', wrapBareUrls: 'Wrap Bare URLs on Paste',
    pasteHtmlMd: 'Convert HTML on Paste',
    zoomIn: 'Zoom In', zoomOut: 'Zoom Out', zoomReset: 'Reset Zoom',
    devTools: 'Toggle Developer Tools', toggleTheme: 'Toggle Theme',
    insert: 'Insert', insertMermaidDiagram: 'Mermaid Diagram…',
    insertCallout: 'Insert Callout…',
    window: 'Window', minimize: 'Minimize', zoom: 'Zoom', fullscreen: 'Enter Full Screen',
    front: 'Bring All to Front',
    help: 'Help', showHelp: 'Markdown Syntax Reference'
  },
  zh: {
    app: 'VeloxMark', services: '服务', hide: '隐藏 VeloxMark', hideOthers: '隐藏其他',
    unhide: '全部显示', quit: '退出 VeloxMark', preferences: '偏好设置…',
    file: '文件', newFile: '新建', openFile: '打开…', openFolder: '打开文件夹…',
    quickOpen: '快速打开…', openRecent: '打开最近', noRecent: '暂无最近文件',
    clearMenu: '清空列表', save: '保存', saveAs: '另存为…', export: '导出',
    pdf: 'PDF…', html: 'HTML…', close: '关闭', closeTab: '关闭标签', reopenClosedTab: '重新打开已关标签', nextTab: '下一个标签',
    edit: '编辑', cut: '剪切', copy: '复制', paste: '粘贴', pasteMatch: '粘贴并匹配样式',
    del: '删除', selectAll: '全选',
    copyRichText: '复制为富文本', copyAsHtml: '复制为 HTML',
    exportSelectionHtml: '导出选区为 HTML…',
    insertTable: '插入表格…', convertToTable: '选区转表格…',
    formatDocument: '格式化文档',
    format: '格式', bold: '加粗', italic: '斜体', inlineCode: '行内代码',
    strikethrough: '删除线', highlight: '高亮',
    view: '视图', toggleOutline: '切换大纲', globalSearch: '文件夹内搜索…',
    focusMode: '专注模式', typewriterMode: '打字机模式', sourceMode: '源码模式',
    typingAssists: '输入辅助', wrapBareUrls: '粘贴时包裹裸链接',
    pasteHtmlMd: '粘贴 HTML 转 Markdown',
    zoomIn: '放大', zoomOut: '缩小', zoomReset: '重置缩放',
    devTools: '开发者工具', toggleTheme: '切换主题',
    insert: '插入', insertMermaidDiagram: 'Mermaid 图表…',
    insertCallout: '插入 Callout…',
    window: '窗口', minimize: '最小化', zoom: '缩放', fullscreen: '进入全屏幕',
    front: '前置所有窗口',
    help: '帮助', showHelp: 'Markdown 语法参考'
  }
}

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

/** Commands whose native-menu entry shows checkbox state (View menu toggles). */
const NATIVE_CHECKBOX_COMMANDS = new Set([
  'toggleFocusMode',
  'toggleTypewriterMode',
  'toggleSourceMode',
  'toggleTypingAssists',
  'toggleWrapBareUrlOnPaste',
  'togglePasteHtmlToMd'
])

function buildDarwinMenu(): Menu {
  const S = NATIVE_MENU_STRINGS[uiLang]
  return Menu.buildFromTemplate([
    {
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
    },
    {
      label: S.file,
      submenu: [
        commandItem('newFile', S.newFile),
        commandItem('openFile', S.openFile),
        commandItem('openFolder', S.openFolder),
        commandItem('quickOpen', S.quickOpen),
        { label: S.openRecent, submenu: recentFilesSubmenu(S) },
        { type: 'separator' },
        commandItem('saveFile', S.save),
        commandItem('saveFileAs', S.saveAs),
        { type: 'separator' },
        // P26 tab commands. No accelerator entries: Cmd/Ctrl+W is routed by
        // the before-input handler in main.ts (tab-aware), Cmd/Ctrl+Tab and
        // Cmd+Shift+T are bound in the renderer command registry.
        commandItem('closeTab', S.closeTab),
        commandItem('reopenClosedTab', S.reopenClosedTab),
        commandItem('nextTab', S.nextTab),
        { type: 'separator' },
        {
          label: S.export,
          submenu: [commandItem('exportPdf', S.pdf), commandItem('exportHtml', S.html)]
        },
        { type: 'separator' },
        { role: 'close', label: S.close }
      ]
    },
    {
      label: S.edit,
      submenu: [
        // No undo/redo roles on purpose: a menu accelerator would intercept
        // Cmd+Z/Y before CodeMirror sees them, and native undo fights CM6's
        // transaction history. CM6's own keymap handles them in the editor.
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
        commandItem('exportSelectionHtml', S.exportSelectionHtml),
        { type: 'separator' },
        commandItem('insertTable', S.insertTable),
        commandItem('convertToTable', S.convertToTable),
        { type: 'separator' },
        commandItem('formatDocument', S.formatDocument),
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
        }
      ]
    },
    {
      label: S.view,
      submenu: [
        commandItem('toggleOutline', S.toggleOutline),
        { type: 'separator' },
        commandItem('globalSearch', S.globalSearch),
        { type: 'separator' },
        commandItem('toggleFocusMode', S.focusMode),
        commandItem('toggleTypewriterMode', S.typewriterMode),
        commandItem('toggleSourceMode', S.sourceMode),
        { type: 'separator' },
        // UX-P01-F8: typing-assist toggles — same registry as the in-app menu.
        commandItem('toggleTypingAssists', S.typingAssists),
        commandItem('toggleWrapBareUrlOnPaste', S.wrapBareUrls),
        commandItem('togglePasteHtmlToMd', S.pasteHtmlMd),
        { type: 'separator' },
        // Zoom/devtools run in main directly — no renderer round-trip.
        { label: S.zoomIn, accelerator: 'Cmd+Plus', click: () => zoomBy(getWindow, 0.5) },
        { label: S.zoomOut, accelerator: 'Cmd+-', click: () => zoomBy(getWindow, -0.5) },
        { label: S.zoomReset, accelerator: 'Cmd+0', click: () => zoomBy(getWindow, 'reset') },
        { type: 'separator' },
        {
          label: S.devTools,
          accelerator: 'Alt+Cmd+I',
          click: () => getWindow()?.webContents.toggleDevTools()
        },
        { type: 'separator' },
        commandItem('toggleTheme', S.toggleTheme)
      ]
    },
    {
      label: S.insert,
      submenu: [
        commandItem('insertMermaidDiagram', S.insertMermaidDiagram),
        commandItem('insertCallout', S.insertCallout),
        commandItem('insertTable', S.insertTable)
      ]
    },
    {
      label: S.window,
      submenu: [
        { role: 'minimize', label: S.minimize },
        { role: 'zoom', label: S.zoom },
        { type: 'separator' },
        { role: 'togglefullscreen', label: S.fullscreen },
        { type: 'separator' },
        { role: 'front', label: S.front }
      ]
    },
    {
      label: S.help,
      submenu: [commandItem('showHelp', S.showHelp)]
    }
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
