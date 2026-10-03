import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  applyMenuKey,
  firstNavIndex,
  levelItems,
  type MenuNavState,
  type NavItemShape
} from '../editor/contextMenu/keyboardNav'
import {
  computeSubPosition,
  detectOverscrollSelection,
  focusEditorBody,
  measurePopupLayout,
  type PopupLayout
} from '../editor/contextMenu/popup'
import { hushLayers } from '../hooks/useHushLayer'
import { isDialogOverlayTarget } from './Dialog'

export interface MenuItem {
  /** Stable command id (e2e seam contract); registry-backed entries only. */
  id?: string
  /** data-testid slug for entries without a command id (submenu parents, recents). */
  testId?: string
  /** FE-01 semantic group title row (menu:ia-reorder); non-interactive. */
  groupTitle?: string
  label?: string
  shortcut?: string
  /** Full-path tooltip (used by Open Recent entries). */
  title?: string
  action?: () => void
  separator?: boolean
  disabled?: boolean
  /** P08: toggle items show a checkmark while the mode is on. */
  checked?: boolean
  /** Second-level menu (e.g. File > Open Recent); shown on hover. */
  submenu?: MenuItem[]
}

export interface MenuDef {
  /** Root menu id slug ('file' | 'edit' | …) — data-testid source. */
  id?: string
  label: string
  items: MenuItem[]
  /** FE-01#2: design `.menu-panel.is-wide` (292px) — File panel only. */
  wide?: boolean
}

/** data-testid for actionable rows: explicit testId wins, else command id. */
function itemTestId(item: MenuItem): string | undefined {
  return item.testId ?? (item.id ? `menu-item-${item.id}` : undefined)
}

/**
 * FE-04#7: submenu gap right of the parent row (ui_04 `.submenu { left:
 * calc(100% + 6px) }` — panel left edge lands ~1px outside the root panel's
 * right border). computeSubPosition takes an *overlap*, so a gap is a negative
 * overlap. The 6px strip is bridged by `.menu-sub-bridge` (hover dead zone).
 */
const SUB_GAP_X = 6

interface Props {
  menus: MenuDef[]
}

