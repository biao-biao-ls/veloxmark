/**
 * P20 e2e seam — rich-text clipboard handle (task 1A split).
 *
 * Effect body moved verbatim from App.tsx (dep array kept as-is).
 * `toastRef` is business-shared (App's showToast writes it) and stays in App.
 * Contract: e2e/handles.d.ts `__veloxP20`.
 */
import { useEffect } from 'react'
import {
  copyHtmlToClipboard,
  copyRichTextToClipboard,
  renderSelectionHtmlDocument
} from '../../export/copyRichText'
import { setPreferences } from '../../preferences/store'
import type { ToastRef, ViewRef } from './types'

export interface P20Deps {
  viewRef: ViewRef
  /** Business-shared — App's showToast writes it. */
  toastRef: ToastRef
}

export function useP20Seam(deps: P20Deps): void {
  const { viewRef, toastRef } = deps
  // P20 e2e handle: rich-text clipboard.
  useEffect(() => {
    window.__veloxP20 = {
      copyRichText: () => {
        const view = viewRef.current
        return view ? copyRichTextToClipboard(view) : Promise.resolve(false)
      },
      copyAsHtml: () => {
        const view = viewRef.current
        return view ? copyHtmlToClipboard(view) : Promise.resolve(false)
      },
      exportSelectionTo: async (target) => {
        const view = viewRef.current
        if (!view) return false
        const html = await renderSelectionHtmlDocument(view)
        return window.api.exportHtml(target, html)
      },
      getClipboard: async () => ({
        html: await window.api.clipboardReadHtml(),
        text: await window.api.clipboardRead()
      }),
      getToast: () => toastRef.current,
      setThemePref: (mode) => setPreferences({ theme: mode })
    }
  }, [viewRef])
}
