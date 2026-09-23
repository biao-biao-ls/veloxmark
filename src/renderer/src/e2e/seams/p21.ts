/**
 * P21 e2e seam — callout probe + export/quote continuation handles
 * (task 1A split). Effect body moved verbatim from App.tsx. Seam-only
 * `calloutDialogOpenRef` migrates with it (mirrors the former App-side sync
 * from `showCalloutInsert`, now the `calloutDialogOpen` dep).
 * Contract: e2e/handles.d.ts `__veloxP21`.
 */
import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { insertNewlineContinueMarkup } from '@codemirror/lang-markdown'
import { getCalloutFoldOverrides } from '../../editor/livePreview/calloutFold'
import { renderSelectionHtmlDocument } from '../../export/copyRichText'
import type { ViewRef } from './types'

export interface P21Deps {
  viewRef: ViewRef
  insertCalloutTemplate: (type: string) => void
  setShowCalloutInsert: Dispatch<SetStateAction<boolean>>
  /** Mirrors App's `showCalloutInsert` state (sync source for the ref). */
  calloutDialogOpen: boolean
}

export function useP21Seam(deps: P21Deps): void {
  const { viewRef, insertCalloutTemplate, setShowCalloutInsert, calloutDialogOpen } = deps
  // Seam-only ref (moved from App).
  const calloutDialogOpenRef = useRef(false)
  calloutDialogOpenRef.current = calloutDialogOpen
  // P21 e2e handle: callout probe + export/quote continuation seams.
  useEffect(() => {
    window.__veloxP21 = {
      getDoc: () => viewRef.current?.state.doc.toString() ?? '',
      setSelection: (pos) => {
        const view = viewRef.current
        if (!view) return
        view.dispatch({ selection: { anchor: Math.min(pos, view.state.doc.length) } })
      },
      openCalloutInsert: () => setShowCalloutInsert(true),
      getCalloutDialogOpen: () => calloutDialogOpenRef.current,
      insertCallout: (type) => insertCalloutTemplate(type),
      renderExportHtml: async () => {
        const view = viewRef.current
        return view ? await renderSelectionHtmlDocument(view) : ''
      },
      pressEnter: () => {
        const view = viewRef.current
        return view ? insertNewlineContinueMarkup(view) : false
      },
      getCalloutFoldOverrides: () => {
        const view = viewRef.current
        return view ? [...getCalloutFoldOverrides(view.state).entries()] : []
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertCalloutTemplate])
}
