/**
 * P18 heading-fold sync domain (task 4.4 = 1.3: body moved verbatim from
 * App.tsx L167–220). Mirrors the editor fold set into React (Outline
 * triangles) and persists it under SessionState.headingFolds[filePath];
 * restores the remembered folds on file open/switch.
 *
 * Persistence horizon (IT-02 FE-09 wording fix): `veloxmark.session` is a
 * localStorage key — fold memory is **cross-restart** (Q10, AC-FN-25), not
 * in-session-only. "Session" names the storage namespace. Fold state is pure
 * display state: it is never written into the .md body (AC-RULE-14) — the
 * only document writes in a fold's lifecycle are the user's own edits.
 *
 * FE-07 outline⇄body loop (ren-head:fold 双向同步): both entries write the
 * same toggleFold/expandFolds channel —
 *   outline click/←→  → onToggleFold → toggleFold effect → foldField
 *   body caret click  → foldClickExtension → toggleFold effect → foldField
 * — and every fold-set change lands in onFoldChanged → syncFoldedKeys, which
 * drives the Outline mirror (foldedKeys) and the session write. This hook is
 * the single write-back funnel (STORE §3.2: no parallel keys).
 *
 * Cleaning rule (IT-02 FE-09, useQuoteFold parity): ids are filtered against
 * the live **foldable sections** (collectFoldSections — a heading with no
 * body lines can never fold) before write-back/restore, so renamed/deleted
 * headings and effect-only ghost keys (e.g. outline toggle on an empty
 * section) are dropped silently and never pollute storage; sibling folds
 * stay untouched.
 *
 * `restoreFoldsForRef` is business-shared: App passes it to useP18Seam
 * (contract type RestoreFoldsForRef in e2e/seams/types.ts — shape pinned).
 * Ref-mirroring (`xxxRef.current = xxx` during render) is the established
 * pattern — consumers hold the refs, never the bare callbacks.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { collectFoldSections, getFoldedKeys, restoreFolds } from '../editor/livePreview/fold'
import { getSession, patchSession } from '../preferences/store'
import type { FilePathRef, RestoreFoldsForRef, ViewRef } from '../e2e/seams/types'
import { computeSig, createSigGate, type SigGate } from './syncGate'

/** Same shape convention as RestoreFoldsForRef — see e2e/seams/types.ts. */
export type SyncFoldedKeysRef = { current: () => void }

export interface UseFoldSyncArgs {
  viewRef: ViewRef
  filePathRef: FilePathRef
  suppressDirtyRef: { current: boolean }
  filePath: string | null
}

export interface UseFoldSyncResult {
  foldedKeys: ReadonlySet<string>
  syncFoldedKeysRef: SyncFoldedKeysRef
  restoreFoldsForRef: RestoreFoldsForRef
}

export function useFoldSync({
  viewRef,
  filePathRef,
  suppressDirtyRef,
  filePath
}: UseFoldSyncArgs): UseFoldSyncResult {
  const [foldedKeys, setFoldedKeys] = useState<ReadonlySet<string>>(() => new Set())
  // Shared signature gate (useQuoteFold/useTableWidthSync parity). Force is a
  // boolean, never a '' sentinel — '' is the legal signature of an empty fold
  // set (syncGate.ts why-note).
  const sigGateRef = useRef<SigGate>(createSigGate())

  /**
   * Mirror the editor fold set into React (Outline triangles) and persist it
   * under SessionState.headingFolds[filePath] (cross-restart, see header).
   * Signature-gated write-back: frequent selection transactions stay cheap
   * and do not spam localStorage, and a heading rename/delete (which drops
   * the key inside foldField without a fold effect) still lands here via
   * onChange — the stale key is filtered out and cleaned from storage on
   * that write (失效清洗, NAV §3.3).
   */
  const syncFoldedKeys = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const keys = getFoldedKeys(view.state)
    // consume() applies on signature change OR a forced re-sync (restore
    // path); same-signature non-forced calls early-return (anti-write-jitter).
    if (!sigGateRef.current.consume(computeSig(keys))) return
    setFoldedKeys(new Set(keys))
    // Programmatic document replacement (file open/switch) drops the outgoing
    // file's keys inside foldField — that is not a user unfold. Persisting it
    // would wipe the target path's fold memory mid-switch, so loads skip
    // the session write (see useFileOps suppressDirtyRef).
    if (suppressDirtyRef.current) return
    const path = filePathRef.current
    if (!path) return
    // Keep only keys that still name a live foldable section (useQuoteFold
    // parity: quote ids filter against live quote blocks the same way).
    const live = new Set(collectFoldSections(view.state).map((r) => r.key))
    const valid = [...keys].filter((k) => live.has(k))
    const all = getSession().headingFolds ?? {}
    patchSession({ headingFolds: { ...all, [path]: valid } })
  }, [viewRef, filePathRef, suppressDirtyRef])
  const syncFoldedKeysRef = useRef(syncFoldedKeys)
  syncFoldedKeysRef.current = syncFoldedKeys

  /**
   * Restore the cross-restart fold memory for `path` — keys must still name
   * live foldable sections (same cleaning rule as the write-back above).
   */
  const restoreFoldsFor = useCallback(
    (path: string | null) => {
      const view = viewRef.current
      if (!view) return
      const saved = path ? getSession().headingFolds?.[path] : undefined
      const live = new Set(collectFoldSections(view.state).map((r) => r.key))
      const valid = new Set((saved ?? []).filter((k) => live.has(k)))
      // Force the next sync to apply even when the restored set is empty —
      // `''` (the empty-set signature) must not gate it out, or the mirror
      // keeps the previous document's folds (useQuoteFold parity).
      sigGateRef.current.forceNext()
      view.dispatch({ effects: restoreFolds.of(valid) })
    },
    [viewRef]
  )
  const restoreFoldsForRef = useRef(restoreFoldsFor)
  restoreFoldsForRef.current = restoreFoldsFor

  // File open/switch → apply that file's remembered folds.
  // loadContent dispatches the new doc synchronously before setFilePath, so
  // this effect (post-render) always reads outlines of the new document.
  useEffect(() => {
    restoreFoldsForRef.current(filePath)
  }, [filePath])

  return { foldedKeys, syncFoldedKeysRef, restoreFoldsForRef }
}
