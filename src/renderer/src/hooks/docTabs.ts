/**
 * Tab model types (task 3.2) — single source shared by useFileOps/useTabStore,
 * TabsBar and the e2e FileOps surface.
 */
import type { EditorState } from '@codemirror/state'

/** P26: one open document tab (display projection of DocTab). */
export interface DocTabInfo {
  id: string
  path: string | null
  name: string
  dirty: boolean
  active: boolean
}

export interface DocTab {
  id: string
  path: string | null
  name: string
  untitledNo: number | null
  /** Full CM6 state while the tab is inactive; null while active (view holds it). */
  state: EditorState | null
  savedContent: string
  scroll: number
  baseDir: string
  dirty: boolean
}
