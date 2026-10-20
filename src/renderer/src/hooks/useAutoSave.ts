import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import type { AutoSaveMode } from '../preferences/store'
import { t } from '../i18n'


const DRAFT_DEBOUNCE_MS = 1000
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
  draftSlot: () => string | undefined
  mode: AutoSaveMode
  delaySec: number
  intervalMin: number
  crashRecoveryEnabled: boolean
  saveFile: () => Promise<boolean>
  saveAllDirtyTabs?: () => Promise<SaveAllResult>
  onAutoSaveFailed?: (message: string) => void
}

export function useAutoSave(args: Args): {
  lastAutoSaveAt: number | null
  lastAutoSaveError: string | null
  notifyChange: () => void
} {
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<number | null>(null)
  const [lastAutoSaveError, setLastAutoSaveError] = useState<string | null>(null)
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastFailToastAt = useRef(0)

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
      const content = view.state.doc.toString()
      await window.api.draftWrite(null, content, a.draftSlot())
      markSuccess()
    } catch (err) {
      reportFailure(a.filePathRef.current, err)
    }
  }, [markSuccess, reportFailure])

  const notifyChange = useCallback((): void => {
    const a = argsRef.current
    if (a.crashRecoveryEnabled) {
      if (draftTimer.current) clearTimeout(draftTimer.current)
      draftTimer.current = setTimeout(() => {
        const cur = argsRef.current
        const view = cur.viewRef.current
        if (!view || !cur.dirtyRef.current || !cur.crashRecoveryEnabled) return
        void window.api.draftWrite(cur.filePathRef.current, view.state.doc.toString(), cur.draftSlot())
      }, DRAFT_DEBOUNCE_MS)
    }
    if (a.mode === 'debounce') {
      if (autoTimer.current) clearTimeout(autoTimer.current)
      autoTimer.current = setTimeout(() => {
        void performAutoSave()
      }, argsRef.current.delaySec * 1000)
    }
  }, [performAutoSave])

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
