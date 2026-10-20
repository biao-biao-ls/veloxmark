import { useEffect, useMemo, useRef, useState } from 'react'
import type { OutlineItem } from '../outline/extract'
import { t } from '../i18n'
import { ChevronIcon } from './Icons'
import { resolveKey, showsFoldTriangle, toOutlineNodes } from './outlineKeys'

const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'])

interface Props {
  items: OutlineItem[]
  activePos: number | null
  onSelect: (pos: number) => void
  foldedKeys?: ReadonlySet<string>
  foldableKeys?: ReadonlySet<string>
  onToggleFold?: (pos: number, key: string) => void
}

export default function Outline({
  items,
  activePos,
  onSelect,
  foldedKeys,
  foldableKeys,
  onToggleFold
}: Props): React.JSX.Element {
  const nodes = useMemo(
    () => toOutlineNodes(items, foldedKeys ?? new Set(), foldableKeys),
    [items, foldedKeys, foldableKeys]
  )
  const [focusIndex, setFocusIndex] = useState(-1)
  const [kbdNav, setKbdNav] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const pendingFocusRef = useRef<number | null>(null)
  const activeIdx = useMemo(
    () => items.findIndex((it) => it.pos === activePos),
    [items, activePos]
  )
  const tabStop =
    focusIndex >= 0 && focusIndex < nodes.length
      ? focusIndex
      : activeIdx >= 0
        ? activeIdx
        : nodes.length > 0
          ? 0
          : -1

  useEffect(() => {
    const idx = pendingFocusRef.current
    if (idx == null) return
    const el = navRef.current?.querySelector<HTMLElement>(`[data-nav-index="${idx}"]`)
    if (!el) return
    pendingFocusRef.current = null
    el.focus()
  })

  const onOutlineKeyDown = (e: React.KeyboardEvent): void => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-nav-index]')
    if (target && NAV_KEYS.has(e.key)) setKbdNav(true)
    const cur = target ? Number(target.dataset.navIndex) : tabStop
    const result = resolveKey({ nodes, focusIndex: cur }, e.key)
    if (result.action === 'none') {
      if (nodes.length > 0 && target && NAV_KEYS.has(e.key)) e.preventDefault()
      return
    }
    e.preventDefault()
    switch (result.action) {
      case 'move': {
        pendingFocusRef.current = result.nextIndex
        setFocusIndex(result.nextIndex)
        navRef.current
          ?.querySelector<HTMLElement>(`[data-nav-index="${result.nextIndex}"]`)
          ?.scrollIntoView({ block: 'nearest' })
        break
      }
      case 'jump': {
        onSelect(items[result.nextIndex].pos)
        break
      }
      case 'collapse':
      case 'expand': {
        const node = nodes[result.nextIndex]
        onToggleFold?.(items[result.nextIndex].pos, node.id)
        break
      }
    }
  }

  if (items.length === 0) {
    return <div className="outline-empty">{t('outline.empty')}</div>
  }
  return (
    <nav
      className="outline"
      ref={navRef}
      onKeyDown={onOutlineKeyDown}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setFocusIndex(-1)
        setKbdNav(false)
        pendingFocusRef.current = null
      }}
    >
      {items.map((item, i) => {
        const key = nodes[i].id
        const folded = foldedKeys?.has(key) === true
        const triangle = showsFoldTriangle(nodes[i]) && onToggleFold !== undefined
        return (
          <button
            key={`${item.pos}-${i}`}
            data-testid={`outline-item-${i}`}
            data-nav-index={i}
            data-nav-focus={i === focusIndex ? '' : undefined}
            tabIndex={i === tabStop ? 0 : -1}
            className={`outline-item outline-l${item.level}${
              activePos === item.pos ? ' outline-active' : ''
            }${i === focusIndex && kbdNav ? ' outline-kbd-focus' : ''}`}
            onFocus={() => setFocusIndex(i)}
            onPointerDown={() => setKbdNav(false)}
            onClick={() => onSelect(item.pos)}
            title={item.text}
          >
            {triangle ? (
              <span
                data-testid={`outline-fold-${i}`}
                className={`outline-fold${folded ? ' is-folded' : ''}`}
                title={folded ? t('render.fold.expand') : t('render.fold.collapse')}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFold?.(item.pos, key)
                }}
              >
                <ChevronIcon className={folded ? undefined : 'is-open'} />
              </span>
            ) : (
              <span data-testid={`outline-fold-${i}`} className="outline-fold empty">
                ·
              </span>
            )}
            <span className="outline-title">{item.text}</span>
          </button>
        )
      })}
    </nav>
  )
}
