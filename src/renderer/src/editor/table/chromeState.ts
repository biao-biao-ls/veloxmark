/**
 * ren-table:chrome-state — block chrome four-state machine (tech-design §4.3),
 * the single show/hide consolidation point (FE-10, 收口单点).
 *
 * States (AC-RULE-01): 静息 idle / hover / 聚焦编辑 editing（含单元格激活）/
 * 错误 error. Exits to idle via editExit or hush (Esc / body-blank, FE-09
 * 协同: useHushLayer collapseChrome calls hush()).
 *
 * Visibility policy lives in ONE place — `chromeSurfaces(phase)`:
 *   idle    → zero chrome (AC-FN-23)
 *   hover   → micro controls ONLY after the debounce (col-grip hint etc.);
 *             the table toolbar never appears here (AC-FN-33 / UI-ELEM-05
 *             exception: toolbar is edit-only)
 *   editing → toolbar + micro (AC-FN-03)
 *   error   → chrome stays (error bar is not a naked state)
 *
 * Debounce (glb-calm:debounce / AC-NF-04): module-level timer, ≥150ms both
 * directions (CHROME_DEBOUNCE_MS clamps to the shared HOVER_DELAY_MS floor),
 * a leave before the show fires cancels it — rapid pass-over flashes zero.
 *
 * Layout (AC-NF-05): every surface is overlay-painted — `slotPx` is 0 on
 * every snapshot; chrome show/hide never moves body content.
 *
 * Pure reducer (`reduceChrome`) + timer-wrapped runtime (`createChromeRuntime`)
 * — platform timers so vi.useFakeTimers drives the machine. The DOM host
 * (pointerenter/leave wiring) lives in toolbar.ts `bindTableChromeHost`.
 */
import { HOVER_DELAY_MS } from '../../hooks/useHoverDiscipline'

// ---- constants --------------------------------------------------------------

/** Single threshold definition — both directions, clamped to the shared floor. */
export const CHROME_DEBOUNCE_MS = HOVER_DELAY_MS

/** AC-NF-05: chrome surfaces are overlay-only — zero layout slot. */
export const CHROME_SLOT_PX = 0

/** Paint class toggled on the hovered zone anchor (styles/markdown.css reads it). */
export const CHROME_ON_CLASS = 'cm-md-chrome-on'

// ---- pure state machine -----------------------------------------------------

export type ChromePhase = 'idle' | 'hover' | 'editing' | 'error'

export type ChromeMicro = 'hidden' | 'show-pending' | 'visible' | 'hide-pending'

export interface ChromeSnapshot<A = unknown> {
  readonly phase: ChromePhase
  /** Phase to return to on errorFixed (error can strike from any state). */
  readonly errorFrom: ChromePhase | null
  readonly micro: ChromeMicro
  /** Hover-zone paint anchor (the block wrap) — null at rest. */
  readonly anchor: A | null
  /** Stable edit-session identity (widget sourceFrom) — guards cross-table exits. */
  readonly editId: unknown | null
  readonly toolbarVisible: boolean
  /**
   * micro 已激活（hover=刷漆 / editing=结构命中）：micro 为 visible 或
   * hide-pending（离开延迟消失）时为 true。editing/error 态为结构命中
   * （CSS 常开），applyPaint 仅 phase==='hover' 才刷 CHROME_ON_CLASS。
   */
  readonly microVisible: boolean
  /** Always CHROME_SLOT_PX — overlay-only invariant (AC-NF-05). */
  readonly slotPx: number
  /**
   * 回安静锁 (AC-FN-31「Esc 回安静后立即进入该态」): set by the explicit quiet
   * commands (editExit / hush / errorFixed→idle). While set, only SYNTHETIC
   * enter/retarget are no-ops — a resting pointer, or a synthetic pointerenter
   * fired by the browser when the zone DOM rebuilds under it, must NOT re-arm
   * hover chrome. A genuine cross-boundary enter (`enter` with `boundary: true`,
   * host-certified via relatedTarget) punches through: the lock clears and the
   * normal 150ms hover debounce runs (AC-NF-04 — the lock must never swallow
   * the next real hover, e.g. leave-before-lock then the first hover back).
   * Also cleared on leave (boundary-out).
   */
  readonly quietLock: boolean
}

