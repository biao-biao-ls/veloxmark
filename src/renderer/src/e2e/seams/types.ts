import type { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { RefObject } from 'react'
import type { DocStats } from '../../components/StatusBar'
import type { FormatWarning } from '../../editor/format'
import type { TableDialogMode, TableInsertForm } from '../../components/TableInsertDialog'
import type { SidebarMode } from '../../preferences/store'
import type { useFileOps } from '../../hooks/useFileOps'
import type { useWorkspaceTree } from '../../hooks/useWorkspaceTree'

export type FileOps = ReturnType<typeof useFileOps>
export type Workspace = ReturnType<typeof useWorkspaceTree>

export type ViewRef = RefObject<EditorView | null>
export type FilePathRef = RefObject<string | null>
export type ToastRef = RefObject<string | null>
export type SidebarModeRef = RefObject<SidebarMode>
export type ProbeRef = RefObject<(state: EditorState) => void>
export type RestoreFoldsForRef = RefObject<(path: string | null) => void>
export type OpenExternalImplRef = RefObject<((url: string) => Promise<boolean>) | null>
export type TableDialogRef = RefObject<TableDialogMode | null>
export type TableFormRef = RefObject<TableInsertForm>
export type LastFormatRef = RefObject<{ changed: number; warnings: FormatWarning[] }>
export type FormatWarningsRef = RefObject<FormatWarning[]>

export type { DocStats, FormatWarning, TableDialogMode, TableInsertForm, SidebarMode }
