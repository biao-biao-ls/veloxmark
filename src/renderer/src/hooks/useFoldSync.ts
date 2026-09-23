/**
 * P18 heading-fold sync domain (task 4.4 = 1.3: body moved verbatim from
 * App.tsx L167–220). Mirrors the editor fold set into React (Outline
 * triangles) and persists it under SessionState.headingFolds[filePath];
 * restores session folds on file open/switch.
 *
 * `restoreFoldsForRef` is business-shared: App passes it to useP18Seam
 * (contract type RestoreFoldsForRef in e2e/seams/types.ts — shape pinned).
 * Ref-mirroring (`xxxRef.current = xxx` during render) is the established
 * pattern — consumers hold the refs, never the bare callbacks.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { extractOutline } from '../outline/extract'
import { foldKey, getFoldedKeys, restoreFolds } from '../editor/livePreview/fold'
import { getSession, patchSession } from '../preferences/store'
import type { FilePathRef, RestoreFoldsForRef, ViewRef } from '../e2e/seams/types'

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
  const foldSigRef = useRef<string>('')

  /**
   * Mirror the editor fold set into React (Outline triangles) and persist it
   * under SessionState.headingFolds[filePath]. Signature-gated so frequent
   * selection transactions stay cheap and do not spam localStorage.
   */
  const syncFoldedKeys = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const keys = getFoldedKeys(view.state)
    const sig = [...keys].sort().join('\n')
    if (sig === foldSigRef.current) return
    foldSigRef.current = sig
    setFoldedKeys(new Set(keys))
    // Programmatic document replacement (file open/switch) drops the outgoing
    // file's keys inside foldField — that is not a user unfold. Persisting it
    // would wipe the target path's session folds mid-switch, so loads skip
    // the session write (see useFileOps suppressDirtyRef).
    if (suppressDirtyRef.current) return
    const path = filePathRef.current
    if (!path) return
    const have = new Set(extractOutline(view.state).map((i) => foldKey(i.level, i.text)))
    const valid = [...keys].filter((k) => have.has(k))
    const all = getSession().headingFolds ?? {}
    patchSession({ headingFolds: { ...all, [path]: valid } })
  }, [viewRef, filePathRef, suppressDirtyRef])
  const syncFoldedKeysRef = useRef(syncFoldedKeys)
  syncFoldedKeysRef.current = syncFoldedKeys

  /** Restore session folds for `path` — keys must still match live headings. */
  const restoreFoldsFor = useCallback(
    (path: string | null) => {
      const view = viewRef.current
      if (!view) return
      const saved = path ? getSession().headingFolds?.[path] : undefined
      const have = new Set(extractOutline(view.state).map((i) => foldKey(i.level, i.text)))
      const valid = new Set((saved ?? []).filter((k) => have.has(k)))
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
