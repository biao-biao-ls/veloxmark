/**
 * Pure placement math for render-zone hover floats (IT-03 FE-03).
 *
 * Used by RenderFloat to pin an overlay to its anchor without ever covering
 * the anchor text (AC-FN-14) and without taking up document flow (AC-NF-05
 * zero displacement — callers position the overlay absolutely/fixed).
 *
 * Placement ladder for `kind: 'below'`:
 *   below → above → beside-right → beside-left
 * `kind: 'row-start'` always sits in the row-start gutter (list drag handle).
 * `kind: 'below-align'` (image edit toolbar, ui_06 block A「图下方贴附，左缘对齐
 * 图像」) is vertical-only: below when there is room, else flip above — the
 * cross axis is ALWAYS the anchor's left edge, never a side shift (IT-03 FE-04
 * replica-review r2 N1: a viewport-filling image used to fall through the
 * ladder to beside-left and slide the toolbar over the sidebar).
 */

/** Below/above gap between anchor edge and float edge (CSS --space-2 sibling). */
export const FLOAT_GAP = 8

/** Row-edge gap for the row-start handle (CSS --space-1 sibling). */
export const HANDLE_GAP = 4

export type FloatKind = 'below' | 'row-start' | 'below-align'

export type FloatPlacement = 'below' | 'above' | 'beside-right' | 'beside-left' | 'row-start'

export interface Rect {
  top: number
  left: number
  bottom: number
  right: number
  width: number
  height: number
}

export interface FloatSize {
  width: number
  height: number
}

export interface ViewportSize {
  width: number
  height: number
}

export interface FloatPos {
  top: number
  left: number
  placement: FloatPlacement
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Compute the overlay's top-left so it hugs the anchor without occluding it.
 * The cross axis is clamped inside the viewport; the placement axis always
 * keeps at least `gap` of clearance from the anchor rect.
 */
export function computeFloatPos(
  anchor: Rect,
  float: FloatSize,
  viewport: ViewportSize,
  kind: FloatKind = 'below',
  gap?: number
): FloatPos {
  const clearance = gap ?? (kind === 'row-start' ? HANDLE_GAP : FLOAT_GAP)
  if (kind === 'row-start') {
    const left = Math.max(0, anchor.left - float.width - clearance)
    return { top: anchor.top, left, placement: 'row-start' }
  }
  if (kind === 'below-align') {
    // Horizontal contract (ui_06 block A): left edge = anchor left edge, always.
    // Vertical is adaptive only: below when it fits, else flip above — even if
    // the flip cannot fully fit (viewport-filling image) it must never side-shift.
    const left = anchor.left
    if (viewport.height - anchor.bottom - clearance >= float.height) {
      return { top: anchor.bottom + clearance, left, placement: 'below' }
    }
    return { top: anchor.top - clearance - float.height, left, placement: 'above' }
  }

  const roomBelow = viewport.height - anchor.bottom - clearance
  const roomAbove = anchor.top - clearance
  const roomRight = viewport.width - anchor.right - clearance

  if (roomBelow >= float.height) {
    return {
      top: anchor.bottom + clearance,
      left: clamp(anchor.left, 0, Math.max(0, viewport.width - float.width)),
      placement: 'below'
    }
  }
  if (roomAbove >= float.height) {
    return {
      top: anchor.top - clearance - float.height,
      left: clamp(anchor.left, 0, Math.max(0, viewport.width - float.width)),
      placement: 'above'
    }
  }
  if (roomRight >= float.width) {
    return {
      top: clamp(anchor.top, 0, Math.max(0, viewport.height - float.height)),
      left: anchor.right + clearance,
      placement: 'beside-right'
    }
  }
  return {
    top: clamp(anchor.top, 0, Math.max(0, viewport.height - float.height)),
    left: Math.max(0, anchor.left - clearance - float.width),
    placement: 'beside-left'
  }
}