export type ChromeEvent<A = unknown> =
  | {
      type: 'enter'
      anchor: A
      /**
       * 真跨界进入（host 以 relatedTarget 判定：不在任何 wrap 内）= 新的用户
       * 意图。仅当 quietLock 在位时有意义：true 才能穿透锁并复燃防抖；
       * 省略/false（合成 enter）仍被压制。
       */
      boundary?: boolean
    }
  | { type: 'retarget'; anchor: A }
  | { type: 'leave'; anchor: A }
  | { type: 'dwell' }
  | { type: 'editEnter'; id: unknown }
  | { type: 'editExit'; id: unknown }
  | { type: 'error' }
  | { type: 'errorFixed' }
  | { type: 'hush' }

/** Timer directive for the host: 'show'/'hide' arm the debounce, 'clear' kills it. */
export type ChromeSchedule = 'show' | 'hide' | 'clear' | null

export interface ChromeStep<A = unknown> {
  readonly snapshot: ChromeSnapshot<A>
  readonly schedule: ChromeSchedule
}

export function initChrome<A = unknown>(): ChromeSnapshot<A> {
  return {
    phase: 'idle',
    errorFrom: null,
    micro: 'hidden',
    anchor: null,
    editId: null,
    toolbarVisible: false,
    microVisible: false,
    slotPx: CHROME_SLOT_PX,
    quietLock: false
  }
}

/**
 * The 收口单点 visibility policy — every chrome host derives from this.
 * `micro: true` is the SETTLED hover contract (after the debounce lands).
 */
export function chromeSurfaces(phase: ChromePhase): { toolbar: boolean; micro: boolean } {
  switch (phase) {
    case 'idle':
      return { toolbar: false, micro: false }
    case 'hover':
      return { toolbar: false, micro: true }
    case 'editing':
    case 'error':
      return { toolbar: true, micro: true }
  }
}

function isPainted(micro: ChromeMicro): boolean {
  return micro === 'visible' || micro === 'hide-pending'
}

function snapshotOf<A>(
  base: ChromeSnapshot<A>,
  patch: Partial<ChromeSnapshot<A>>
): ChromeSnapshot<A> {
  const next = { ...base, ...patch, slotPx: CHROME_SLOT_PX }
  return {
    ...next,
    toolbarVisible: chromeSurfaces(next.phase).toolbar,
    microVisible: isPainted(next.micro)
  }
}

const HIDDEN_PATCH = {
  micro: 'hidden' as ChromeMicro,
  anchor: null,
  editId: null,
  errorFrom: null
}

