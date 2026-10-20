import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import {
  closeContextMenu,
  getContextMenuState,
  subscribeContextMenu
} from '../editor/contextMenu/registry'
import {
  computeSubPosition,
  detectOverscrollSelection,
  measurePopupLayout,
  POPUP_EDGE_MARGIN
} from '../editor/contextMenu/popup'
import { openActiveIndex } from '../editor/contextMenu/keyboardNav'
import type { CtxMenuItem } from '../editor/contextMenu/types'
import { hushLayers } from '../hooks/useHushLayer'
import { isDialogOverlayTarget } from './Dialog'
import { t } from '../i18n'

interface FlatEntry {
  item: CtxMenuItem
  level: 'top' | 'sub'
  parentId?: string
}

function flatten(items: CtxMenuItem[], openSub: string | null): FlatEntry[] {
  const out: FlatEntry[] = []
  for (const item of items) {
    if (item.separator || item.groupTitle !== undefined) continue
    out.push({ item, level: 'top' })
    if (item.submenu && openSub === item.id) {
      for (const child of item.submenu) {
        if (child.separator || child.groupTitle !== undefined) continue
        out.push({ item: child, level: 'sub', parentId: item.id })
      }
    }
  }
  return out
}

function ItemButton({
  item,
  active,
  onActivate,
  onHover,
  depth
}: {
  item: CtxMenuItem
  active: boolean
  onActivate: (item: CtxMenuItem) => void
  onHover: (item: CtxMenuItem) => void
  depth: number
}): ReactElement {
  const cls = [
    'velox-ctx-item',
    item.disabled ? ' velox-ctx-disabled' : '',
    item.danger ? ' velox-ctx-danger' : '',
    active ? ' velox-ctx-active' : ''
  ]
    .filter(Boolean)
    .join('')
  return (
    <button
      type="button"
      className={cls}
      data-op={item.id}
      data-depth={depth}
      disabled={item.disabled}
      role="menuitem"
      aria-disabled={item.disabled ? 'true' : undefined}
      aria-checked={item.checked != null ? !!item.checked : undefined}
      onClick={() => onActivate(item)}
      onMouseEnter={() => onHover(item)}
    >
      <span className="velox-ctx-check">{item.checked ? '✓' : ''}</span>
      <span className="velox-ctx-label">{item.label}</span>
      <span className="velox-ctx-shortcut">{item.submenu ? '▸' : (item.shortcut ?? '')}</span>
    </button>
  )
}

