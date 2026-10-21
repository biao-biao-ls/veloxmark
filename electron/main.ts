import { app, BrowserWindow, net, protocol, shell } from 'electron'

import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerAllIpc, type AppIpcDeps } from './ipc'
import { zoomLevelToFactor } from './shared/zoom'
import { stopFolderWatcher } from './ipc/folder'
import { attachWindowStatePersistence, loadWindowState } from './ipc/window-state'
import { initDarwinMenu, installApplicationMenu, setMenuCheckedIds, setRecentFiles, setUiLanguage } from './menu/darwin'
import { IpcChannels, menuChannel } from './shared/api'

if (process.platform === 'darwin') {
  app.setName('VeloxMark')
  app.setAboutPanelOptions({
    applicationName: 'VeloxMark',
    applicationVersion: app.getVersion(),
    copyright: 'Copyright © 2026 VeloxMark contributors',
    ...(app.isPackaged ? {} : { iconPath: join(__dirname, '../../build/logo.png') })
  })
}

const queuedOpens: { path: string; isDir: boolean }[] = []
let rendererLoaded = false

let mainWindow: BrowserWindow | null = null
const getWindow = (): BrowserWindow | null => mainWindow

let closeApproved = false

async function deliverOpenPath(filePath: string): Promise<void> {
  let isDir = false
  try {
    isDir = (await stat(filePath)).isDirectory()
  } catch {
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

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mdres',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

function createWindow(): void {
  const geometry = loadWindowState()
  mainWindow = new BrowserWindow({
    width: geometry.width,
    height: geometry.height,
    ...(geometry.x != null && geometry.y != null ? { x: geometry.x, y: geometry.y } : {}),
    minWidth: 640,
    minHeight: 400,
    show: false,
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 14, y: 14 }
        }
      : { frame: false }),
    backgroundColor: '#ffffff',
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      zoomFactor: zoomLevelToFactor(geometry.zoomLevel)
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (geometry.maximized) mainWindow?.maximize()
    mainWindow?.show()
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[veloxmark] render-process-gone', details.reason, details.exitCode)
    rendererLoaded = false
  })
  attachWindowStatePersistence(mainWindow)

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

  mainWindow.on('close', (e) => {
    if (closeApproved) return
    if (!rendererLoaded) return
    e.preventDefault()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.appQueryClose)
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
    rendererLoaded = false
  })

  const notifyFullScreen = (): void => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.appFullScreen, mainWindow.isFullScreen())
    }
  }
  mainWindow.on('enter-full-screen', notifyFullScreen)
  mainWindow.on('leave-full-screen', notifyFullScreen)

  const notifyMaximized = (): void => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.appMaximized, mainWindow.isMaximized())
    }
  }
  mainWindow.on('maximize', notifyMaximized)
  mainWindow.on('unmaximize', notifyMaximized)
  mainWindow.on('restore', notifyMaximized)

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

  const appDeps: AppIpcDeps = {
    onRendererReady: () => {
      rendererLoaded = true
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IpcChannels.appFullScreen, mainWindow.isFullScreen())
        mainWindow.webContents.send(IpcChannels.appMaximized, mainWindow.isMaximized())
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

app.on('before-quit', stopFolderWatcher)
app.on('window-all-closed', stopFolderWatcher)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
