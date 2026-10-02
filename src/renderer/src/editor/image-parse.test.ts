/**
 * FE-04 收口批 #8 — shared width-percentage derivation (ren-image:write-md).
 *
 * The `(w / naturalWidth) * 100` formula lived twice (ImageEditFloat's
 * deriveWidthPct with a 100 fallback vs the zoom toolbar's derivePct with a
 * spec.width fallback). Single 口径 here: live rendered style.width first,
 * then the source `=WxH` slot (specWidth), then 100.
 */
import { describe, expect, it } from 'vitest'
import { deriveWidthPct } from './image-parse'

describe('deriveWidthPct: single width-% formula (FE-04 review DRY)', () => {
  it('prefers the live rendered style width over the source slot', () => {
    expect(deriveWidthPct('200px', 400, 100)).toBe(50)
    expect(deriveWidthPct('400px', 400, 200)).toBe(100)
  })

  it('rounds to the nearest percent', () => {
    expect(deriveWidthPct('333px', 1000)).toBe(33)
    expect(deriveWidthPct('667px', 1000)).toBe(67)
  })

  it('falls back to spec.width when no live style width is set', () => {
    expect(deriveWidthPct('', 400, 200)).toBe(50)
    expect(deriveWidthPct(undefined, 400, 200)).toBe(50)
    expect(deriveWidthPct(null, 400, 200)).toBe(50)
  })

  it('falls back to 100 when neither width is known', () => {
    expect(deriveWidthPct('', 400)).toBe(100)
    expect(deriveWidthPct('', 400, undefined)).toBe(100)
    expect(deriveWidthPct('200px', 400, undefined)).toBe(50)
  })

  it('ignores non-numeric / zero / negative style widths', () => {
    expect(deriveWidthPct('auto', 400, 200)).toBe(50)
    expect(deriveWidthPct('0px', 400, 200)).toBe(50)
    expect(deriveWidthPct('-20px', 400, 200)).toBe(50)
  })

  it('degrades to 100 without a natural width (image still loading)', () => {
    expect(deriveWidthPct('200px', 0)).toBe(100)
    expect(deriveWidthPct('200px', 0, 200)).toBe(100)
    expect(deriveWidthPct('', 0, 200)).toBe(100)
  })

  it('ignores non-positive spec widths (0 is not a sizing directive)', () => {
    expect(deriveWidthPct('', 400, 0)).toBe(100)
    expect(deriveWidthPct('', 400, -5)).toBe(100)
  })
})
