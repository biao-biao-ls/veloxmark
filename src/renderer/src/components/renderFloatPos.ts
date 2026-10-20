
export const FLOAT_GAP = 8

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
