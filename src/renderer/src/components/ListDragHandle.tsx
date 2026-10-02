/**
 * IT-03 FE-06 — list row drag handle (ren-list:drag-handle).
 *
 * Structure per ui_06 block C:
 *   .cm-md-drag-handle        ⠿ accent block at the row start (hover-surfaced)
 *     .is-disabled            single-line list — gray, not draggable
 *   .cm-md-drop-indicator     2px insert line between rows while dragging
 *   .cm-md-drag-ghost         dragged item text riding the pointer
 *
 * Show/hide is owned entirely by the FE-03 hoverDiscipline bus (this module
 * registers its content via registerHoverContent; the handle itself only
 * pins/unpins around the drag session so it cannot vanish mid-drag). No
 * self-written show/hide timers.
 *
 * Commit path: dropListMove (editor/listDrag) — read-only gate (AC-ERR-08),
 * one region replace = one Ctrl+Z (AC-OP-16), toast receipt
 * `render.toast.listMoved`. A no-op drop commits nothing and stays silent.
 * Task-item checkboxes are NOT handled here (ren-task:check lives on
 * TaskWidget — light toggle, no toast, PEND-15).
 */
import { type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import { EditorView } from '@codemirror/view'
import {
  canReorderListItem,
  docLines,
  dropListMove,
  lineAtRow,
  listDragSessionStep,
  planListMove,
  type ListPlacement
} from '../editor/listDrag'
import { hoverDiscipline, HOVER_CHANNELS } from '../hooks/useHoverDiscipline'
import { t } from '../i18n'
import { registerHoverContent } from './RenderFloat'

const CHANNEL = HOVER_CHANNELS.listHandle

/** Ghost rides slightly below-right of the pointer (never under the cursor). */
const GHOST_OFFSET_X = 8
const GHOST_OFFSET_Y = 6

function handleMeta(anchor: HTMLElement): {
  view: EditorView
  fromLine: number
  draggable: boolean
} | null {
  const view = EditorView.findFromDOM(anchor)
  if (!view) return null
  const fromLine = lineAtRow(view, anchor)
  if (fromLine === null) return null
  return { view, fromLine, draggable: canReorderListItem(docLines(view), fromLine) }
}

interface DropTarget {
  toLine: number
  placement: ListPlacement
}

function targetAt(view: EditorView, x: number, y: number): DropTarget | null {
  const pos = view.posAtCoords({ x, y })
  if (pos == null) return null
  const lineInfo = view.state.doc.lineAt(pos)
  const top = view.coordsAtPos(lineInfo.from)?.top ?? y
  const bottom = view.coordsAtPos(lineInfo.to)?.bottom ?? top
  return { toLine: lineInfo.number - 1, placement: y < (top + bottom) / 2 ? 'before' : 'after' }
}

function indicatorStyle(
  view: EditorView,
  line: number,
  mode: 'before' | 'after',
  rowRect: DOMRect
): { top: number; left: number; width: number } {
  const docLine = view.state.doc.line(line + 1)
  const coords =
    mode === 'before' ? view.coordsAtPos(docLine.from) : view.coordsAtPos(docLine.to)
  const top = mode === 'before' ? (coords?.top ?? rowRect.top) : (coords?.bottom ?? rowRect.bottom)
  return { top: top - 1, left: rowRect.left, width: Math.max(0, rowRect.width) }
}

/**
 * Pointer drag session. Synchronous from pointerdown (the read-only gate runs
 * at commit, mirroring ImageEditFloat's resize session): pin → ghost + insert
 * line follow the pointer → Esc cancels → pointerup re-plans live and commits.
 *
 * Session integrity (FE-06 fix-cr): the handle owns the gesture via pointer
 * capture (table/widget.ts grip-resize convention) so a release outside the
 * window still reaches us; `listDragSessionStep` is the single decision point
 * — any interrupted release (buttons already 0 on move / pointercancel /
 * window blur) cleans up and never calls `dropListMove`. Commit rights belong
 * to pointerup alone; Esc aborts like an interrupt.
 */
function startListDrag(anchor: HTMLElement, view: EditorView, fromLine: number, e: ReactPointerEvent): void {
  const handleEl = e.currentTarget as HTMLElement | null
  const pointerId = e.pointerId
  // Pointer capture keeps the gesture owned by the handle even when the cursor
  // leaves the window (table/widget.ts grip-resize convention).
  try {
    if (typeof pointerId === 'number') handleEl?.setPointerCapture(pointerId)
  } catch {
    // synthetic/probe events may lack capture — window listeners cover them
  }
  const rowRect = anchor.getBoundingClientRect()
  const ghost = document.createElement('div')
  ghost.className = 'cm-md-drag-ghost'
  ghost.setAttribute('data-testid', 'list-drag-ghost')
  ghost.textContent = (anchor.textContent ?? '').trim()
  const indicator = document.createElement('div')
  indicator.className = 'cm-md-drop-indicator'
  indicator.setAttribute('data-testid', 'list-drop-indicator')
  document.body.append(ghost, indicator)

  let target: DropTarget = { toLine: fromLine, placement: 'after' }
  let finished = false
  // FE-06 review perf: row snapshot once per session (the doc cannot change
  // mid-gesture) + rAF-coalesced placement — commit still re-plans live in
  // dropListMove, so a mid-drag document edit can never be latched in.
  const lines = docLines(view)
  let frame = 0
  let queued: { x: number; y: number } | null = null

  const place = (x: number, y: number): void => {
    ghost.style.left = `${x + GHOST_OFFSET_X}px`
    ghost.style.top = `${y + GHOST_OFFSET_Y}px`
    const hit = targetAt(view, x, y)
    if (hit) target = hit
    const plan = planListMove(lines, fromLine, target.toLine, target.placement)
    if (!plan) return
    const pos = indicatorStyle(view, plan.indicator.line, plan.indicator.mode, rowRect)
    indicator.style.top = `${pos.top}px`
    indicator.style.left = `${pos.left}px`
    indicator.style.width = `${pos.width}px`
    indicator.style.display = 'block'
  }

  /** At most one re-plan per animation frame — pointermove stays cheap. */
  const schedulePlace = (x: number, y: number): void => {
    queued = { x, y }
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      const next = queued
      queued = null
      if (next && !finished) place(next.x, next.y)
    })
  }

  const cleanup = (): void => {
    if (finished) return
    finished = true
    if (frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    queued = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onInterrupt)
    window.removeEventListener('blur', onInterrupt)
    window.removeEventListener('keydown', onKeydown, true)
    try {
      // Guard: capture may already be gone with the pointer.
      if (typeof pointerId === 'number' && handleEl?.hasPointerCapture(pointerId)) {
        handleEl.releasePointerCapture(pointerId)
      }
    } catch {
      // capture may already be released
    }
    ghost.remove()
    indicator.remove()
    hoverDiscipline.unpin(CHANNEL)
    // The committed edit rebuilds line DOM under the anchor — collapse the
    // channel instead of leaving a handle glued to a detached row.
    hoverDiscipline.hideNow(CHANNEL)
  }

  const onMove = (ev: PointerEvent): void => {
    // Release-outside-window / capture loss: buttons already 0 on a move —
    // abort + cleanup, never commit to a stale drop target (listDragSessionStep).
    if (listDragSessionStep('move', ev.buttons).type === 'finish') {
      cleanup()
      return
    }
    schedulePlace(ev.clientX, ev.clientY)
  }
  const onUp = (ev: PointerEvent): void => {
    if (finished) return
    const hit = targetAt(view, ev.clientX, ev.clientY)
    if (hit) target = hit
    const { toLine, placement } = target
    const step = listDragSessionStep('up', ev.buttons)
    cleanup()
    // commit=true only for pointerup — interrupts never write back.
    if (step.commit) void dropListMove(view, fromLine, toLine, placement)
  }
  const onInterrupt = (): void => {
    // pointercancel / window blur — same as Esc: teardown, no document write.
    cleanup()
  }
  const onKeydown = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Escape') return
    ev.stopPropagation()
    cleanup()
  }

  hoverDiscipline.pin(CHANNEL)
  place(e.clientX, e.clientY)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onInterrupt)
  window.addEventListener('blur', onInterrupt)
  window.addEventListener('keydown', onKeydown, true)
}

function ListDragHandle({ anchor }: { anchor: HTMLElement }): ReactElement {
  const meta = handleMeta(anchor)
  const draggable = meta?.draggable ?? false
  const label = t('render.list.dragHandle')

  const onPointerDown = (e: ReactPointerEvent<HTMLSpanElement>): void => {
    // Keep CM from moving the cursor / starting a text selection mid-drag.
    e.preventDefault()
    e.stopPropagation()
    if (!meta || !draggable) return
    startListDrag(anchor, meta.view, meta.fromLine, e)
  }

  return (
    <span
      className={draggable ? 'cm-md-drag-handle' : 'cm-md-drag-handle is-disabled'}
      data-testid="list-drag-handle"
      data-disabled={draggable ? undefined : 'true'}
      title={label}
      aria-label={label}
      aria-disabled={draggable ? undefined : true}
      onPointerDown={onPointerDown}
    >
      ⠿
    </span>
  )
}

// FE-06 registration: one content source for the list-handle channel. The
// host (FE-03) owns mounting; this side effect only fills the slot.
registerHoverContent(CHANNEL, (anchor) => <ListDragHandle anchor={anchor} />)
