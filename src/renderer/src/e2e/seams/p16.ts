import { useEffect, useRef } from 'react'
import { getMermaidTemplates, isCursorInMermaidFence } from '../../editor/mermaidTemplates'
import { setMermaidExportIo } from '../../editor/mermaid'
import type { ViewRef } from './types'

export interface P16Deps {
  viewRef: ViewRef
  insertMermaidTemplate: (id: string) => void
  openMermaidInsert: () => void
  dialogOpen: boolean
}

export function useP16Seam(deps: P16Deps): void {
  const { viewRef, insertMermaidTemplate, openMermaidInsert, dialogOpen } = deps
  const mermaidDialogOpenRef = useRef(false)
  mermaidDialogOpenRef.current = dialogOpen
  useEffect(() => {
    window.__veloxP16 = {
      templates: () => getMermaidTemplates().map((x) => x.id),
      insertTemplate: (id) => insertMermaidTemplate(id),
      openInsertDialog: () => openMermaidInsert(),
      getDialogOpen: () => mermaidDialogOpenRef.current,
      isCursorInMermaidFence: () => {
        const view = viewRef.current
        return view ? isCursorInMermaidFence(view.state) : false
      },
      setExportIo: (io) => setMermaidExportIo(io)
    }
  }, [insertMermaidTemplate, openMermaidInsert])
}
