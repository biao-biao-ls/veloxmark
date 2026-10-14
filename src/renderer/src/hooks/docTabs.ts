/**
 * Tab model types (task 3.2) — single source shared by useFileOps/useTabStore,
 * TabsBar and the e2e FileOps surface.
 */
import type { EditorState } from '@codemirror/state'
import { t } from '../i18n'

/** P26: one open document tab (display projection of DocTab). */
export interface DocTabInfo {
  id: string
  path: string | null
  name: string
  /** Built-in welcome document — displays as t('tabs.welcome'), not `name`. */
  isWelcome: boolean
  dirty: boolean
  active: boolean
}

export interface DocTab {
  id: string
  path: string | null
  name: string
  /** Built-in welcome document — display name comes from t('tabs.welcome'). */
  isWelcome: boolean
  untitledNo: number | null
  /** Full CM6 state while the tab is inactive; null while active (view holds it). */
  state: EditorState | null
  savedContent: string
  scroll: number
  baseDir: string
  dirty: boolean
}

/**
 * Display name for a tab — the welcome tab renders as t('tabs.welcome') so it
 * localizes live on language switches; everything else keeps its mechanical
 * name (file basename / `untitled-N`). The `path == null` guard keeps a saved
 * welcome file (path assigned, flag not yet cleared) showing its basename.
 */
export function displayTabName(tab: Pick<DocTabInfo, 'name' | 'path' | 'isWelcome'>): string {
  return tab.isWelcome && tab.path == null ? t('tabs.welcome') : tab.name
}
