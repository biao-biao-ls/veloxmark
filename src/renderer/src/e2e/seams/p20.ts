/**
 * P20 e2e seam — rich-text clipboard handle (task 1A split).
 *
 * Effect body moved verbatim from App.tsx (dep array kept as-is).
 * FE-07: the toast message lives in the useToast bus now — `getToast` reads it
 * live (the `getToast(): string | null` handle contract is unchanged).
 * Contract: e2e/handles.d.ts `__veloxP20`.
 */
import { useEffect } from 'react'
import {
  copyHtmlToClipboard,
  copyRichTextToClipboard,
  renderSelectionHtmlDocument
} from '../../export/copyRichText'
import { getToastMessage } from '../../hooks/useToast'
import { setPreferences } from '../../preferences/store'
import type { ViewRef } from './types'

export interface P20Deps {
  viewRef: ViewRef
}

export function useP20Seam(deps: P20Deps): void {
  const { viewRef } = deps
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
      getToast: () => getToastMessage(),
      setThemePref: (mode) => setPreferences({ theme: mode })
    }
  }, [viewRef])
}
