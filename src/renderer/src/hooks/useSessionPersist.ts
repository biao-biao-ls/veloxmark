/**
 * P03 session-persistence write side (task 4.4 = 1.3: bodies moved verbatim
 * from App.tsx L257–307). One-way writes: React state → session store / IPC.
 * The native-menu subscription effect that sat in this block stays in App
 * (double-dispatch defect locus — task 4.5 restructures it).
 *
 * Deps are explicit primitives/stable callbacks on purpose — never pass hook
 * or store object literals (their per-render identity would resurface in the
 * dep arrays below).
 */
import { useEffect, useState } from 'react'
import type { RecentItem } from '../commands'
import type { DocTabInfo } from './docTabs'
import { baseNameOf } from '../pathUtil'
import { patchSession } from '../preferences/store'
import type { SidebarMode } from '../preferences/store'

export interface UseSessionPersistArgs {
  /**
   * These effects fire on mount, which is *before* the restore effect runs and
   * while restoringRef is still false. Writing then would overwrite the saved
   * session with the initial React state — sidebarVisible true, mode 'outline',
   * width 240 — wiping recents, last paths and the stored sidebar layout on
   * every launch. Gate on sessionSynced, which the restore effect flips once
   * the saved state has been applied; flipping it re-runs these effects, so
   * the restored values are written back and later edits keep persisting.
   */
  sessionSynced: boolean
  showOutline: boolean
  sidebarMode: SidebarMode
  sidebarWidth: number
  persistTabsSession: () => void
  tabInfos: DocTabInfo[]
  recentFiles: string[]
}

export function useSessionPersist({
  sessionSynced,
  showOutline,
  sidebarMode,
  sidebarWidth,
  persistTabsSession,
  tabInfos,
  recentFiles
}: UseSessionPersistArgs): { recentItems: RecentItem[] } {
  useEffect(() => {
    if (!sessionSynced) return
    patchSession({ sidebarVisible: showOutline })
  }, [sessionSynced, showOutline])
  useEffect(() => {
    if (!sessionSynced) return
    patchSession({ sidebarMode })
  }, [sessionSynced, sidebarMode])
  useEffect(() => {
    if (!sessionSynced) return
    patchSession({ sidebarWidth })
  }, [sessionSynced, sidebarWidth])
  // P26: tab set persistence (paths + active) — fires when tabs change.
  useEffect(() => {
    if (!sessionSynced) return
    persistTabsSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionSynced, tabInfos])

  // Validated Recent Files entries for the File menu (and the macOS native
  // menu, which receives the same list over IPC).
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const files = recentFiles
      const items = await Promise.all(
        files.map(async (path) => ({
          path,
          name: baseNameOf(path),
          exists: await window.api.pathExists(path)
        }))
      )
      if (!cancelled) setRecentItems(items)
    })()
    return () => {
      cancelled = true
    }
  }, [recentFiles])

  useEffect(() => {
    void window.api.setRecentFiles(recentItems.map(({ path, exists }) => ({ path, exists })))
  }, [recentItems])

  return { recentItems }
}
