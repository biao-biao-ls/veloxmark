import type { RefObject } from 'react'
import type { EditorView } from '@codemirror/view'

export interface Command {
  id: string
  label: string
  shortcut?: string
  run: () => void
  bindGlobal?: boolean
  checked?: () => boolean
  isDisabled?: () => boolean
}


export interface FileCmdOps {
  newFile: () => Promise<void>
  openFile: () => Promise<void>
  openFolder: () => Promise<void>
  saveFile: () => Promise<void>
  saveFileAs: () => Promise<boolean>
  openRecentFile: (path: string) => Promise<void>
  clearRecentFiles: () => void
  exportDocument: (format: 'pdf' | 'html') => void
  openPreferences: () => void
  openQuickOpen: () => void
  loadContent: (content: string, path: string | null) => void
}

export interface EditCmdOps {
  viewRef: RefObject<EditorView | null>
  saveFileAs: () => Promise<boolean>
  showToast: (message: string) => void
}

export interface FormatCmdOps {
  viewRef: RefObject<EditorView | null>
  showToast: (message: string) => void
  formatDocument: () => void
  openLinkAtCursor: () => void
  copyLinkAddressAtCursor: () => void
}

export interface TabsCmdOps {
  nextTab: () => void
  closeTab: () => void
  reopenClosedTab: () => void
  getTabCount: () => number
  hasClosedTabs: () => boolean
}

export interface ViewCmdOps {
  viewRef: RefObject<EditorView | null>
  toggleTheme: () => void
  toggleSidebar: () => void
  openGlobalSearch: () => void
}

export interface InsertCmdOps {
  openMermaidInsert: () => void
  openCalloutInsert: () => void
  openTableInsert: (mode: 'insert' | 'convert') => void
  hasSelection: () => boolean
}

export interface CommandOps
  extends FileCmdOps,
    EditCmdOps,
    FormatCmdOps,
    TabsCmdOps,
    ViewCmdOps,
    InsertCmdOps {}

export interface RecentItem {
  path: string
  name: string
  exists: boolean
}
