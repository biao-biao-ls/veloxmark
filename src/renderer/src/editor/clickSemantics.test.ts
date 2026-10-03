import { describe, expect, it } from 'vitest'
import {
  chromeAllowed,
  hitTargetFromTarget,
  judgeClickSemantics,
  shouldCancelPendingShow,
  syncPureSelectionChrome,
  type HitTarget
} from './clickSemantics'

// AC-RULE-13 / ren-click:semantics route table: 6 hitTargets × selection
// empty / non-empty = 12 combinations (FE-09 阶段 1 matrix pin).
const HIT_TARGETS: HitTarget[] = ['text', 'table', 'math', 'code', 'image', 'mermaid']

describe('judgeClickSemantics (ren-click:semantics route table)', () => {
  for (const hitTarget of HIT_TARGETS) {
    it(`click ${hitTarget} content with empty selection → edit:${hitTarget} (writer path)`, () => {
      expect(judgeClickSemantics({ hitTarget, selectionEmpty: true })).toEqual({
        kind: 'edit',
        form: hitTarget
      })
    })

    it(`release over ${hitTarget} with non-empty selection → safe select (no edit, no chrome)`, () => {
      expect(judgeClickSemantics({ hitTarget, selectionEmpty: false })).toEqual({
        kind: 'select'
      })
    })
  }

  it('covers the full 6×2 matrix (2 documents × 6 targets)', () => {
    let combos = 0
    for (const hitTarget of HIT_TARGETS) {
      for (const selectionEmpty of [true, false]) {
        const verdict = judgeClickSemantics({ hitTarget, selectionEmpty })
        if (selectionEmpty) {
          expect(verdict).toEqual({ kind: 'edit', form: hitTarget })
        } else {
          expect(verdict).toEqual({ kind: 'select' })
        }
        combos++
      }
    }
    expect(combos).toBe(12)
  })

  it('the select verdict never carries an edit form (safe no-op contract)', () => {
    const verdict = judgeClickSemantics({ hitTarget: 'image', selectionEmpty: false })
    expect(verdict.kind).toBe('select')
    expect('form' in verdict ? verdict.form : undefined).toBeUndefined()
  })
})

describe('chromeAllowed (pure-selection chrome policy)', () => {
  it('tool chrome may surface when no selection exists', () => {
    expect(chromeAllowed(true)).toBe(true)
  })

  it('tool chrome is suppressed while a selection exists (AC-FN-18)', () => {
    expect(chromeAllowed(false)).toBe(false)
  })
})

/** Duck-typed Element stand-in — node vitest has no DOM. */
function el(matches: Record<string, boolean>): { closest(sel: string): unknown } {
  return {
    closest(sel: string) {
      // First matching selector wins, mirroring the real classify order.
      for (const [selector, hit] of Object.entries(matches)) {
        if (selector === sel && hit) return {}
      }
      return null
    }
  }
}

describe('hitTargetFromTarget (decoration hit-area classify)', () => {
  it('maps image wrap → image', () => {
    expect(hitTargetFromTarget(el({ '.cm-md-image-wrap': true }) as never)).toBe('image')
  })
  it('maps table wrap → table', () => {
    expect(hitTargetFromTarget(el({ '.cm-md-table-wrap': true }) as never)).toBe('table')
  })
  it('maps table element → table', () => {
    expect(hitTargetFromTarget(el({ '.cm-md-table': true }) as never)).toBe('table')
  })
  it('maps math block → math', () => {
    expect(hitTargetFromTarget(el({ '.cm-md-math-block': true }) as never)).toBe('math')
  })
  it('maps inline math → math', () => {
    expect(hitTargetFromTarget(el({ '.cm-md-math-inline': true }) as never)).toBe('math')
  })
  it('maps code block → code', () => {
    expect(hitTargetFromTarget(el({ '.cm-md-code-block': true }) as never)).toBe('code')
  })
  it('maps mermaid block → mermaid', () => {
    expect(hitTargetFromTarget(el({ '.cm-md-mermaid': true }) as never)).toBe('mermaid')
  })
  it('maps plain editor text (paragraph / link / list row) → text', () => {
    expect(hitTargetFromTarget(el({ '.cm-content': true }) as never)).toBe('text')
  })
  it('returns null for non-element targets', () => {
    expect(hitTargetFromTarget(null)).toBeNull()
    expect(hitTargetFromTarget(undefined as never)).toBeNull()
  })
  it('returns null outside the editor surface', () => {
    expect(hitTargetFromTarget(el({}) as never)).toBeNull()
  })
})

describe('shouldCancelPendingShow (pending-show 残窗守卫, I1)', () => {
  it('keeps the pending show while merely passing over (no press, no selection)', () => {
    expect(shouldCancelPendingShow({ buttons: 0, selectionEmpty: true })).toBe(false)
  })

  it('cancels while a press gesture is in flight (buttons !== 0)', () => {
    expect(shouldCancelPendingShow({ buttons: 1, selectionEmpty: true })).toBe(true)
  })

  it('cancels while a text selection exists (AC-FN-18 chrome-free copy)', () => {
    expect(shouldCancelPendingShow({ buttons: 0, selectionEmpty: false })).toBe(true)
  })
})

/** Duck-typed EditorView stand-in — node vitest has no DOM (I3). */
function stubView(selectionEmpty: boolean): { view: never; classes: Set<string> } {
  const classes = new Set<string>()
  const view = {
    dom: {
      classList: {
        toggle(name: string, force?: boolean) {
          const add = force ?? !classes.has(name)
          if (add) classes.add(name)
          else classes.delete(name)
          return add
        }
      }
    },
    state: { selection: { main: { empty: selectionEmpty } } }
  }
  return { view: view as never, classes }
}

describe('syncPureSelectionChrome (pure-selection CSS hook, I3)', () => {
  it('non-empty selection → adds .cm-md-selecting', () => {
    const { view, classes } = stubView(false)
    syncPureSelectionChrome(view)
    expect(classes.has('cm-md-selecting')).toBe(true)
  })

  it('empty selection → removes .cm-md-selecting', () => {
    const { view, classes } = stubView(true)
    classes.add('cm-md-selecting') // pre-seeded: toggle must clear it
    syncPureSelectionChrome(view)
    expect(classes.has('cm-md-selecting')).toBe(false)
  })
})
