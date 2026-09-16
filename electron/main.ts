import { app, BrowserWindow, ipcMain, Menu, net, protocol, shell } from 'electron'

// NOTE: window uses frameless mode; all menus live in the renderer titlebar.
// Exception: macOS keeps the native menu bar (see buildDarwinMenu) and native
// traffic lights via titleBarStyle: 'hiddenInset'.
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerAllIpc } from './ipc'
import { stopFolderWatcher } from './ipc/folder'
import { zoomBy } from './ipc/window'

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
// A path may point at a directory (Finder "Open" on a folder) — deliver those
// on a separate channel so the renderer opens them as a folder workspace.
const queuedOpens: { path: string; isDir: boolean }[] = []
let rendererLoaded = false

let mainWindow: BrowserWindow | null = null
const getWindow = (): BrowserWindow | null => mainWindow

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
  saveFile: 'Cmd+S',
  saveFileAs: 'Cmd+Shift+S',
  toggleTheme: 'Cmd+Shift+T'
}

function commandItem(id: string, label: string): Electron.MenuItemConstructorOptions {
  return {
    label,
    accelerator: DARWIN_COMMAND_ACCELERATORS[id],
    click: () => sendMenu(`menu:${id}`)
  }
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
        commandItem('newFile', 'New'),
        commandItem('openFile', 'Open…'),
        commandItem('openFolder', 'Open Folder…'),
        { type: 'separator' },
        commandItem('saveFile', 'Save'),
        commandItem('saveFileAs', 'Save As…'),
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
        commandItem('toggleOutline', 'Toggle Outline'),
        { type: 'separator' },
        // Zoom/devtools run in main directly — no renderer round-trip.
        { label: 'Zoom In', accelerator: 'Cmd+Plus', click: () => zoomBy(getWindow, 0.5) },
        { label: 'Zoom Out', accelerator: 'Cmd+-', click: () => zoomBy(getWindow, -0.5) },
        { label: 'Reset Zoom', accelerator: 'Cmd+0', click: () => zoomBy(getWindow, 'reset') },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Cmd+I',
          click: () => mainWindow?.webContents.toggleDevTools()
        },
        { type: 'separator' },
        commandItem('toggleTheme', 'Toggle Theme')
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
      submenu: [commandItem('showHelp', 'Markdown Syntax Reference')]
    }
  ])
}

app.whenReady().then(() => {
  registerAllIpc(getWindow)

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

// Renderer-owned lifetime: closing the window drops the OS watch handle.
app.on('before-quit', stopFolderWatcher)
app.on('window-all-closed', stopFolderWatcher)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
