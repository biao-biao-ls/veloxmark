import { useSyncExternalStore } from 'react'

export const HOVER_DELAY_MS = 150

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
  delayMs?: number
}

export interface HoverDiscipline<A> {
  show(id: string, anchor: A, opts?: HoverShowOptions): void
  hide(id: string): void
  retain(id: string): void
  release(id: string): void
  pin(id: string): void
  unpin(id: string): void
  hideNow(id: string): void
  cancelPendingShow(id: string): void
  hideAllNow(): void
  subscribe(listener: () => void): () => void
  getSnapshot(): HoverSnapshot<A>
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
      if (entry.anchor === anchor) return
      entry.anchor = anchor
      entry.delayMs = delayMs
      clearTimer(entry)
      entry.timer = setTimeout(() => activate(entry), delayMs)
      return
    }
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
