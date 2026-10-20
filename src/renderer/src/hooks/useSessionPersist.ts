import { useEffect, useState } from 'react'
import type { RecentItem } from '../commands'
import type { DocTabInfo } from './docTabs'
import { baseNameOf } from '../pathUtil'
import { getPreferences, getSession, patchSession, setPreferences } from '../preferences/store'
import type { SidebarMode } from '../preferences/store'
import { upsertRecent } from '../filetree/recents'

export interface UseSessionPersistArgs {
  sessionSynced: boolean
  showSidebar: boolean
  sidebarMode: SidebarMode
  sidebarWidth: number
  persistTabsSession: () => void
  tabInfos: DocTabInfo[]
  recentFiles: string[]
}

export function useSessionPersist({
  sessionSynced,
  showSidebar,
  sidebarMode,
  sidebarWidth,
  persistTabsSession,
  tabInfos,
  recentFiles
}: UseSessionPersistArgs): { recentItems: RecentItem[] } {
  useEffect(() => {
    const last = getSession().lastFolderPath
    if (!last) return
    patchSession({ lastFolderPath: null })
    const p = getPreferences()
    const recentFolders = upsertRecent(p.recentFolders, last)
    if (recentFolders !== p.recentFolders) setPreferences({ recentFolders })
  }, [])

  useEffect(() => {
    if (!sessionSynced) return
    patchSession({ sidebarVisible: showSidebar })
  }, [sessionSynced, showSidebar])
  useEffect(() => {
    if (!sessionSynced) return
    patchSession({ sidebarMode })
  }, [sessionSynced, sidebarMode])
  useEffect(() => {
    if (!sessionSynced) return
    patchSession({ sidebarWidth })
  }, [sessionSynced, sidebarWidth])
  useEffect(() => {
    if (!sessionSynced) return
    persistTabsSession()
  }, [sessionSynced, tabInfos])

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
