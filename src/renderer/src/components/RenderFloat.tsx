/**
 * RenderFloat — shared overlay shell + hover-channel host for render-zone
 * hover chrome (IT-03 FE-03, contract ren-hover:discipline).
 *
 * Shell: absolutely out-of-flow (position: fixed) overlay pinned to its anchor,
 * placement computed by renderFloatPos (below → above → side flip, never
 * covering the anchor text). Show/hide is owned entirely by the
 * useHoverDiscipline base — this file holds no debounce timers.
 *
 * Host: RenderFloatHost subscribes to the hoverDiscipline singleton bus and
 * renders the active channel's content. FE-04/FE-05/FE-06 plug their real UI
 * in via registerHoverContent(id, render) from their component module top
 * level (one side-effect import line in App.tsx if needed) — do NOT mount a
 * second host or hand-write setTimeout for show/hide.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode
} from 'react'
import {
  hoverDiscipline,
  HOVER_CHANNELS,
  type HoverChannelId
} from '../hooks/useHoverDiscipline'
import { computeFloatPos, type FloatKind } from './renderFloatPos'
import { t } from '../i18n'

/** Content renderer for one hover channel; receives the live anchor element. */
export type HoverContentRender = (anchor: HTMLElement) => ReactNode

const hoverContents = new Map<string, HoverContentRender>()

/**
 * Register (or with null, unregister) the UI rendered for a hover channel.
 * Only one content source per channel — registering replaces the built-in
 * placeholder. Show/hide timing stays with the shared base either way.
 */
export function registerHoverContent(
  id: HoverChannelId | string,
  render: HoverContentRender | null
): void {
  if (render === null) hoverContents.delete(id)
  else hoverContents.set(id, render)
}

export interface RenderFloatProps {
  anchor: HTMLElement
  kind?: FloatKind
  /** When set, pointer enter/leave on the overlay suspends/resumes hide. */
  channelId?: string
  testId?: string
  className?: string
  children: ReactNode
}

/**
 * Positioning shell. Re-places on viewport resize and on any scroll (capture
 * phase catches the editor scroller). Out of document flow — rendering it
 * never displaces body content (AC-NF-05).
 */
export function RenderFloat({
  anchor,
  kind = 'below',
  channelId,
  testId,
  className,
  children
}: RenderFloatProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  const place = useCallback(() => {
    const el = ref.current
    if (!el || !anchor.isConnected) return
    const anchorRect = anchor.getBoundingClientRect()
    const floatRect = el.getBoundingClientRect()
    const pos = computeFloatPos(
      anchorRect,
      { width: floatRect.width, height: floatRect.height },
      { width: window.innerWidth, height: window.innerHeight },
      kind
    )
    el.style.top = `${pos.top}px`
    el.style.left = `${pos.left}px`
    el.style.visibility = 'visible'
  }, [anchor, kind])

  // Position before paint so the first visible frame is already anchored.
  useLayoutEffect(() => {
    place()
  }, [place])

  useEffect(() => {
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [place])

  return (
    <div
      ref={ref}
      className={className ? `render-float ${className}` : 'render-float'}
      data-testid={testId ?? 'render-float'}
      style={{ visibility: 'hidden' }}
      onPointerEnter={channelId ? () => hoverDiscipline.retain(channelId) : undefined}
      onPointerLeave={channelId ? () => hoverDiscipline.release(channelId) : undefined}
    >
      {children}
    </div>
  )
}

/** Built-in chrome shown until a channel registers its own content. */
function DefaultListHandle() {
  const label = t('render.list.dragHandle')
  return (
    <span
      className="cm-md-drag-handle"
      data-testid="list-drag-handle"
      title={label}
      aria-label={label}
    >
      ⠿
    </span>
  )
}

function DefaultFloatSlot({ testId }: { testId: string }) {
  return (
    <div className="cm-md-float" data-testid={testId}>
      <span className="cm-md-float-slot" aria-hidden="true">
        ⋯
      </span>
    </div>
  )
}

function defaultContent(id: string): ReactNode {
  if (id === HOVER_CHANNELS.listHandle) return <DefaultListHandle />
  return (
    <DefaultFloatSlot
      testId={id === HOVER_CHANNELS.imageFloat ? 'image-edit-float' : 'link-hover-float'}
    />
  )
}

function channelKind(id: string): FloatKind {
  if (id === HOVER_CHANNELS.listHandle) return 'row-start'
  // Image edit toolbar (ui_06 block A): hug the image's left edge — vertical
  // below→above only, never the side-flip ladder (FE-04 r2 N1).
  if (id === HOVER_CHANNELS.imageFloat) return 'below-align'
  return 'below'
}

/**
 * Single host for all render-zone hover chrome. Mount once at the app root.
 * At most one channel is ever visible (enforced by the discipline core).
 */
export function RenderFloatHost() {
  const active = useSyncExternalStore(
    hoverDiscipline.subscribe,
    hoverDiscipline.getSnapshot,
    hoverDiscipline.getSnapshot
  ).active

  // Row hover hint shares the discipline debounce (ui_06 block C row backdrop).
  useEffect(() => {
    const row = active && active.id === HOVER_CHANNELS.listHandle ? active.anchor : null
    if (!row) return
    row.classList.add('cm-md-list-hover')
    return () => row.classList.remove('cm-md-list-hover')
  }, [active])

  // Esc hush (AC-FN-21) is owned by useHushLayer (FE-09): its collapseChrome
  // hook calls hoverDiscipline.hideAllNow(). The interim document listener that
  // used to live here is removed — one consumer, no double-trigger.

  if (!active) return null

  const custom = hoverContents.get(active.id)
  return (
    <RenderFloat
      anchor={active.anchor}
      kind={channelKind(active.id)}
      channelId={active.id}
      testId="render-float"
    >
      {custom ? custom(active.anchor) : defaultContent(active.id)}
    </RenderFloat>
  )
}
