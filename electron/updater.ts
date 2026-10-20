import { app, ipcMain, net } from 'electron'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { autoUpdater } from 'electron-updater'
import type { GetWindow } from './ipc/getWindow'
import { IpcChannels, type UpdaterMode, type UpdaterStatus } from './shared/api'

const GITHUB_REPO = 'biao-biao-ls/veloxmark'

let getWindow: GetWindow = () => null
let mode: UpdaterMode = 'manual'
let checking = false
let autoUpdaterWired = false

function emit(status: UpdaterStatus): void {
  const win = getWindow()
  if (win && !win.isDestroyed()) win.webContents.send(IpcChannels.updaterStatus, status)
}

/**
 * Routing rules (docs/release-distribution.md, step 3):
 * - Linux: only AppImage supports electron-updater (detected via the APPIMAGE env var);
 * - Windows: portable zip has no uninstaller -> manual, NSIS install (an Uninstall *.exe
 *   in the install dir) -> auto;
 * - macOS: try auto; an unsigned build fails via the error event -> the renderer falls
 *   back to opening the releases page.
 */
function detectMode(): UpdaterMode {
  if (!app.isPackaged) return 'manual'
  if (process.platform === 'linux') return process.env['APPIMAGE'] ? 'auto' : 'manual'
  if (process.platform === 'win32') {
    const dir = dirname(process.execPath)
    const hasUninstaller =
      existsSync(join(dir, 'Uninstall VeloxMark.exe')) || existsSync(join(dir, 'Uninstall.exe'))
    return hasUninstaller ? 'auto' : 'manual'
  }
  return 'auto'
}

function normalizeVersion(v: string): number[] {
  return v
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)
}

function isNewer(next: string, current: string): boolean {
  const a = normalizeVersion(next)
  const b = normalizeVersion(current)
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

/** manual mode: query the latest GitHub release, notify only, never download */
async function checkViaGithub(): Promise<void> {
  const res = await net.fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { 'User-Agent': 'VeloxMark', Accept: 'application/vnd.github+json' }
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  const data = (await res.json()) as { tag_name?: string }
  const tag = data.tag_name ?? ''
  if (tag && isNewer(tag, app.getVersion())) {
    emit({ phase: 'available', mode: 'manual', version: tag.replace(/^v/i, '') })
  } else {
    emit({ phase: 'not-available', mode: 'manual' })
  }
}

function ensureAutoUpdater(): typeof autoUpdater {
  if (!autoUpdaterWired) {
    autoUpdaterWired = true
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.on('update-available', (info) =>
      emit({ phase: 'available', mode: 'auto', version: info.version })
    )
    autoUpdater.on('update-not-available', () => emit({ phase: 'not-available', mode: 'auto' }))
    autoUpdater.on('download-progress', () => emit({ phase: 'downloading', mode: 'auto' }))
    autoUpdater.on('update-downloaded', (info) =>
      emit({ phase: 'downloaded', mode: 'auto', version: info.version })
    )
    autoUpdater.on('error', (err) =>
      emit({ phase: 'error', mode: 'auto', error: String((err as Error)?.message ?? err) })
    )
  }
  return autoUpdater
}

async function check(): Promise<void> {
  if (checking) return
  checking = true
  emit({ phase: 'checking', mode })
  try {
    if (mode === 'auto') {
      await ensureAutoUpdater().checkForUpdates()
    } else {
      await checkViaGithub()
    }
  } catch (err) {
    emit({ phase: 'error', mode, error: String((err as Error)?.message ?? err) })
  } finally {
    checking = false
  }
}

async function download(): Promise<void> {
  if (mode !== 'auto' || !autoUpdaterWired) return
  emit({ phase: 'downloading', mode })
  try {
    await autoUpdater.downloadUpdate()
  } catch (err) {
    emit({ phase: 'error', mode, error: String((err as Error)?.message ?? err) })
  }
}

function install(): void {
  if (mode === 'auto' && autoUpdaterWired) autoUpdater.quitAndInstall()
}

export function registerUpdaterIpc(getWindowFn: GetWindow): void {
  getWindow = getWindowFn
  mode = detectMode()
  ipcMain.handle(IpcChannels.appGetVersion, () => app.getVersion())
  ipcMain.handle(IpcChannels.updaterCheck, () => check())
  ipcMain.handle(IpcChannels.updaterDownload, () => download())
  ipcMain.handle(IpcChannels.updaterInstall, () => install())
}
