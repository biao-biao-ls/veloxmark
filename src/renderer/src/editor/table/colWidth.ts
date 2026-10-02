/**
 * FE-06 / PEND-10 `col-width:absorb` — pure column-width domain.
 *
 * Drag semantics (tech-design §9 / TBL-table-ops §3.7):
 * - middle boundary: only columns j and j+1 trade width — pair sum (hence
 *   table total) is invariant (Excel-style "move the boundary", 120/120 → 150/90);
 * - last boundary: the exception — only column j moves, the total may grow or
 *   shrink, clamped inside the content column (no overflow, no 0/negative);
 * - structure changes (AC-ERR-03): old widths map onto the new structure's
 *   columns, invalid/over-limit values reset to the default (0 = auto), residue
 *   beyond the new column count is dropped.
 *
 * The widget layer measures rendered widths and writes back through
 * `setColWidth`; persistence reuses SessionState.tableColWidths (no new keys).
 */

/**
 * Single tokenized minimum column width (PEND-10/FE-06) — replaces the old
 * magic 40 shared by the drag path; keep this the only declaration point.
 */
export const MIN_COL_WIDTH = 48

/** Displacement below this is a click — mistouch, never a width writeback. */
export const DRAG_COMMIT_MIN_PX = 2

export interface ColWidthClamp {
  /** Lower bound — defaults to MIN_COL_WIDTH. */
  min?: number
  /** Upper bound (content column width). Omit for unbounded. */
  max?: number
}

/** Clamp one width into [min, max]; non-finite input falls back to min. */
export function clampColWidth(w: number, clamp?: ColWidthClamp): number {
  const min = clamp?.min ?? MIN_COL_WIDTH
  const max = clamp?.max ?? Number.POSITIVE_INFINITY
  if (!Number.isFinite(w)) return min
  return Math.min(Math.max(w, min), max)
}

/**
 * PEND-10 absorb: apply drag-end width `w` to column `j`'s right boundary.
 * Returns a new array; out-of-range `j` returns a copy unchanged.
 */
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
    // Last-boundary exception: only j moves — the total may change but must
    // stay inside the content column, so w is capped by max minus the others.
    const sumOthers = next.reduce((sum, x, i) => (i === j ? sum : sum + x), 0)
    const upper = max != null ? Math.max(min, max - sumOthers) : undefined
    next[j] = clampColWidth(w, { min, max: upper })
    return next
  }
  const pair = widths[j] + widths[j + 1]
  if (!Number.isFinite(pair) || pair < 2) {
    // Degenerate pair cannot host two positive widths — reset both to min.
    next[j] = min
    next[j + 1] = min
    return next
  }
  // Middle boundary: keep the pair sum, both sides inside [min, max].
  let lo = min
  let hi = pair - min
  if (max != null) {
    lo = Math.max(lo, pair - max)
    hi = Math.min(hi, max)
  }
  if (hi < lo) {
    // Pair can't host two clamped columns — the AC asserts the sum, so keep it
    // and only forbid 0/negative widths.
    lo = 1
    hi = pair - 1
  }
  const wj = clampColWidth(w, { min: lo, max: hi })
  next[j] = wj
  next[j + 1] = pair - wj
  return next
}

/** True when the gesture moved enough to count as a drag (not a mistouch click). */
export function isDragCommit(dx: number, threshold: number = DRAG_COMMIT_MIN_PX): boolean {
  return Math.abs(dx) >= threshold
}

/**
 * Widths to persist at drag end; null = mistouch — callers must NOT write
 * tableColWidths (stage-2 AC: click without movement writes back nothing).
 */
export function dragEndWidths(
  widths: readonly number[],
  j: number,
  w: number,
  dx: number,
  clamp?: ColWidthClamp
): number[] | null {
  return isDragCommit(dx) ? absorbNeighbor(widths, j, w, clamp) : null
}

/** Insert a column at `index`: old widths shift right; new column = default. */
export function insertColWidths(widths: readonly number[], index: number): number[] {
  const next = [...widths]
  next.splice(Math.max(0, Math.min(index, next.length)), 0, 0)
  return next
}

/** Delete the column at `index`: its width drops, the rest shift left. */
export function deleteColWidths(widths: readonly number[], index: number): number[] {
  const next = [...widths]
  if (index >= 0 && index < next.length) next.splice(index, 1)
  return next
}

/** Move the column `from` → `to`: its width follows the column. */
export function moveColWidths(widths: readonly number[], from: number, to: number): number[] {
  const next = [...widths]
  if (from < 0 || from >= next.length) return next
  const target = Math.max(0, Math.min(to, next.length - 1))
  const [moved] = next.splice(from, 1)
  next.splice(target, 0, moved)
  return next
}

/**
 * AC-ERR-03: map a width array onto `colCount` columns — drop residue beyond
 * colCount (no misalignment), pad with the default (0 = auto), and reset
 * 失效/超界 values (non-finite, < min, > max) to the default width.
 */
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
