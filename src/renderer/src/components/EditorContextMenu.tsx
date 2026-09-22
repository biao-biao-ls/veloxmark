/**
 * P27 editor context-menu host — pure presentation over the registry store.
 *
 * Item → DOM contract (e2e probes key on it):
 *   .editor-context-menu.velox-ctx-menu
 *     button.velox-ctx-item[data-op="<id>"]
 *       span.velox-ctx-check (✓ when checked)
 *       span.velox-ctx-label
 *       span.velox-ctx-shortcut
 *     div.velox-ctx-sub (submenu panel, item buttons inside carry data-op too)
 *
 * Keyboard: ↑↓ move, →/Enter open submenu, ←/Esc close level, Enter runs,
 * Esc closes everything and focus returns to the editor (store contract).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import {
  closeContextMenu,
  getContextMenuState,
  subscribeContextMenu
} from '../editor/contextMenu/registry'
import type { CtxMenuItem } from '../editor/contextMenu/types'

interface FlatEntry {
  item: CtxMenuItem
  level: 'top' | 'sub'
  parentId?: string
}

function flatten(items: CtxMenuItem[], openSub: string | null): FlatEntry[] {
  const out: FlatEntry[] = []
  for (const item of items) {
    if (item.separator) continue
    out.push({ item, level: 'top' })
    if (item.submenu && openSub === item.id) {
      for (const child of item.submenu) {
        if (child.separator) continue
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
  const [activeIdx, setActiveIdx] = useState(0)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const restoreFocus = useRef(false)

  // Reset per-open transient state (new x/y/items each open replaces state).
  const openKey = state ? `${state.x}:${state.y}:${state.items.length}:${state.items.map((i) => i.id).join(',')}` : ''
  const lastKey = useRef('')
  useEffect(() => {
    if (openKey && openKey !== lastKey.current) {
      lastKey.current = openKey
      setOpenSub(null)
      setActiveIdx(0)
      setPos(null)
      restoreFocus.current = true
    } else if (!openKey) {
      lastKey.current = ''
    }
  }, [openKey])

  // Close bookkeeping — focus-return is the store's job; we only guard that
  // focus lands inside the editor when the menu had taken it.
  // Scroll closes the menu (professional convention) — but NOT within a short
  // grace window after open: centering/scrollIntoView around the right-click
  // would otherwise race the menu shut the moment it mounts.
  const openedAt = useRef(0)
  useEffect(() => {
    if (!state) return
    openedAt.current = performance.now()
    const onDown = (e: Event): void => {
      const target = e.target as Node | null
      if (rootRef.current && target && rootRef.current.contains(target)) return
      for (const el of subRefs.current.values()) {
        if (el && target && el.contains(target)) return
      }
      closeContextMenu()
    }
    const onScroll = (): void => {
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

  // Viewport clamp after items render (menu height depends on them).
  useLayoutEffect(() => {
    if (!state || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    const margin = 8
    const left = Math.max(margin, Math.min(state.x, window.innerWidth - rect.width - margin))
    const top = Math.max(margin, Math.min(state.y, window.innerHeight - rect.height - margin))
    setPos({ left, top })
  }, [state, tick])

  // Focus the menu root so keyboard works immediately; content stays focused
  // behind us — the store returns focus to .cm-content on close.
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
          closeContextMenu()
        }
        return
      }
      const posIdx = enabled.findIndex(({ i }) => i === activeIdx)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        const next = enabled[(posIdx + 1 + enabled.length) % enabled.length]
        setActiveIdx(next.i)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        const next = enabled[(posIdx - 1 + enabled.length) % enabled.length]
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
        if (openSub) setOpenSub(null)
        else closeContextMenu()
      }
    },
    [state, openSub, activeIdx, runItem]
  )

  if (!state) return null
  void tick
  const flat = flatten(state.items, openSub)

  // Portal out of CM6-managed subtrees (widget rebuilds race React commits —
  // e2e log: removeChild NotFoundError), but keep theme-token scope: --bg/
  // --fg/--border resolve only under .app.theme-* (tokens are not on :root),
  // so a body portal renders the menu transparent/black. Mount as a direct
  // .app child instead — not CM6-managed, and .app has no transform, so
  // position:fixed stays viewport-relative.
  const portalHost = document.querySelector('.app') ?? document.body
  return createPortal(
    <div
      ref={rootRef}
      className="editor-context-menu velox-ctx-menu"
      role="menu"
      tabIndex={-1}
      style={{
        left: pos?.left ?? Math.max(8, state.x),
        top: pos?.top ?? Math.max(8, state.y),
        visibility: pos || state ? 'visible' : 'hidden'
      }}
      onKeyDown={onKeyDown}
      data-velox-ctx="root"
    >
      {state.items.map((item, idx) => {
        if (item.separator) return <div key={`sep-${item.id}-${idx}`} className="velox-ctx-sep" role="separator" />
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
                className="velox-ctx-sub"
                role="menu"
                ref={(el) => {
                  subRefs.current.set(item.id, el)
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
