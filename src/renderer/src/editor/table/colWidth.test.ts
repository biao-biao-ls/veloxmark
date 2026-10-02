import { describe, expect, it } from 'vitest'
import {
  DRAG_COMMIT_MIN_PX,
  MIN_COL_WIDTH,
  absorbNeighbor,
  clampColWidth,
  deleteColWidths,
  dragEndWidths,
  insertColWidths,
  isDragCommit,
  moveColWidths,
  sanitizeWidths
} from './colWidth'

/**
 * FE-06 / PEND-10 (col-width:absorb) — stage-2 AC assertions:
 *  1) middle drag keeps w[j]+w[j+1] (total width invariant)
 *  2) last-boundary drag changes the total; w clamped to [min, content width]
 *  3) click-without-move writes back nothing (tableColWidths unchanged)
 * plus clamp boundaries (no 0/negative/overflow) and AC-ERR-03 structure remap.
 */

describe('MIN_COL_WIDTH token', () => {
  it('is 48px and is the single default lower bound', () => {
    expect(MIN_COL_WIDTH).toBe(48)
    expect(clampColWidth(1)).toBe(MIN_COL_WIDTH)
  })
})

describe('clampColWidth', () => {
  it('clamps into [min, max] and never yields 0/negative', () => {
    expect(clampColWidth(100, { min: 48, max: 400 })).toBe(100)
    expect(clampColWidth(10, { min: 48, max: 400 })).toBe(48)
    expect(clampColWidth(500, { min: 48, max: 400 })).toBe(400)
    expect(clampColWidth(-20, { min: 48, max: 400 })).toBe(48)
    expect(clampColWidth(Number.NaN, { min: 48, max: 400 })).toBe(48)
  })

  it('defaults min to MIN_COL_WIDTH and leaves max unbounded when omitted', () => {
    expect(clampColWidth(10)).toBe(MIN_COL_WIDTH)
    expect(clampColWidth(10_000)).toBe(10_000)
  })
})

describe('absorbNeighbor — middle boundary (right-neighbor absorb)', () => {
  it('keeps the pair sum (hence total width) invariant: 120/120 → 150/90', () => {
    const next = absorbNeighbor([120, 120], 0, 150)
    expect(next).toEqual([150, 90])
    expect(next[0] + next[1]).toBe(240)
  })

  it('keeps the total of every column, not just the pair (3-col)', () => {
    const before = [100, 120, 80]
    const next = absorbNeighbor(before, 1, 150)
    expect(next[1] + next[2]).toBe(200)
    expect(next.reduce((s, x) => s + x, 0)).toBe(300)
    expect(next[0]).toBe(100) // untouched column keeps its width
  })

  it('clamps the dragged width so neither side goes 0/negative', () => {
    const clampedUp = absorbNeighbor([120, 120], 0, 0, { min: 48 })
    expect(clampedUp[0]).toBe(48)
    expect(clampedUp[1]).toBe(192)
    const clampedDown = absorbNeighbor([120, 120], 0, 200, { min: 48 })
    expect(clampedDown[0]).toBe(192) // pair(240) - min(48)
    expect(clampedDown[1]).toBe(48)
  })

  it('keeps both sides inside the content-column max when given', () => {
    // pair 200; max 150 → w ∈ [pair-max, min(max, pair-min)] = [50, 150]
    const next = absorbNeighbor([100, 100], 0, 40, { min: 48, max: 150 })
    expect(next[0]).toBe(50)
    expect(next[1]).toBe(150)
    const wide = absorbNeighbor([100, 100], 0, 1000, { min: 48, max: 150 })
    expect(wide[0]).toBe(150)
    expect(wide[1]).toBe(50)
  })

  it('returns a copy and refuses out-of-range j', () => {
    const widths = [120, 120]
    expect(absorbNeighbor(widths, 2, 150)).toEqual(widths)
    expect(absorbNeighbor(widths, -1, 150)).toEqual(widths)
  })
})

