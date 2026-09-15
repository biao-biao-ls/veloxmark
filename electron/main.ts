import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, net, protocol, shell } from 'electron'

// NOTE: window uses frameless mode; all menus live in the renderer titlebar.
// Exception: macOS keeps the native menu bar (see buildDarwinMenu) and native
// traffic lights via titleBarStyle: 'hiddenInset'.
import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, normalize } from 'node:path'
import { pathToFileURL } from 'node:url'

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
    ...(app.isPackaged ? {} : { iconPath: join(__dirname, '../../build/icon.png') })
  })
}

// macOS "open with" / double-clicking a .md in Finder while the app is running.
// Events can arrive before the renderer is up, so queue until it signals ready.
const queuedOpenPaths: string[] = []
let rendererLoaded = false

function deliverOpenPath(filePath: string): void {
  if (rendererLoaded && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:openPath', filePath)
  } else {
    queuedOpenPaths.push(filePath)
  }
}

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  deliverOpenPath(filePath)
})

// Custom protocol so relative images inside a .md file can be displayed even
// when the renderer origin is http://localhost (dev) or file:// (prod).
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mdres',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

  mainWindow.on('ready-to-show', () => mainWindow?.show())
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

// ---- file operations -------------------------------------------------------

const FILE_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'txt'] },
  { name: 'All Files', extensions: ['*'] }
]

ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: FILE_FILTERS
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const content = await readFile(filePath, 'utf-8')
  return { filePath, content }
})

ipcMain.handle(
  'dialog:saveFile',
  async (_e, defaultPath?: string, filters?: { name: string; extensions: string[] }[]) => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: filters && filters.length > 0 ? filters : FILE_FILTERS
    })
    if (result.canceled || !result.filePath) return null
    return result.filePath
  }
)

ipcMain.handle('file:read', async (_e, filePath: string) => {
  return readFile(filePath, 'utf-8')
})

ipcMain.handle('file:write', async (_e, filePath: string, content: string) => {
  await writeFile(filePath, content, 'utf-8')
  return true
})

ipcMain.handle('file:resolveImageSrc', (_e, dir: string, src: string) => {
  if (/^(https?:|data:|mdres:)/i.test(src)) return src
  const abs = normalize(isAbsolute(src) ? src : join(dir || '.', src))
  return `mdres://image?path=${encodeURIComponent(abs)}`
})

// ---- window controls (custom frameless titlebar) ---------------------------

function zoomBy(delta: number | 'reset'): void {
  const contents = mainWindow?.webContents
  if (!contents) return
  contents.setZoomLevel(delta === 'reset' ? 0 : contents.getZoomLevel() + delta)
}

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize-restore', () => {
  if (!mainWindow) return
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())
ipcMain.on('window:toggleDevTools', () => mainWindow?.webContents.toggleDevTools())
ipcMain.on('window:zoom', (_e, action: 'in' | 'out' | 'reset') => {
  if (action === 'reset') zoomBy('reset')
  else zoomBy(action === 'in' ? 0.5 : -0.5)
})

ipcMain.handle('clipboard:read', () => clipboard.readText())
ipcMain.handle('clipboard:write', (_e, text: string) => clipboard.writeText(text))

// Renderer pings once the editor is mounted; only then can openPath be applied.
ipcMain.on('app:rendererReady', () => {
  rendererLoaded = true
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:fullScreen', mainWindow.isFullScreen())
  }
  for (const filePath of queuedOpenPaths.splice(0)) {
    mainWindow?.webContents.send('app:openPath', filePath)
  }
})

// ---- renderer -> main state sync (window title) ----------------------------

ipcMain.handle('app:setState', (_e, state: { filePath: string | null; dirty: boolean }) => {
  if (mainWindow) {
    const name = state.filePath ? basename(state.filePath) : 'Untitled'
    mainWindow.setTitle(`${state.dirty ? '• ' : ''}${name} - VeloxMark`)
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

function buildDarwinMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: 'VeloxMark',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'Cmd+N', click: () => sendMenu('menu:newFile') },
        { label: 'Open…', accelerator: 'Cmd+O', click: () => sendMenu('menu:openFile') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'Cmd+S', click: () => sendMenu('menu:saveFile') },
        {
          label: 'Save As…',
          accelerator: 'Cmd+Shift+S',
          click: () => sendMenu('menu:saveFileAs')
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        // No undo/redo roles on purpose: a menu accelerator would intercept
        // Cmd+Z/Y before CodeMirror sees them, and native undo fights CM6's
        // transaction history. CM6's own keymap handles them in the editor.
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Outline', click: () => sendMenu('menu:toggleOutline') },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'Cmd+Plus', click: () => zoomBy(0.5) },
        { label: 'Zoom Out', accelerator: 'Cmd+-', click: () => zoomBy(-0.5) },
        { label: 'Reset Zoom', accelerator: 'Cmd+0', click: () => zoomBy('reset') },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Cmd+I',
          click: () => mainWindow?.webContents.toggleDevTools()
        },
        { type: 'separator' },
        { label: 'Toggle Theme', accelerator: 'Cmd+Shift+T', click: () => sendMenu('menu:toggleTheme') }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Markdown Syntax Reference',
          click: () => sendMenu('menu:showHelp')
        }
      ]
    }
  ])
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(buildDarwinMenu())
  } else {
    Menu.setApplicationMenu(null)
  }

  // macOS ignores the BrowserWindow `icon` option — the Dock icon comes from
  // the bundle icns when packaged, and from Electron's default in dev.
  if (process.platform === 'darwin' && !app.isPackaged) {
    app.dock.setIcon(join(__dirname, '../../build/icon.png'))
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
