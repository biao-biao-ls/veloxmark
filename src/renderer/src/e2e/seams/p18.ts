/**
 * P18 e2e seam — heading-fold handle (task 1A split).
 *
 * Effect body moved verbatim from App.tsx (dep array kept as-is).
 * `restoreFoldsForRef` is business-shared (App's fold-sync effect writes it)
 * and stays in App. Contract: e2e/handles.d.ts `__veloxP18`.
 */
import { useEffect } from 'react'
import {
  collectFoldRanges,
  foldKey,
  getFoldedKeys,
  restoreFolds,
  toggleFold
} from '../../editor/livePreview/fold'
import { extractOutline } from '../../outline/extract'
import { getSession } from '../../preferences/store'
import type { FilePathRef, RestoreFoldsForRef, ViewRef } from './types'

export interface P18Deps {
  viewRef: ViewRef
  filePathRef: FilePathRef
  /** Business-shared — App's fold-sync effect writes it. */
  restoreFoldsForRef: RestoreFoldsForRef
}

export function useP18Seam(deps: P18Deps): void {
  const { viewRef, filePathRef, restoreFoldsForRef } = deps
  // P18 e2e handle: heading folds.
  useEffect(() => {
    window.__veloxP18 = {
      getFoldedKeys: () => {
        const view = viewRef.current
        return view ? [...getFoldedKeys(view.state)] : []
      },
      toggleKey: (key) => {
        viewRef.current?.dispatch({ effects: toggleFold.of(key) })
      },
      getRanges: () => {
        const view = viewRef.current
        if (!view) return []
        return collectFoldRanges(view.state, getFoldedKeys(view.state)).map((r) => ({
          key: r.key,
          from: r.from,
          to: r.to,
          lines: r.lines
        }))
      },
      getHeadingKeys: () => {
        const view = viewRef.current
        if (!view) return []
        return extractOutline(view.state).map((i) => foldKey(i.level, i.text))
      },
      restoreFromSession: () => {
        restoreFoldsForRef.current(filePathRef.current)
      },
      restoreKeys: (keys) => {
        viewRef.current?.dispatch({ effects: restoreFolds.of(new Set(keys)) })
      },
      getSessionFolds: () => {
        const path = filePathRef.current
        return path ? (getSession().headingFolds?.[path] ?? []) : []
      },
      benchToggle: (key, n = 20) => {
        const view = viewRef.current
        if (!view) return { ms: 0, avg: 0 }
        const t0 = performance.now()
        for (let i = 0; i < n; i++) {
          view.dispatch({ effects: toggleFold.of(key) })
        }
        const ms = performance.now() - t0
        return { ms, avg: ms / n }
      }
    }
  }, [viewRef, filePathRef])
}
