/**
 * P22 e2e seam — table-insert dialog handle (task 1A split).
 *
 * Effect body moved verbatim from App.tsx (dep array kept as-is).
 * `tableDialogRef`/`tableFormRef` are business-shared (App's
 * `confirmTableDialog` reads them) and stay in App.
 * Contract: e2e/handles.d.ts `__veloxP22`.
 */
import { useEffect } from 'react'
import type {
  TableDialogMode,
  TableDialogRef,
  TableFormRef,
  TableInsertForm,
  ViewRef
} from './types'

export interface P22Deps {
  viewRef: ViewRef
  openTableInsert: (mode: TableDialogMode) => void
  /** Business-shared — App's `confirmTableDialog` reads them. */
  tableDialogRef: TableDialogRef
  tableFormRef: TableFormRef
  patchTableForm: (patch: Partial<TableInsertForm>) => void
  confirmTableDialog: () => void
}

export function useP22Seam(deps: P22Deps): void {
  const { viewRef, openTableInsert, tableDialogRef, tableFormRef, patchTableForm, confirmTableDialog } = deps
  // P22 e2e handle
  useEffect(() => {
    window.__veloxP22 = {
      getDoc: () => viewRef.current?.state.doc.toString() ?? '',
      setSelection: (from, to) => {
        const view = viewRef.current
        if (!view) return
        const len = view.state.doc.length
        view.dispatch({
          selection: {
            anchor: Math.min(from, len),
            head: Math.min(to ?? from, len)
          }
        })
      },
      openDialog: (mode) => openTableInsert(mode),
      getDialogMode: () => tableDialogRef.current,
      setDialogForm: (patch) => patchTableForm(patch),
      getDialogForm: () => tableFormRef.current,
      confirm: () => confirmTableDialog()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTableInsert, confirmTableDialog, patchTableForm])
}
