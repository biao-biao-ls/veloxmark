import type { EditorState } from '@codemirror/state'
import { t } from '../i18n'

export interface DocTabInfo {
  id: string
  path: string | null
  name: string
  isWelcome: boolean
  dirty: boolean
  active: boolean
}

export interface DocTab {
  id: string
  path: string | null
  name: string
  isWelcome: boolean
  untitledNo: number | null
  draftSlot: string
  state: EditorState | null
  savedContent: string
  scroll: number
  baseDir: string
  dirty: boolean
}

export function newDraftSlot(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function displayTabName(tab: Pick<DocTabInfo, 'name' | 'path' | 'isWelcome'>): string {
  return tab.isWelcome && tab.path == null ? t('tabs.welcome') : tab.name
}
