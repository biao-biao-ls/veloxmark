/**
 * P23 e2e seam — format pipeline handle (task 1A split).
 *
 * Effect body moved verbatim from App.tsx (dep array kept as-is).
 * `lastFormatRef`/`formatWarningsRef` are business-shared (App's
 * `formatDocument`/`showFormatWarnings` write them) and stay in App.
 * Contract: e2e/handles.d.ts `__veloxP23`.
 */
import { useEffect } from 'react'
import { undo } from '@codemirror/commands'
import { faultNextFormatOnce } from '../../editor/format'
import { getPreferences, setPreferences } from '../../preferences/store'
import type { FileOps, FormatWarningsRef, LastFormatRef, ViewRef } from './types'

export interface P23Deps {
  viewRef: ViewRef
  fileOps: FileOps
  formatDocument: () => void
  /** Business-shared — App's `formatDocument`/`showFormatWarnings` write them. */
  lastFormatRef: LastFormatRef
  formatWarningsRef: FormatWarningsRef
  showFormatWarnings: () => void
  toast: string | null
}

export function useP23Seam(deps: P23Deps): void {
  const { viewRef, fileOps, formatDocument, showFormatWarnings, lastFormatRef, formatWarningsRef, toast } = deps
  // P23 e2e handle
  useEffect(() => {
    window.__veloxP23 = {
      getDoc: () => viewRef.current?.state.doc.toString() ?? '',
      setSelection: (from, to) => {
        const view = viewRef.current
        if (!view) return
        const len = view.state.doc.length
        view.dispatch({
          selection: { anchor: Math.min(from, len), head: Math.min(to ?? from, len) }
        })
      },
      loadDoc: (text, path) => fileOps.loadContent(text, path),
      format: () => {
        formatDocument()
        return lastFormatRef.current
      },
      undo: () => {
        const view = viewRef.current
        return view ? undo(view) : false
      },
      getToast: () => toast,
      setFormatOnSave: (v) => setPreferences({ formatOnSave: v }),
      getFormatOnSave: () => getPreferences().formatOnSave,
      saveFile: () => fileOps.saveFile(),
      getFilePath: () => fileOps.filePath,
      getFormatWarnings: () => formatWarningsRef.current,
      openFormatWarnings: () => showFormatWarnings(),
      faultNextFormat: () => faultNextFormatOnce()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatDocument, fileOps, toast, showFormatWarnings])
}
