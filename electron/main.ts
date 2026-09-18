import { app, BrowserWindow, ipcMain, Menu, net, protocol, shell } from 'electron'

// NOTE: window uses frameless mode; all menus live in the renderer titlebar.
// Exception: macOS keeps the native menu bar (see buildDarwinMenu) and native
// traffic lights via titleBarStyle: 'hiddenInset'.
import { readFileSync, writeFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerAllIpc } from './ipc'
import { stopFolderWatcher } from './ipc/folder'
import { zoomBy } from './ipc/window'
import { attachWindowStatePersistence, loadWindowState } from './ipc/window-state'
import type { RecentFileItem } from './shared/api'

// In dev the process lives inside Electron.app's bundle, so macOS would show
// "Electron" in the menu bar; packaged builds get the name from CFBundleName.
// Must run before ready so the About panel and app menu pick it up.
if (process.platform === 'darwin') {
  app.setName('VeloxMark')
  app.setAboutPanelOptions({
    applicationName: 'VeloxMark',
    applicationVersion: app.getVersion(),
    copyright: 'Copyright © 2026 VeloxMark contributors',
    // Packaged apps already embed the icns; dev needs an explicit path.
    // build/logo.png is the Apple-grid master; icon.png stays full-bleed for Windows.
    ...(app.isPackaged ? {} : { iconPath: join(__dirname, '../../build/logo.png') })
  })
}

// macOS "open with" / double-clicking a .md in Finder while the app is running.
// Events can arrive before the renderer is up, so queue until it signals ready.
// A path may point at a directory (Finder "Open" on a folder) — deliver those
// on a separate channel so the renderer opens them as a folder workspace.
const queuedOpens: { path: string; isDir: boolean }[] = []
let rendererLoaded = false

let mainWindow: BrowserWindow | null = null
const getWindow = (): BrowserWindow | null => mainWindow

// P12: true only for the close retry that follows an approved queryClose.
let closeApproved = false

async function deliverOpenPath(filePath: string): Promise<void> {
  let isDir = false
  try {
    isDir = (await stat(filePath)).isDirectory()
  } catch {
    // unreadable path — still attempt to open it as a file
  }
  const channel = isDir ? 'app:openFolder' : 'app:openPath'
  if (rendererLoaded && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, filePath)
  } else {
    queuedOpens.push({ path: filePath, isDir })
  }
}

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  void deliverOpenPath(filePath)
})

// Custom protocol so relative images inside a .md file can be displayed even
// when the renderer origin is http://localhost (dev) or file:// (prod).
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mdres',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

function createWindow(): void {
  // P03: restore the last geometry (validated against current displays).
  const geometry = loadWindowState()
  mainWindow = new BrowserWindow({
    width: geometry.width,
    height: geometry.height,
    ...(geometry.x != null && geometry.y != null ? { x: geometry.x, y: geometry.y } : {}),
    minWidth: 640,
    minHeight: 400,
    show: false,
    // Windows/Linux: frameless + custom titlebar. macOS: hidden titlebar but
    // keep the native traffic lights (min/max/close interop, Option-click,
    // hover glyphs, green = fullscreen) with them inset into our titlebar.
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 14, y: 14 }
        }
      : { frame: false }),
    backgroundColor: '#ffffff',
    // Dev/preview: load from build/. Packaged apps get the icon embedded by
    // electron-builder (build/icon.ico / build/icon.png are its defaults).
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (geometry.maximized) mainWindow?.maximize()
    mainWindow?.show()
  })
  // Crash diagnostics (e2e + field): never silent-kill the renderer.
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[veloxmark] render-process-gone', details.reason, details.exitCode)
  })
  attachWindowStatePersistence(mainWindow)

  // P12 close intercept: ask the renderer whether the close may proceed. The
  // renderer shows the three-option dialog when dirty and answers via
  // `app:closeResponse`; `closeApproved` lets the retried close through.
  // Applies to the titlebar ×, Cmd+Q / Alt+F4 and app.quit() alike — all of
  // them fire the window 'close' event first.
  mainWindow.on('close', (e) => {
    if (closeApproved) return
    e.preventDefault()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:queryClose')
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
    rendererLoaded = false // a new window will signal ready again
  })

  // Fullscreen toggles whether the titlebar reserves space for the traffic
  // lights (they auto-hide in fullscreen) — keep the renderer in sync.
  const notifyFullScreen = (): void => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:fullScreen', mainWindow.isFullScreen())
    }
  }
  mainWindow.on('enter-full-screen', notifyFullScreen)
  mainWindow.on('leave-full-screen', notifyFullScreen)

  if (!app.isPackaged) {
    mainWindow.webContents.on('console-message', (_e, level, message) => {
      console.log(`[renderer:${level}] ${message}`)
    })
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Renderer pings once the editor is mounted; only then can openPath be applied.
ipcMain.on('app:rendererReady', () => {
  rendererLoaded = true
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:fullScreen', mainWindow.isFullScreen())
  }
  for (const { path, isDir } of queuedOpens.splice(0)) {
    mainWindow?.webContents.send(isDir ? 'app:openFolder' : 'app:openPath', path)
  }
})

