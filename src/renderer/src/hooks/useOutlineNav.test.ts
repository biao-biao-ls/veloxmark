/**
 * useOutlineNav core — nav-outline:jump / nav-outline:active-follow tests
 * (IT-02 FE-07).
 *
 * Covers the pure logic only (node env):
 *  - visible-section rule (pickActiveHeading) incl. top-region default
 *  - jump unfold params (jumpExpandKeys) incl. target inside folded ancestors
 *  - jump-pin mutual exclusion (createActiveFollow): no active flicker while
 *    the smooth-scroll animation runs, latest jump wins on rapid clicks
 *  - follow throttle boundaries (createThrottle): leading fire, trailing
 *    coalesce, cancel drops the pending trailing run
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OutlineItem } from '../outline/extract'
import {
  ACTIVE_FOLLOW_THROTTLE_MS,
  createActiveFollow,
  createThrottle,
  jumpExpandKeys,
  pickActiveHeading
} from './useOutlineNav'

function item(level: number, text: string, pos: number): OutlineItem {
  return { level, text, pos }
}

// A(1)@0 → A1(2)@100 → B(1)@200 → B1(3)@300
const ITEMS: OutlineItem[] = [
  item(1, 'A', 0),
  item(2, 'A1', 100),
  item(1, 'B', 200),
  item(3, 'B1', 300)
]

const keys = (...pairs: Array<[number, string]>): ReadonlySet<string> =>
  new Set(pairs.map(([lv, text]) => `${lv}:${text}`))

describe('pickActiveHeading — visible-section rule', () => {
  it('returns null for an empty outline', () => {
    expect(pickActiveHeading([], 50)).toBeNull()
  })

  it('the top region above the first heading owns the first section', () => {
    const items = [item(1, 'H', 50)]
    expect(pickActiveHeading(items, 0)).toBe(50)
  })

  it('probe on a heading selects that heading', () => {
    expect(pickActiveHeading(ITEMS, 0)).toBe(0)
    expect(pickActiveHeading(ITEMS, 100)).toBe(100)
    expect(pickActiveHeading(ITEMS, 200)).toBe(200)
  })

  it('probe inside a section selects its heading', () => {
    expect(pickActiveHeading(ITEMS, 50)).toBe(0)
    expect(pickActiveHeading(ITEMS, 150)).toBe(100)
  })

  it('probe just before a heading keeps the previous section', () => {
    expect(pickActiveHeading(ITEMS, 199)).toBe(100)
    expect(pickActiveHeading(ITEMS, 299)).toBe(200)
  })

  it('probe past the last heading selects the last heading', () => {
    expect(pickActiveHeading(ITEMS, 500)).toBe(300)
  })
})

describe('jumpExpandKeys — jump unfold params', () => {
  it('returns nothing when no folded key is on the jump path', () => {
    expect(jumpExpandKeys(ITEMS, 100, keys())).toEqual([])
  })

  it('expands the target heading itself when folded', () => {
    expect(jumpExpandKeys(ITEMS, 100, keys([2, 'A1']))).toEqual(['2:A1'])
  })

  it('expands folded ancestors when the target hides inside a folded section', () => {
    expect(jumpExpandKeys(ITEMS, 100, keys([1, 'A']))).toEqual(['1:A'])
  })

  it('expands self + all folded ancestors together', () => {
    // B1(3) nested under B(1) — both folded on the jump path.
    expect(new Set(jumpExpandKeys(ITEMS, 300, keys([1, 'B'], [3, 'B1'])))).toEqual(
      new Set(['3:B1', '1:B'])
    )
  })

  it('never expands folded siblings off the jump path', () => {
    // Jump to A1: folded B is a sibling subtree, not an ancestor.
    expect(jumpExpandKeys(ITEMS, 100, keys([1, 'B'], [3, 'B1']))).toEqual([])
  })

  it('returns nothing for a position that is not a heading', () => {
    expect(jumpExpandKeys(ITEMS, 150, keys([1, 'A']))).toEqual([])
  })
})

describe('createActiveFollow — jump pin mutual exclusion', () => {
  it('follows the probe while unpinned', () => {
    const follow = createActiveFollow()
    expect(follow.update(ITEMS, 150)).toBe(100)
    expect(follow.update(ITEMS, 250)).toBe(200)
  })

  it('freezes active at the pinned pos while pinned (no flicker mid-animation)', () => {
    const follow = createActiveFollow()
    follow.pin(200)
    expect(follow.isPinned()).toBe(true)
    // Intermediate animation probes disagree with the pin — pin wins.
    expect(follow.update(ITEMS, 50)).toBe(200)
    expect(follow.update(ITEMS, 150)).toBe(200)
    expect(follow.update(ITEMS, 350)).toBe(200)
  })

  it('rapid jumps: the latest pin wins', () => {
    const follow = createActiveFollow()
    follow.pin(100)
    follow.pin(300)
    expect(follow.update(ITEMS, 50)).toBe(300)
  })

  it('after release the probe rule is back', () => {
    const follow = createActiveFollow()
    follow.pin(300)
    follow.release()
    expect(follow.isPinned()).toBe(false)
    expect(follow.update(ITEMS, 150)).toBe(100)
    expect(follow.update([], 150)).toBeNull()
  })

  it('release is idempotent', () => {
    const follow = createActiveFollow()
    follow.pin(0)
    follow.release()
    follow.release()
    expect(follow.update(ITEMS, 150)).toBe(100)
  })
})

describe('createThrottle — follow debounce boundaries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires leading immediately on the first schedule', () => {
    const fn = vi.fn()
    const throttle = createThrottle(fn, ACTIVE_FOLLOW_THROTTLE_MS)
    throttle.schedule()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('coalesces a burst into leading + one trailing run', () => {
    const fn = vi.fn()
    const throttle = createThrottle(fn, ACTIVE_FOLLOW_THROTTLE_MS)
    throttle.schedule()
    throttle.schedule()
    throttle.schedule()
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(ACTIVE_FOLLOW_THROTTLE_MS)
    expect(fn).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(ACTIVE_FOLLOW_THROTTLE_MS * 2)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('boundary: just under the wait window does not lead-fire', () => {
    const fn = vi.fn()
    const throttle = createThrottle(fn, ACTIVE_FOLLOW_THROTTLE_MS)
    throttle.schedule() // t=0 leading
    vi.advanceTimersByTime(ACTIVE_FOLLOW_THROTTLE_MS - 1)
    throttle.schedule() // t=wait-1 → trailing only
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('boundary: at the wait window a new schedule lead-fires again', () => {
    const fn = vi.fn()
    const throttle = createThrottle(fn, ACTIVE_FOLLOW_THROTTLE_MS)
    throttle.schedule() // t=0 leading
    vi.advanceTimersByTime(ACTIVE_FOLLOW_THROTTLE_MS)
    throttle.schedule() // t=wait → leading again
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('cancel drops the pending trailing run', () => {
    const fn = vi.fn()
    const throttle = createThrottle(fn, ACTIVE_FOLLOW_THROTTLE_MS)
    throttle.schedule() // leading
    throttle.schedule() // trailing pending
    throttle.cancel()
    vi.advanceTimersByTime(ACTIVE_FOLLOW_THROTTLE_MS * 3)
    expect(fn).toHaveBeenCalledTimes(1)
    // The throttle is usable again after cancel.
    throttle.schedule()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('flush runs the pending trailing run immediately', () => {
    const fn = vi.fn()
    const throttle = createThrottle(fn, ACTIVE_FOLLOW_THROTTLE_MS)
    throttle.schedule() // leading
    throttle.schedule() // trailing pending
    throttle.flush()
    expect(fn).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(ACTIVE_FOLLOW_THROTTLE_MS * 2)
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
