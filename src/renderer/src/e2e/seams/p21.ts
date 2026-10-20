import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { insertNewlineContinueMarkup } from '@codemirror/lang-markdown'
import { getCalloutFoldOverrides } from '../../editor/livePreview/calloutFold'
import { renderSelectionHtmlDocument } from '../../export/copyRichText'
import type { ViewRef } from './types'

export interface P21Deps {
  viewRef: ViewRef
  insertCalloutTemplate: (type: string) => void
  setShowCalloutInsert: Dispatch<SetStateAction<boolean>>
  calloutDialogOpen: boolean
}

export function useP21Seam(deps: P21Deps): void {
  const { viewRef, insertCalloutTemplate, setShowCalloutInsert, calloutDialogOpen } = deps
  const calloutDialogOpenRef = useRef(false)
  calloutDialogOpenRef.current = calloutDialogOpen
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
  }, [insertCalloutTemplate])
}
