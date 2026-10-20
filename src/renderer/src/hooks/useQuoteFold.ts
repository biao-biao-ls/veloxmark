import { useCallback, useEffect, useRef } from 'react'
import {
  collectQuoteFoldBlocks,
  getQuoteFoldedKeys,
  restoreQuoteFolds
} from '../editor/livePreview/quoteFold'
import { getSession, patchSession } from '../preferences/store'
import type { FilePathRef, ViewRef } from '../e2e/seams/types'
import { computeSig, createSigGate, type SigGate } from './syncGate'

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
  const sigGateRef = useRef<SigGate>(createSigGate())

  const liveKeys = useCallback(() => {
    const view = viewRef.current
    if (!view) return new Set<string>()
    return new Set(collectQuoteFoldBlocks(view.state).map((b) => b.key))
  }, [viewRef])

  const syncQuoteFolds = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const keys = getQuoteFoldedKeys(view.state)
    if (!sigGateRef.current.consume(computeSig(keys))) return
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

  const restoreQuoteFoldsFor = useCallback(
    (path: string | null) => {
      const view = viewRef.current
      if (!view) return
      const saved = path ? getSession().quoteFolds?.[path] : undefined
      const have = liveKeys()
      const valid = new Set((saved ?? []).filter((k) => have.has(k)))
      sigGateRef.current.forceNext()
      view.dispatch({ effects: restoreQuoteFolds.of(valid) })
    },
    [liveKeys, viewRef]
  )

  useEffect(() => {
    restoreQuoteFoldsFor(filePath)
  }, [filePath, restoreQuoteFoldsFor])

  return { syncQuoteFoldsRef }
}