export function reduceChrome<A>(
  snapshot: ChromeSnapshot<A>,
  event: ChromeEvent<A>
): ChromeStep<A> {
  switch (event.type) {
    case 'enter': {
      // Edit session owns the chrome (structural paint) — hover never fights it.
      if (snapshot.phase === 'editing' || snapshot.phase === 'error') {
        return { snapshot, schedule: null }
      }
      // quietLock 只压合成 enter（AC-FN-31 驻留指针/重建回灌不复燃）；真跨界
      // enter（boundary，host 以 relatedTarget 判定）是新的用户意图 —— 解锁并
      // 走正常防抖（AC-NF-04：锁置位后下一次真实 hover 不许被吞）。
      let state = snapshot
      if (state.quietLock) {
        if (event.boundary !== true) return { snapshot, schedule: null }
        state = { ...state, quietLock: false }
      }
      const base = { phase: 'hover' as ChromePhase, anchor: event.anchor, errorFrom: null }
      switch (state.micro) {
        case 'show-pending':
          // Same anchor re-fire keeps the dwell clock (child churn).
          if (state.anchor === event.anchor) return { snapshot: state, schedule: null }
          return {
            snapshot: snapshotOf(state, base),
            schedule: 'show'
          }
        case 'hidden':
          return {
            snapshot: snapshotOf(state, { ...base, micro: 'show-pending' }),
            schedule: 'show'
          }
        case 'visible':
          return { snapshot: snapshotOf(state, base), schedule: 'clear' }
        case 'hide-pending':
          // Pointer came back before the hide landed — no flicker.
          return {
            snapshot: snapshotOf(state, { ...base, micro: 'visible' }),
            schedule: 'clear'
          }
      }
      break
    }
    case 'retarget': {
      // Zone DOM rebuilt under a resting pointer — same hover session.
      if (snapshot.phase === 'editing' || snapshot.phase === 'error') {
        return { snapshot, schedule: null }
      }
      // Quiet-lock holds through the exit rebuild — no :hover re-arm.
      if (snapshot.quietLock) {
        return { snapshot, schedule: null }
      }
      const base = { phase: 'hover' as ChromePhase, anchor: event.anchor, errorFrom: null }
      switch (snapshot.micro) {
        case 'show-pending':
          // Dwell clock survives the remount.
          return { snapshot: snapshotOf(snapshot, base), schedule: null }
        case 'hidden':
          return {
            snapshot: snapshotOf(snapshot, { ...base, micro: 'show-pending' }),
            schedule: 'show'
          }
        case 'visible':
          return { snapshot: snapshotOf(snapshot, base), schedule: 'clear' }
        case 'hide-pending':
          return {
            snapshot: snapshotOf(snapshot, { ...base, micro: 'visible' }),
            schedule: 'clear'
          }
      }
      break
    }
    case 'leave': {
      // Edit chrome lives partly outside the wrap (toolbar on outer) — a leave
      // must never drop the session. Stale leaves (dead anchors) are ignored.
      if (snapshot.phase === 'editing' || snapshot.phase === 'error') {
        return { snapshot, schedule: null }
      }
      // Quiet-lock release: boundary-out after an explicit quiet command is
      // the only unlock — the NEXT enter is genuine user intent (anchor was
      // cleared by the quiet patch, so the stale-anchor guard must not eat it).
      if (snapshot.quietLock) {
        return {
          snapshot: snapshotOf(snapshot, { quietLock: false, ...HIDDEN_PATCH }),
          schedule: 'clear'
        }
      }
      if (snapshot.anchor !== event.anchor) return { snapshot, schedule: null }
      switch (snapshot.micro) {
        case 'show-pending':
          // Cancelled before ever painting — rapid pass-over flashes zero.
          return {
            snapshot: snapshotOf(snapshot, { phase: 'idle', ...HIDDEN_PATCH }),
            schedule: 'clear'
          }
        case 'visible':
          // 离开同延迟消失 (AC-NF-04): stay in hover through hide-pending so
          // the paint survives until the hide debounce lands — the class drops
          // only on the settle (dwell), never synchronously with the leave.
          return {
            snapshot: snapshotOf(snapshot, {
              phase: 'hover',
              micro: 'hide-pending',
              errorFrom: null
            }),
            schedule: 'hide'
          }
        case 'hide-pending':
          return { snapshot, schedule: null }
        case 'hidden':
          return {
            snapshot: snapshotOf(snapshot, { phase: 'idle', ...HIDDEN_PATCH }),
            schedule: null
          }
      }
      break
    }
    case 'dwell': {
      if (snapshot.micro === 'show-pending') {
        return {
          snapshot: snapshotOf(snapshot, { micro: 'visible' }),
          schedule: 'clear'
        }
      }
      if (snapshot.micro === 'hide-pending') {
        // Hide debounce landed — NOW the zone returns to 静息 (paint drops here).
        return {
          snapshot: snapshotOf(snapshot, { phase: 'idle', ...HIDDEN_PATCH }),
          schedule: 'clear'
        }
      }
      return { snapshot, schedule: null }
    }
    case 'editEnter': {
      // Editing micro chrome is structural (CSS `.cm-md-table-editing`) — paint
      // timing is not needed, show immediately. A→B transfer keeps the phase.
      return {
        snapshot: snapshotOf(snapshot, {
          phase: 'editing',
          errorFrom: null,
          micro: 'visible',
          editId: event.id
        }),
        schedule: 'clear'
      }
    }
    case 'editExit': {
      // Only the matching session may close it (cross-table rebuild ordering).
      if (snapshot.editId !== event.id) return { snapshot, schedule: null }
      // AC-FN-31: exit lands in 静息 immediately and locks hover re-arm until
      // the pointer genuinely leaves (resting pointer must not re-light chrome).
      return {
        snapshot: snapshotOf(snapshot, { phase: 'idle', ...HIDDEN_PATCH, quietLock: true }),
        schedule: 'clear'
      }
    }
    case 'error': {
      return {
        snapshot: snapshotOf(snapshot, {
          phase: 'error',
          errorFrom: snapshot.phase === 'error' ? snapshot.errorFrom : snapshot.phase,
          micro: 'visible'
        }),
        schedule: 'clear'
      }
    }
    case 'errorFixed': {
      const back = snapshot.errorFrom ?? 'idle'
      return {
        snapshot: snapshotOf(snapshot, {
          phase: back,
          errorFrom: null,
          micro: back === 'idle' ? 'hidden' : 'visible',
          anchor: back === 'idle' ? null : snapshot.anchor,
          quietLock: back === 'idle'
        }),
        schedule: 'clear'
      }
    }
    case 'hush': {
      // Esc / body-blank (FE-09): one-shot back to 静息 zero chrome —
      // quiet-locked so a resting pointer cannot re-arm until it leaves.
      return {
        snapshot: snapshotOf(snapshot, { phase: 'idle', ...HIDDEN_PATCH, quietLock: true }),
        schedule: 'clear'
      }
    }
  }
}

