/**
 * FE-07 outline navigation domain — nav-outline:jump + nav-outline:active-follow.
 *
 * Extracted from App.tsx so the shell keeps zero jump/follow logic (CLAUDE.md
 * 2642-line debt rule): App only threads `useOutlineNav` results to Outline /
 * anchor navigation. Contract: design/api/NAV-sidebar.md §3.5.
 *
 * Disciplines encoded here:
 *  - jump = unfold path folds first (expandFolds), cursor lands on the heading,
 *    then a **smooth** centered scroll (behavior:'smooth' 口径 — CM6's
 *    EditorView.scrollIntoView is instant and must not be used for outline
 *    jumps)
 *  - jump pin / follow mutual exclusion: while the smooth-scroll animation
 *    runs, scroll/selection follow updates are ignored and active is frozen at
 *    the jump target — no flicker mid-animation; on rapid clicks the latest
 *    pin wins and settles with the last click
 *  - active follow: scroll position drives the visible-section highlight
 *    (throttled — extractOutline walks the syntax tree), selection changes keep
 *    the pre-existing cursor-follow entry
 *  - release drops the pending throttled follow run so the settled active
 *    (the jump target) survives edge clamping (jumping near the document end
 *    cannot center the heading — a stray recompute would flip active back to
 *    the previous section)
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { StateEffect, type EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { extractOutline, type OutlineItem } from '../outline/extract'
import { expandFolds, foldKey, getFoldedKeys, headingAtLine } from '../editor/livePreview/fold'
import type { ViewRef } from '../e2e/seams/types'

/** Scroll-follow recompute floor — scroll events fire far faster than this. */
export const ACTIVE_FOLLOW_THROTTLE_MS = 100

/** Safety net when `scrollend` never fires (interrupted/zero-distance scrolls). */
export const JUMP_SETTLE_FALLBACK_MS = 800

/** Scrolled distance below this means "already there" — no animation to settle. */
const JUMP_MIN_SCROLL_DELTA = 2

/**
 * Visible-section rule (AC-FN-11-1): the active heading is the last heading at
 * or before `probePos`. The region above the first heading belongs to the
 * first section (design default active = 首个可视章节项).
 */
export function pickActiveHeading(items: OutlineItem[], probePos: number): number | null {
  if (items.length === 0) return null
  let active: number = items[0].pos
  for (const item of items) {
    if (item.pos <= probePos) active = item.pos
    else break
  }
  return active
}

/**
 * Fold keys to unfold before jumping to `targetPos` (nav-outline:jump 异常场景:
 * 目标在折叠区内先自动展开). Returns the target's own key when folded plus every
 * folded ancestor — a target hidden inside a folded parent is unreachable until
 * its ancestors open. Siblings off the jump path stay folded.
 */
export function jumpExpandKeys(
  items: OutlineItem[],
  targetPos: number,
  foldedKeys: ReadonlySet<string>
): string[] {
  const idx = items.findIndex((i) => i.pos === targetPos)
  if (idx < 0) return []
  const keys: string[] = []
  const self = items[idx]
  const selfKey = foldKey(self.level, self.text)
  if (foldedKeys.has(selfKey)) keys.push(selfKey)
  // Walk backwards for the ancestor chain (strictly decreasing heading level).
  let level = self.level
  for (let j = idx - 1; j >= 0 && level > 1; j--) {
    if (items[j].level < level) {
      const key = foldKey(items[j].level, items[j].text)
      if (foldedKeys.has(key)) keys.push(key)
      level = items[j].level
    }
  }
  return keys
}

export interface ActiveFollow {
  /** Jump animation started — freeze active at `pos` until release(). */
  pin(pos: number): void
  /** Jump animation settled — resume probe follow. */
  release(): void
  isPinned(): boolean
  /** Follow update; while pinned the pinned pos wins (no flicker). */
  update(items: OutlineItem[], probePos: number): number | null
}

