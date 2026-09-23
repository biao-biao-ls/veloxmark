/**
 * Command surface types（2B 自 commands.ts 平移）。
 *
 * `CommandOps` 按域拆为六个窄接口（spec 2.10）——域 builder 只收自己用到的
 * 子集；`CommandOps` 保持 28 字段全集，App.tsx 的 `commandOps` 字面量与
 * `useMenus.Args` 结构兼容零改动。命名带 `Cmd` 后缀，避让 `e2e/seams/types.ts`
 * 的 `FileOps`（useFileOps 返回类型）。
 */
import type { RefObject } from 'react'
import type { EditorView } from '@codemirror/view'

export interface Command {
  /** Stable id; also the native-menu channel suffix (`menu:<id>`). */
  id: string
  label: string
  /** 'Ctrl+Shift+O'-style; display conversion happens in fmtShortcut. */
  shortcut?: string
  run: () => void
  /**
   * Bind on the window keydown. Only app-level commands set this — editor
   * commands (undo/copy/find …) stay with CodeMirror's keymap / native
   * handling so prompts and inputs keep working.
   */
  bindGlobal?: boolean
  /** P08: toggle commands show a checkmark in the in-app menu when on. */
  checked?: () => boolean
  /** P22: grey the menu item when a precondition fails (e.g. empty selection). */
  isDisabled?: () => boolean
}

// ---- domain ops（2.10） ------------------------------------------------------

export interface FileCmdOps {
  newFile: () => Promise<void>
  openFile: () => Promise<void>
  openFolder: () => Promise<void>
  saveFile: () => Promise<void>
  saveFileAs: () => Promise<boolean>
  openRecentFile: (path: string) => Promise<void>
  clearRecentFiles: () => void
  /** P04: open the export options dialog for the given format. */
  exportDocument: (format: 'pdf' | 'html') => void
  openPreferences: () => void
  /** P07: open the Quick Open (fuzzy file search) modal. */
  openQuickOpen: () => void
  loadContent: (content: string, path: string | null) => void
}

export interface EditCmdOps {
  viewRef: RefObject<EditorView | null>
  /** Paste falls back to save-as for relative image paths before first save. */
  saveFileAs: () => Promise<boolean>
  /** P20: transient status-bar message (auto-clears in the App). */
  showToast: (message: string) => void
}

export interface FormatCmdOps {
  viewRef: RefObject<EditorView | null>
  showToast: (message: string) => void
  /** P23: format the whole document (single undoable transaction). */
  formatDocument: () => void
  /** P27: open the link at the selection head (context menu openLink path). */
  openLinkAtCursor: () => void
  /** P27: copy the link address at the selection head to the clipboard. */
  copyLinkAddressAtCursor: () => void
}

export interface TabsCmdOps {
  /** P26 tabs. */
  nextTab: () => void
  closeTab: () => void
  reopenClosedTab: () => void
  getTabCount: () => number
  hasClosedTabs: () => boolean
}

export interface ViewCmdOps {
  viewRef: RefObject<EditorView | null>
  toggleTheme: () => void
  toggleOutline: () => void
  /** P13: open the sidebar Search view and focus its query box. */
  openGlobalSearch: () => void
}

export interface InsertCmdOps {
  /** P16: open the Mermaid template picker (App no-ops inside a fence). */
  openMermaidInsert: () => void
  /** P21: open the callout-type picker (ListPickDialog). */
  openCalloutInsert: () => void
  /** P22: open the table dialog ('insert' blank grid / 'convert' selection). */
  openTableInsert: (mode: 'insert' | 'convert') => void
  /** P22: whether the editor has a non-empty selection (menu enablement). */
  hasSelection: () => boolean
}

/** Runtime operations the registry binds to — supplied by the App hooks. */
export interface CommandOps
  extends FileCmdOps,
    EditCmdOps,
    FormatCmdOps,
    TabsCmdOps,
    ViewCmdOps,
    InsertCmdOps {}

/** One validated Open Recent entry (existence decided by the App). */
export interface RecentItem {
  path: string
  /** File name only — the menu label. */
  name: string
  exists: boolean
}
