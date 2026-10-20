import { useCallback, useEffect, useRef, useState } from 'react'
import { collectFoldSections, getFoldedKeys, restoreFolds } from '../editor/livePreview/fold'
import { getSession, patchSession } from '../preferences/store'
import type { FilePathRef, RestoreFoldsForRef, ViewRef } from '../e2e/seams/types'
import { computeSig, createSigGate, type SigGate } from './syncGate'

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
  const sigGateRef = useRef<SigGate>(createSigGate())

  const syncFoldedKeys = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const keys = getFoldedKeys(view.state)
    if (!sigGateRef.current.consume(computeSig(keys))) return
    setFoldedKeys(new Set(keys))
    if (suppressDirtyRef.current) return
    const path = filePathRef.current
    if (!path) return
    const live = new Set(collectFoldSections(view.state).map((r) => r.key))
    const valid = [...keys].filter((k) => live.has(k))
    const all = getSession().headingFolds ?? {}
    patchSession({ headingFolds: { ...all, [path]: valid } })
  }, [viewRef, filePathRef, suppressDirtyRef])
  const syncFoldedKeysRef = useRef(syncFoldedKeys)
  syncFoldedKeysRef.current = syncFoldedKeys

  const restoreFoldsFor = useCallback(
    (path: string | null) => {
      const view = viewRef.current
      if (!view) return
      const saved = path ? getSession().headingFolds?.[path] : undefined
      const live = new Set(collectFoldSections(view.state).map((r) => r.key))
      const valid = new Set((saved ?? []).filter((k) => live.has(k)))
      sigGateRef.current.forceNext()
      view.dispatch({ effects: restoreFolds.of(valid) })
    },
    [viewRef]
  )
  const restoreFoldsForRef = useRef(restoreFoldsFor)
  restoreFoldsForRef.current = restoreFoldsFor

  useEffect(() => {
    restoreFoldsForRef.current(filePath)
  }, [filePath])

  return { foldedKeys, syncFoldedKeysRef, restoreFoldsForRef }
}
