/**
 * syncGate — session-persist signature gate (useFoldSync / useQuoteFold /
 * useTableWidthSync shared core).
 *
 * Regression vectors for the force-sentinel collision (IT-02 FE-09 fix):
 *  - empty target set + forced re-sync MUST apply (mirror write) — `''` is a
 *    legal signature of an empty fold set and must not double as a force
 *    sentinel (switching to a doc with no fold memory left ghost folds in
 *    the Outline mirror and inverted ←/→ fold direction)
 *  - same signature + non-forced path still early-returns (write-jitter guard
 *    must not regress)
 *  - non-empty target set + forced re-sync MUST apply even when the signature
 *    is unchanged
 */
import { describe, expect, it } from 'vitest'
import { computeSig, createSigGate, shouldApplySync } from './syncGate'

/** Mirror-simulating consumer: what useFoldSync does when consume() is true. */
function attachMirror(gate: ReturnType<typeof createSigGate>, initial: Iterable<string> = []) {
  let mirror = new Set(initial)
  return {
    get mirror() {
      return mirror
    },
    apply(keys: Iterable<string>) {
      const set = new Set(keys)
      if (!gate.consume(computeSig(set))) return
      mirror = set
    }
  }
}

describe('computeSig', () => {
  it('sorts keys and joins them with \\n (order-insensitive identity)', () => {
    expect(computeSig(['3:c', '2:b', '2:a'])).toBe('2:a\n2:b\n3:c')
    expect(computeSig(['2:a', '2:b', '3:c'])).toBe('2:a\n2:b\n3:c')
  })

  it('maps the empty set to the legal signature ""', () => {
    expect(computeSig([])).toBe('')
  })
})

describe('shouldApplySync (sign-gated write-back)', () => {
  // Vector 1 — 目标集为空 + 强制再同步必须置镜像
  it('applies a forced re-sync for an empty target set (sig "" must not collide with the force path)', () => {
    // previous doc left a non-empty sig; restore target folds = ∅
    expect(shouldApplySync(computeSig([]), '2:第一章', true)).toBe(true)
    // previous doc had no folds either (sig already "")
    expect(shouldApplySync(computeSig([]), '', true)).toBe(true)
  })

  // Vector 2 — 同 sig 非强制路径仍提前 return（防写抖动不回归）
  it('skips non-forced syncs with an unchanged signature (write-jitter guard)', () => {
    expect(shouldApplySync('', '', false)).toBe(false)
    expect(shouldApplySync('2:第一章', '2:第一章', false)).toBe(false)
    expect(shouldApplySync(computeSig(['2:a', '2:b']), computeSig(['2:b', '2:a']), false)).toBe(false)
  })

  // Vector 3 — 非空集强制再同步置镜像
  it('applies a forced re-sync for a non-empty set even when the signature is unchanged', () => {
    expect(shouldApplySync('2:第一章', '2:第一章', true)).toBe(true)
    expect(shouldApplySync(computeSig(['2:a']), computeSig(['2:a']), true)).toBe(true)
  })

  it('applies non-forced syncs whenever the signature changed', () => {
    expect(shouldApplySync('2:第一章', '', false)).toBe(true)
    expect(shouldApplySync('', '2:第一章', false)).toBe(true)
    expect(shouldApplySync('2:b', '2:a', false)).toBe(true)
  })
})

describe('createSigGate (hook write-back funnel state machine)', () => {
  // Vector 1 — 目标集为空 + 强制再同步必须置镜像
  it('writes the mirror on a forced re-sync when the target set is empty', () => {
    const gate = createSigGate()
    const sim = attachMirror(gate, ['2:第一章']) // previous document's folds
    gate.forceNext() // restore path (no fold memory → target ∅)
    sim.apply([])
    expect(sim.mirror.size).toBe(0) // ghost folds must be cleared
  })

  // Vector 2 — 同 sig 非强制路径仍提前 return（防写抖动不回归）
  it('skips non-forced syncs with an unchanged signature (write-jitter guard)', () => {
    const gate = createSigGate()
    let writes = 0
    const counting = {
      apply(keys: Iterable<string>) {
        const set = new Set(keys)
        if (!gate.consume(computeSig(set))) return
        writes += 1
      }
    }
    counting.apply(['2:a']) // first sync applies
    expect(writes).toBe(1)
    counting.apply(['2:a']) // same sig, non-forced → no mirror write
    counting.apply([]) // then empty sig change → applies
    counting.apply([]) // same empty sig, non-forced → no mirror write
    expect(writes).toBe(2)
  })

  // Vector 3 — 非空集强制再同步置镜像
  it('writes the mirror on a forced re-sync for a non-empty set even when the signature is unchanged', () => {
    const gate = createSigGate()
    const sim = attachMirror(gate)
    sim.apply(['2:a'])
    expect(sim.mirror).toEqual(new Set(['2:a']))
    gate.forceNext() // restore target folds the same set as last sync
    sim.apply(['2:a'])
    expect(sim.mirror).toEqual(new Set(['2:a'])) // applied, not skipped
  })

  it('applies the first non-forced sync and then gates on signature change only', () => {
    const gate = createSigGate()
    const sim = attachMirror(gate)
    sim.apply(['2:a'])
    expect(sim.mirror).toEqual(new Set(['2:a']))
    sim.apply(['2:b'])
    expect(sim.mirror).toEqual(new Set(['2:b']))
  })
})