export default function MenuBar({ menus }: Props): React.JSX.Element {
  /**
   * 菜单状态机键盘侧焦点模型（menu:state-machine，FE-05）：
   * level 'root' = 全关（rootIndex 焦点根按钮）；'menu' = 一级展开；
   * 'submenu' = 子菜单展开（parentIndex 定位父行）。open/subOpen 均由此派生，
   * 鼠标 hover/click 与键盘共用同一状态 → 双通道同源（AC-RULE-09）。
   */
  const [nav, setNav] = useState<MenuNavState>({ level: 'root', rootIndex: 0, activeIndex: 0 })
  const navRef = useRef(nav)
  navRef.current = nav
  const open = nav.level === 'root' ? null : nav.rootIndex
  const subOpen = nav.level === 'submenu' ? (nav.parentIndex ?? null) : null

  /** Layout of the open root dropdown (limit-height + flip, AC-RULE-10). */
  const [layout, setLayout] = useState<PopupLayout | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const labelRefs = useRef<Array<HTMLButtonElement | null>>([])
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const rootItems = useMemo(
    () => menus.map((m) => m.items as NavItemShape[]),
    [menus]
  )

  /** Unified menu-state-machine exit (menu:state-machine). */
  const closeAll = useCallback((opts: { refocus: boolean }) => {
    setNav((n) => ({ level: 'root', rootIndex: n.rootIndex, activeIndex: n.rootIndex }))
    if (opts.refocus) focusEditorBody()
  }, [])

  /** 同一执行入口：点击与 Enter 都走这里（AC-RULE-09 同源：action→close 顺序一致）。 */
  const runItem = useCallback(
    (item: MenuItem | undefined) => {
      if (!item || item.disabled) return
      // UX-P04 F4b: run the action BEFORE closing — closing first unmounts the
      // row and resets focus to <body>, so dialog triggers can no longer
      // recapture their invoker (openExport reads document.activeElement).
      item.action?.()
      closeAll({ refocus: false })
    },
    [closeAll]
  )

  // FE-09 (glb-hush:one-shot): the open dropdown + submenu is ONE 'menu' tier
  // layer. Esc/blank via the hush bus collapses it together with other chrome;
  // the modal tier (confirm) outranks it and closes alone first (PEND-04).
  // close() skips refocus — collapseAll owns the focus-return contract.
  useEffect(() => {
    if (open === null) return
    return hushLayers.register({
      id: 'menubar-menu',
      tier: 'menu',
      close: () => closeAll({ refocus: false }),
      owns: (target) =>
        target instanceof Node && rootRef.current != null && rootRef.current.contains(target)
    })
  }, [open, closeAll])

  // Outside close paths: mousedown OR click (UX-P08 gate). Focus returns to the
  // editor body (AC-FN-10) unless the click landed on something focusable —
  // that target owns focus, stealing it would fight the click.
  useEffect(() => {
    if (open === null) return
    const closeIfOutside = (e: Event): void => {
      if (rootRef.current?.contains(e.target as Node)) return
      // FE-09 PEND-04: modal overlay owns its gestures — overlay-blank only
      // closes the confirm; lower layers yield (blank == Esc in stacking).
      if (isDialogOverlayTarget(e.target)) return
      const target = e.target as HTMLElement | null
      const targetTakesFocus =
        target != null &&
        typeof target.closest === 'function' &&
        target.closest('button,input,textarea,select,a,[contenteditable],[tabindex]') != null
      closeAll({ refocus: !targetTakesFocus })
    }
    document.addEventListener('mousedown', closeIfOutside)
    document.addEventListener('click', closeIfOutside)
    return () => {
      document.removeEventListener('mousedown', closeIfOutside)
      document.removeEventListener('click', closeIfOutside)
    }
  }, [open, closeAll])

  /**
   * 键盘遍历（FE-05 / Q8 菜单键盘化兜底）：挂在 menubar 容器上——只有焦点在
   * 菜单栏/菜单面板内（事件冒泡至此）才生效，正文方向键/Enter 不被劫持。
   * 不消费的键（Tab 等）原样放行。
   */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // FE-09: Esc is owned by the hush bus (one-shot quiet / modal topmost,
      // glb-hush:one-shot). Delegating here — instead of the keyboardNav
      // two-stage Escape — keeps a single consumer and avoids double-triggering
      // the document-level bus after this handler's stopPropagation. ← still
      // steps out of submenus one level (keyboardNav ArrowLeft path below).
      if (e.key === 'Escape') {
        if (hushLayers.consumeTop() !== 'none') {
          e.preventDefault()
          e.stopPropagation()
        }
        return
      }
      // 焦点同步兜底：React 把 focus 当连续事件异步批处理，Tab 进入后同一帧内
      // 按键会拿到旧 rootIndex。菜单全关时以 DOM 焦点所在的根按钮为准校正，
      // 保证「Tab 聚焦菜单栏 → ←/→ 开合根菜单」确定性生效；已展开时不校正
      // （hover 切根后焦点仍可能留在原按钮，键盘须跟 hover 后的可见菜单走）。
      let base = navRef.current
      if (base.level === 'root') {
        const focusedRoot = labelRefs.current.findIndex(
          (el) => el != null && el === document.activeElement
        )
        if (focusedRoot >= 0 && base.rootIndex !== focusedRoot) {
          base = { level: 'root', rootIndex: focusedRoot, activeIndex: focusedRoot }
          navRef.current = base
        }
      }
      const r = applyMenuKey(base, e.key, { focusInMenu: true, rootItems })
      if (r.state === navRef.current && r.effect === 'none') return
      e.preventDefault()
      e.stopPropagation()
      if (r.effect === 'run') {
        const item = levelItems(r.state, rootItems)[r.state.activeIndex] as MenuItem | undefined
        runItem(item)
        return
      }
      setNav(r.state)
      if (r.effect === 'close') closeAll({ refocus: true })
    },
    [rootItems, runItem, closeAll]
  )

  // Limit-height + edge-flip layout for the open dropdown (AC-RULE-10).
  // Recomputed on resize so flip direction follows the window.
  useLayoutEffect(() => {
    if (open === null) {
      setLayout(null)
      return
    }
    const panel = dropdownRef.current
    const anchor = labelRefs.current[open]
    if (!panel || !anchor) return
    const measure = (): void => {
      const a = anchor.getBoundingClientRect()
      setLayout(
        measurePopupLayout({
          anchorRect: { top: a.top, bottom: a.bottom, left: a.left, right: a.right },
          panel,
          reservedTop: rootRef.current?.getBoundingClientRect().height ?? 0
        })
      )
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  // FE-05 × FE-04 联动：限高滚动面内键盘激活项自动滚入可视区（block:nearest 语义，
  // 滚到底不越界）。只调含激活项面板自身的 scrollTop——不触发根面板 onScroll
  // 的「滚动收拢子级」路径（子面板滚动不冒泡，一级导航时 subOpen 必为 null）。
  useLayoutEffect(() => {
    if (nav.level === 'root') return
    const el = rootRef.current?.querySelector('.menu-item-active')
    const panel = el?.closest('.menu-dropdown')
    if (!(el instanceof HTMLElement) || !(panel instanceof HTMLElement)) return
    const elRect = el.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    if (elRect.top < panelRect.top) panel.scrollTop -= panelRect.top - elRect.top
    else if (elRect.bottom > panelRect.bottom) panel.scrollTop += elRect.bottom - panelRect.bottom
  }, [nav])

  // AC-FN-10 path 4 (超界滚动选择): scrolling past either edge of a
  // limit-height panel closes the menu and returns focus to the body.
  const onPanelWheel = useCallback(
    (e: React.WheelEvent<HTMLElement>): void => {
      const el = e.currentTarget
      const edge = detectOverscrollSelection({
        scrollTop: el.scrollTop,
        deltaY: e.deltaY,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight
      })
      if (edge !== 'none') closeAll({ refocus: true })
    },
    [closeAll]
  )

  /**
   * 指针打开（点击/hover 切根）——FE-04 r2「静息无预选」统一口径（两处同改）：
   * 打开即 -1 无激活项（IT-02/FE-05 元素表「初始状态: 无激活项」，设计 ui_04
   * 静息全白）；高亮只来自真实 hover（onMouseEnter→activeIndex）或键盘导航。
   * 键盘打开仍走 applyMenuKey「首项默认激活」（keyboardNav 契约，勿双标准）。
   */
  const openRoot = useCallback((i: number) => {
    setNav({ level: 'menu', rootIndex: i, activeIndex: -1 })
  }, [])

  /** 根按钮聚焦（Tab）与 hover 同步焦点模型，方向键从正确根开始。 */
  const syncRoot = useCallback(
    (i: number) => {
      const cur = navRef.current
      if (cur.level !== 'root' && cur.rootIndex !== i) {
        openRoot(i) // 已展开 → 与 hover 一致切换根菜单并保持一级展开
      } else if (cur.level === 'root') {
        setNav({ level: 'root', rootIndex: i, activeIndex: i })
      }
    },
    [openRoot]
  )

  return (
    <div className="menubar" ref={rootRef} onKeyDown={onKeyDown}>
      {/* FE-01#8 / IT-04-FE-02#1: ui_04 .menubar-brand — brand text left of the roots. */}
      <span className="menubar-brand">VeloxMark</span>
      {menus.map((menu, i) => {
        // FE-01#1: the check column is a per-panel affordance — panels with any
        // checked item (View) keep the 12px slot on every row; check-less panels
        // (File/Edit/Insert/Help) drop it so labels align with the group titles.
        const checkColumn = menu.items.some((it) => it.checked !== undefined)
        return (
        <div key={menu.label} className="menubar-root">
          <button
            ref={(el) => {
              labelRefs.current[i] = el
            }}
            className={`menubar-label${open === i ? ' menubar-open' : ''}`}
            data-testid={`menu-root-${menu.id ?? i}`}
            onClick={() => {
              if (open === i) {
                closeAll({ refocus: false })
              } else {
                openRoot(i)
              }
            }}
            onFocus={() => syncRoot(i)}
            onMouseEnter={() => {
              // classic behavior: hovering another top-level menu keeps one open
              syncRoot(i)
            }}
          >
            {menu.label}
          </button>
          {open === i && (
            <div
              ref={dropdownRef}
              className={[
                'menu-dropdown',
                menu.wide ? 'menu-dropdown--wide' : '',
                layout?.placement === 'top' ? 'menu-dropdown--up' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              style={layout ? { maxHeight: layout.maxHeight } : undefined}
              onWheel={onPanelWheel}
              onScroll={() => {
                // fixed 子面板不随根面板滚动条跟随——滚动即收拢子级（一级保持），
                // 对齐桌面菜单惯例；scroll 不冒泡，不会误伤子面板自身滚动。
                if (nav.level === 'submenu') {
                  setNav((n) => ({
                    level: 'menu',
                    rootIndex: n.rootIndex,
                    activeIndex: n.parentIndex ?? n.activeIndex
                  }))
                }
              }}
            >
              {menu.items.map((item, j) =>
                item.groupTitle !== undefined ? (
                  <div key={j} className="menu-group-title">
                    {item.groupTitle}
                  </div>
                ) : item.separator ? (
                  <div key={j} className="menu-separator" />
                ) : item.submenu ? (
                  <SubMenuHost
                    key={j}
                    item={item}
                    index={j}
                    checkColumn={checkColumn}
                    active={nav.level === 'menu' && nav.activeIndex === j}
                    open={subOpen === j}
                    onRowEnter={() => {
                      // AC-RULE-02: re-entering the parent row collapses the
                      // submenu (first level stays open); entering from another
                      // row opens this one and moves active to the first child.
                      const cur = navRef.current
                      if (cur.level === 'submenu' && cur.parentIndex === j) {
                        setNav({ level: 'menu', rootIndex: cur.rootIndex, activeIndex: j })
                      } else {
                        setNav({
                          level: 'submenu',
                          rootIndex: cur.rootIndex,
                          activeIndex: firstNavIndex(item.submenu ?? []),
                          parentIndex: j
                        })
                      }
                    }}
                    onFocusRow={() => {
                      // Tab 落到父行与 hover 同款收拢子级（否则 level 停留
                      // 'submenu'，childActive 误高亮子项、方向键在子层移动）。
                      setNav((n) => ({ level: 'menu', rootIndex: n.rootIndex, activeIndex: j }))
                    }}
                    onHostLeave={() => {
                      const cur = navRef.current
                      if (cur.level === 'submenu' && cur.parentIndex === j) {
                        setNav({ level: 'menu', rootIndex: cur.rootIndex, activeIndex: j })
                      }
                    }}
                    onOverscroll={() => closeAll({ refocus: true })}
                    onRun={runItem}
                    childActive={
                      nav.level === 'submenu' && nav.parentIndex === j ? nav.activeIndex : -1
                    }
                    onChildEnter={(k) => {
                      const cur = navRef.current
                      setNav({
                        level: 'submenu',
                        rootIndex: cur.rootIndex,
                        activeIndex: k,
                        parentIndex: j
                      })
                    }}
                  />
                ) : (
                  <button
                    key={j}
                    className={`menu-item${nav.level === 'menu' && nav.activeIndex === j ? ' menu-item-active' : ''}`}
                    title={item.title}
                    disabled={item.disabled}
                    data-testid={itemTestId(item)}
                    onFocus={() => {
                      // Tab 落到叶行同款收拢子级（与 onMouseEnter 一致）。
                      setNav((n) => ({ level: 'menu', rootIndex: n.rootIndex, activeIndex: j }))
                    }}
                    onMouseEnter={() => {
                      // hover 与键盘激活同源：进入叶行收拢子级并同步激活态
                      setNav((n) => ({ level: 'menu', rootIndex: n.rootIndex, activeIndex: j }))
                    }}
                    onClick={() => runItem(item)}
                  >
                    {checkColumn && (
                      <span className="menu-item-check">{item.checked ? '✓' : ''}</span>
                    )}
                    <span className="menu-item-label">{item.label}</span>
                    {item.shortcut && (
                      <span className="menu-item-shortcut">{item.shortcut}</span>
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>
        )
      })}
    </div>
  )
}

/**
 * An item that owns a second-level dropdown, revealed on hover or →/Enter
 * （FE-05 键盘侧同源：展开后焦点移入子菜单首项）.
 *
 * Submenu open-state lives in MenuBar (AC-RULE-02): hover parent opens, moving
 * back to the parent collapses, sibling rows collapse it, leaving the host
 * collapses it — the first-level panel never closes as a side effect. Panel
 * geometry reuses the popup base (limit-height + 边缘翻转, AC-FN-08): 贴下缘
 * 上翻、贴右缘左翻（menu-sub--flip），hover 项间移动不闪烁（面板不重挂）。
 */
function SubMenuHost({
  item,
  index,
  checkColumn,
  active,
  open,
  childActive,
  onRowEnter,
  onFocusRow,
  onHostLeave,
  onOverscroll,
  onRun,
  onChildEnter
}: {
  item: MenuItem
  index: number
  checkColumn: boolean
  active: boolean
  open: boolean
  childActive: number
  onRowEnter: () => void
  onFocusRow: () => void
  onHostLeave: () => void
  onOverscroll: () => void
  /** 同源执行入口（MenuBar runItem）：disabled-guard + action→close 顺序唯一处。 */
  onRun: (item: MenuItem | undefined) => void
  onChildEnter: (childIndex: number) => void
}): React.JSX.Element {
  const rowRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [layout, setLayout] = useState<PopupLayout | null>(null)
  /** fixed 落点（子面板逃逸根面板 overflow 裁切，computeSubPosition 同源几何）。 */
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  /** FE-04#7: hover 桥几何（gap 条 + 设计稿 1px accent 连接线，行高锚点）。 */
  const [bridge, setBridge] = useState<{
    left: number
    top: number
    width: number
    height: number
    lineY: number
  } | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setLayout(null)
      setPos(null)
      setBridge(null)
      return
    }
    const panel = panelRef.current
    const row = rowRef.current
    if (!panel || !row) return
    const measure = (): void => {
      const a = row.getBoundingClientRect()
      const next = measurePopupLayout({
        anchorRect: { top: a.top, bottom: a.bottom, left: a.left, right: a.right },
        panel,
        reservedTop: row.closest('.menubar')?.getBoundingClientRect().height ?? 0
      })
      setLayout(next)
      const panelH = Math.min(panel.scrollHeight, next.maxHeight)
      const p = computeSubPosition({
        anchorRect: { top: a.top, bottom: a.bottom, left: a.left, right: a.right },
        panelSize: { width: panel.offsetWidth, height: panelH },
        placement: next.placement,
        submenuPlacement: next.submenuPlacement,
        // ui_04 `.submenu { left: calc(100% + 6px) }` — gap, not overlap (FE-04#7).
        overlapX: -SUB_GAP_X
      })
      setPos(p)
      // Bridge strip spans the gap (7px: 1px over the row edge + 6px gap) and
      // the full row→panel vertical travel; the accent line sits at the parent
      // row's 14px mark (ui_04 .submenu-bridge top: 14px on the .mi).
      const bTop = Math.min(a.top, p.top)
      setBridge({
        left: next.submenuPlacement === 'left' ? a.left - SUB_GAP_X : a.right - 1,
        top: bTop,
        width: 7,
        height: Math.max(a.bottom, p.top + panelH) - bTop,
        lineY: a.top + 14 - bTop
      })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  const panelClass = [
    'menu-dropdown',
    'menu-sub',
    layout?.submenuPlacement === 'left' ? 'menu-sub--flip' : '',
    layout?.placement === 'top' ? 'menu-dropdown--up' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="menu-sub-host" onMouseLeave={onHostLeave}>
      <button
        ref={rowRef}
        className={`menu-item${active ? ' menu-item-active' : ''}`}
        disabled={item.disabled}
        data-testid={itemTestId(item)}
        data-menu-index={index}
        onFocus={onFocusRow}
        onMouseEnter={onRowEnter}
      >
        {checkColumn && <span className="menu-item-check">{item.checked ? '✓' : ''}</span>}
        <span className="menu-item-label">{item.label}</span>
        <span className="menu-item-shortcut">▸</span>
      </button>
      {open && (
        <div
          ref={panelRef}
          className={panelClass}
          style={
            layout && pos
              ? {
                  left: pos.left,
                  top: pos.top,
                  right: 'auto',
                  bottom: 'auto',
                  maxHeight: layout.maxHeight
                }
              : undefined
          }
          onWheel={(e) => {
            // Keep the root panel out of submenu wheel routing (bubbling would
            // let a submenu overscroll trip the root's close path).
            e.stopPropagation()
            const el = e.currentTarget
            const edge = detectOverscrollSelection({
              scrollTop: el.scrollTop,
              deltaY: e.deltaY,
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight
            })
            if (edge !== 'none') onOverscroll()
          }}
        >
          {item.submenu?.map((child, k) =>
            child.separator ? (
              <div key={k} className="menu-separator" />
            ) : (
              <button
                key={k}
                className={`menu-item${childActive === k ? ' menu-item-active' : ''}`}
                title={child.title}
                disabled={child.disabled}
                data-testid={itemTestId(child)}
                onFocus={() => onChildEnter(k)}
                onMouseEnter={() => onChildEnter(k)}
                onClick={() => onRun(child)}
              >
                <span className="menu-item-label">{child.label}</span>
                {child.shortcut && (
                  <span className="menu-item-shortcut">{child.shortcut}</span>
                )}
              </button>
            )
          )}
        </div>
      )}
      {/* FE-04#7: 6px hover bridge (DOM child of the host — pointer travel
          through the gap never fires onHostLeave) + design accent connector. */}
      {open && bridge && (
        <div
          className="menu-sub-bridge"
          aria-hidden="true"
          style={
            {
              left: bridge.left,
              top: bridge.top,
              width: bridge.width,
              height: bridge.height,
              '--bridge-line-y': `${bridge.lineY}px`
            } as React.CSSProperties
          }
        />
      )}
    </div>
  )
}
