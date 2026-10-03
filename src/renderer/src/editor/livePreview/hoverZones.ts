/**
 * Hover hit-area wiring for render-zone chrome (IT-03 FE-03, FE-09).
 *
 * Maps pointer entry/exit on decorated hit zones to the shared
 * useHoverDiscipline show/hide base. Pure event delegation over the editor
 * DOM — no Decoration is added here, so the tree/regex pass order is
 * untouched and there is nothing viewport-scoped to manage.
 *
 * Zone precedence (innermost specific chrome wins):
 *   image wrap > link > list row
 *
 * FE-09 (AC-RULE-13 / AC-FN-18): every surfacing decision goes through
 * clickSemantics — hover never pops chrome mid-drag or while a text selection
 * exists, and a pure-selection release is the safe-select route (no edit
 * routing, no tool floats/handles/chips — drop any that raced in mid-drag).
 * Pending shows are swept at press/gesture start (I1 残窗) and the select
 * verdict hides channel-by-channel so pinned edit sessions survive (I2).
 */
import { EditorView } from '@codemirror/view'
import { hoverDiscipline, HOVER_CHANNELS } from '../../hooks/useHoverDiscipline'
import {
  hitTargetFromTarget,
  judgeClickSemantics,
  shouldCancelPendingShow
} from '../clickSemantics'
// NOTE: this file is the decoration-layer hit-area seam named by FE-09's
// handlers wiring slot (handlers.ts is the syntax handlers barrel since the
// 1D split — hit-zone wiring has lived here since FE-03).

interface HoverZone {
  id: string
  anchor: HTMLElement
}

function zoneOf(target: EventTarget | null): HoverZone | null {
  if (!(target instanceof Element)) return null
  const img = target.closest('.cm-md-image-wrap')
  // No parse result → no image float (REN disable rule).
  if (img instanceof HTMLElement && !img.classList.contains('cm-md-image-broken')) {
    return { id: HOVER_CHANNELS.imageFloat, anchor: img }
  }
  const link = target.closest('.cm-md-link')
  if (link instanceof HTMLElement) return { id: HOVER_CHANNELS.linkFloat, anchor: link }
  const row = target.closest('.cm-md-list')
  if (row instanceof HTMLElement) return { id: HOVER_CHANNELS.listHandle, anchor: row }
  return null
}

let lastPointer: { x: number; y: number } | null = null

/** Sweep every known channel's show-pending entry (I1 残窗). */
function cancelPendingShows(): void {
  for (const id of Object.values(HOVER_CHANNELS)) hoverDiscipline.cancelPendingShow(id)
}

export const hoverZonesExtension = EditorView.domEventHandlers({
  mouseover(event, view) {
    // Pure-selection protection (AC-FN-18): no tool chrome mid-drag, and none
    // while a text selection exists (copy workflow stays chrome-free). A show
    // scheduled before the gesture must die here too — pressing inside the
    // same zone never fires mouseout.
    if (
      shouldCancelPendingShow({
        buttons: event.buttons,
        selectionEmpty: view.state.selection.main.empty
      })
    ) {
      cancelPendingShows()
      return
    }
    const zone = zoneOf(event.target)
    if (!zone) return
    hoverDiscipline.show(zone.id, zone.anchor)
  },
  mousedown(event, view) {
    // I1 (AC-FN-18 残窗): hover → press → drag-select inside the same zone
    // never fires mouseout, so the dwell timer would pop chrome mid-gesture.
    // Sweep show-pending entries only — visible chrome keeps its hide/pin
    // lifecycle and cancelPendingShow never bypasses pinned/retained.
    if (
      shouldCancelPendingShow({
        buttons: event.buttons,
        selectionEmpty: view.state.selection.main.empty
      })
    ) {
      cancelPendingShows()
    }
  },
  mouseout(event) {
    const from = zoneOf(event.target)
    if (!from) return
    // Still inside the same hit zone (child element churn) — nothing left.
    const to = zoneOf(event.relatedTarget)
    if (to && to.id === from.id && to.anchor === from.anchor) return
    hoverDiscipline.hide(from.id)
  },
  mousemove(event) {
    lastPointer = { x: event.clientX, y: event.clientY }
  },
  mouseup(event, view) {
    // I4: only left-button release is the click/select gesture — right/middle
    // release must not run edit-path recovery show().
    if (event.button !== 0) return
    // Unified AC-RULE-13 adjudication at release: hit target × selection.
    const hit = hitTargetFromTarget(event.target) ?? 'text'
    const verdict = judgeClickSemantics({
      hitTarget: hit,
      selectionEmpty: view.state.selection.main.empty
    })
    if (verdict.kind === 'select') {
      // Pure-selection release is a safe action — no edit routing, no tool
      // floats/handles/chips. Drop raced-in chrome channel-by-channel via
      // hide(): show-pending dies instantly, and pinned/retained edit sessions
      // are never killed (hideAllNow's pin-killing force is reserved for the
      // Esc hush path — a drag-select release must not drop a link-edit draft).
      for (const id of Object.values(HOVER_CHANNELS)) hoverDiscipline.hide(id)
      return
    }
    // Edit-path release: post-drag recovery. While a channel is pinned,
    // releases do not schedule hides, and the pointer may end over a row that
    // never re-fired mouseover.
    if (!lastPointer) return
    const under = zoneOf(document.elementFromPoint(lastPointer.x, lastPointer.y))
    if (under) hoverDiscipline.show(under.id, under.anchor)
  }
})
