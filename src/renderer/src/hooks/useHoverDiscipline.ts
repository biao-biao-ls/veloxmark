/**
 * ren-hover:discipline — shared hover show/hide debounce base for every
 * render-zone hover control (image float, link float, list drag handle,
 * task micro-ops). FE-04/FE-05/FE-06 plug into this base and must never
 * hand-write setTimeout for show/hide.
 *
 * Discipline:
 *  - show and hide are debounced in both directions at HOVER_DELAY_MS
 *    (any per-call delayMs is clamped up to that floor)
 *  - a pending show cancelled before it fires renders nothing (rapid
 *    pass-over produces zero flashes)
 *  - hovering the float suspends the pending hide (retain/release)
 *  - pin freezes hide across drag/edit sessions; hideAllNow (Esc hush)
 *    collapses everything including pinned channels
 *  - cancelPendingShow drops a not-yet-rendered show only (press-drag 残窗);
 *    visible/pinned/retained chrome is never touched
 *  - at most one channel is visible at a time
 *  - dispose() clears every timer (unmount cleanup, zero residue)
 *
 * Bus shape follows the Dialog/ctxMenu singleton pattern: a module-level
 * `hoverDiscipline` port for imperative callers (editor hit wiring) plus a
 * `useHoverDiscipline(id)` hook backed by useSyncExternalStore.
 */
import { useSyncExternalStore } from 'react'

/** Single threshold definition — every show/hide delay clamps to this floor. */
export const HOVER_DELAY_MS = 150

/** Contract channel ids consumed by FE-04/FE-05/FE-06. */
export const HOVER_CHANNELS = {
  imageFloat: 'ren-image:edit-float',
  linkFloat: 'ren-link:hover-float',
  listHandle: 'ren-list:drag-handle'
} as const

export type HoverChannelId = (typeof HOVER_CHANNELS)[keyof typeof HOVER_CHANNELS]

export interface HoverActive<A> {
  readonly id: string
  readonly anchor: A
}

export interface HoverSnapshot<A> {
  readonly active: HoverActive<A> | null
}

export interface HoverShowOptions {
  /** Requested dwell; clamped up to HOVER_DELAY_MS. */
  delayMs?: number
}

export interface HoverDiscipline<A> {
  /** Schedule show after the debounce; same-anchor repeats keep the dwell clock. */
  show(id: string, anchor: A, opts?: HoverShowOptions): void
  /** Schedule hide after the debounce; ignored while retained or pinned. */
  hide(id: string): void
  /** Pointer entered the float — cancel any pending hide. */
  retain(id: string): void
  /** Pointer left the float — resume the hide path. */
  release(id: string): void
  /** Drag/edit session started — hide is blocked until unpin. */
  pin(id: string): void
  /** Drag/edit session finished — resume the hide path. */
  unpin(id: string): void
  /** Immediate removal (no debounce) for a single channel. */
  hideNow(id: string): void
  /**
   * Cancel a debounce-scheduled show before it ever renders (AC-FN-18 残窗:
   * a press-drag inside the same zone never fires mouseout). Show-pending
   * entries only — visible chrome keeps its hide lifecycle, and pinned /
   * retained entries are never touched (hide's pin contract holds).
   */
  cancelPendingShow(id: string): void
  /** Esc hush: collapse every channel immediately, pinned included. */
  hideAllNow(): void
  subscribe(listener: () => void): () => void
  getSnapshot(): HoverSnapshot<A>
  /** Cancel every timer and drop state (unmount cleanup). */
  dispose(): void
}

type Status = 'show-pending' | 'visible' | 'hide-pending'

interface Entry<A> {
  id: string
  anchor: A
  status: Status
  retained: boolean
  pinned: boolean
  delayMs: number
  timer: ReturnType<typeof setTimeout> | null
}

const EMPTY_SNAPSHOT: HoverSnapshot<unknown> = { active: null }

/**
 * Factory used by tests and by the module singleton. Timer primitives are the
 * platform ones so vi.useFakeTimers() can drive the machine.
 */