describe('absorbNeighbor — last boundary (total-width exception)', () => {
  it('changes only the last width and the total follows', () => {
    const before = [100, 120, 80]
    const next = absorbNeighbor(before, 2, 120)
    expect(next).toEqual([100, 120, 120])
    expect(next.reduce((s, x) => s + x, 0)).toBe(340) // 300 → 340
  })

  it('shrinks the total too (no right-neighbor absorb)', () => {
    const next = absorbNeighbor([100, 120, 80], 2, 40, { min: 48 })
    expect(next).toEqual([100, 120, 48])
    expect(next.reduce((s, x) => s + x, 0)).toBe(268)
  })

  it('clamps w into [min, content width] — 1-col table is this path', () => {
    // 1-col: sumOthers = 0 → upper = content width (400)
    expect(absorbNeighbor([120], 0, 300, { min: 48, max: 400 })).toEqual([300])
    expect(absorbNeighbor([120], 0, 500, { min: 48, max: 400 })).toEqual([400])
    expect(absorbNeighbor([120], 0, 5, { min: 48, max: 400 })).toEqual([48])
  })

  it('never lets the total overflow the content column', () => {
    // sumOthers = 220, content = 400 → w ≤ 180 even though w itself is < 400
    const next = absorbNeighbor([100, 120, 80], 2, 300, { min: 48, max: 400 })
    expect(next).toEqual([100, 120, 180])
    expect(next.reduce((s, x) => s + x, 0)).toBe(400)
    // and min wins over the total bound in the degenerate case
    const tiny = absorbNeighbor([200, 220, 80], 2, 300, { min: 48, max: 400 })
    expect(tiny[2]).toBe(48)
  })
})

describe('anti-mistouch (click without movement writes back nothing)', () => {
  it('treats sub-threshold displacement as a click, not a drag', () => {
    expect(DRAG_COMMIT_MIN_PX).toBeGreaterThan(0)
    expect(isDragCommit(0)).toBe(false)
    expect(isDragCommit(1)).toBe(false)
    expect(isDragCommit(-1)).toBe(false)
    expect(isDragCommit(DRAG_COMMIT_MIN_PX)).toBe(true)
    expect(isDragCommit(-60)).toBe(true)
  })

  it('dragEndWidths returns null on a pure click — no tableColWidths writeback', () => {
    expect(dragEndWidths([120, 120], 0, 120, 0)).toBeNull()
    expect(dragEndWidths([120, 120], 0, 150, 1)).toBeNull()
  })

  it('dragEndWidths returns the absorbed widths once the gesture commits', () => {
    expect(dragEndWidths([120, 120], 0, 150, 30)).toEqual([150, 90])
    expect(dragEndWidths([120], 0, 200, -30, { min: 48, max: 400 })).toEqual([200])
  })
})

describe('AC-ERR-03 structure remap', () => {
  it('insertColWidths shifts old widths right and defaults the new column', () => {
    expect(insertColWidths([100, 200, 300], 1)).toEqual([100, 0, 200, 300])
    expect(insertColWidths([100, 200, 300], 0)).toEqual([0, 100, 200, 300])
    expect(insertColWidths([100, 200, 300], 3)).toEqual([100, 200, 300, 0])
  })

  it('deleteColWidths drops the column width and shifts left (no residue)', () => {
    expect(deleteColWidths([100, 200, 300], 1)).toEqual([100, 300])
    expect(deleteColWidths([100, 200, 300], 0)).toEqual([200, 300])
    expect(deleteColWidths([100, 200, 300], 2)).toEqual([100, 200])
  })

  it('moveColWidths carries the width with the column', () => {
    expect(moveColWidths([100, 200, 300], 0, 2)).toEqual([200, 300, 100])
    expect(moveColWidths([100, 200, 300], 2, 0)).toEqual([300, 100, 200])
    expect(moveColWidths([100, 200, 300], 1, 1)).toEqual([100, 200, 300])
  })

  it('sanitizeWidths maps onto the new column count and resets invalid values', () => {
    // residue beyond colCount dropped; NaN/negative/0 reset to default (auto)
    expect(sanitizeWidths([100, Number.NaN, -5], 3)).toEqual([100, 0, 0])
    // excess entries must not linger as misaligned residue
    expect(sanitizeWidths([100, 200, 300, 400], 2)).toEqual([100, 200])
    // pad shorter arrays with the default
    expect(sanitizeWidths([100], 3)).toEqual([100, 0, 0])
  })

  it('sanitizeWidths resets 失效/超界 values to the default width', () => {
    // < min and > max are both 失效/超界 → default 0 (auto)
    expect(sanitizeWidths([30, 900, 100], 3, { min: 48, max: 800 })).toEqual([0, 0, 100])
    expect(sanitizeWidths([48, 800], 2, { min: 48, max: 800 })).toEqual([48, 800])
  })

  it('insert+sanitize keeps the old structure mapping compliant (插列后新列宽合规)', () => {
    const remapped = insertColWidths([120, 120], 1)
    expect(sanitizeWidths(remapped, 3)).toEqual([120, 0, 120])
    expect(remapped.length).toBe(3)
  })
})
