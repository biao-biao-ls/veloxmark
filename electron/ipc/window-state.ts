import { app, screen, type BrowserWindow } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { clampZoomLevel } from '../shared/zoom'

export interface WindowGeometry {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
  zoomLevel: number
}

const MIN_WIDTH = 640
const MIN_HEIGHT = 400
const DEFAULT_WIDTH = 1200
const DEFAULT_HEIGHT = 800

function statePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

export function loadWindowState(): WindowGeometry {
  let raw: Partial<WindowGeometry>
  try {
    raw = JSON.parse(readFileSync(statePath(), 'utf-8')) as Partial<WindowGeometry>
  } catch {
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, maximized: false, zoomLevel: 0 }
  }
  const width = Math.max(MIN_WIDTH, Math.round(raw.width ?? DEFAULT_WIDTH))
  const height = Math.max(MIN_HEIGHT, Math.round(raw.height ?? DEFAULT_HEIGHT))
  const maximized = raw.maximized === true
  const zoomLevel = clampZoomLevel(typeof raw.zoomLevel === 'number' ? raw.zoomLevel : 0)
  const base = { width, height, maximized, zoomLevel }
  if (typeof raw.x === 'number' && typeof raw.y === 'number') {
    const bounds = { x: Math.round(raw.x), y: Math.round(raw.y), width, height }
    const area = screen.getDisplayMatching(bounds).workArea
    const visible =
      bounds.x + bounds.width > area.x + 32 &&
      bounds.x < area.x + area.width - 32 &&
      bounds.y + 32 < area.y + area.height &&
      bounds.y > area.y - bounds.height + 64
    if (visible) return { ...bounds, ...base }
  }
  return base
}

function snapshot(win: BrowserWindow): WindowGeometry {
  const bounds = win.getNormalBounds()
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    maximized: win.isMaximized(),
    zoomLevel: clampZoomLevel(win.webContents.getZoomLevel())
  }
}

export function saveWindowStateNow(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(statePath(), JSON.stringify(snapshot(win)), 'utf-8')
  } catch {
  }
}

export function attachWindowStatePersistence(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null

  const schedule = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    timer = setTimeout(() => {
      timer = null
      saveWindowStateNow(win)
    }, 500)
  }

  win.on('resize', schedule)
  win.on('move', schedule)
  win.on('close', () => saveWindowStateNow(win))
}
