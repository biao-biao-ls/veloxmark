/**
 * P17 e2e seam — link resolve / navigate / revalidate / openExternal handle
 * (task 1A split). Effect body moved verbatim from App.tsx (dep array kept
 * as-is). `openExternalImplRef` is business-shared (App's openExternal path
 * reads it) and stays in App. Contract: e2e/handles.d.ts `__veloxP17`.
 */
import { useEffect } from 'react'
import { getLivePreviewConfig } from '../../editor/livePreview/config'
import { getBrokenHrefs as getBrokenHrefsFromCache } from '../../editor/livePreview/linkNav'
import { setPreferences } from '../../preferences/store'
import type { OpenExternalImplRef, ViewRef } from './types'

export interface P17Deps {
  viewRef: ViewRef
  resolveAndNavigate: (href: string) => Promise<void>
  revalidateLinks: () => Promise<void>
  /** Business-shared — App's openExternal path reads it. */
  openExternalImplRef: OpenExternalImplRef
}

export function useP17Seam(deps: P17Deps): void {
  const { viewRef, resolveAndNavigate, revalidateLinks, openExternalImplRef } = deps
  // P17 e2e handle.
  useEffect(() => {
    window.__veloxP17 = {
      resolve: (href, baseDir) => {
        const view = viewRef.current
        const bd = baseDir ?? (view ? getLivePreviewConfig(view.state).baseDir : '')
        return window.api.resolveLink(bd, href)
      },
      navigate: (href) => resolveAndNavigate(href),
      revalidate: () => revalidateLinks(),
      getBrokenHrefs: () => {
        const view = viewRef.current
        const bd = view ? getLivePreviewConfig(view.state).baseDir : ''
        return getBrokenHrefsFromCache(bd)
      },
      getLinkEpoch: () => {
        const view = viewRef.current
        return view ? getLivePreviewConfig(view.state).linkEpoch : -1
      },
      setExternalConfirm: (v) => setPreferences({ externalLinkConfirm: v }),
      setOpenExternalImpl: (fn) => {
        openExternalImplRef.current = fn
      }
    }
  }, [resolveAndNavigate, revalidateLinks, viewRef])
}
