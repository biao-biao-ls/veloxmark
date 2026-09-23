/**
 * P14 e2e seam — i18n / doc-stats handle (task 1A split).
 *
 * Effect body moved verbatim from App.tsx. Seam-only `statsRef` /
 * `loadContentRef` migrate with it (same per-render mirror pattern).
 * Contract: e2e/handles.d.ts `__veloxP14`.
 */
import { useEffect, useRef } from 'react'
import { getLang, t } from '../../i18n'
import { setPreferences } from '../../preferences/store'
import type { DocStats, FileOps } from './types'

export interface P14Deps {
  stats: DocStats
  fileOps: FileOps
}

export function useP14Seam(deps: P14Deps): void {
  const { stats, fileOps } = deps
  // P14 e2e handle.
  const statsRef = useRef(stats)
  statsRef.current = stats
  const loadContentRef = useRef(fileOps.loadContent)
  loadContentRef.current = fileOps.loadContent
  useEffect(() => {
    window.__veloxP14 = {
      setLanguage: (pref) => setPreferences({ language: pref }),
      getLang: () => getLang(),
      getStats: () => statsRef.current,
      t: (key, params) => t(key, params),
      loadDoc: (text, path) => loadContentRef.current(text, path)
    }
  }, [])
}
