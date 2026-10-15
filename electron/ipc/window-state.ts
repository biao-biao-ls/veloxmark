/**
 * Window geometry persistence (P03) — self-implemented "electron-window-state"
 * pattern. Stored as JSON under userData (main-process lifetime is reliable;
 * the renderer never touches this file).
 *
 * Also owns UI zoom persistence (zoomLevel, Electron's native unit): every
 * write is a whole-state snapshot from the live window, so the debounced
 * geometry save and the immediate zoom save can never clobber each other.
 */
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
  /** UI zoom, Electron zoomLevel (0 = 100%). Absent in pre-zoom files → 0. */
  zoomLevel: number
}

const MIN_WIDTH = 640
const MIN_HEIGHT = 400
const DEFAULT_WIDTH = 1200
const DEFAULT_HEIGHT = 800

function statePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

/** Read the saved geometry; rejects off-screen/invalid data. Call after ready. */
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
    // Keep the title bar reachable: require a meaningful on-screen overlap.
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

/**
 * Whole-state synchronous write, safe from any call path (debounced geometry
 * events and immediate zoom changes alike — both snapshot the live window).
 */
export function saveWindowStateNow(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(statePath(), JSON.stringify(snapshot(win)), 'utf-8')
  } catch {
    // Losing window state is non-fatal.
  }
}

/**
 * Track a window and persist its geometry: debounced on resize/move (a final
 * flush runs on close so quitting mid-drag still saves).
 */
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
