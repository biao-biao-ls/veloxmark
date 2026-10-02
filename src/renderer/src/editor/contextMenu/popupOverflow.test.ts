/**
 * popupOverflow — pure layout solver for AC-RULE-10 (menu:popup-overflow).
 *
 * Contract (task FE-04「期望数据」):
 *   input  { anchorRect, viewport, menuNaturalSize }
 *   output { maxHeight, placement: 'bottom'|'top', submenuPlacement: 'right'|'left' }
 *
 * Assertions pin the two flip directions (贴下缘→top, 贴右缘子菜单→left),
 * the AC-RULE-10 max-height formula (可视高 − 菜单栏高 − 边距) and the
 * overscroll-selection close trigger (AC-FN-10 path 4).
 */
import { describe, expect, it } from 'vitest'
import {
  computePopupLayout,
  computeSubPosition,
  detectOverscrollSelection,
  POPUP_EDGE_MARGIN,
  SUB_OVERLAP_X,
  SUB_OVERLAP_Y,
  type PopupLayoutInput
} from './popup'

const VIEWPORT = { width: 1280, height: 800 }

function input(overrides: Partial<PopupLayoutInput>): PopupLayoutInput {
  return {
    anchorRect: { top: 100, bottom: 132, left: 40, right: 96 },
    viewport: VIEWPORT,
    menuNaturalSize: { width: 220, height: 200 },
    ...overrides
  }
}

describe('computePopupLayout', () => {
  it('中央锚点放得下 → bottom + right，限高钳到下方可用空间', () => {
    const layout = computePopupLayout(
      input({
        anchorRect: { top: 300, bottom: 332, left: 400, right: 460 },
        menuNaturalSize: { width: 220, height: 200 },
        reservedTop: 40
      })
    )
    expect(layout.placement).toBe('bottom')
    expect(layout.submenuPlacement).toBe('right')
    // 中部锚点下方空余 460 < 规格限高 752 → 取下方空余，面板不越出视口
    expect(layout.maxHeight).toBe(VIEWPORT.height - 332 - POPUP_EDGE_MARGIN)
  })

  it('贴窗口下缘且菜单自然高度超出下方空余 → placement=top（整菜单上翻）', () => {
    const layout = computePopupLayout(
      input({
        anchorRect: { top: 700, bottom: 740, left: 100, right: 160 },
        menuNaturalSize: { width: 220, height: 400 }
      })
    )
    expect(layout.placement).toBe('top')
  })

  it('贴窗口右缘且子菜单自然宽度超出右侧空余 → submenuPlacement=left（子菜单左翻）', () => {
    const layout = computePopupLayout(
      input({
        anchorRect: { top: 200, bottom: 232, left: 1180, right: 1240 },
        menuNaturalSize: { width: 200, height: 160 }
      })
    )
    expect(layout.submenuPlacement).toBe('left')
  })

  it('视图 15 项超高（自然高 > 规格限高）→ maxHeight 封顶为规格公式值并内滚动', () => {
    const layout = computePopupLayout(
      input({
        anchorRect: { top: 8, bottom: 40, left: 20, right: 60 },
        menuNaturalSize: { width: 240, height: 620 },
        reservedTop: 40
      })
    )
    expect(layout.placement).toBe('bottom')
    expect(layout.maxHeight).toBe(VIEWPORT.height - 40 - POPUP_EDGE_MARGIN)
  })

  it('上翻后 maxHeight 钳制到上方可用空间，不越出视口上缘', () => {
    const layout = computePopupLayout(
      input({
        anchorRect: { top: 500, bottom: 540, left: 100, right: 160 },
        menuNaturalSize: { width: 220, height: 400 }
      })
    )
    // spaceBelow = 252 < 400，spaceAbove = 492 ≥ 400 → 上翻
    expect(layout.placement).toBe('top')
    expect(layout.maxHeight).toBe(500 - POPUP_EDGE_MARGIN)
    expect(layout.maxHeight).toBeLessThanOrEqual(VIEWPORT.height)
  })

  it('极窄窗 640×400（AC-ERR-09）：限高为正且不超出视口，全项经滚动可达', () => {
    const layout = computePopupLayout(
      input({
        anchorRect: { top: 4, bottom: 32, left: 8, right: 48 },
        viewport: { width: 640, height: 400 },
        menuNaturalSize: { width: 220, height: 520 },
        reservedTop: 32
      })
    )
    expect(layout.maxHeight).toBeGreaterThan(0)
    expect(layout.maxHeight).toBeLessThanOrEqual(400)
    expect(layout.maxHeight).toBe(400 - 32 - POPUP_EDGE_MARGIN)
  })

  it('两侧空余都放不下 → 选空余更大的一侧并限高滚动', () => {
    const layout = computePopupLayout(
      input({
        // 上方 492、下方 260，自然高 600 两侧都放不下 → 上翻取更大侧
        anchorRect: { top: 500, bottom: 532, left: 40, right: 96 },
        menuNaturalSize: { width: 220, height: 600 }
      })
    )
    expect(layout.placement).toBe('top')
    expect(layout.maxHeight).toBe(500 - POPUP_EDGE_MARGIN)
  })

  it('margin 可参数化（契约默认 8）', () => {
    const layout = computePopupLayout(
      input({
        anchorRect: { top: 8, bottom: 40, left: 20, right: 60 },
        menuNaturalSize: { width: 240, height: 100 },
        reservedTop: 40,
        margin: 16
      })
    )
    expect(layout.maxHeight).toBe(VIEWPORT.height - 40 - 16)
    expect(POPUP_EDGE_MARGIN).toBe(8)
  })
})

