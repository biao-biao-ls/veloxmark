/**
 * IT-03 FE-08 long-quote fold sync domain (useFoldSync mirror, STORE §3.2).
 * Persists the editor's folded quote-block ids under
 * SessionState.quoteFolds[filePath] and restores them on file open/switch
 * via restoreQuoteFolds (wholesale set replace — anti-crosstalk).
 *
 * Writeback discipline is useFoldSync's: signature-gated (frequent selection
 * transactions stay cheap and do not spam localStorage), suppressDirty-gated
 * (programmatic document replacement must not wipe the target path's
 * session folds mid-switch), ids filtered to live quote blocks before the
 * write (STORE §3.2 id-drift contract: mismatched ids are dropped silently,
 * other entries untouched).
 */
import { useCallback, useEffect, useRef } from 'react'
import {
  collectQuoteFoldBlocks,
  getQuoteFoldedKeys,
  restoreQuoteFolds
} from '../editor/livePreview/quoteFold'
import { getSession, patchSession } from '../preferences/store'
import type { FilePathRef, ViewRef } from '../e2e/seams/types'
import { computeSig, createSigGate, type SigGate } from './syncGate'

/** Same shape convention as SyncFoldedKeysRef — see useFoldSync. */
export type SyncQuoteFoldsRef = { current: () => void }

export interface UseQuoteFoldArgs {
  viewRef: ViewRef
  filePathRef: FilePathRef
  suppressDirtyRef: { current: boolean }
  filePath: string | null
}

export interface UseQuoteFoldResult {
  syncQuoteFoldsRef: SyncQuoteFoldsRef
}

export function useQuoteFold({
  viewRef,
  filePathRef,
  suppressDirtyRef,
  filePath
}: UseQuoteFoldArgs): UseQuoteFoldResult {
  // Shared signature gate (useFoldSync parity): force is a boolean — `''` is
  // the legal signature of an empty quote-fold set (syncGate.ts why-note).
  const sigGateRef = useRef<SigGate>(createSigGate())

  /** Live quote-block keys of the current document (validity filter). */
  const liveKeys = useCallback(() => {
    const view = viewRef.current
    if (!view) return new Set<string>()
    return new Set(collectQuoteFoldBlocks(view.state).map((b) => b.key))
  }, [viewRef])

  const syncQuoteFolds = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const keys = getQuoteFoldedKeys(view.state)
    // consume() applies on signature change OR a forced re-sync (restore path);
    // same-signature non-forced calls early-return (anti-write-jitter).
    if (!sigGateRef.current.consume(computeSig(keys))) return
    // File open/switch drops the outgoing file's keys inside quoteFoldField —
    // that is not a user unfold (see useFoldSync's suppressDirty gate).
    if (suppressDirtyRef.current) return
    const path = filePathRef.current
    if (!path) return
    const have = liveKeys()
    const valid = [...keys].filter((k) => have.has(k))
    const all = getSession().quoteFolds ?? {}
    patchSession({ quoteFolds: { ...all, [path]: valid } })
  }, [liveKeys, filePathRef, suppressDirtyRef])
  const syncQuoteFoldsRef = useRef(syncQuoteFolds)
  syncQuoteFoldsRef.current = syncQuoteFolds

  /** Restore session folds for `path` — ids must still match live blocks. */
  const restoreQuoteFoldsFor = useCallback(
    (path: string | null) => {
      const view = viewRef.current
      if (!view) return
      const saved = path ? getSession().quoteFolds?.[path] : undefined
      const have = liveKeys()
      const valid = new Set((saved ?? []).filter((k) => have.has(k)))
      // Force the next sync even when the restored set is empty — `''` is a
      // legal signature and must not gate the write-back out (useFoldSync parity).
      sigGateRef.current.forceNext()
      view.dispatch({ effects: restoreQuoteFolds.of(valid) })
    },
    [liveKeys, viewRef]
  )

  // File open/switch → apply that file's remembered folds. Runs post-render
  // (useFoldSync convention): loadContent has already swapped the document.
  useEffect(() => {
    restoreQuoteFoldsFor(filePath)
  }, [filePath, restoreQuoteFoldsFor])

  return { syncQuoteFoldsRef }
}