/**
 * Jump-pin / follow mutual exclusion state machine (pure — unit tested).
 * While pinned every update returns the pinned pos regardless of probe, so
 * intermediate scroll frames of a smooth jump never flip the highlight.
 */
export function createActiveFollow(): ActiveFollow {
  let pinnedPos: number | null = null
  return {
    pin(pos: number) {
      pinnedPos = pos
    },
    release() {
      pinnedPos = null
    },
    isPinned() {
      return pinnedPos !== null
    },
    update(items: OutlineItem[], probePos: number): number | null {
      if (pinnedPos !== null) return pinnedPos
      return pickActiveHeading(items, probePos)
    }
  }
}

export interface Throttle {
  /** Leading fire when the wait window has elapsed, else coalesce to trailing. */
  schedule(): void
  /** Drop a pending trailing run (jump settle keeps the jumped active). */
  cancel(): void
  /** Run a pending trailing run immediately. */
  flush(): void
}

/** Leading + trailing throttle with injectable timers (boundary-tested). */
export function createThrottle(fn: () => void, waitMs: number): Throttle {
  let lastRun = -Infinity
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending = false

  const run = (): void => {
    lastRun = Date.now()
    fn()
  }
  const clearPending = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    pending = false
  }

  return {
    schedule() {
      const elapsed = Date.now() - lastRun
      if (elapsed >= waitMs) {
        clearPending()
        run()
      } else if (!pending) {
        pending = true
        timer = setTimeout(() => {
          timer = undefined
          pending = false
          run()
        }, waitMs - elapsed)
      }
    },
    cancel() {
      clearPending()
    },
    flush() {
      if (!pending) return
      clearPending()
      run()
    }
  }
}

/**
 * Probe for scroll-follow: the section containing the viewport center is the
 * "current visible section". Center (not top) so a centered jump target stays
 * the active section once the animation settles.
 */
function scrollProbePos(view: EditorView): number | null {
  const scroller = view.scrollDOM
  const rect = scroller.getBoundingClientRect()
  return view.posAtCoords({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  })
}

export interface UseOutlineNavResult {
  /** Active outline row (heading start pos) — scroll-followed, pinned during jumps. */
  activePos: number | null
  /** nav-outline:jump — smooth centered jump, unfold path folds, cursor on heading. */
  jumpToHeading: (pos: number) => void
  /** Selection/tree entry — recompute active from the cursor (pre-existing App wiring). */
  updateActiveHeading: () => void
}