describe('detectOverscrollSelection（AC-FN-10 第四条关闭路径）', () => {
  const scrollable = { scrollHeight: 900, clientHeight: 300 }

  it('限高滚动底部边界继续向下滚 → after-end（超界滚动选择）', () => {
    expect(
      detectOverscrollSelection({ scrollTop: 600, deltaY: 120, ...scrollable })
    ).toBe('after-end')
  })

  it('顶部边界继续向上滚 → before-start（超界滚动选择）', () => {
    expect(
      detectOverscrollSelection({ scrollTop: 0, deltaY: -120, ...scrollable })
    ).toBe('before-start')
  })

  it('列表中部滚动 → none（正常内滚动，不触发关闭）', () => {
    expect(
      detectOverscrollSelection({ scrollTop: 300, deltaY: 120, ...scrollable })
    ).toBe('none')
  })

  it('未超限（内容不滚动）→ none，不误触关闭', () => {
    expect(
      detectOverscrollSelection({ scrollTop: 0, deltaY: 120, scrollHeight: 200, clientHeight: 300 })
    ).toBe('none')
  })

  it('deltaY 为 0 → none', () => {
    expect(
      detectOverscrollSelection({ scrollTop: 600, deltaY: 0, ...scrollable })
    ).toBe('none')
  })
})

describe('computeSubPosition（子面板 fixed 落点，逃逸根面板 overflow 裁切）', () => {
  const anchorRect = { top: 100, bottom: 132, left: 40, right: 260 }
  const panelSize = { width: 170, height: 200 }

  it('常规右下展开：left = 父行右缘 − 重叠，top = 父行顶 − 重叠', () => {
    const pos = computeSubPosition({
      anchorRect,
      panelSize,
      placement: 'bottom',
      submenuPlacement: 'right'
    })
    expect(pos).toEqual({
      left: anchorRect.right - SUB_OVERLAP_X,
      top: anchorRect.top - SUB_OVERLAP_Y
    })
  })

  it('左翻：left = 父行左缘 + 重叠 − 面板宽', () => {
    const pos = computeSubPosition({
      anchorRect,
      panelSize,
      placement: 'bottom',
      submenuPlacement: 'left'
    })
    expect(pos.left).toBe(anchorRect.left + SUB_OVERLAP_X - panelSize.width)
  })

  it('上翻：top = 父行底 + 重叠 − 面板高（底缘贴父行展开）', () => {
    const pos = computeSubPosition({
      anchorRect,
      panelSize,
      placement: 'top',
      submenuPlacement: 'right'
    })
    expect(pos.top).toBe(anchorRect.bottom + SUB_OVERLAP_Y - panelSize.height)
  })

  it('重叠量可参数化（hover 缝隙断链防护）', () => {
    const pos = computeSubPosition({
      anchorRect,
      panelSize,
      placement: 'bottom',
      submenuPlacement: 'right',
      overlapX: 0,
      overlapY: 0
    })
    expect(pos).toEqual({ left: anchorRect.right, top: anchorRect.top })
  })
})
