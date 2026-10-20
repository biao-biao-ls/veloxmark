
export const POPUP_EDGE_MARGIN = 8

export const MIN_PANEL_MAX_HEIGHT = 96

export interface PopupRect {
  top: number
  bottom: number
  left: number
  right: number
}

export interface PopupSize {
  width: number
  height: number
}

export interface PopupLayoutInput {
  anchorRect: PopupRect
  viewport: PopupSize
  menuNaturalSize: PopupSize
  reservedTop?: number
  margin?: number
  maxHeightCap?: number
}

export interface PopupLayout {
  maxHeight: number
  placement: 'bottom' | 'top'
  submenuPlacement: 'right' | 'left'
}

export function computePopupLayout(input: PopupLayoutInput): PopupLayout {
  const margin = input.margin ?? POPUP_EDGE_MARGIN
  const reservedTop = input.reservedTop ?? 0
  const { anchorRect, viewport, menuNaturalSize, maxHeightCap } = input

  const spaceBelow = viewport.height - anchorRect.bottom - margin
  const spaceAbove = anchorRect.top - reservedTop - margin
  const specMaxHeight = viewport.height - reservedTop - margin

  const placement: PopupLayout['placement'] =
    spaceBelow >= menuNaturalSize.height
      ? 'bottom'
      : spaceAbove >= menuNaturalSize.height
        ? 'top'
        : spaceBelow >= spaceAbove
          ? 'bottom'
          : 'top'
  const chosenSpace = placement === 'bottom' ? spaceBelow : spaceAbove
  const cap = maxHeightCap ?? Infinity
  const maxHeight = Math.max(MIN_PANEL_MAX_HEIGHT, Math.min(specMaxHeight, chosenSpace, cap))

  const spaceRight = viewport.width - anchorRect.right - margin
  const spaceLeft = anchorRect.left - margin
  const submenuPlacement: PopupLayout['submenuPlacement'] =
    spaceRight >= menuNaturalSize.width
      ? 'right'
      : spaceLeft >= menuNaturalSize.width
        ? 'left'
        : spaceRight >= spaceLeft
          ? 'right'
          : 'left'

  return { maxHeight, placement, submenuPlacement }
}

export function measurePopupLayout(args: {
  anchorRect: PopupRect
  panel: HTMLElement
  reservedTop?: number
  margin?: number
  maxHeightCap?: number
}): PopupLayout {
  const { anchorRect, panel, reservedTop, margin, maxHeightCap } = args
  return computePopupLayout({
    anchorRect,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    menuNaturalSize: { width: panel.offsetWidth, height: panel.scrollHeight },
    reservedTop,
    margin,
    maxHeightCap
  })
}

export const SUB_OVERLAP_X = 2
export const SUB_OVERLAP_Y = 4

export interface SubPositionInput {
  anchorRect: PopupRect
  panelSize: PopupSize
  placement: 'bottom' | 'top'
  submenuPlacement: 'right' | 'left'
  overlapX?: number
  overlapY?: number
}

export function computeSubPosition(input: SubPositionInput): { left: number; top: number } {
  const overlapX = input.overlapX ?? SUB_OVERLAP_X
  const overlapY = input.overlapY ?? SUB_OVERLAP_Y
  const { anchorRect, panelSize, placement, submenuPlacement } = input
  const left =
    submenuPlacement === 'right'
      ? anchorRect.right - overlapX
      : anchorRect.left + overlapX - panelSize.width
  const top =
    placement === 'bottom'
      ? anchorRect.top - overlapY
      : anchorRect.bottom + overlapY - panelSize.height
  return { left, top }
}

export type OverscrollEdge = 'none' | 'before-start' | 'after-end'

export interface OverscrollInput {
  scrollTop: number
  deltaY: number
  scrollHeight: number
  clientHeight: number
}

export function detectOverscrollSelection(input: OverscrollInput): OverscrollEdge {
  const { scrollTop, deltaY, scrollHeight, clientHeight } = input
  if (deltaY === 0) return 'none'
  if (scrollHeight <= clientHeight) return 'none'
  if (deltaY < 0 && scrollTop <= 1) return 'before-start'
  if (deltaY > 0 && scrollTop + clientHeight >= scrollHeight - 1) return 'after-end'
  return 'none'
}

export const EDITOR_FOCUS_SEL = '.cm-content'

export function focusEditorBody(): void {
  const el = document.querySelector<HTMLElement>(EDITOR_FOCUS_SEL)
  if (!el) return
  el.focus()
  setTimeout(() => {
    const active = document.activeElement
    if (active === document.body || active === document.documentElement) {
      el.focus()
    }
  }, 0)
}
