/**
 * renderFloatPos — pure float placement math tests (IT-03 FE-03).
 *
 * Guarantees under test (AC-FN-14 判据 2 / AC-NF-05):
 *  - prefer below the anchor, flip vertically / laterally when it does not fit
 *  - never overlap the anchor rect (no occlusion of anchor text)
 *  - clamp the cross axis inside the viewport
 *  - row-start placement sits fully left of the row edge (handle gutter)
 *  - below-align (image toolbar) pins left to the anchor and never side-shifts
 */
import { describe, expect, it } from 'vitest'
import {
  computeFloatPos,
  FLOAT_GAP,
  HANDLE_GAP,
  type Rect
} from './renderFloatPos'

function rect(top: number, left: number, width: number, height: number): Rect {
  return { top, left, width, height, bottom: top + height, right: left + width }
}

function overlaps(a: Rect, b: { top: number; left: number; width: number; height: number }): boolean {
  return (
    a.left < b.left + b.width &&
    b.left < a.right &&
    a.top < b.top + b.height &&
    b.top < a.bottom
  )
}

const VIEWPORT = { width: 1200, height: 800 }
const FLOAT = { width: 200, height: 80 }

describe('computeFloatPos', () => {
  it('places the float below the anchor when there is room', () => {
    const anchor = rect(100, 300, 160, 40)
    const pos = computeFloatPos(anchor, FLOAT, VIEWPORT, 'below')
    expect(pos.placement).toBe('below')
    expect(pos.top).toBe(anchor.bottom + FLOAT_GAP)
    expect(pos.left).toBe(anchor.left)
  })

  it('flips above when the float does not fit below', () => {
    const anchor = rect(720, 300, 160, 40) // bottom 760, viewport 800
    const pos = computeFloatPos(anchor, FLOAT, VIEWPORT, 'below')
    expect(pos.placement).toBe('above')
    expect(pos.top + FLOAT.height).toBe(anchor.top - FLOAT_GAP)
  })

  it('flips to the right side when neither below nor above fits', () => {
    const anchor = rect(40, 300, 160, 720) // spans nearly the whole viewport height
    const pos = computeFloatPos(anchor, FLOAT, VIEWPORT, 'below')
    expect(pos.placement).toBe('beside-right')
    expect(pos.left).toBe(anchor.right + FLOAT_GAP)
    expect(pos.top).toBe(anchor.top)
  })

  it('flips to the left side when the right side overflows the viewport', () => {
    const anchor = rect(40, 1000, 160, 720) // no vertical room, right edge 1160 of 1200
    const pos = computeFloatPos(anchor, FLOAT, VIEWPORT, 'below')
    expect(pos.placement).toBe('beside-left')
    expect(pos.left + FLOAT.width).toBe(anchor.left - FLOAT_GAP)
  })

  it('never overlaps the anchor rect for every placement it can pick', () => {
    const cases = [
      rect(100, 300, 160, 40),
      rect(720, 300, 160, 40),
      rect(380, 300, 160, 400),
      rect(380, 1000, 160, 400),
      rect(20, 20, 100, 40),
      rect(740, 20, 100, 40)
    ]
    for (const anchor of cases) {
      const pos = computeFloatPos(anchor, FLOAT, VIEWPORT, 'below')
      const placed = rect(pos.top, pos.left, FLOAT.width, FLOAT.height)
      expect(overlaps(anchor, placed), `anchor ${JSON.stringify(anchor)}`).toBe(false)
    }
  })

  it('clamps the left edge inside the viewport when the anchor hangs past it', () => {
    const anchor = rect(100, -20, 80, 40)
    const pos = computeFloatPos(anchor, FLOAT, VIEWPORT, 'below')
    expect(pos.left).toBeGreaterThanOrEqual(0)
    expect(pos.left).toBe(Math.min(Math.max(anchor.left, 0), VIEWPORT.width - FLOAT.width))
  })

  it('clamps the top edge inside the viewport for side placements', () => {
    const anchor = rect(-20, 300, 160, 820) // no vertical room, sticks out the top
    const pos = computeFloatPos(anchor, FLOAT, VIEWPORT, 'below')
    expect(pos.placement).toBe('beside-right')
    expect(pos.top).toBe(0)
  })

  it('below-align: sits under the anchor with its left edge on the anchor left edge', () => {
    const anchor = rect(100, 328, 769, 200)
    const pos = computeFloatPos(anchor, FLOAT, VIEWPORT, 'below-align')
    expect(pos.placement).toBe('below')
    expect(pos.top).toBe(anchor.bottom + FLOAT_GAP)
    expect(pos.left).toBe(anchor.left)
  })

  it('below-align: flips above when there is no room below but keeps the anchor left edge', () => {
    const anchor = rect(300, 328, 769, 460) // bottom 760 of 800
    const pos = computeFloatPos(anchor, FLOAT, VIEWPORT, 'below-align')
    expect(pos.placement).toBe('above')
    expect(pos.top + FLOAT.height).toBe(anchor.top - FLOAT_GAP)
    expect(pos.left).toBe(anchor.left)
  })

  it('below-align: a viewport-filling image never side-shifts onto the sidebar (r2 N1)', () => {
    // Mirrors the replica-review r2 frame: image spans almost the whole
    // viewport height at the content column (x≈328) — below and above both
    // fail to fit, yet the float must stay on the anchor left edge.
    const anchor = rect(40, 328, 769, 720)
    const pos = computeFloatPos(anchor, { width: 290, height: 36 }, VIEWPORT, 'below-align')
    expect(pos.placement).toBe('above')
    expect(pos.left).toBe(328)
  })

  it('below-align: an anchor hanging past the right edge still pins left to the anchor', () => {
    const anchor = rect(100, 1100, 80, 40)
    const pos = computeFloatPos(anchor, FLOAT, VIEWPORT, 'below-align')
    expect(pos.left).toBe(anchor.left)
    expect(pos.placement).toBe('below')
  })

  it('places a row-start handle fully left of the row edge (handle gutter)', () => {
    const anchor = rect(300, 400, 500, 22)
    const pos = computeFloatPos(anchor, { width: 22, height: 22 }, VIEWPORT, 'row-start')
    expect(pos.placement).toBe('row-start')
    expect(pos.top).toBe(anchor.top)
    expect(pos.left + 22).toBeLessThanOrEqual(anchor.left)
    expect(anchor.left - (pos.left + 22)).toBeLessThanOrEqual(HANDLE_GAP)
  })

  it('keeps a row-start handle on screen even when the row hugs the left edge', () => {
    const anchor = rect(300, 0, 500, 22)
    const pos = computeFloatPos(anchor, { width: 22, height: 22 }, VIEWPORT, 'row-start')
    expect(pos.left).toBeGreaterThanOrEqual(0)
    expect(pos.top).toBe(anchor.top)
  })
})
