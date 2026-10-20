
export const MIN_COL_WIDTH = 48

export const DRAG_COMMIT_MIN_PX = 2

export interface ColWidthClamp {
  min?: number
  max?: number
}

export function clampColWidth(w: number, clamp?: ColWidthClamp): number {
  const min = clamp?.min ?? MIN_COL_WIDTH
  const max = clamp?.max ?? Number.POSITIVE_INFINITY
  if (!Number.isFinite(w)) return min
  return Math.min(Math.max(w, min), max)
}

export function absorbNeighbor(
  widths: readonly number[],
  j: number,
  w: number,
  clamp?: ColWidthClamp
): number[] {
  const next = [...widths]
  if (j < 0 || j >= widths.length) return next
  const min = clamp?.min ?? MIN_COL_WIDTH
  const max = clamp?.max
  if (j === widths.length - 1) {
    const sumOthers = next.reduce((sum, x, i) => (i === j ? sum : sum + x), 0)
    const upper = max != null ? Math.max(min, max - sumOthers) : undefined
    next[j] = clampColWidth(w, { min, max: upper })
    return next
  }
  const pair = widths[j] + widths[j + 1]
  if (!Number.isFinite(pair) || pair < 2) {
    next[j] = min
    next[j + 1] = min
    return next
  }
  let lo = min
  let hi = pair - min
  if (max != null) {
    lo = Math.max(lo, pair - max)
    hi = Math.min(hi, max)
  }
  if (hi < lo) {
    lo = 1
    hi = pair - 1
  }
  const wj = clampColWidth(w, { min: lo, max: hi })
  next[j] = wj
  next[j + 1] = pair - wj
  return next
}

export function isDragCommit(dx: number, threshold: number = DRAG_COMMIT_MIN_PX): boolean {
  return Math.abs(dx) >= threshold
}

export function dragEndWidths(
  widths: readonly number[],
  j: number,
  w: number,
  dx: number,
  clamp?: ColWidthClamp
): number[] | null {
  return isDragCommit(dx) ? absorbNeighbor(widths, j, w, clamp) : null
}

export function insertColWidths(widths: readonly number[], index: number): number[] {
  const next = [...widths]
  next.splice(Math.max(0, Math.min(index, next.length)), 0, 0)
  return next
}

export function deleteColWidths(widths: readonly number[], index: number): number[] {
  const next = [...widths]
  if (index >= 0 && index < next.length) next.splice(index, 1)
  return next
}

export function moveColWidths(widths: readonly number[], from: number, to: number): number[] {
  const next = [...widths]
  if (from < 0 || from >= next.length) return next
  const target = Math.max(0, Math.min(to, next.length - 1))
  const [moved] = next.splice(from, 1)
  next.splice(target, 0, moved)
  return next
}

export function sanitizeWidths(
  widths: readonly number[],
  colCount: number,
  clamp?: ColWidthClamp
): number[] {
  const min = clamp?.min ?? MIN_COL_WIDTH
  const max = clamp?.max
  const n = Math.max(0, colCount)
  const next: number[] = []
  for (let i = 0; i < n; i++) {
    const x = widths[i]
    next.push(Number.isFinite(x) && x >= min && (max == null || x <= max) ? x : 0)
  }
  return next
}
