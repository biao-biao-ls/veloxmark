/**
 * Popup base — 限高滚动 + 边缘翻转横向能力（AC-RULE-10 / menu:popup-overflow）。
 *
 * 弹层基座纯几何：下拉/⋮/右键共用，不绑定表格（tech-design 11.2 参数化）。
 * 纯函数无 DOM 依赖 → popupOverflow.test.ts 全量断言；调用方（MenuBar /
 * EditorContextMenu）只负责量测 anchorRect/viewport/menuNaturalSize 并应用
 * 输出（maxHeight + 方向类名）。
 *
 * 契约（任务 FE-04「期望数据」）：
 *   输入  { anchorRect, viewport, menuNaturalSize }
 *   输出  { maxHeight, placement: 'bottom'|'top', submenuPlacement: 'right'|'left' }
 */

/** 弹层与窗口边缘的最小间距（AC-RULE-10「边距」）。 */
export const POPUP_EDGE_MARGIN = 8

/**
 * 限高下限：病理锚点（窗口极窄 + 锚点贴角）时保证面板仍有一条可滚动操作带，
 * 避免 maxHeight 被钳到不可操作的碎片高度。
 */
export const MIN_PANEL_MAX_HEIGHT = 96

/** 触点/父项的视口坐标矩形（DOMRect 的纯数据投影）。 */
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
  /** 触发点（根按钮 / 子菜单父行）的视口矩形。 */
  anchorRect: PopupRect
  /** 窗口可视区尺寸。 */
  viewport: PopupSize
  /** 面板自然尺寸（未限高时的宽高）。 */
  menuNaturalSize: PopupSize
  /** 视口顶部保留带高度（菜单栏）；右键等自由弹层传 0。 */
  reservedTop?: number
  /** 边缘间距，默认 POPUP_EDGE_MARGIN。 */
  margin?: number
  /** 设计稿限高上限（如表格菜单 480px）；不传则只用视口公式。 */
  maxHeightCap?: number
}

export interface PopupLayout {
  /** 面板限高（超出走内滚动，不裁切）。 */
  maxHeight: number
  /** 纵向展开方向：'bottom' 挂锚点下方，'top' 贴下缘时整面板上翻。 */
  placement: 'bottom' | 'top'
  /** 子菜单横向展开方向：'right' 常规，贴右缘时 'left' 左翻。 */
  submenuPlacement: 'right' | 'left'
}

/**
 * 解算弹层限高与展开方向。
 *
 * placement：下方放得下 → bottom；否则上方放得下 → top；都放不下取空余更大侧
 * （配合 maxHeight 限高滚动）。maxHeight 主项取规格公式「可视高 − 菜单栏高 −
 * 边距」，并钳到所选侧的可用空间（保证面板不越出视口）。
 */
export function computePopupLayout(input: PopupLayoutInput): PopupLayout {
  const margin = input.margin ?? POPUP_EDGE_MARGIN
  const reservedTop = input.reservedTop ?? 0
  const { anchorRect, viewport, menuNaturalSize, maxHeightCap } = input

  const spaceBelow = viewport.height - anchorRect.bottom - margin
  const spaceAbove = anchorRect.top - reservedTop - margin
  // AC-RULE-10 规格公式：最大高度 = 窗口可视高 − 菜单栏高 − 边距
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

/**
 * DOM 量测适配：从面板元素取自然尺寸后走纯解算（⌀ 组件各自重复量测逻辑）。
 * scrollHeight 在 max-height 裁切时仍是内容自然高，量测无需先解限。
 */
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

/** 子菜单与父行的重叠量（防 hover 缝隙断链，AC-FN-08）。 */
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

/**
 * 子菜单面板的视口落点（position: fixed 内联注入）。
 *
 * 为什么 fixed：根面板限高内滚动的 overflow 容器会裁切其 containing-block
 * 链上的 absolute 后代——子菜单挂在面板外（left:100%）时整体被裁、不可点
 * （AC-FN-08「完整展开不裁切」）。fixed 以视口为 containing block，逃逸该裁切；
 * 几何统一在此收口，MenuBar / EditorContextMenu 同源。
 */
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

/** 限高滚动中「滚动到边界继续」的超界方向（AC-FN-10 第四条关闭路径）。 */
export type OverscrollEdge = 'none' | 'before-start' | 'after-end'

export interface OverscrollInput {
  scrollTop: number
  deltaY: number
  scrollHeight: number
  clientHeight: number
}

/**
 * 超界滚动选择判定：限高滚动面板滚到边界后继续向外滚动 → 关闭路径之一。
 * 内容未超限（无可滚动）返回 'none'，不误触关闭（AC-FN-05 内滚动不受影响）。
 */
export function detectOverscrollSelection(input: OverscrollInput): OverscrollEdge {
  const { scrollTop, deltaY, scrollHeight, clientHeight } = input
  if (deltaY === 0) return 'none'
  if (scrollHeight <= clientHeight) return 'none'
  // 1px 容差吸收亚像素滚动条/缩放抖动
  if (deltaY < 0 && scrollTop <= 1) return 'before-start'
  if (deltaY > 0 && scrollTop + clientHeight >= scrollHeight - 1) return 'after-end'
  return 'none'
}

/** 关闭后焦点回正文的编辑面选择器（ctxMenuStore 焦点归还合同同源）。 */
export const EDITOR_FOCUS_SEL = '.cm-content'

/**
 * 焦点回正文（AC-FN-10：Esc/外点/超界滚动选择路径）。
 * 编辑面不存在时静默降级（欢迎页等无正文场景）。
 *
 * 外点路径有竞态：mousedown 的默认动作（目标不可聚焦时把焦点打回 body）
 * 发生在监听器之后，会抹掉同步 focus——下一拍若焦点仍在 body/documentElement
 * 则补一次；点到对话框等真焦点持有者时不抢焦点。
 */
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