// ---- runtime (module-level debounce timers — hoverDiscipline factory shape) --

export interface ChromeRuntime<A> {
  /** `opts.boundary`：真跨界进入（可穿透 quietLock）——见 ChromeEvent.enter。 */
  enter(anchor: A, opts?: { boundary?: boolean }): void
  retarget(anchor: A): void
  leave(anchor: A): void
  editEnter(id: unknown): void
  editExit(id: unknown): void
  error(): void
  errorFixed(): void
  hush(): void
  subscribe(listener: () => void): () => void
  getSnapshot(): ChromeSnapshot<A>
  /** Cancel every timer and drop the paint (unmount cleanup). */
  dispose(): void
}

export interface ChromeRuntimeOptions<A> {
  /** Paint hook — toggles CHROME_ON_CLASS on the anchor by default. */
  paint?: (anchor: A, on: boolean) => void
}

interface ClassListHost {
  classList?: { toggle(name: string, force?: boolean): void }
}

export function createChromeRuntime<A = HTMLElement>(
  options?: ChromeRuntimeOptions<A>
): ChromeRuntime<A> {
  const paint =
    options?.paint ??
    ((anchor: A, on: boolean): void => {
      const host = anchor as unknown as ClassListHost
      host.classList?.toggle(CHROME_ON_CLASS, on)
    })
  let state = initChrome<A>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let painted: A | null = null
  const listeners = new Set<() => void>()

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function applyPaint(): void {
    const shouldPaint = state.microVisible && state.phase === 'hover' && state.anchor != null
    if (shouldPaint) {
      const target = state.anchor as A
      if (painted !== null && painted !== target) paint(painted, false)
      paint(target, true)
      painted = target
    } else if (painted !== null) {
      paint(painted, false)
      painted = null
    }
  }

  function dispatch(event: ChromeEvent<A>): void {
    const step = reduceChrome(state, event)
    state = step.snapshot
    if (step.schedule === 'show' || step.schedule === 'hide') {
      clearTimer()
      timer = setTimeout(() => dispatch({ type: 'dwell' }), CHROME_DEBOUNCE_MS)
    } else if (step.schedule === 'clear') {
      clearTimer()
    }
    applyPaint()
    for (const listener of listeners) listener()
  }

  return {
    enter: (anchor, opts) => dispatch({ type: 'enter', anchor, boundary: opts?.boundary === true }),
    retarget: (anchor) => dispatch({ type: 'retarget', anchor }),
    leave: (anchor) => dispatch({ type: 'leave', anchor }),
    editEnter: (id) => dispatch({ type: 'editEnter', id }),
    editExit: (id) => dispatch({ type: 'editExit', id }),
    error: () => dispatch({ type: 'error' }),
    errorFixed: () => dispatch({ type: 'errorFixed' }),
    hush: () => dispatch({ type: 'hush' }),
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => state,
    dispose() {
      clearTimer()
      state = initChrome<A>()
      applyPaint()
      listeners.clear()
    }
  }
}

/** Singleton bus — imperative port for the chrome host + useHushLayer reset. */
export const chromeState: ChromeRuntime<HTMLElement> = createChromeRuntime<HTMLElement>()
