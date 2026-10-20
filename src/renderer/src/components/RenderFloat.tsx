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

export type HoverContentRender = (anchor: HTMLElement) => ReactNode

const hoverContents = new Map<string, HoverContentRender>()

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
  channelId?: string
  testId?: string
  className?: string
  children: ReactNode
}

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
  if (id === HOVER_CHANNELS.imageFloat) return 'below-align'
  return 'below'
}

export function RenderFloatHost() {
  const active = useSyncExternalStore(
    hoverDiscipline.subscribe,
    hoverDiscipline.getSnapshot,
    hoverDiscipline.getSnapshot
  ).active

  useEffect(() => {
    const row = active && active.id === HOVER_CHANNELS.listHandle ? active.anchor : null
    if (!row) return
    row.classList.add('cm-md-list-hover')
    return () => row.classList.remove('cm-md-list-hover')
  }, [active])


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