export function EditorContextMenuHost(): ReactElement | null {
  const state = getContextMenuState()
  const [tick, setTick] = useState(0)
  useEffect(() => subscribeContextMenu(() => setTick((n) => n + 1)), [])
  const rootRef = useRef<HTMLDivElement>(null)
  const subRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const [openSub, setOpenSub] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight?: number } | null>(null)
  const [subLayout, setSubLayout] = useState<{
    id: string
    maxHeight: number
    flipX: boolean
    flipY: boolean
    left: number
    top: number
  } | null>(null)
  const restoreFocus = useRef(false)

  const openKey = state
    ? `${state.via ?? 'pointer'}:${state.x}:${state.y}:${state.items.length}:${state.items.map((i) => i.id).join(',')}`
    : ''
  const [lastOpenKey, setLastOpenKey] = useState('')
  if (state && openKey && openKey !== lastOpenKey) {
    setLastOpenKey(openKey)
    setOpenSub(null)
    setActiveIdx(openActiveIndex(state.via ?? 'pointer', flatten(state.items, null).map((f) => f.item)))
    setSubLayout(null)
    restoreFocus.current = true
  } else if (!openKey && lastOpenKey) {
    setLastOpenKey('')
  }

  const openedAt = useRef(0)
  useEffect(() => {
    if (!state) return
    openedAt.current = performance.now()
    const onDown = (e: Event): void => {
      const target = e.target as Node | null
      if (isDialogOverlayTarget(e.target)) return
      if (rootRef.current && target && rootRef.current.contains(target)) return
      for (const el of subRefs.current.values()) {
        if (el && target && el.contains(target)) return
      }
      closeContextMenu()
    }
    const onScroll = (e: Event): void => {
      const target = e.target as Node | null
      const insideMenu =
        (rootRef.current != null && target != null && rootRef.current.contains(target)) ||
        [...subRefs.current.values()].some(
          (el) => el != null && target != null && el.contains(target)
        )
      if (insideMenu) {
        if (rootRef.current != null && target === rootRef.current) setOpenSub(null)
        return
      }
      if (performance.now() - openedAt.current < 300) return
      closeContextMenu()
    }
    const onBlurOrResize = (): void => closeContextMenu()
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('click', onDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onBlurOrResize)
    window.addEventListener('blur', onBlurOrResize)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('click', onDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onBlurOrResize)
      window.removeEventListener('blur', onBlurOrResize)
    }
  }, [state])

  useLayoutEffect(() => {
    if (!state || !rootRef.current) return
    const panel = rootRef.current
    const layout = measurePopupLayout({
      anchorRect: { top: state.y, bottom: state.y, left: state.x, right: state.x },
      panel,
      maxHeightCap: state.maxHeightCap
    })
    const width = panel.offsetWidth
    const height = Math.min(panel.scrollHeight, layout.maxHeight)
    const margin = POPUP_EDGE_MARGIN
    const left = Math.max(margin, Math.min(state.x, window.innerWidth - width - margin))
    const top =
      layout.placement === 'top'
        ? Math.max(margin, state.y - height)
        : Math.max(margin, Math.min(state.y, window.innerHeight - height - margin))
    setPos({ left, top, maxHeight: layout.maxHeight })
  }, [state, tick])

  useLayoutEffect(() => {
    if (!state || !openSub) {
      setSubLayout(null)
      return
    }
    const panel = subRefs.current.get(openSub)
    const row = rootRef.current?.querySelector<HTMLElement>(`[data-op="${openSub}"]`)
    if (!panel || !row) return
    const a = row.getBoundingClientRect()
    const anchorRect = { top: a.top, bottom: a.bottom, left: a.left, right: a.right }
    const layout = measurePopupLayout({ anchorRect, panel })
    const pos = computeSubPosition({
      anchorRect,
      panelSize: {
        width: panel.offsetWidth,
        height: Math.min(panel.scrollHeight, layout.maxHeight)
      },
      placement: layout.placement,
      submenuPlacement: layout.submenuPlacement
    })
    setSubLayout({
      id: openSub,
      maxHeight: layout.maxHeight,
      flipX: layout.submenuPlacement === 'left',
      flipY: layout.placement === 'top',
      left: pos.left,
      top: pos.top
    })
  }, [state, tick, openSub])

  useEffect(() => {
    if (state) rootRef.current?.focus({ preventScroll: true })
  }, [state, openKey])

  const runItem = useCallback((item: CtxMenuItem) => {
    if (item.disabled) return
    if (item.submenu?.length) {
      setOpenSub((cur) => (cur === item.id ? null : item.id))
      return
    }
    closeContextMenu()
    item.run?.()
  }, [])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!state) return
      const flat = flatten(state.items, openSub)
      const enabled = flat.map((entry, i) => ({ entry, i })).filter(({ entry }) => !entry.item.disabled)
      if (enabled.length === 0) {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          hushLayers.consumeTop()
        }
        return
      }
      const posIdx = enabled.findIndex(({ i }) => i === activeIdx)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        const next = enabled[posIdx === -1 ? 0 : (posIdx + 1) % enabled.length]
        setActiveIdx(next.i)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        const next = enabled[posIdx === -1 ? enabled.length - 1 : (posIdx - 1 + enabled.length) % enabled.length]
        setActiveIdx(next.i)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        const cur = flat[activeIdx]
        if (cur?.item.submenu?.length) setOpenSub(cur.item.id)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        const cur = flat[activeIdx]
        if (cur?.level === 'sub' && cur.parentId) setOpenSub(null)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        const cur = flat[activeIdx]
        if (cur) runItem(cur.item)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        hushLayers.consumeTop()
      }
    },
    [state, openSub, activeIdx, runItem]
  )

  if (!state) return null
  void tick
  const flat = flatten(state.items, openSub)

  const portalHost = document.querySelector('.app') ?? document.body
  const onPanelWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
    const el = e.currentTarget
    const edge = detectOverscrollSelection({
      scrollTop: el.scrollTop,
      deltaY: e.deltaY,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight
    })
    if (edge !== 'none') closeContextMenu()
  }

  return createPortal(
    <div
      ref={rootRef}
      className="editor-context-menu velox-ctx-menu"
      role="menu"
      tabIndex={-1}
      style={{
        left: pos?.left ?? Math.max(8, state.x),
        top: pos?.top ?? Math.max(8, state.y),
        maxHeight: pos?.maxHeight,
        visibility: pos || state ? 'visible' : 'hidden'
      }}
      onKeyDown={onKeyDown}
      onWheel={onPanelWheel}
      data-velox-ctx="root"
    >
      {state.items.map((item, idx) => {
        if (item.separator) return <div key={`sep-${item.id}-${idx}`} className="velox-ctx-sep" role="separator" />
        if (item.groupTitle !== undefined)
          return (
            <div key={`grp-${item.id}-${idx}`} className="velox-ctx-group-label" role="presentation">
              {item.groupTitle}
              {item.danger ? <span className="velox-ctx-group-badge">{t('menu.grp.dangerBadge')}</span> : null}
            </div>
          )
        const flatIdx = flat.findIndex((f) => f.level === 'top' && f.item.id === item.id)
        return (
          <div key={item.id} className="velox-ctx-row">
            <ItemButton
              item={item}
              active={flatIdx === activeIdx}
              depth={0}
              onActivate={runItem}
              onHover={(it) => {
                if (flatIdx >= 0) setActiveIdx(flatIdx)
                setOpenSub(it.submenu?.length ? it.id : openSub)
              }}
            />
            {item.submenu?.length && openSub === item.id ? (
              <div
                className={[
                  'velox-ctx-sub',
                  subLayout?.id === item.id && subLayout.flipX ? 'velox-ctx-sub--flip' : '',
                  subLayout?.id === item.id && subLayout.flipY ? 'velox-ctx-sub--up' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="menu"
                ref={(el) => {
                  subRefs.current.set(item.id, el)
                }}
                style={
                  subLayout?.id === item.id
                    ? {
                        left: subLayout.left,
                        top: subLayout.top,
                        right: 'auto',
                        bottom: 'auto',
                        maxHeight: subLayout.maxHeight
                      }
                    : undefined
                }
                onWheel={(e) => {
                  e.stopPropagation()
                  onPanelWheel(e)
                }}
              >
                {item.submenu.map((child, cidx) => {
                  if (child.separator) return <div key={`sep-${child.id}-${cidx}`} className="velox-ctx-sep" role="separator" />
                  const childFlat = flat.findIndex((f) => f.level === 'sub' && f.item.id === child.id && f.parentId === item.id)
                  return (
                    <ItemButton
                      key={child.id}
                      item={child}
                      active={childFlat === activeIdx}
                      depth={1}
                      onActivate={runItem}
                      onHover={() => {
                        if (childFlat >= 0) setActiveIdx(childFlat)
                      }}
                    />
                  )
                })}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>,
    portalHost
  )
}
