/**
 * UI zoom math — the single source for zoomLevel ↔ percent ↔ factor conversion.
 *
 * Electron scales the page as factor := 1.2 ^ zoomLevel (the webContents
 * zoomLevel unit used by setZoomLevel/getZoomLevel and the ±0.5 menu steps).
 * The renderer and the Preferences UI speak integer percent; window-state.json
 * stores the native zoomLevel float. Zero electron imports — consumed by
 * ipc/window.ts, ipc/window-state.ts and main.ts (shared/ stays dependency-free).
 */

/** UI zoom band: 50%–200% (tighter than Chromium's 50%–300% hard limits). */
export const ZOOM_MIN_PERCENT = 50
export const ZOOM_MAX_PERCENT = 200

const LOG_1_2 = Math.log(1.2)

/** ±log(2)/log(1.2) ≈ ±3.80 — the zoomLevel band matching 50%–200%. */
export const ZOOM_MIN_LEVEL = Math.log(ZOOM_MIN_PERCENT / 100) / LOG_1_2
export const ZOOM_MAX_LEVEL = Math.log(ZOOM_MAX_PERCENT / 100) / LOG_1_2

/** Clamp a stored/derived zoomLevel into the band; NaN/garbage → 0 (100%). */
export function clampZoomLevel(level: number): number {
  if (!Number.isFinite(level)) return 0
  return Math.min(ZOOM_MAX_LEVEL, Math.max(ZOOM_MIN_LEVEL, level))
}

/** Clamp a UI percent into the band; NaN/garbage → 100. */
export function clampZoomPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 100
  return Math.min(ZOOM_MAX_PERCENT, Math.max(ZOOM_MIN_PERCENT, percent))
}

export function percentToZoomLevel(percent: number): number {
  return Math.log(percent / 100) / LOG_1_2
}

/** Exact percent (may be fractional) — round at the IPC/display boundary. */
export function zoomLevelToPercent(level: number): number {
  return 100 * Math.pow(1.2, level)
}

/** Scale factor for webPreferences.zoomFactor — exact, never the rounded percent. */
export function zoomLevelToFactor(level: number): number {
  return Math.pow(1.2, level)
}
