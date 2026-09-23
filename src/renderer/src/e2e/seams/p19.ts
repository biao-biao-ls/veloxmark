/**
 * P19 e2e seam — HTML→Markdown paste pipeline handle (task 1A split).
 * Effect body moved verbatim from App.tsx (dep array kept as-is).
 * Contract: e2e/handles.d.ts `__veloxP19`.
 */
import { useEffect } from 'react'
import {
  faultNextHtmlTransformOnce,
  htmlToMarkdownSafe,
  runMenuPaste
} from '../../editor/assists'
import { getLivePreviewConfig } from '../../editor/livePreview/config'
import { setPreferences } from '../../preferences/store'
import type { FileOps, ViewRef } from './types'

export interface P19Deps {
  viewRef: ViewRef
  fileOps: FileOps
}

export function useP19Seam(deps: P19Deps): void {
  const { viewRef, fileOps } = deps
  // P19 e2e handle: HTML→Markdown paste pipeline.
  useEffect(() => {
    window.__veloxP19 = {
      transform: (html) => htmlToMarkdownSafe(html),
      pasteHtmlEvent: (html, plain) => {
        const view = viewRef.current
        if (!view) return false
        const dt = new DataTransfer()
        if (html) dt.setData('text/html', html)
        if (plain != null) dt.setData('text/plain', plain)
        const ev = new ClipboardEvent('paste', { bubbles: true, cancelable: true })
        // Some Chromium builds drop clipboardData from the constructor init.
        if (!ev.clipboardData || ev.clipboardData.getData('text/html') !== (html || '')) {
          Object.defineProperty(ev, 'clipboardData', { value: dt })
        }
        view.contentDOM.dispatchEvent(ev)
        return ev.defaultPrevented
      },
      pasteFromClipboard: async () => {
        const view = viewRef.current
        if (!view) return false
        const before = view.state.doc.toString()
        await runMenuPaste(view, () =>
          getLivePreviewConfig(view.state).baseDir ? Promise.resolve(true) : fileOps.saveFileAs()
        )
        return view.state.doc.toString() !== before
      },
      setPasteHtmlToMd: (v) => setPreferences({ pasteHtmlToMd: v }),
      faultNextTransform: () => faultNextHtmlTransformOnce(),
      writeClipboardHtml: (html, text) => window.api.clipboardWriteHtml(html, text),
      getDoc: () => viewRef.current?.state.doc.toString() ?? ''
    }
  }, [viewRef, fileOps.saveFileAs])
}
