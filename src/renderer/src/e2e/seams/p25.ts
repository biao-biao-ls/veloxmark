/**
 * P25 e2e seam — mermaid preview panel handle (task 1A split).
 *
 * Effect body moved verbatim from App.tsx (dep array kept as-is).
 * `mpProbeRef` is business-shared (create-editor wiring writes it) and stays
 * in App. Contract: e2e/handles.d.ts `__veloxP25`.
 */
import { useEffect } from 'react'
import { undo } from '@codemirror/commands'
import { getPreferences, getSession, setPreferences } from '../../preferences/store'
import type { FileOps, ProbeRef, ViewRef } from './types'

export interface P25Deps {
  viewRef: ViewRef
  fileOps: FileOps
  /** Business-shared — create-editor wiring in App writes it. */
  mpProbeRef: ProbeRef
}

export function useP25Seam(deps: P25Deps): void {
  const { viewRef, fileOps, mpProbeRef } = deps
  // P25 e2e handle
  useEffect(() => {
    window.__veloxP25 = {
      getDoc: () => viewRef.current?.state.doc.toString() ?? '',
      loadDoc: (text, path) => fileOps.loadContent(text, path),
      setCursor: (pos) => {
        const view = viewRef.current
        if (!view) return
        const p = Math.min(Math.max(0, pos), view.state.doc.length)
        view.dispatch({ selection: { anchor: p } })
      },
      insertText: (pos, text) => {
        const view = viewRef.current
        if (!view) return
        const p = Math.min(Math.max(0, pos), view.state.doc.length)
        view.dispatch({
          changes: { from: p, insert: text },
          selection: { anchor: p + text.length }
        })
      },
      undo: () => {
        const view = viewRef.current
        return view ? undo(view) : false
      },
      panel: () => {
        const el = document.querySelector('.mermaid-preview-panel')
        if (!el) return { visible: false }
        return {
          visible: true,
          hasSvg: !!el.querySelector('.mermaid-preview-svg svg'),
          errorText: el.querySelector('.mermaid-preview-error')?.textContent ?? null,
          pinOn: !!el.querySelector('.mermaid-preview-pin.is-on'),
          editableCount: el.querySelectorAll('[contenteditable="true"]').length,
          svgText: el.querySelector('.mermaid-preview-svg')?.innerHTML ?? '',
          height: el.getBoundingClientRect().height
        }
      },
      clickPin: () => {
        const btn = document.querySelector('.mermaid-preview-pin')
        if (!btn) return false
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        return true
      },
      setPrefs: (patch) => setPreferences(patch),
      getPrefs: () => ({ mermaidPreviewHeight: getPreferences().mermaidPreviewHeight }),
      getPinSession: () => getSession().mermaidPreviewPin === true,
      probeNow: () => {
        const view = viewRef.current
        if (view) mpProbeRef.current(view.state)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileOps])
}
