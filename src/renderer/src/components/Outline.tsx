import { useEffect, useMemo, useRef, useState } from 'react'
import type { OutlineItem } from '../outline/extract'
import { t } from '../i18n'
import { resolveKey, showsFoldTriangle, toOutlineNodes } from './outlineKeys'

/** nav-keyboard:outline key set (NAV-sidebar.md 3.2 — no Home/End here). */
const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'])

interface Props {
  items: OutlineItem[]
  /** FE-07 active-follow state (useOutlineNav.activePos) — highlight source. */
  activePos: number | null
  /** FE-07 nav-outline:jump — wired to useOutlineNav.jumpToHeading via App.
   *  Enter resolves to this same path (AC-FN-11 口径: behavior = click). */
  onSelect: (pos: number) => void
  /** P18: folded heading keys (`level:text`) — drives triangle direction. */
  foldedKeys?: ReadonlySet<string>
  /** FE-08#4/FE-09#2: foldable section keys (collectFoldSections) — empty
   *  sections render the leaf "·" placeholder instead of a triangle. */
  foldableKeys?: ReadonlySet<string>
  /** P18: triangle click toggles fold only — must not move the cursor. */
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
  // FE-08 nav-keyboard:outline — roving tabindex over the flat heading list.
  // Keys resolve in outlineKeys.ts (pure); this file owns DOM focus only.
  const nodes = useMemo(
    () => toOutlineNodes(items, foldedKeys ?? new Set(), foldableKeys),
    [items, foldedKeys, foldableKeys]
  )
  const [focusIndex, setFocusIndex] = useState(-1)
  // Keyboard-modality marker for the focus ring (nav-keyboard:focus-visible):
  // the ring is keyboard-only — nav keys set it, pointer presses clear it.
  // Pairs with :focus-visible in CSS (same idiom as .filetree-kbd-focus).
  const [kbdNav, setKbdNav] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const pendingFocusRef = useRef<number | null>(null)
  const activeIdx = useMemo(
    () => items.findIndex((it) => it.pos === activePos),
    [items, activePos]
  )
  // Roving tabindex stop: explicit focus wins, else the active heading, else
  // first row — so Tab can always enter the outline (AC-FN-13 keyboard path).
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

  // Route nav keys through the pure mapper. Fires only when DOM focus is on an
  // outline row (handler lives on the nav) — body editor input is never
  // hijacked, and the empty outline binds nothing. Enter is preventDefault'd so
  // the button's synthesized click (which would double-jump) is suppressed.
  const onOutlineKeyDown = (e: React.KeyboardEvent): void => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-nav-index]')
    if (target && NAV_KEYS.has(e.key)) setKbdNav(true)
    const cur = target ? Number(target.dataset.navIndex) : tabStop
    const result = resolveKey({ nodes, focusIndex: cur }, e.key)
    if (result.action === 'none') {
      // Consume the nav key set inside a non-empty outline so arrows don't
      // rubber-band the panel; unknown keys pass through untouched.
      if (nodes.length > 0 && target && NAV_KEYS.has(e.key)) e.preventDefault()
      return
    }
    e.preventDefault()
    switch (result.action) {
      case 'move': {
        // Focus movement never jumps the body (Enter only).
        pendingFocusRef.current = result.nextIndex
        setFocusIndex(result.nextIndex)
        navRef.current
          ?.querySelector<HTMLElement>(`[data-nav-index="${result.nextIndex}"]`)
          ?.scrollIntoView({ block: 'nearest' })
        break
      }
      case 'jump': {
        // Enter = the row click path: same onSelect → jumpToHeading (FE-07).
        onSelect(items[result.nextIndex].pos)
        break
      }
      case 'collapse':
      case 'expand': {
        // ←/→ = the fold-triangle click path: toggleFold only, no cursor move,
        // no toast (PEND-15). resolveKey only emits when the state differs,
        // so the toggle is exactly the requested transition; useFoldSync's
        // onFoldChanged gate persists headingFolds (AC-FN-30).
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
        // Focus left the outline entirely → drop the DOM-focus mark so the
        // focus-ring presentation never leaks outside the panel.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setFocusIndex(-1)
        setKbdNav(false)
        pendingFocusRef.current = null // no latent .focus() stealing focus back
      }}
    >
      {items.map((item, i) => {
        const key = nodes[i].id
        const folded = foldedKeys?.has(key) === true
        // FE-08#4 + FE-09#2: interactive ▾/▸ only on foldable rows with
        // children; leaves and empty sections show the "·" placeholder.
        const triangle = showsFoldTriangle(nodes[i]) && onToggleFold !== undefined
        return (
          <button
            key={`${item.pos}-${i}`}
            data-testid={`outline-item-${i}`}
            data-nav-index={i}
            data-nav-focus={i === focusIndex ? '' : undefined}
            // FE-08 roving tabindex: one tab stop per outline.
            tabIndex={i === tabStop ? 0 : -1}
            className={`outline-item outline-l${item.level}${
              activePos === item.pos ? ' outline-active' : ''
            }${i === focusIndex && kbdNav ? ' outline-kbd-focus' : ''}`}
            onFocus={() => setFocusIndex(i)}
            onPointerDown={() => setKbdNav(false)}
            onClick={() => onSelect(item.pos)}
            title={item.text}
          >
            <span className="outline-lv">H{item.level}</span>
            {triangle ? (
              <span
                data-testid={`outline-fold-${i}`}
                className={`outline-fold${folded ? ' is-folded' : ''}`}
                // FE-07 UI-IXD-06: caret direction flips with the fold state;
                // titles are the frozen render.fold.* keys (body triangle shares them).
                title={folded ? t('render.fold.expand') : t('render.fold.collapse')}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFold?.(item.pos, key)
                }}
              >
                {folded ? '▸' : '▾'}
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
