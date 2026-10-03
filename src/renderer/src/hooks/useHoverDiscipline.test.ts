/**
 * useHoverDiscipline core — ren-hover:discipline contract tests (IT-03 FE-03).
 *
 * Covers the show/hide debounce state machine only (pure logic, node env):
 *  - both directions debounced at >= HOVER_DELAY_MS (clamped up)
 *  - rapid pass-over never shows (0 flash)
 *  - float hover suspends the pending hide (retain/release)
 *  - pin freezes hide for drag/edit sessions
 *  - exclusive single visible channel
 *  - timer cleanup on dispose / hideAllNow
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHoverDiscipline, HOVER_CHANNELS, HOVER_DELAY_MS } from './useHoverDiscipline'

type Anchor = string

interface Seen {
  id: string | null
  anchor: Anchor | null
}

function trackSnapshots<A>(core: ReturnType<typeof createHoverDiscipline<A>>): Seen[] {
  const seen: Seen[] = []
  core.subscribe(() => {
    const active = core.getSnapshot().active
    seen.push({ id: active?.id ?? null, anchor: (active?.anchor as A as Anchor) ?? null })
  })
  return seen
}

describe('hover discipline core (ren-hover:discipline)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows only after the HOVER_DELAY_MS dwell elapses', () => {
    const core = createHoverDiscipline<Anchor>()
    core.show(HOVER_CHANNELS.listHandle, 'row-a')
    expect(core.getSnapshot().active).toBeNull()
    vi.advanceTimersByTime(HOVER_DELAY_MS - 1)
    expect(core.getSnapshot().active).toBeNull()
    vi.advanceTimersByTime(1)
    expect(core.getSnapshot().active).toEqual({ id: HOVER_CHANNELS.listHandle, anchor: 'row-a' })
    core.dispose()
  })

  it('clamps a sub-threshold delayMs request up to HOVER_DELAY_MS', () => {
    const core = createHoverDiscipline<Anchor>()
    core.show(HOVER_CHANNELS.listHandle, 'row-a', { delayMs: 0 })
    vi.advanceTimersByTime(HOVER_DELAY_MS - 1)
    expect(core.getSnapshot().active).toBeNull()
    vi.advanceTimersByTime(1)
    expect(core.getSnapshot().active).not.toBeNull()
    core.dispose()
  })

  it('honors a delayMs request above the threshold', () => {
    const core = createHoverDiscipline<Anchor>()
    const slow = HOVER_DELAY_MS * 2
    core.show(HOVER_CHANNELS.listHandle, 'row-a', { delayMs: slow })
    vi.advanceTimersByTime(HOVER_DELAY_MS)
    expect(core.getSnapshot().active).toBeNull()
    vi.advanceTimersByTime(slow - HOVER_DELAY_MS)
    expect(core.getSnapshot().active).not.toBeNull()
    core.dispose()
  })

  it('never shows when the pointer leaves before the threshold (rapid pass = 0 flash)', () => {
    const core = createHoverDiscipline<Anchor>()
    const seen = trackSnapshots(core)
    core.show(HOVER_CHANNELS.imageFloat, 'img')
    vi.advanceTimersByTime(HOVER_DELAY_MS - 10)
    core.hide(HOVER_CHANNELS.imageFloat)
    vi.advanceTimersByTime(HOVER_DELAY_MS * 4)
    expect(core.getSnapshot().active).toBeNull()
    expect(seen).toHaveLength(0)
    core.dispose()
  })

  it('keeps chrome visible through the hide debounce, then removes it', () => {
    const core = createHoverDiscipline<Anchor>()
    core.show(HOVER_CHANNELS.listHandle, 'row-a')
    vi.advanceTimersByTime(HOVER_DELAY_MS)
    expect(core.getSnapshot().active).not.toBeNull()
    core.hide(HOVER_CHANNELS.listHandle)
    vi.advanceTimersByTime(HOVER_DELAY_MS - 1)
    expect(core.getSnapshot().active).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(core.getSnapshot().active).toBeNull()
    core.dispose()
  })

  it('cancels a pending hide when the pointer re-enters (0 flicker)', () => {
    const core = createHoverDiscipline<Anchor>()
    const seen = trackSnapshots(core)
    core.show(HOVER_CHANNELS.listHandle, 'row-a')
    vi.advanceTimersByTime(HOVER_DELAY_MS)
    core.hide(HOVER_CHANNELS.listHandle)
    vi.advanceTimersByTime(HOVER_DELAY_MS - 1)
    core.show(HOVER_CHANNELS.listHandle, 'row-a')
    vi.advanceTimersByTime(HOVER_DELAY_MS * 3)
    // never left the visible state a single time (no null-id notification)
    expect(core.getSnapshot().active).toEqual({ id: HOVER_CHANNELS.listHandle, anchor: 'row-a' })
    expect(seen.every((s) => s.id === HOVER_CHANNELS.listHandle)).toBe(true)
    core.dispose()
  })

  it('does not restart the show timer for repeated same-anchor requests', () => {
    const core = createHoverDiscipline<Anchor>()
    core.show(HOVER_CHANNELS.listHandle, 'row-a')
    vi.advanceTimersByTime(100)
    // mouseover bubbling re-fires for the same anchor — dwell clock must keep running
    core.show(HOVER_CHANNELS.listHandle, 'row-a')
    vi.advanceTimersByTime(HOVER_DELAY_MS - 100)
    expect(core.getSnapshot().active).toEqual({ id: HOVER_CHANNELS.listHandle, anchor: 'row-a' })
    core.dispose()
  })

  it('restarts the show timer when the dwell target anchor changes', () => {
    const core = createHoverDiscipline<Anchor>()
    core.show(HOVER_CHANNELS.listHandle, 'row-a')
    vi.advanceTimersByTime(100)
    core.show(HOVER_CHANNELS.listHandle, 'row-b')
    vi.advanceTimersByTime(HOVER_DELAY_MS - 100)
    // row-a's dwell must NOT have activated — the threshold restarted for row-b
    expect(core.getSnapshot().active).toBeNull()
    vi.advanceTimersByTime(100)
    expect(core.getSnapshot().active).toEqual({ id: HOVER_CHANNELS.listHandle, anchor: 'row-b' })
    core.dispose()
  })

  it('retargets visible chrome immediately when the anchor changes (row sweep, no flicker)', () => {
    const core = createHoverDiscipline<Anchor>()
    const seen = trackSnapshots(core)
    core.show(HOVER_CHANNELS.listHandle, 'row-a')
    vi.advanceTimersByTime(HOVER_DELAY_MS)
    core.show(HOVER_CHANNELS.listHandle, 'row-b')
    expect(core.getSnapshot().active).toEqual({ id: HOVER_CHANNELS.listHandle, anchor: 'row-b' })
    core.show(HOVER_CHANNELS.listHandle, 'row-c')
    expect(core.getSnapshot().active).toEqual({ id: HOVER_CHANNELS.listHandle, anchor: 'row-c' })
    vi.advanceTimersByTime(HOVER_DELAY_MS * 2)
    // retargets only — the channel never disappeared (no id going null)
    expect(seen.every((s) => s.id === HOVER_CHANNELS.listHandle)).toBe(true)
    core.dispose()
  })

  it('is exclusive: a newly activated channel collapses the previous one', () => {
    const core = createHoverDiscipline<Anchor>()
    core.show(HOVER_CHANNELS.imageFloat, 'img')
    vi.advanceTimersByTime(HOVER_DELAY_MS)
    expect(core.getSnapshot().active?.id).toBe(HOVER_CHANNELS.imageFloat)
    core.show(HOVER_CHANNELS.linkFloat, 'link')
    vi.advanceTimersByTime(HOVER_DELAY_MS)
    expect(core.getSnapshot().active).toEqual({ id: HOVER_CHANNELS.linkFloat, anchor: 'link' })
    core.dispose()
  })

  it('suspends the pending hide while the float is hovered (retain/release)', () => {
    const core = createHoverDiscipline<Anchor>()
    core.show(HOVER_CHANNELS.linkFloat, 'link')
    vi.advanceTimersByTime(HOVER_DELAY_MS)
    core.hide(HOVER_CHANNELS.linkFloat)
    vi.advanceTimersByTime(10)
    core.retain(HOVER_CHANNELS.linkFloat)
    vi.advanceTimersByTime(HOVER_DELAY_MS * 4)
    expect(core.getSnapshot().active).toEqual({ id: HOVER_CHANNELS.linkFloat, anchor: 'link' })
    core.release(HOVER_CHANNELS.linkFloat)
    vi.advanceTimersByTime(HOVER_DELAY_MS - 1)
    expect(core.getSnapshot().active).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(core.getSnapshot().active).toBeNull()
    core.dispose()
  })

  it('pin blocks hide until unpin, then hides on the debounce', () => {
    const core = createHoverDiscipline<Anchor>()
    core.show(HOVER_CHANNELS.listHandle, 'row-a')
    vi.advanceTimersByTime(HOVER_DELAY_MS)
    core.pin(HOVER_CHANNELS.listHandle)
    core.hide(HOVER_CHANNELS.listHandle)
    vi.advanceTimersByTime(HOVER_DELAY_MS * 6)
    expect(core.getSnapshot().active).toEqual({ id: HOVER_CHANNELS.listHandle, anchor: 'row-a' })
    core.unpin(HOVER_CHANNELS.listHandle)
    vi.advanceTimersByTime(HOVER_DELAY_MS - 1)
    expect(core.getSnapshot().active).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(core.getSnapshot().active).toBeNull()
    core.dispose()
  })

  it('pin keeps the channel visible even when another channel requests show', () => {
    const core = createHoverDiscipline<Anchor>()
    core.show(HOVER_CHANNELS.listHandle, 'row-a')
    vi.advanceTimersByTime(HOVER_DELAY_MS)
    core.pin(HOVER_CHANNELS.listHandle)
    core.show(HOVER_CHANNELS.imageFloat, 'img')
    vi.advanceTimersByTime(HOVER_DELAY_MS * 2)
    expect(core.getSnapshot().active?.id).toBe(HOVER_CHANNELS.listHandle)
    core.dispose()
  })

  it('hideNow removes chrome immediately and clears timers', () => {
    const core = createHoverDiscipline<Anchor>()
    core.show(HOVER_CHANNELS.imageFloat, 'img')
    vi.advanceTimersByTime(HOVER_DELAY_MS)
    core.hideNow(HOVER_CHANNELS.imageFloat)
    expect(core.getSnapshot().active).toBeNull()
    // pending show must also die instantly
    core.show(HOVER_CHANNELS.imageFloat, 'img')
    core.hideNow(HOVER_CHANNELS.imageFloat)
    vi.advanceTimersByTime(HOVER_DELAY_MS * 2)
    expect(core.getSnapshot().active).toBeNull()
    core.dispose()
  })

  it('cancelPendingShow drops a debounce-scheduled show before it ever renders (I1 残窗)', () => {
    const core = createHoverDiscipline<Anchor>()
    const seen = trackSnapshots(core)
    core.show(HOVER_CHANNELS.imageFloat, 'img')
    core.cancelPendingShow(HOVER_CHANNELS.imageFloat)
    vi.advanceTimersByTime(HOVER_DELAY_MS * 4)
    expect(core.getSnapshot().active).toBeNull()
    expect(seen).toHaveLength(0)
    core.dispose()
  })

  it('cancelPendingShow never touches visible chrome (hide lifecycle unchanged)', () => {
    const core = createHoverDiscipline<Anchor>()
    core.show(HOVER_CHANNELS.listHandle, 'row-a')
    vi.advanceTimersByTime(HOVER_DELAY_MS)
    core.cancelPendingShow(HOVER_CHANNELS.listHandle)
    expect(core.getSnapshot().active).toEqual({ id: HOVER_CHANNELS.listHandle, anchor: 'row-a' })
    vi.advanceTimersByTime(HOVER_DELAY_MS * 4)
    expect(core.getSnapshot().active).toEqual({ id: HOVER_CHANNELS.listHandle, anchor: 'row-a' })
    core.dispose()
  })

  it('cancelPendingShow respects pin/retain (never bypasses the pin contract)', () => {
    const core = createHoverDiscipline<Anchor>()
    core.show(HOVER_CHANNELS.linkFloat, 'link')
    core.pin(HOVER_CHANNELS.linkFloat) // edge: pinned before the dwell fires
    core.cancelPendingShow(HOVER_CHANNELS.linkFloat)
    vi.advanceTimersByTime(HOVER_DELAY_MS * 2)
    expect(core.getSnapshot().active).toEqual({ id: HOVER_CHANNELS.linkFloat, anchor: 'link' })
    core.dispose()
  })

  it('hideAllNow collapses every channel including pinned ones (Esc hush)', () => {
    const core = createHoverDiscipline<Anchor>()
    core.show(HOVER_CHANNELS.listHandle, 'row-a')
    vi.advanceTimersByTime(HOVER_DELAY_MS)
    core.pin(HOVER_CHANNELS.listHandle)
    core.show(HOVER_CHANNELS.linkFloat, 'link') // ignored — other channel pinned
    core.hideAllNow()
    expect(core.getSnapshot().active).toBeNull()
    vi.advanceTimersByTime(HOVER_DELAY_MS * 3)
    expect(core.getSnapshot().active).toBeNull()
    core.dispose()
  })

  it('dispose clears every timer (unmount cleanup)', () => {
    const core = createHoverDiscipline<Anchor>()
    core.show(HOVER_CHANNELS.listHandle, 'row-a')
    core.show(HOVER_CHANNELS.imageFloat, 'img')
    core.dispose()
    vi.advanceTimersByTime(HOVER_DELAY_MS * 4)
    expect(core.getSnapshot().active).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('returns a stable snapshot identity until the active channel changes', () => {
    const core = createHoverDiscipline<Anchor>()
    const first = core.getSnapshot()
    expect(core.getSnapshot()).toBe(first)
    core.show(HOVER_CHANNELS.listHandle, 'row-a')
    // still pending — snapshot unchanged
    expect(core.getSnapshot()).toBe(first)
    vi.advanceTimersByTime(HOVER_DELAY_MS)
    const second = core.getSnapshot()
    expect(second).not.toBe(first)
    expect(core.getSnapshot()).toBe(second)
    core.dispose()
  })

  it('unsubscribe stops notifications', () => {
    const core = createHoverDiscipline<Anchor>()
    let calls = 0
    const un = core.subscribe(() => {
      calls += 1
    })
    core.show(HOVER_CHANNELS.listHandle, 'row-a')
    vi.advanceTimersByTime(HOVER_DELAY_MS)
    expect(calls).toBe(1)
    un()
    core.hideNow(HOVER_CHANNELS.listHandle)
    expect(calls).toBe(1)
    core.dispose()
  })
})
