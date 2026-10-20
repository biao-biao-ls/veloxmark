import { HOVER_DELAY_MS } from '../../hooks/useHoverDiscipline'


export const CHROME_DEBOUNCE_MS = HOVER_DELAY_MS

export const CHROME_SLOT_PX = 0

export const CHROME_ON_CLASS = 'cm-md-chrome-on'


export type ChromePhase = 'idle' | 'hover' | 'editing' | 'error'

export type ChromeMicro = 'hidden' | 'show-pending' | 'visible' | 'hide-pending'

export interface ChromeSnapshot<A = unknown> {
  readonly phase: ChromePhase
  readonly errorFrom: ChromePhase | null
  readonly micro: ChromeMicro
  readonly anchor: A | null
  readonly editId: unknown | null
  readonly toolbarVisible: boolean
  readonly microVisible: boolean
  readonly slotPx: number
  readonly quietLock: boolean
}

export type ChromeEvent<A = unknown> =
  | {
      type: 'enter'
      anchor: A
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
      if (snapshot.phase === 'editing' || snapshot.phase === 'error') {
        return { snapshot, schedule: null }
      }
      let state = snapshot
      if (state.quietLock) {
        if (event.boundary !== true) return { snapshot, schedule: null }
        state = { ...state, quietLock: false }
      }
      const base = { phase: 'hover' as ChromePhase, anchor: event.anchor, errorFrom: null }
      switch (state.micro) {
        case 'show-pending':
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
          return {
            snapshot: snapshotOf(state, { ...base, micro: 'visible' }),
            schedule: 'clear'
          }
      }
      break
    }
    case 'retarget': {
      if (snapshot.phase === 'editing' || snapshot.phase === 'error') {
        return { snapshot, schedule: null }
      }
      if (snapshot.quietLock) {
        return { snapshot, schedule: null }
      }
      const base = { phase: 'hover' as ChromePhase, anchor: event.anchor, errorFrom: null }
      switch (snapshot.micro) {
        case 'show-pending':
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
      if (snapshot.phase === 'editing' || snapshot.phase === 'error') {
        return { snapshot, schedule: null }
      }
      if (snapshot.quietLock) {
        return {
          snapshot: snapshotOf(snapshot, { quietLock: false, ...HIDDEN_PATCH }),
          schedule: 'clear'
        }
      }
      if (snapshot.anchor !== event.anchor) return { snapshot, schedule: null }
      switch (snapshot.micro) {
        case 'show-pending':
          return {
            snapshot: snapshotOf(snapshot, { phase: 'idle', ...HIDDEN_PATCH }),
            schedule: 'clear'
          }
        case 'visible':
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
        return {
          snapshot: snapshotOf(snapshot, { phase: 'idle', ...HIDDEN_PATCH }),
          schedule: 'clear'
        }
      }
      return { snapshot, schedule: null }
    }
    case 'editEnter': {
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
      if (snapshot.editId !== event.id) return { snapshot, schedule: null }
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
      return {
        snapshot: snapshotOf(snapshot, { phase: 'idle', ...HIDDEN_PATCH, quietLock: true }),
        schedule: 'clear'
      }
    }
  }
}


export interface ChromeRuntime<A> {
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
  dispose(): void
}

export interface ChromeRuntimeOptions<A> {
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

export const chromeState: ChromeRuntime<HTMLElement> = createChromeRuntime<HTMLElement>()
