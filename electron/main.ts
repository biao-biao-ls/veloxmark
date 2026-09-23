import { app, BrowserWindow, net, protocol, shell } from 'electron'

// NOTE: window uses frameless mode; all menus live in the renderer titlebar.
// Exception: macOS keeps the native menu bar (see menu/darwin.ts) and native
// traffic lights via titleBarStyle: 'hiddenInset'.
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerAllIpc, type AppIpcDeps } from './ipc'
import { stopFolderWatcher } from './ipc/folder'
import { attachWindowStatePersistence, loadWindowState } from './ipc/window-state'
import { initDarwinMenu, installApplicationMenu, setMenuCheckedIds, setRecentFiles, setUiLanguage } from './menu/darwin'
import { IpcChannels, menuChannel } from './shared/api'

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
  const channel = isDir ? IpcChannels.appOpenFolder : IpcChannels.appOpenPath
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

  // P26: Cmd/Ctrl+W is tab-aware — main never decides, the renderer does
  // (tabs>1 → close tab; else window:close → P12 close intercept). before-
  // input runs ahead of native-menu accelerators, so the window-close role
  // never races the tab command.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const win = getWindow()
    if (!win) return
    if (input.type !== 'keyDown') return
    const wKey = input.key === 'w' || input.key === 'W'
    if (!wKey || input.shift || input.alt) return
    if (!(input.meta || input.control)) return
    event.preventDefault()
    win.webContents.send(menuChannel('closeTabOrWindow'))
  })

  // P12 close intercept: ask the renderer whether the close may proceed. The
  // renderer shows the three-option dialog when dirty and answers via
  // `app:closeResponse`; `closeApproved` lets the retried close through.
  // Applies to the titlebar ×, Cmd+Q / Alt+F4 and app.quit() alike — all of
  // them fire the window 'close' event first.
  mainWindow.on('close', (e) => {
    if (closeApproved) return
    e.preventDefault()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.appQueryClose)
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
      mainWindow.webContents.send(IpcChannels.appFullScreen, mainWindow.isFullScreen())
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

app.whenReady().then(() => {
  initDarwinMenu(getWindow)

  // App-domain behaviors for ipc/app.ts — lifecycle closures stay here, menu
  // state syncs delegate to menu/darwin (ipc/* must not import menu/*).
  const appDeps: AppIpcDeps = {
    // Renderer pings once the editor is mounted; only then can openPath be applied.
    onRendererReady: () => {
      rendererLoaded = true
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IpcChannels.appFullScreen, mainWindow.isFullScreen())
      }
      for (const { path, isDir } of queuedOpens.splice(0)) {
        mainWindow?.webContents.send(isDir ? IpcChannels.appOpenFolder : IpcChannels.appOpenPath, path)
      }
    },
    approveClose: () => {
      const win = getWindow()
      if (!win || win.isDestroyed()) return
      closeApproved = true
      win.close()
      closeApproved = false
    },
    setRecentFiles,
    setMenuCheckedIds,
    setUiLanguage
  }
  registerAllIpc(getWindow, appDeps)

  installApplicationMenu()

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
