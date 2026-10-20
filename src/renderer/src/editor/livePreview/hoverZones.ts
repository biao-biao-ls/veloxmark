import { EditorView } from '@codemirror/view'
import { hoverDiscipline, HOVER_CHANNELS } from '../../hooks/useHoverDiscipline'
import {
  hitTargetFromTarget,
  judgeClickSemantics,
  shouldCancelPendingShow
} from '../clickSemantics'

interface HoverZone {
  id: string
  anchor: HTMLElement
}

function zoneOf(target: EventTarget | null): HoverZone | null {
  if (!(target instanceof Element)) return null
  const img = target.closest('.cm-md-image-wrap')
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

function cancelPendingShows(): void {
  for (const id of Object.values(HOVER_CHANNELS)) hoverDiscipline.cancelPendingShow(id)
}

export const hoverZonesExtension = EditorView.domEventHandlers({
  mouseover(event, view) {
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
    const to = zoneOf(event.relatedTarget)
    if (to && to.id === from.id && to.anchor === from.anchor) return
    hoverDiscipline.hide(from.id)
  },
  mousemove(event) {
    lastPointer = { x: event.clientX, y: event.clientY }
  },
  mouseup(event, view) {
    if (event.button !== 0) return
    const hit = hitTargetFromTarget(event.target) ?? 'text'
    const verdict = judgeClickSemantics({
      hitTarget: hit,
      selectionEmpty: view.state.selection.main.empty
    })
    if (verdict.kind === 'select') {
      for (const id of Object.values(HOVER_CHANNELS)) hoverDiscipline.hide(id)
      return
    }
    if (!lastPointer) return
    const under = zoneOf(document.elementFromPoint(lastPointer.x, lastPointer.y))
    if (under) hoverDiscipline.show(under.id, under.anchor)
  }
})
