
export const ZOOM_MIN_PERCENT = 50
export const ZOOM_MAX_PERCENT = 200

const LOG_1_2 = Math.log(1.2)

export const ZOOM_MIN_LEVEL = Math.log(ZOOM_MIN_PERCENT / 100) / LOG_1_2
export const ZOOM_MAX_LEVEL = Math.log(ZOOM_MAX_PERCENT / 100) / LOG_1_2

export function clampZoomLevel(level: number): number {
  if (!Number.isFinite(level)) return 0
  return Math.min(ZOOM_MAX_LEVEL, Math.max(ZOOM_MIN_LEVEL, level))
}

export function clampZoomPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 100
  return Math.min(ZOOM_MAX_PERCENT, Math.max(ZOOM_MIN_PERCENT, percent))
}

export function percentToZoomLevel(percent: number): number {
  return Math.log(percent / 100) / LOG_1_2
}

export function zoomLevelToPercent(level: number): number {
  return 100 * Math.pow(1.2, level)
}

export function zoomLevelToFactor(level: number): number {
  return Math.pow(1.2, level)
}