// ---- application menu ------------------------------------------------------
// Windows/Linux keep Menu.setApplicationMenu(null) — the renderer titlebar owns
// all menus there. macOS is different: the menu bar is platform chrome, and a
// null menu strips the system shortcuts (Cmd+Q/H/W/M, Edit roles like copy and
// paste in plain <input>s). App-specific items forward to the channels the
// renderer already listens on (see preload `onMenu`).
function sendMenu(channel: string): void {
  mainWindow?.webContents.send(channel)
}

// App-command accelerators for the macOS native menu. Labels and handlers
// live in the renderer's command registry (src/renderer/src/commands.ts);
// this stays a thin id→accelerator map, and every click forwards as
// `menu:<id>` so the renderer dispatches through the same registry.
const DARWIN_COMMAND_ACCELERATORS: Record<string, string> = {
  newFile: 'Cmd+N',
  openFile: 'Cmd+O',
  openFolder: 'Cmd+Shift+O',
  quickOpen: 'Cmd+P',
  saveFile: 'Cmd+S',
  saveFileAs: 'Cmd+Shift+S',
  openPreferences: 'Cmd+,',
  toggleTheme: 'Cmd+Shift+T',
  // P08 writing modes (Typewriter Mode is menu-only, no accelerator).
  toggleFocusMode: 'F8',
  toggleSourceMode: 'Cmd+/',
  // P13 folder-wide search.
  globalSearch: 'Cmd+Shift+F'
}

// P03: recent files, pushed from the renderer (which owns the store) whenever
// the list changes so the native File > Open Recent submenu stays in sync.
let recentFiles: RecentFileItem[] = []

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
    pdf: 'PDF…', html: 'HTML…', close: 'Close',
    edit: 'Edit', cut: 'Cut', copy: 'Copy', paste: 'Paste', pasteMatch: 'Paste and Match Style',
    del: 'Delete', selectAll: 'Select All',
    view: 'View', toggleOutline: 'Toggle Outline', globalSearch: 'Search in Folder…',
    focusMode: 'Focus Mode', typewriterMode: 'Typewriter Mode', sourceMode: 'Source Mode',
    zoomIn: 'Zoom In', zoomOut: 'Zoom Out', zoomReset: 'Reset Zoom',
    devTools: 'Toggle Developer Tools', toggleTheme: 'Toggle Theme',
    insert: 'Insert', insertMermaidDiagram: 'Mermaid Diagram…',
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
    pdf: 'PDF…', html: 'HTML…', close: '关闭',
    edit: '编辑', cut: '剪切', copy: '复制', paste: '粘贴', pasteMatch: '粘贴并匹配样式',
    del: '删除', selectAll: '全选',
    view: '视图', toggleOutline: '切换大纲', globalSearch: '文件夹内搜索…',
    focusMode: '专注模式', typewriterMode: '打字机模式', sourceMode: '源码模式',
    zoomIn: '放大', zoomOut: '缩小', zoomReset: '重置缩放',
    devTools: '开发者工具', toggleTheme: '切换主题',
    insert: '插入', insertMermaidDiagram: 'Mermaid 图表…',
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
    click: () => mainWindow?.webContents.send('menu:openRecent', item.path)
  }))
  items.push(
    { type: 'separator' },
    {
      label: S.clearMenu,
      click: () => mainWindow?.webContents.send('menu:clearRecent')
    }
  )
  return items
}