export function createHoverDiscipline<A = HTMLElement>(): HoverDiscipline<A> {
  const entries = new Map<string, Entry<A>>()
  const listeners = new Set<() => void>()
  let snapshot: HoverSnapshot<A> = EMPTY_SNAPSHOT as HoverSnapshot<A>

  function notify(): void {
    for (const listener of listeners) listener()
  }

  function setActive(next: HoverActive<A> | null): void {
    const current = snapshot.active
    if (current === next) return
    if (current && next && current.id === next.id && current.anchor === next.anchor) return
    if (!current && !next) return
    snapshot = { active: next }
    notify()
  }

  function clearTimer(entry: Entry<A>): void {
    if (entry.timer !== null) {
      clearTimeout(entry.timer)
      entry.timer = null
    }
  }

  function remove(id: string): void {
    const entry = entries.get(id)
    if (!entry) return
    clearTimer(entry)
    entries.delete(id)
  }

  function isOtherChannelPinned(id: string): boolean {
    for (const entry of entries.values()) {
      if (entry.id !== id && entry.pinned) return true
    }
    return false
  }

  function activate(entry: Entry<A>): void {
    entry.timer = null
    entry.status = 'visible'
    // Exclusive chrome: any other channel that is not pinned is collapsed now.
    for (const other of [...entries.keys()]) {
      if (other === entry.id) continue
      const otherEntry = entries.get(other)
      if (otherEntry && !otherEntry.pinned) remove(other)
    }
    setActive({ id: entry.id, anchor: entry.anchor })
  }

  function deactivate(id: string): void {
    remove(id)
    setActive(null)
  }

  function show(id: string, anchor: A, opts?: HoverShowOptions): void {
    if (isOtherChannelPinned(id)) return
    const delayMs = Math.max(opts?.delayMs ?? HOVER_DELAY_MS, HOVER_DELAY_MS)
    const entry = entries.get(id)
    if (!entry) {
      const fresh: Entry<A> = {
        id,
        anchor,
        status: 'show-pending',
        retained: false,
        pinned: false,
        delayMs,
        timer: null
      }
      fresh.timer = setTimeout(() => activate(fresh), delayMs)
      entries.set(id, fresh)
      return
    }
    if (entry.status === 'show-pending') {
      // Same anchor re-fire (mouseover bubbling): dwell clock keeps running.
      if (entry.anchor === anchor) return
      // Dwell target moved — restart the threshold against the new anchor.
      entry.anchor = anchor
      entry.delayMs = delayMs
      clearTimer(entry)
      entry.timer = setTimeout(() => activate(entry), delayMs)
      return
    }
    // Visible or hide-pending: cancel the pending hide and retarget if needed.
    const retargeted = entry.anchor !== anchor
    const wasHidePending = entry.status === 'hide-pending'
    clearTimer(entry)
    entry.anchor = anchor
    entry.delayMs = delayMs
    entry.status = 'visible'
    if (retargeted || wasHidePending) setActive({ id, anchor: entry.anchor })
  }

  function hide(id: string): void {
    const entry = entries.get(id)
    if (!entry) return
    if (entry.pinned || entry.retained) return
    if (entry.status === 'show-pending') {
      // Cancelled before ever showing — rapid pass-over leaves no chrome.
      remove(id)
      return
    }
    if (entry.status === 'hide-pending') return
    entry.status = 'hide-pending'
    clearTimer(entry)
    entry.timer = setTimeout(() => deactivate(id), entry.delayMs)
  }

  function retain(id: string): void {
    const entry = entries.get(id)
    if (!entry) return
    entry.retained = true
    if (entry.status === 'hide-pending') {
      clearTimer(entry)
      entry.timer = null
      entry.status = 'visible'
    }
  }

  function release(id: string): void {
    const entry = entries.get(id)
    if (!entry) return
    entry.retained = false
    hide(id)
  }

  function pin(id: string): void {
    const entry = entries.get(id)
    if (!entry) return
    entry.pinned = true
    if (entry.status === 'hide-pending') {
      clearTimer(entry)
      entry.timer = null
      entry.status = 'visible'
    }
  }

  function unpin(id: string): void {
    const entry = entries.get(id)
    if (!entry) return
    entry.pinned = false
    hide(id)
  }

  function hideNow(id: string): void {
    const entry = entries.get(id)
    if (!entry) return
    remove(id)
    // Snapshot consistency: only clear the active channel when this id WAS the
    // active one — hideNow on a non-active entry (e.g. a show-pending rival)
    // must not wipe the live channel's snapshot (API contract face).
    if (snapshot.active?.id === id) setActive(null)
  }

  function cancelPendingShow(id: string): void {
    const entry = entries.get(id)
    if (!entry) return
    if (entry.pinned || entry.retained) return
    if (entry.status !== 'show-pending') return
    remove(id)
  }

  function hideAllNow(): void {
    for (const id of [...entries.keys()]) remove(id)
    setActive(null)
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  function getSnapshot(): HoverSnapshot<A> {
    return snapshot
  }

  function dispose(): void {
    for (const entry of entries.values()) clearTimer(entry)
    entries.clear()
    setActive(null)
    listeners.clear()
  }

  return {
    show,
    hide,
    retain,
    release,
    pin,
    unpin,
    hideNow,
    cancelPendingShow,
    hideAllNow,
    subscribe,
    getSnapshot,
    dispose
  }
}

/** Singleton bus — imperative port for editor hit wiring (Dialog/ctxMenu pattern). */
export const hoverDiscipline: HoverDiscipline<HTMLElement> = createHoverDiscipline<HTMLElement>()

export interface HoverChannelState {
  visible: boolean
  anchor: HTMLElement | null
  retain: () => void
  release: () => void
  pin: () => void
  unpin: () => void
  hideNow: () => void
}

/** Reactive view of one channel's hover state (FE-04/FE-05/FE-06 entry point). */
export function useHoverDiscipline(id: string): HoverChannelState {
  const snapshot = useSyncExternalStore(
    hoverDiscipline.subscribe,
    hoverDiscipline.getSnapshot,
    hoverDiscipline.getSnapshot
  )
  const active = snapshot.active
  const visible = active !== null && active.id === id
  return {
    visible,
    anchor: visible ? active.anchor : null,
    retain: () => hoverDiscipline.retain(id),
    release: () => hoverDiscipline.release(id),
    pin: () => hoverDiscipline.pin(id),
    unpin: () => hoverDiscipline.unpin(id),
    hideNow: () => hoverDiscipline.hideNow(id)
  }
}
