/**
 * P16 e2e seam — mermaid insert dialog / template handle (task 1A split).
 *
 * Effect body moved verbatim from App.tsx. Seam-only `mermaidDialogOpenRef`
 * migrates with it (mirrors the former App-side sync from `showMermaidInsert`,
 * now the `dialogOpen` dep).
 * Contract: e2e/handles.d.ts `__veloxP16`.
 */
import { useEffect, useRef } from 'react'
import { MERMAID_TEMPLATES, isCursorInMermaidFence } from '../../editor/mermaidTemplates'
import { setMermaidExportIo } from '../../editor/widgets'
import type { ViewRef } from './types'

export interface P16Deps {
  viewRef: ViewRef
  insertMermaidTemplate: (id: string) => void
  openMermaidInsert: () => void
  /** Mirrors App's `showMermaidInsert` state (sync source for the ref). */
  dialogOpen: boolean
}

export function useP16Seam(deps: P16Deps): void {
  const { viewRef, insertMermaidTemplate, openMermaidInsert, dialogOpen } = deps
  // Seam-only ref (moved from App).
  const mermaidDialogOpenRef = useRef(false)
  mermaidDialogOpenRef.current = dialogOpen
  // P16 e2e handle.
  useEffect(() => {
    window.__veloxP16 = {
      templates: () => MERMAID_TEMPLATES.map((x) => x.id),
      insertTemplate: (id) => insertMermaidTemplate(id),
      openInsertDialog: () => openMermaidInsert(),
      getDialogOpen: () => mermaidDialogOpenRef.current,
      isCursorInMermaidFence: () => {
        const view = viewRef.current
        return view ? isCursorInMermaidFence(view.state) : false
      },
      setExportIo: (io) => setMermaidExportIo(io)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertMermaidTemplate, openMermaidInsert])
}
