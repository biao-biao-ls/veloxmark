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
import logoUrl from '../assets/logo.png'

export interface MenuItem {
  id?: string
  testId?: string
  groupTitle?: string
  label?: string
  shortcut?: string
  title?: string
  action?: () => void
  separator?: boolean
  disabled?: boolean
  checked?: boolean
  submenu?: MenuItem[]
}

export interface MenuDef {
  id?: string
  label: string
  items: MenuItem[]
  wide?: boolean
}

function itemTestId(item: MenuItem): string | undefined {
  return item.testId ?? (item.id ? `menu-item-${item.id}` : undefined)
}

const SUB_GAP_X = 6

interface Props {
  menus: MenuDef[]
}

export default function MenuBar({ menus }: Props): React.JSX.Element {
  const [nav, setNav] = useState<MenuNavState>({ level: 'root', rootIndex: 0, activeIndex: 0 })
  const navRef = useRef(nav)
  navRef.current = nav
  const open = nav.level === 'root' ? null : nav.rootIndex
  const subOpen = nav.level === 'submenu' ? (nav.parentIndex ?? null) : null

  const [layout, setLayout] = useState<PopupLayout | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const labelRefs = useRef<Array<HTMLButtonElement | null>>([])
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const rootItems = useMemo(
    () => menus.map((m) => m.items as NavItemShape[]),
    [menus]
  )

  const closeAll = useCallback((opts: { refocus: boolean }) => {
    setNav((n) => ({ level: 'root', rootIndex: n.rootIndex, activeIndex: n.rootIndex }))
    if (opts.refocus) focusEditorBody()
  }, [])

  const runItem = useCallback(
    (item: MenuItem | undefined) => {
      if (!item || item.disabled) return
      item.action?.()
      closeAll({ refocus: false })
    },
    [closeAll]
  )

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

  useEffect(() => {
    if (open === null) return
    const closeIfOutside = (e: Event): void => {
      if (rootRef.current?.contains(e.target as Node)) return
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

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (hushLayers.consumeTop() !== 'none') {
          e.preventDefault()
          e.stopPropagation()
        }
        return
      }
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

  const openRoot = useCallback((i: number) => {
    setNav({ level: 'menu', rootIndex: i, activeIndex: -1 })
  }, [])

  const syncRoot = useCallback(
    (i: number) => {
      const cur = navRef.current
      if (cur.level !== 'root' && cur.rootIndex !== i) {
        openRoot(i)
      } else if (cur.level === 'root') {
        setNav({ level: 'root', rootIndex: i, activeIndex: i })
      }
    },
    [openRoot]
  )

  return (
    <div className="menubar" ref={rootRef} onKeyDown={onKeyDown}>
      <span className="menubar-brand">
        <img src={logoUrl} alt="VeloxMark" width={18} height={18} draggable={false} />
      </span>
      {menus.map((menu, i) => {
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
                      setNav((n) => ({ level: 'menu', rootIndex: n.rootIndex, activeIndex: j }))
                    }}
                    onMouseEnter={() => {
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
  onRun: (item: MenuItem | undefined) => void
  onChildEnter: (childIndex: number) => void
}): React.JSX.Element {
  const rowRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [layout, setLayout] = useState<PopupLayout | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
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
        overlapX: -SUB_GAP_X
      })
      setPos(p)
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
