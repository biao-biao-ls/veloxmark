import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, net, protocol, shell } from 'electron'

// NOTE: window uses frameless mode; all menus live in the renderer titlebar.
import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, normalize } from 'node:path'
import { pathToFileURL } from 'node:url'

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
    frame: false, // custom titlebar + in-app menu (follows app theme)
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
  })

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

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize-restore', () => {
  if (!mainWindow) return
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())
ipcMain.on('window:toggleDevTools', () => mainWindow?.webContents.toggleDevTools())
ipcMain.on('window:zoom', (_e, action: 'in' | 'out' | 'reset') => {
  if (!mainWindow) return
  const contents = mainWindow.webContents
  if (action === 'reset') contents.setZoomLevel(0)
  else contents.setZoomLevel(contents.getZoomLevel() + (action === 'in' ? 0.5 : -0.5))
})

ipcMain.handle('clipboard:read', () => clipboard.readText())
ipcMain.handle('clipboard:write', (_e, text: string) => clipboard.writeText(text))

// ---- renderer -> main state sync (window title) ----------------------------

ipcMain.handle('app:setState', (_e, state: { filePath: string | null; dirty: boolean }) => {
  if (mainWindow) {
    const name = state.filePath ? basename(state.filePath) : 'Untitled'
    mainWindow.setTitle(`${state.dirty ? '• ' : ''}${name} - VeloxMark`)
  }
})

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)

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
