import { undo } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'
import { useSyncExternalStore } from 'react'
import { t } from '../i18n'

export const TOAST_DWELL_MS = 5000

export interface ToastAction {
  label: string
  run: () => boolean
}

export interface ToastInputObject {
  message: string
  action?: ToastAction
}

export type ToastInput = string | ToastInputObject

export interface ToastState {
  id: number
  message: string
  action: ToastAction | null
}

export interface ToastStore {
  show(input: ToastInput): void
  runAction(): void
  subscribe(listener: () => void): () => void
  getSnapshot(): ToastState | null
  getMessage(): string | null
  dispose(): void
}

function undoneInput(): ToastInputObject {
  return { message: t('toast.undone') }
}

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


const singleton = createToastStore()

export function toast(input: ToastInput): void {
  singleton.show(input)
}

export function toastUndone(): void {
  singleton.show(undoneInput())
}

export function undoWithAck(view: EditorView): boolean {
  if (!undo(view)) return false
  toastUndone()
  refocusAfterUndo(view)
  return true
}

function refocusAfterUndo(view: EditorView): void {
  const active: Element | null =
    typeof document === 'undefined' ? null : document.activeElement
  if (active && view.dom?.contains(active)) return
  view.focus()
}

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

export function runToastAction(): void {
  singleton.runAction()
}

export function getToastMessage(): string | null {
  return singleton.getMessage()
}

export function useToast(): ToastState | null {
  return useSyncExternalStore(
    singleton.subscribe,
    singleton.getSnapshot,
    () => null as ToastState | null
  )
}
