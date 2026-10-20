import { useCallback, useEffect, useRef, useState } from 'react'
import { StateEffect, type EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { extractOutline, type OutlineItem } from '../outline/extract'
import { expandFolds, foldKey, getFoldedKeys, headingAtLine } from '../editor/livePreview/fold'
import type { ViewRef } from '../e2e/seams/types'

export const ACTIVE_FOLLOW_THROTTLE_MS = 100

export const JUMP_SETTLE_FALLBACK_MS = 800

const JUMP_MIN_SCROLL_DELTA = 2

export function pickActiveHeading(items: OutlineItem[], probePos: number): number | null {
  if (items.length === 0) return null
  let active: number = items[0].pos
  for (const item of items) {
    if (item.pos <= probePos) active = item.pos
    else break
  }
  return active
}

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
  pin(pos: number): void
  release(): void
  isPinned(): boolean
  update(items: OutlineItem[], probePos: number): number | null
}

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
  schedule(): void
  cancel(): void
  flush(): void
}

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

function scrollProbePos(view: EditorView): number | null {
  const scroller = view.scrollDOM
  const rect = scroller.getBoundingClientRect()
  return view.posAtCoords({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  })
}

export interface UseOutlineNavResult {
  activePos: number | null
  jumpToHeading: (pos: number) => void
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
      const active = item?.pos ?? pos
      followRef.current!.pin(active)
      setActivePos(active)

      const effects: StateEffect<unknown>[] = []
      if (item) {
        const keys = jumpExpandKeys(items, item.pos, getFoldedKeys(view.state))
        if (keys.length > 0) effects.push(expandFolds.of(keys))
      }
      view.dispatch({
        selection: { anchor: pos },
        ...(effects.length > 0 ? { effects } : {})
      })
      view.focus()

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