export function useOutlineNav({ viewRef }: { viewRef: ViewRef }): UseOutlineNavResult {
  const [activePos, setActivePos] = useState<number | null>(null)
  const followRef = useRef<ActiveFollow | null>(null)
  if (followRef.current === null) followRef.current = createActiveFollow()
  const throttleRef = useRef<Throttle | null>(null)
  if (throttleRef.current === null) {
    throttleRef.current = createThrottle(() => runFollowRef.current(), ACTIVE_FOLLOW_THROTTLE_MS)
  }
  // Jump lifecycle refs — the editor view outlives renders; settle callbacks
  // are plain timers/listeners that must see the latest jump generation.
  const jumpSeqRef = useRef(0)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const settleListenerRef = useRef<{ el: HTMLElement; fn: () => void } | null>(null)
  const runFollowRef = useRef<() => void>(() => {})

  const clearSettle = useCallback(() => {
    if (settleTimerRef.current !== undefined) {
      clearTimeout(settleTimerRef.current)
      settleTimerRef.current = undefined
    }
    const l = settleListenerRef.current
    if (l) {
      l.el.removeEventListener('scrollend', l.fn)
      settleListenerRef.current = null
    }
  }, [])

  /** Release the jump pin; drop the pending follow run (see file header). */
  const settleJump = useCallback(
    (seq: number) => {
      if (seq !== jumpSeqRef.current) return
      clearSettle()
      followRef.current?.release()
      throttleRef.current?.cancel()
    },
    [clearSettle]
  )

  const runFollow = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const probe = scrollProbePos(view)
    if (probe === null) return
    setActivePos(followRef.current!.update(extractOutline(view.state), probe))
  }, [viewRef])
  runFollowRef.current = runFollow

  const updateActiveHeading = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    // Cursor-follow entry (pre-existing behavior): the cursor's line start is
    // the probe, so a cursor on a heading line activates that heading.
    const head = view.state.selection.main.head
    const probe = view.state.doc.lineAt(head).from
    setActivePos(followRef.current!.update(extractOutline(view.state), probe))
  }, [viewRef])

  const jumpToHeading = useCallback(
    (pos: number) => {
      const view = viewRef.current
      if (!view) return
      const items = extractOutline(view.state)
      const item = headingAtLine(view.state, pos)
      // Non-heading targets (defensive) still scroll + land the cursor.
      const active = item?.pos ?? pos
      followRef.current!.pin(active)
      setActivePos(active)

      const effects: StateEffect<unknown>[] = []
      if (item) {
        const keys = jumpExpandKeys(items, item.pos, getFoldedKeys(view.state))
        if (keys.length > 0) effects.push(expandFolds.of(keys))
      }
      // Selection + unfold share one transaction so foldField's selection
      // auto-expand also covers any collapsed range still hiding the target.
      // No scrollIntoView here — the smooth scroll below owns positioning.
      view.dispatch({
        selection: { anchor: pos },
        ...(effects.length > 0 ? { effects } : {})
      })
      view.focus()

      // dispatch() has already synced the DOM (unfold included), so the
      // measure is valid immediately — no rAF hop, which would stall the jump
      // whenever the window is occluded (rAF pauses on hidden windows).
      const seq = ++jumpSeqRef.current
      clearSettle()
      const scroller = view.scrollDOM
      const coords = view.coordsAtPos(pos)
      if (!coords) {
        settleJump(seq)
        return
      }
      const rect = scroller.getBoundingClientRect()
      const blockCenter = (coords.top + coords.bottom) / 2
      const viewCenter = rect.top + rect.height / 2
      const top = Math.max(0, scroller.scrollTop + (blockCenter - viewCenter))
      if (Math.abs(top - scroller.scrollTop) < JUMP_MIN_SCROLL_DELTA) {
        settleJump(seq)
        return
      }
      scroller.scrollTo({ top, behavior: 'smooth' })
      const onEnd = (): void => settleJump(seq)
      scroller.addEventListener('scrollend', onEnd, { once: true })
      settleListenerRef.current = { el: scroller, fn: onEnd }
      settleTimerRef.current = setTimeout(() => settleJump(seq), JUMP_SETTLE_FALLBACK_MS)
    },
    [viewRef, clearSettle, settleJump]
  )

  // Scroll-follow subscription. The editor view is created by App's
  // create-editor effect in the same commit — attach on the next frame once
  // viewRef is populated, and seed the initial active (first visible section).
  useEffect(() => {
    let cancelled = false
    let raf = 0
    let attempts = 0
    let attached: { el: HTMLElement; fn: () => void } | null = null
    const onScroll = (): void => throttleRef.current?.schedule()
    const tryAttach = (): void => {
      if (cancelled) return
      const view = viewRef.current
      if (!view) {
        if (++attempts < 120) raf = requestAnimationFrame(tryAttach)
        return
      }
      view.scrollDOM.addEventListener('scroll', onScroll, { passive: true })
      attached = { el: view.scrollDOM, fn: onScroll }
      runFollowRef.current()
    }
    tryAttach()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      if (attached) attached.el.removeEventListener('scroll', attached.fn)
      throttleRef.current?.cancel()
      clearSettle()
    }
  }, [viewRef, clearSettle])

  return { activePos, jumpToHeading, updateActiveHeading }
}