function commandItem(id: string, label: string): Electron.MenuItemConstructorOptions {
  return {
    label,
    accelerator: DARWIN_COMMAND_ACCELERATORS[id],
    click: () => sendMenu(`menu:${id}`)
  }
}

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
        { role: 'delete', label: S.del },
        { role: 'selectAll', label: S.selectAll }
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
        // Zoom/devtools run in main directly — no renderer round-trip.
        { label: S.zoomIn, accelerator: 'Cmd+Plus', click: () => zoomBy(getWindow, 0.5) },
        { label: S.zoomOut, accelerator: 'Cmd+-', click: () => zoomBy(getWindow, -0.5) },
        { label: S.zoomReset, accelerator: 'Cmd+0', click: () => zoomBy(getWindow, 'reset') },
        { type: 'separator' },
        {
          label: S.devTools,
          accelerator: 'Alt+Cmd+I',
          click: () => mainWindow?.webContents.toggleDevTools()
        },
        { type: 'separator' },
        commandItem('toggleTheme', S.toggleTheme)
      ]
    },
    {
      label: S.insert,
      submenu: [commandItem('insertMermaidDiagram', S.insertMermaidDiagram)]
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

app.whenReady().then(() => {
  initUiLang()
  registerAllIpc(getWindow)

  // P03: renderer pushes the recent-files list (with existence flags) so the
  // native Open Recent submenu can rebuild; clearMenu flows back the other way.
  ipcMain.handle('app:setRecentFiles', (_e, files: RecentFileItem[]) => {
    recentFiles = Array.isArray(files) ? files : []
    rebuildDarwinMenu()
  })

  // P14: renderer resolved the language pref — persist + rebuild native menu.
  ipcMain.handle('app:setLanguage', (_e, lang: string) => {
    uiLang = lang === 'zh' ? 'zh' : 'en'
    try {
      writeFileSync(uiLanguagePath(), JSON.stringify({ lang: uiLang }), 'utf8')
    } catch (err) {
      console.error('[veloxmark] failed to persist ui language', err)
    }
    rebuildDarwinMenu()
    return true
  })

  // P12: renderer verdict for the close query — allow re-runs close with the
  // intercept flag set; deny is a no-op (the renderer already showed Cancel).
  ipcMain.on('app:closeResponse', (_e, allow: boolean) => {
    const win = getWindow()
    if (!win || win.isDestroyed()) return
    if (!allow) return
    closeApproved = true
    win.close()
    closeApproved = false
  })

  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(buildDarwinMenu())
  } else {
    Menu.setApplicationMenu(null)
  }

  // macOS ignores the BrowserWindow `icon` option — the Dock icon comes from
  // the bundle icns when packaged, and from the Apple-grid master in dev
  // (icon.png is full-bleed for the Windows taskbar and must not be used here).
  if (process.platform === 'darwin' && !app.isPackaged) {
    app.dock.setIcon(join(__dirname, '../../build/logo.png'))
  }

  protocol.handle('mdres', async (request) => {
    try {
      const url = new URL(request.url)
      const filePath = decodeURIComponent(url.searchParams.get('path') ?? '')
      if (!filePath) return new Response('Bad request', { status: 400 })
      return await net.fetch(pathToFileURL(filePath).toString())
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Renderer-owned lifetime: closing the window drops the OS watch handle.
app.on('before-quit', stopFolderWatcher)
app.on('window-all-closed', stopFolderWatcher)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
