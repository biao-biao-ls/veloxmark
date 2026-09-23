import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import type { AutoSaveMode } from '../preferences/store'
import { t } from '../i18n'

/**
 * P12 autosave + crash-recovery draft layer.
 *
 * Two independent debounced pipelines share the editor-change signal:
 *  - drafts (crash recovery): every mode writes `{path, content}` to the
 *    main-process draft store after 1s idle (main throttles disk writes).
 *    Successful saves discard drafts (see useFileOps); this layer only runs
 *    while the document is dirty and the pref is on.
 *  - autosave: 'debounce' saves `delaySec` after the last change;
 *    'interval' saves every `intervalMin` minutes while dirty. File-backed
 *    documents reuse saveFile; Untitled buffers save into the draft area
 *    and are marked clean ("保存即 clean" — the draft *is* the save target
 *    until the user picks a path).
 *
 * UX-P12 F3: a failed write is never silent — the sticky status/titlebar
 * slots flip to "Auto-save failed HH:MM" (cleared by the next success) and a
 * rate-limited toast carrying path + reason fires through `onAutoSaveFailed`.
 */

const DRAFT_DEBOUNCE_MS = 1000
/** Consecutive-failure toast throttle — the sticky slot stays visible anyway. */
const FAIL_TOAST_INTERVAL_MS = 60_000

interface SaveAllResult {
  ok: boolean
  failedPath?: string | null
  error?: unknown
}

interface Args {
  viewRef: RefObject<EditorView | null>
  filePathRef: RefObject<string | null>
  dirtyRef: RefObject<boolean>
  mode: AutoSaveMode
  delaySec: number
  intervalMin: number
  crashRecoveryEnabled: boolean
  /** Reuse useFileOps.saveFile (writes the file, clears dirty; false on write failure). */
  saveFile: () => Promise<boolean>
  /** P26: write EVERY dirty tab (autosave covers all tabs, not just active). */
  saveAllDirtyTabs?: () => Promise<SaveAllResult>
  /**
   * 3.1 single source: untitled-draft save bookkeeping (saved baseline +
   * clear dirty + app-state sync) lives in useFileOps.markActiveSaved — the
   * raw savedContentRef/dirtyRef/setDirty triple writes are gone from here.
   */
  markActiveSaved: (content: string, path: string | null) => void
  /** UX-P12 F3: transient failure toast (App → statusbar sb-toast). Rate-limited here. */
  onAutoSaveFailed?: (message: string) => void
}

export function useAutoSave(args: Args): {
  lastAutoSaveAt: number | null
  /** UX-P12 F3: sticky failure label until the next successful autosave. */
  lastAutoSaveError: string | null
  notifyChange: () => void
} {
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<number | null>(null)
  const [lastAutoSaveError, setLastAutoSaveError] = useState<string | null>(null)
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastFailToastAt = useRef(0)

  // Latest-args ref so stable callbacks below never capture stale prefs/ops.
  const argsRef = useRef(args)
  argsRef.current = args

  const markSuccess = useCallback((): void => {
    setLastAutoSaveAt(Date.now())
    setLastAutoSaveError(null)
  }, [])

  const reportFailure = useCallback((path: string | null, err: unknown): void => {
    const reason = err instanceof Error ? err.message : String(err ?? '')
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setLastAutoSaveError(t('status.autoSaveFailed', { time }))
    const now = Date.now()
    if (now - lastFailToastAt.current < FAIL_TOAST_INTERVAL_MS) return
    lastFailToastAt.current = now
    const msg =
      path != null && path !== ''
        ? t('toast.autoSaveFailedPath', { path, reason })
        : t('toast.autoSaveFailed', { reason })
    argsRef.current.onAutoSaveFailed?.(msg)
  }, [])

  const performAutoSave = useCallback(async (): Promise<void> => {
    const a = argsRef.current
    const view = a.viewRef.current
    try {
      // P26: autosave walks all dirty tabs; falls back to active-only when the
      // tab layer has not registered the helper (single-doc contexts).
      if (a.saveAllDirtyTabs) {
        const hadDirty = a.dirtyRef.current
        const res = await a.saveAllDirtyTabs()
        if (res && res.ok === false) {
          reportFailure(res.failedPath ?? a.filePathRef.current, res.error ?? new Error('write failed'))
          return
        }
        if (hadDirty) markSuccess()
        return
      }
      if (!view || !a.dirtyRef.current) return
      const path = a.filePathRef.current
      if (path) {
        const ok = await a.saveFile()
        if (ok) markSuccess()
        else reportFailure(path, new Error('write failed'))
        return
      }
      // Untitled → draft area, then the same clean bookkeeping as a real save.
      const content = view.state.doc.toString()
      await window.api.draftWrite(null, content)
      a.markActiveSaved(content, null)
      markSuccess()
    } catch (err) {
      reportFailure(a.filePathRef.current, err)
    }
  }, [markSuccess, reportFailure])

  /** Called from the editor's onChange (via a ref in App). */
  const notifyChange = useCallback((): void => {
    const a = argsRef.current
    if (a.crashRecoveryEnabled) {
      if (draftTimer.current) clearTimeout(draftTimer.current)
      draftTimer.current = setTimeout(() => {
        const cur = argsRef.current
        const view = cur.viewRef.current
        if (!view || !cur.dirtyRef.current || !cur.crashRecoveryEnabled) return
        void window.api.draftWrite(cur.filePathRef.current, view.state.doc.toString())
      }, DRAFT_DEBOUNCE_MS)
    }
    if (a.mode === 'debounce') {
      if (autoTimer.current) clearTimeout(autoTimer.current)
      autoTimer.current = setTimeout(() => {
        void performAutoSave()
      }, argsRef.current.delaySec * 1000)
    }
  }, [performAutoSave])

  // Fixed-interval autosave: (re)armed whenever mode/interval change.
  useEffect(() => {
    if (intervalTimer.current) {
      clearInterval(intervalTimer.current)
      intervalTimer.current = null
    }
    if (args.mode !== 'interval') return
    intervalTimer.current = setInterval(() => {
      void performAutoSave()
    }, args.intervalMin * 60 * 1000)
    return () => {
      if (intervalTimer.current) {
        clearInterval(intervalTimer.current)
        intervalTimer.current = null
      }
    }
  }, [args.mode, args.intervalMin, performAutoSave])

  useEffect(() => {
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current)
      if (autoTimer.current) clearTimeout(autoTimer.current)
      if (intervalTimer.current) clearInterval(intervalTimer.current)
    }
  }, [])

  return { lastAutoSaveAt, lastAutoSaveError, notifyChange }
}
