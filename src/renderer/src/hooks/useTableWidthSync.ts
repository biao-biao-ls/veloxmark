/**
 * 7F table column-width sync domain (mirrors useFoldSync). Persists the
 * editor's colWidths map under SessionState.tableColWidths[filePath] and
 * restores it on file open/switch via restoreColWidths (wholesale replace —
 * drops the outgoing file's mapPos debris, anti-crosstalk).
 *
 * Triggered by setup.ts `onColWidthsChanged` (setColWidth / restoreColWidths
 * effects + Map-identity flips from mapPos remaps). Writes are signature-gated
 * and debounced: offset-keyed maps churn identity on every edit above a table,
 * but only a real content change should reach localStorage.
 *
 * Known limitations (fold parity):
 * - save-as/rename changes the path without a doc replace — the new path's
 *   (empty) memory replaces the live map on the [filePath] restore effect.
 * - Untitled (no path) widths are never persisted.
 */
import { useCallback, useEffect, useRef } from 'react'
import { getTableEdit, restoreColWidths } from '../editor/table/state'
import { getSession, patchSession } from '../preferences/store'
import type { FilePathRef, ViewRef } from '../e2e/seams/types'

/** Same shape convention as SyncFoldedKeysRef — see useFoldSync. */
export type SyncColWidthsRef = { current: () => void }

/** Mirrors the cursor-persist throttle (App.tsx lastCursor timer). */
const WRITE_DEBOUNCE_MS = 500

export interface UseTableWidthSyncArgs {
  viewRef: ViewRef
  filePathRef: FilePathRef
  suppressDirtyRef: { current: boolean }
  filePath: string | null
}

export interface UseTableWidthSyncResult {
  syncColWidthsRef: SyncColWidthsRef
}

export function useTableWidthSync({
  viewRef,
  filePathRef,
  suppressDirtyRef,
  filePath
}: UseTableWidthSyncArgs): UseTableWidthSyncResult {
  const widthSigRef = useRef<string>('')
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  /** Sorted-key serialization — Map iteration order is not stable across rebuilds. */
  const snapshot = useCallback((): Record<string, number[]> => {
    const view = viewRef.current
    const rec: Record<string, number[]> = {}
    if (!view) return rec
    const entries = [...getTableEdit(view.state).colWidths.entries()].sort((a, b) => a[0] - b[0])
    for (const [from, widths] of entries) rec[String(from)] = widths
    return rec
  }, [viewRef])

  const syncColWidths = useCallback(() => {
    const rec = snapshot()
    const sig = JSON.stringify(Object.entries(rec))
    if (sig === widthSigRef.current) return
    widthSigRef.current = sig
    // Programmatic document replacement (file open/switch) mapPos-scrambles the
    // outgoing file's offsets — persisting mid-switch would poison storage
    // (useFoldSync's suppressDirty gate, same rationale).
    if (suppressDirtyRef.current) return
    if (!filePathRef.current) return
    clearTimeout(writeTimerRef.current)
    writeTimerRef.current = setTimeout(() => {
      clearTimeout(writeTimerRef.current)
      const path = filePathRef.current
      if (!path) return
      const all = getSession().tableColWidths ?? {}
      patchSession({ tableColWidths: { ...all, [path]: snapshot() } })
    }, WRITE_DEBOUNCE_MS)
  }, [snapshot, filePathRef, suppressDirtyRef])
  const syncColWidthsRef = useRef(syncColWidths)
  syncColWidthsRef.current = syncColWidths

  /** Restore `path`'s remembered widths — wholesale map replace (AC5). */
  const restoreColWidthsFor = useCallback(
    (path: string | null) => {
      const view = viewRef.current
      if (!view) return
      clearTimeout(writeTimerRef.current)
      const saved = path ? getSession().tableColWidths?.[path] : undefined
      const map = new Map<number, number[]>()
      for (const [from, widths] of Object.entries(saved ?? {})) {
        const n = Number(from)
        if (Number.isFinite(n)) map.set(n, widths)
      }
      widthSigRef.current = '' // force the next sync to re-evaluate
      view.dispatch({ effects: restoreColWidths.of(map) })
    },
    [viewRef]
  )

  // File open/switch → apply that file's remembered widths. Runs post-render
  // (useFoldSync convention): loadContent has already swapped the document.
  useEffect(() => {
    restoreColWidthsFor(filePath)
  }, [filePath, restoreColWidthsFor])

  useEffect(() => () => clearTimeout(writeTimerRef.current), [])

  return { syncColWidthsRef }
}
