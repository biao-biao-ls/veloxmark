/**
 * useToast core — glb-toast:* contract tests (IT-01 FE-07).
 *
 * Covers the toast state machine only (pure logic, node env):
 *  - fixed TOAST_DWELL_MS dwell (PEND-05: never extended, never early)
 *  - queue replace: a new toast swaps the current one and resets the clock
 *  - undo action click runs once and acks with the frozen undone receipt
 *    (glb-toast:undo-ack) on a fresh dwell
 *  - no-action form (string shorthand + bare `{ message }`)
 *  - getMessage mirrors the visible message (e2e `getToast` contract)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorState } from '@codemirror/state'
import { history } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'
import { t } from '../i18n'
import {
  createToastStore,
  getToastMessage,
  runToastAction,
  toast,
  TOAST_DWELL_MS,
  undoAction,
  undoWithAck,
  type ToastAction
} from './useToast'

/** Headless view with a real history() stack (and focus spies for the guard). */
function historyView(doc: string): { view: EditorView; getDoc: () => string } {
  let state = EditorState.create({ doc, extensions: [history()] })
  const view = {
    get state() {
      return state
    },
    dispatch(spec: { [k: string]: unknown }) {
      state = state.update(spec as never).state
    },
    focus: vi.fn(),
    dom: { contains: () => false }
  } as unknown as EditorView & { focus: ReturnType<typeof vi.fn> }
  return { view, getDoc: () => state.doc.toString() }
}

describe('toast store core (glb-toast:*)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('auto-dismisses exactly at TOAST_DWELL_MS (5s dwell, PEND-05)', () => {
    const store = createToastStore()
    store.show('已删除第 3 行（Ctrl+Z 可撤销）')
    expect(store.getSnapshot()?.message).toBe('已删除第 3 行（Ctrl+Z 可撤销）')
    vi.advanceTimersByTime(TOAST_DWELL_MS - 1)
    expect(store.getSnapshot()).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(store.getSnapshot()).toBeNull()
    store.dispose()
  })

  it('replaces the current toast on a new one and resets the dwell clock', () => {
    const store = createToastStore()
    store.show('first')
    vi.advanceTimersByTime(TOAST_DWELL_MS - 100)
    store.show('second')
    expect(store.getSnapshot()?.message).toBe('second')
    // The replaced toast's leftover 100ms must NOT dismiss the replacement.
    vi.advanceTimersByTime(200)
    expect(store.getSnapshot()?.message).toBe('second')
    // Fresh full dwell from the replacement.
    vi.advanceTimersByTime(TOAST_DWELL_MS - 200 - 1)
    expect(store.getSnapshot()).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(store.getSnapshot()).toBeNull()
    store.dispose()
  })

  it('runs the undo action once and acks with the frozen undone receipt for a fresh dwell', () => {
    const store = createToastStore()
    const run = vi.fn(() => true)
    const action: ToastAction = { label: t('toast.undoBtn'), run }
    store.show({ message: '已删除第 3 行（Ctrl+Z 可撤销）', action })
    expect(store.getSnapshot()?.action?.label).toBe(t('toast.undoBtn'))
    vi.advanceTimersByTime(1000)
    store.runAction()
    expect(run).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()?.message).toBe(t('toast.undone'))
    expect(store.getSnapshot()?.action).toBeNull()
    // Ack dwells its own full 5s (glb-toast:undo-ack).
    vi.advanceTimersByTime(TOAST_DWELL_MS - 1)
    expect(store.getSnapshot()?.message).toBe(t('toast.undone'))
    vi.advanceTimersByTime(1)
    expect(store.getSnapshot()).toBeNull()
    store.dispose()
  })

  it('keeps the no-action form free of buttons (string shorthand + bare object)', () => {
    const store = createToastStore()
    store.show('已复制')
    expect(store.getSnapshot()).toMatchObject({ message: '已复制', action: null })
    store.show({ message: '已导出 → /tmp/a.md' })
    expect(store.getSnapshot()).toMatchObject({ message: '已导出 → /tmp/a.md', action: null })
    // No-op when there is nothing to run.
    store.runAction()
    expect(store.getSnapshot()?.message).toBe('已导出 → /tmp/a.md')
    store.dispose()
  })

  it('getMessage mirrors the visible message for the getToast e2e contract', () => {
    const store = createToastStore()
    expect(store.getMessage()).toBeNull()
    store.show('已复制')
    expect(store.getMessage()).toBe('已复制')
    vi.advanceTimersByTime(TOAST_DWELL_MS)
    expect(store.getMessage()).toBeNull()
    store.dispose()
  })

  it('notifies subscribers on every state change (useSyncExternalStore feed)', () => {
    const store = createToastStore()
    const seen: Array<string | null> = []
    const unsub = store.subscribe(() => seen.push(store.getSnapshot()?.message ?? null))
    store.show('a')
    store.show('b')
    vi.advanceTimersByTime(TOAST_DWELL_MS)
    unsub()
    expect(seen).toEqual(['a', 'b', null])
    store.dispose()
  })
})

describe('undoWithAck (glb-undo:triple-entry shared face)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    toast('reset')
    vi.advanceTimersByTime(TOAST_DWELL_MS)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('undoes one history step and posts the frozen undone receipt', () => {
    const { view, getDoc } = historyView('cell')
    view.dispatch({ changes: { from: 0, insert: 'X' } })
    expect(getDoc()).toBe('Xcell')
    expect(undoWithAck(view)).toBe(true)
    expect(getDoc()).toBe('cell')
    expect(getToastMessage()).toBe(t('toast.undone'))
  })

  it('returns false and posts no receipt when there is nothing to undo', () => {
    toast('marker')
    const { view } = historyView('cell')
    expect(undoWithAck(view)).toBe(false)
    expect(getToastMessage()).toBe('marker')
  })
})

describe('undoAction button closure (glb-undo:triple-entry)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    toast('reset')
    vi.advanceTimersByTime(TOAST_DWELL_MS)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('undoAction + runToastAction undoes one real history step and acks with the frozen undone receipt', () => {
    const { view, getDoc } = historyView('cell')
    view.dispatch({ changes: { from: 0, insert: 'X' } })
    expect(getDoc()).toBe('Xcell')
    toast({ message: '已删除第 3 行（Ctrl+Z 可撤销）', action: undoAction(view) })
    runToastAction()
    expect(getDoc()).toBe('cell')
    expect(getToastMessage()).toBe(t('toast.undone'))
  })

  it('undo failure (empty stack) on the button posts no fake undone receipt', () => {
    const { view, getDoc } = historyView('cell')
    toast({ message: '已删除第 3 行（Ctrl+Z 可撤销）', action: undoAction(view) })
    runToastAction()
    expect(getDoc()).toBe('cell')
    // No false「已撤销」receipt — the original toast stays (gating in runAction).
    expect(getToastMessage()).toBe('已删除第 3 行（Ctrl+Z 可撤销）')
    expect(getToastMessage()).not.toBe(t('toast.undone'))
  })
})
