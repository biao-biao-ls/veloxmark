/**
 * glb-toast:* action-capable toast base (IT-01 FE-07).
 *
 * Singleton module-level bus (Dialog/ctxMenu pattern): imperative `toast()` for
 * editor/command call sites, `useToast()` for the render face (ToastHost via
 * useSyncExternalStore). State machine here is pure and unit-tested.
 *
 * Contracts (GLB-global-patterns.md):
 *  - toast:action — `{ message, action?: { label, run } }`; string shorthand is
 *    the legacy no-action form (old call sites compile and behave unchanged)
 *  - toast:undo — the action button is one undo step (same CM6 history as
 *    Ctrl+Z / edit-menu undo); after it runs, the receipt switches to the
 *    frozen「已撤销」and dwells another full 5s (glb-toast:undo-ack)
 *  - dwell-5s (PEND-05) — fixed 5s for every toast, never extended by hover
 *  - queue replace — one visible toast per window; a new toast swaps the
 *    current one and resets the clock
 */
import { undo } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'
import { useSyncExternalStore } from 'react'
import { t } from '../i18n'

/** PEND-05 ruling: fixed dwell for every toast. */
export const TOAST_DWELL_MS = 5000

export interface ToastAction {
  label: string
  /**
   * Runs the action once. Returns true only when it actually applied (undo
   * stepped) — runAction posts the「已撤销」ack on true alone (glb-undo:triple-entry).
   */
  run: () => boolean
}

export interface ToastInputObject {
  message: string
  action?: ToastAction
}

/** GLB toast:action input — string shorthand is the no-action form. */
export type ToastInput = string | ToastInputObject

export interface ToastState {
  /** Monotonic id — ToastHost keys the card so a replacement re-animates. */
  id: number
  message: string
  action: ToastAction | null
}

export interface ToastStore {
  show(input: ToastInput): void
  /** GLB toast:undo — run the current action once, then ack「已撤销」. */
  runAction(): void
  subscribe(listener: () => void): () => void
  getSnapshot(): ToastState | null
  /** e2e `getToast` contract reader — visible message or null. */
  getMessage(): string | null
  /** Cancel timers and drop state (unmount cleanup, zero residue). */
  dispose(): void
}

/** Frozen terminal receipt (glb-toast:undo-ack). */
function undoneInput(): ToastInputObject {
  return { message: t('toast.undone') }
}

/**
 * Factory used by tests and by the module singleton. Timer primitives are the
 * platform ones so vi.useFakeTimers() can drive the machine.
 */
export function createToastStore(): ToastStore {
  const listeners = new Set<() => void>()
  let snapshot: ToastState | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let nextId = 1

  function notify(): void {
    for (const listener of listeners) listener()
  }

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function show(input: ToastInput): void {
    const obj: ToastInputObject = typeof input === 'string' ? { message: input } : input
    clearTimer()
    snapshot = { id: nextId++, message: obj.message, action: obj.action ?? null }
    notify()
    timer = setTimeout(() => {
      timer = null
      snapshot = null
      notify()
    }, TOAST_DWELL_MS)
  }

  return {
    show,
    runAction() {
      const current = snapshot
      if (!current?.action) return
      // Failure (e.g. empty undo stack) must not fake the「已撤销」receipt; the
      // simplest equivalent gating is to keep the original toast untouched.
      if (current.action.run()) show(undoneInput())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => snapshot,
    getMessage: () => snapshot?.message ?? null,
    dispose() {
      clearTimer()
      listeners.clear()
      snapshot = null
    }
  }
}

// ---- module singleton (mermaidLightboxBus / Dialog bus shape) -------------

const singleton = createToastStore()

/** GLB toast:action entry — string shorthand keeps legacy call sites compiling. */
export function toast(input: ToastInput): void {
  singleton.show(input)
}

/** glb-toast:undo-ack for the Ctrl+Z / edit-menu undo entries (three-entry). */
export function toastUndone(): void {
  singleton.show(undoneInput())
}

/**
 * glb-undo:triple-entry shared face: one CM6 history step + the frozen
 * 「已撤销」ack. Returns false (posting no receipt) when there is nothing to
 * undo. Used by the Ctrl+Z / edit-menu entries and the in-cell Mod-z fallback.
 */
export function undoWithAck(view: EditorView): boolean {
  if (!undo(view)) return false
  toastUndone()
  refocusAfterUndo(view)
  return true
}

/**
 * AC-OP-12 terminal state: after an undo entry runs, the next keystroke must
 * reach the content — clicking the toast button (or a menu item) otherwise
 * leaves focus on <body>/the menu. Nested cell editors live inside view.dom,
 * so a focus already there is left alone.
 */
function refocusAfterUndo(view: EditorView): void {
  const active: Element | null =
    typeof document === 'undefined' ? null : document.activeElement
  if (active && view.dom?.contains(active)) return
  view.focus()
}

/**
 * GLB toast:action — the design system's only action is undo (toast:undo):
 * one CM6 history step on `view`, label from the frozen toast.undoBtn key.
 * The「已撤销」ack after run is owned by the store (runAction) and only posts
 * when this run() reports success — same gating as undoWithAck.
 */
export function undoAction(view: EditorView): ToastAction {
  return {
    label: t('toast.undoBtn'),
    run: () => {
      if (!undo(view)) return false
      refocusAfterUndo(view)
      return true
    }
  }
}

/** ToastHost's button target — runs the visible action and posts the ack. */
export function runToastAction(): void {
  singleton.runAction()
}

/** Live reader for the e2e `getToast` contract (P20/P23/P26). */
export function getToastMessage(): string | null {
  return singleton.getMessage()
}

/** Render-face subscription (ToastHost). */
export function useToast(): ToastState | null {
  return useSyncExternalStore(
    singleton.subscribe,
    singleton.getSnapshot,
    () => null as ToastState | null
  )
}
