/**
 * hideNow snapshot-consistency pin (IT-03 FE-03 code-review Minor):
 * hideNow(id) on a NON-active channel must drop only that entry — the active
 * channel's snapshot stays put. Latent API-contract face (current callers only
 * ever hideNow their own active channel, so this was unreachable by timing).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHoverDiscipline, HOVER_CHANNELS, HOVER_DELAY_MS } from './useHoverDiscipline'

type Anchor = string

describe('hover discipline hideNow snapshot consistency', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('hideNow(non-active) keeps the active channel snapshot (active=A, hideNow(B))', () => {
    const core = createHoverDiscipline<Anchor>()
    core.show(HOVER_CHANNELS.imageFloat, 'img')
    vi.advanceTimersByTime(HOVER_DELAY_MS)
    expect(core.getSnapshot().active).toEqual({ id: HOVER_CHANNELS.imageFloat, anchor: 'img' })

    // B is show-pending — an entry that exists but is NOT the active channel.
    core.show(HOVER_CHANNELS.linkFloat, 'link')
    core.hideNow(HOVER_CHANNELS.linkFloat)

    // The active channel A must survive B's removal untouched.
    expect(core.getSnapshot().active).toEqual({ id: HOVER_CHANNELS.imageFloat, anchor: 'img' })
    core.dispose()
  })
})
