import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import type { AutoSaveMode } from '../preferences/store'

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
 */

const DRAFT_DEBOUNCE_MS = 1000

interface Args {
  viewRef: RefObject<EditorView | null>
  filePathRef: RefObject<string | null>
  dirtyRef: RefObject<boolean>
  savedContentRef: RefObject<string>
  mode: AutoSaveMode
  delaySec: number
  intervalMin: number
  crashRecoveryEnabled: boolean
  /** Reuse useFileOps.saveFile (writes the file, clears dirty). */
  saveFile: () => Promise<boolean>
  setDirty: (dirty: boolean) => void
  syncAppState: (path: string | null, dirty: boolean) => void
}

export function useAutoSave(args: Args): {
  lastAutoSaveAt: number | null
  notifyChange: () => void
} {
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<number | null>(null)
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Latest-args ref so stable callbacks below never capture stale prefs/ops.
  const argsRef = useRef(args)
  argsRef.current = args

  const performAutoSave = useCallback(async (): Promise<void> => {
    const a = argsRef.current
    const view = a.viewRef.current
    if (!view || !a.dirtyRef.current) return
    const path = a.filePathRef.current
    if (path) {
      const ok = await a.saveFile()
      if (ok) setLastAutoSaveAt(Date.now())
      return
    }
    // Untitled → draft area, then the same clean bookkeeping as a real save.
    const content = view.state.doc.toString()
    await window.api.draftWrite(null, content)
    a.savedContentRef.current = content
    a.dirtyRef.current = false
    a.setDirty(false)
    a.syncAppState(null, false)
    setLastAutoSaveAt(Date.now())
  }, [])

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

  return { lastAutoSaveAt, notifyChange }
}
