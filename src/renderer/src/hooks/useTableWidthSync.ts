import { useCallback, useEffect, useRef } from 'react'
import { getTableEdit, restoreColWidths } from '../editor/table/state'
import { getSession, patchSession } from '../preferences/store'
import type { FilePathRef, ViewRef } from '../e2e/seams/types'
import { createSigGate, type SigGate } from './syncGate'

export type SyncColWidthsRef = { current: () => void }

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
  const sigGateRef = useRef<SigGate>(createSigGate())
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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
    if (!sigGateRef.current.consume(JSON.stringify(Object.entries(rec)))) return
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
      sigGateRef.current.forceNext()
      view.dispatch({ effects: restoreColWidths.of(map) })
    },
    [viewRef]
  )

  useEffect(() => {
    restoreColWidthsFor(filePath)
  }, [filePath, restoreColWidthsFor])

  useEffect(() => () => clearTimeout(writeTimerRef.current), [])

  return { syncColWidthsRef }
}
