import type { RefObject } from 'react'
import { openSearchPanel } from '@codemirror/search'
import { redo, undo } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'
import type { MenuDef, MenuItem } from './components/MenuBar'
import { getHelpMd } from './content'
import { runMenuPaste } from './editor/assists'
import {
  copyHtmlToClipboard,
  copyRichTextToClipboard,
  exportSelectionHtmlFile
} from './export/copyRichText'
import { livePreviewConfigFacet } from './editor/livePreview'
import { getLang, t } from './i18n'
import { getPreferences, setPreferences } from './preferences/store'

/**
 * Command registry — single source for menu labels, shortcuts and handlers.
 *
 * The in-app MenuBar, the global keydown and the macOS native-menu dispatch
 * are all generated from this list. Adding a command = one entry here, plus
 * one id→accelerator line in electron/main.ts (darwin menu only).
 */
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

/** Runtime operations the registry binds to — supplied by the App hooks. */
export interface CommandOps {
  viewRef: RefObject<EditorView | null>
  newFile: () => Promise<void>
  openFile: () => Promise<void>
  openFolder: () => Promise<void>
  saveFile: () => Promise<void>
  saveFileAs: () => Promise<boolean>
  toggleTheme: () => void
  toggleOutline: () => void
  loadContent: (content: string, path: string | null) => void
  openPreferences: () => void
  openRecentFile: (path: string) => Promise<void>
  clearRecentFiles: () => void
  /** P04: open the export options dialog for the given format. */
  exportDocument: (format: 'pdf' | 'html') => void
  /** P07: open the Quick Open (fuzzy file search) modal. */
  openQuickOpen: () => void
  /** P13: open the sidebar Search view and focus its query box. */
  openGlobalSearch: () => void
  /** P16: open the Mermaid template picker (App no-ops inside a fence). */
  openMermaidInsert: () => void
  /** P21: open the callout-type picker (ListPickDialog). */
  openCalloutInsert: () => void
  /** P22: open the table dialog ('insert' blank grid / 'convert' selection). */
  openTableInsert: (mode: 'insert' | 'convert') => void
  /** P22: whether the editor has a non-empty selection (menu enablement). */
  hasSelection: () => boolean
  /** P23: format the whole document (single undoable transaction). */
  formatDocument: () => void
  /** P26 tabs. */
  nextTab: () => void
  closeTab: () => void
  reopenClosedTab: () => void
  getTabCount: () => number
  hasClosedTabs: () => boolean
  /** P20: transient status-bar message (auto-clears in the App). */
  showToast: (message: string) => void
}

/** One validated Open Recent entry (existence decided by the App). */
export interface RecentItem {
  path: string
  /** File name only — the menu label. */
  name: string
  exists: boolean
}

export function buildCommands(ops: CommandOps): Command[] {
  const view = (): EditorView | null => ops.viewRef.current
  return [
    // ---- File --------------------------------------------------------------
    {
      id: 'newFile',
      label: 'cmd.newFile',
      shortcut: 'Ctrl+N',
      bindGlobal: true,
      run: () => void ops.newFile()
    },
    {
      id: 'openFile',
      label: 'cmd.openFile',
      shortcut: 'Ctrl+O',
      bindGlobal: true,
      run: () => void ops.openFile()
    },
    {
      id: 'openFolder',
      label: 'cmd.openFolder',
      shortcut: 'Ctrl+Shift+O',
      bindGlobal: true,
      run: () => void ops.openFolder()
    },
    {
      id: 'quickOpen',
      label: 'cmd.quickOpen',
      shortcut: 'Ctrl+P',
      bindGlobal: true,
      run: () => ops.openQuickOpen()
    },
    {
      id: 'saveFile',
      label: 'cmd.saveFile',
      shortcut: 'Ctrl+S',
      bindGlobal: true,
      run: () => void ops.saveFile()
    },
    {
      id: 'saveFileAs',
      label: 'cmd.saveFileAs',
      shortcut: 'Ctrl+Shift+S',
      bindGlobal: true,
      run: () => void ops.saveFileAs()
    },
    {
      id: 'openPreferences',
      label: 'cmd.openPreferences',
      shortcut: 'Ctrl+,',
      bindGlobal: true,
      run: () => ops.openPreferences()
    },
    {
      id: 'exportPdf',
      label: 'cmd.exportPdf',
      run: () => ops.exportDocument('pdf')
    },
    {
      id: 'exportHtml',
      label: 'cmd.exportHtml',
      run: () => ops.exportDocument('html')
    },
    // ---- Edit --------------------------------------------------------------
    {
      id: 'undo',
      label: 'cmd.undo',
      shortcut: 'Ctrl+Z',
      run: () => {
        const v = view()
        if (v) undo(v)
      }
    },
    {
      id: 'redo',
      label: 'cmd.redo',
      shortcut: 'Ctrl+Y',
      run: () => {
        const v = view()
        if (v) redo(v)
      }
    },
    {
      id: 'cut',
      label: 'cmd.cut',
      shortcut: 'Ctrl+X',
      run: () => {
        const v = view()
        if (!v) return
        const { from, to } = v.state.selection.main
        if (from === to) return
        void window.api.clipboardWrite(v.state.sliceDoc(from, to))
        v.dispatch({ changes: { from, to } })
      }
    },
    {
      id: 'copy',
      label: 'cmd.copy',
      shortcut: 'Ctrl+C',
      run: () => {
        const v = view()
        if (!v) return
        const { from, to } = v.state.selection.main
        if (from !== to) void window.api.clipboardWrite(v.state.sliceDoc(from, to))
      }
    },
    {
      id: 'paste',
      label: 'cmd.paste',
      shortcut: 'Ctrl+V',
      run: () => {
        const v = view()
        if (!v) return
        // Shared with the e2e hook so menu-paste and Ctrl+V cannot drift:
        // P05 bitmap → P19 HTML→MD → P01 URL transform → plain insert.
        void runMenuPaste(v, () =>
          v.state.facet(livePreviewConfigFacet).baseDir
            ? Promise.resolve(true)
            : ops.saveFileAs()
        )
      }
    },
    // ---- P20 rich-text clipboard ---------------------------------------------
    {
      id: 'copyRichText',
      label: 'cmd.copyRichText',
      shortcut: 'Ctrl+Shift+C',
      bindGlobal: true,
      run: () => {
        const v = view()
        if (!v) return
        void copyRichTextToClipboard(v).then((ok) => {
          if (ok) ops.showToast(t('toast.copiedRich'))
        })
      }
    },
    {
      id: 'copyAsHtml',
      label: 'cmd.copyAsHtml',
      run: () => {
        const v = view()
        if (!v) return
        void copyHtmlToClipboard(v).then((ok) => {
          if (ok) ops.showToast(t('toast.copiedHtml'))
        })
      }
    },
    {
      id: 'exportSelectionHtml',
      label: 'cmd.exportSelectionHtml',
      run: () => {
        const v = view()
        if (!v) return
        void exportSelectionHtmlFile(v).then((ok) => {
          if (ok) ops.showToast(t('toast.exportedSelection'))
        })
      }
    },
    {
      id: 'selectAll',
      label: 'cmd.selectAll',
      shortcut: 'Ctrl+A',
      run: () => {
        const v = view()
        if (!v) return
        v.dispatch({ selection: { anchor: 0, head: v.state.doc.length } })
      }
    },
    {
      id: 'find',
      label: 'cmd.find',
      shortcut: 'Ctrl+F',
      run: () => {
        const v = view()
        if (v) openSearchPanel(v)
      }
    },
    {
      id: 'formatDocument',
      label: 'cmd.formatDocument',
      shortcut: 'Shift+Alt+F',
      bindGlobal: true,
      run: () => ops.formatDocument()
    },
    // ---- P26 tabs ----------------------------------------------------------
    {
      id: 'nextTab',
      label: 'cmd.nextTab',
      shortcut: 'Ctrl+Tab',
      bindGlobal: true,
      isDisabled: () => ops.getTabCount() < 2,
      run: () => ops.nextTab()
    },
    {
      id: 'closeTab',
      label: 'cmd.closeTab',
      shortcut: 'Ctrl+W',
      bindGlobal: true,
      run: () => ops.closeTab()
    },
    {
      id: 'reopenClosedTab',
      label: 'cmd.reopenClosedTab',
      shortcut: 'Ctrl+Shift+T',
      bindGlobal: true,
      isDisabled: () => !ops.hasClosedTabs(),
      run: () => ops.reopenClosedTab()
    },
    // ---- View --------------------------------------------------------------
    { id: 'toggleOutline', label: 'cmd.toggleOutline', run: () => ops.toggleOutline() },
    {
      id: 'globalSearch',
      label: 'cmd.globalSearch',
      shortcut: 'Ctrl+Shift+F',
      bindGlobal: true,
      run: () => ops.openGlobalSearch()
    },
    // P08 writing modes — state lives in preferences; the App effect pushes
    // it into the editor config facet (single write path, survives restart).
    {
      id: 'toggleFocusMode',
      label: 'cmd.toggleFocusMode',
      shortcut: 'F8',
      bindGlobal: true,
      checked: () => getPreferences().focusMode,
      run: () => setPreferences({ focusMode: !getPreferences().focusMode })
    },
    {
      id: 'toggleTypewriterMode',
      label: 'cmd.toggleTypewriterMode',
      checked: () => getPreferences().typewriterMode,
      run: () => setPreferences({ typewriterMode: !getPreferences().typewriterMode })
    },
    {
      id: 'toggleSourceMode',
      label: 'cmd.toggleSourceMode',
      shortcut: 'Ctrl+/',
      bindGlobal: true,
      checked: () => getPreferences().sourceMode,
      run: () => setPreferences({ sourceMode: !getPreferences().sourceMode })
    },
    { id: 'zoomIn', label: 'cmd.zoomIn', run: () => window.api.windowZoom('in') },
    { id: 'zoomOut', label: 'cmd.zoomOut', run: () => window.api.windowZoom('out') },
    { id: 'zoomReset', label: 'cmd.zoomReset', run: () => window.api.windowZoom('reset') },
    {
      id: 'toggleDevTools',
      label: 'cmd.toggleDevTools',
      run: () => window.api.windowToggleDevTools()
    },
    {
      id: 'toggleTheme',
      label: 'cmd.toggleTheme',
      shortcut: 'Ctrl+Shift+T',
      bindGlobal: true,
      run: () => ops.toggleTheme()
    },
    // ---- Insert (P16) -------------------------------------------------------
    {
      id: 'insertMermaidDiagram',
      label: 'cmd.insertMermaidDiagram',
      run: () => ops.openMermaidInsert()
    },
    // ---- Insert (P21) -------------------------------------------------------
    {
      id: 'insertCallout',
      label: 'cmd.insertCallout',
      run: () => ops.openCalloutInsert()
    },
    // ---- Insert/Edit (P22) --------------------------------------------------
    {
      id: 'insertTable',
      label: 'cmd.insertTable',
      run: () => ops.openTableInsert('insert')
    },
    {
      id: 'convertToTable',
      label: 'cmd.convertToTable',
      isDisabled: () => !ops.hasSelection(),
      run: () => ops.openTableInsert('convert')
    },
    // ---- Help --------------------------------------------------------------
    {
      id: 'showHelp',
      label: 'cmd.showHelp',
      run: () => ops.loadContent(getHelpMd(getLang()), null)
    }
  ]
}

// ---- display layer ---------------------------------------------------------

/** Format a 'Ctrl+Shift+O' shortcut for display (⌘/⇧ glyphs on macOS). */
export function fmtShortcut(s: string, isMac: boolean): string {
  return isMac
    ? s.replace('Ctrl+', '⌘').replace('Shift+', '⇧').replace('Alt+', '⌥').replaceAll('+', '')
    : s
}

// ---- menu layout -----------------------------------------------------------

type LayoutItem = string | { separator: true } | { recent: true } | { export: true }

const MENU_LAYOUT: { label: string; items: LayoutItem[] }[] = [
  {
    label: 'menu.file',
    items: [
      'newFile',
      'openFile',
      'openFolder',
      'quickOpen',
      { recent: true },
      { separator: true },
      'saveFile',
      'saveFileAs',
      { separator: true },
      'closeTab',
      'reopenClosedTab',
      'nextTab',
      { separator: true },
      { export: true },
      { separator: true },
      'openPreferences'
    ]
  },
  {
    label: 'menu.edit',
    items: [
      'undo',
      'redo',
      { separator: true },
      'cut',
      'copy',
      'paste',
      'copyRichText',
      'copyAsHtml',
      'selectAll',
      { separator: true },
      'find',
      'formatDocument',
      { separator: true },
      'exportSelectionHtml',
      { separator: true },
      'insertTable',
      'convertToTable'
    ]
  },
  {
    label: 'menu.view',
    items: [
      'toggleOutline',
      { separator: true },
      'globalSearch',
      { separator: true },
      'toggleFocusMode',
      'toggleTypewriterMode',
      'toggleSourceMode',
      { separator: true },
      'zoomIn',
      'zoomOut',
      'zoomReset',
      { separator: true },
      'toggleDevTools',
      { separator: true },
      'toggleTheme'
    ]
  },
  { label: 'menu.insert', items: ['insertMermaidDiagram', 'insertCallout', 'insertTable'] },
  { label: 'menu.help', items: ['showHelp'] }
]

/** Expand the registry + layout into the MenuBar's menu definitions. */
export function buildMenus(
  commands: Command[],
  isMac: boolean,
  recentItems: RecentItem[] = [],
  ops?: Pick<CommandOps, 'openRecentFile' | 'clearRecentFiles'>
): MenuDef[] {
  const byId = new Map(commands.map((c) => [c.id, c]))
  return MENU_LAYOUT.map((menu) => ({
    label: t(menu.label),
    items: menu.items.map((item): MenuItem => {
      if (typeof item === 'object' && 'separator' in item) return { separator: true }
      if (typeof item === 'object' && 'recent' in item) {
        return { label: t('menu.openRecent'), submenu: buildRecentSubmenu(recentItems, ops) }
      }
      if (typeof item === 'object' && 'export' in item) {
        return {
          label: t('menu.export'),
          submenu: ['exportPdf', 'exportHtml'].map((id) => {
            const cmd = byId.get(id)
            if (!cmd) throw new Error(`export submenu references unknown command "${id}"`)
            return { label: t(cmd.label), action: cmd.run }
          })
        }
      }
      const cmd = byId.get(item)
      if (!cmd) throw new Error(`menu layout references unknown command "${item}"`)
      return {
        label: t(cmd.label),
        shortcut: cmd.shortcut ? fmtShortcut(cmd.shortcut, isMac) : undefined,
        checked: cmd.checked?.(),
        disabled: cmd.isDisabled?.(),
        action: cmd.run
      }
    })
  }))
}

/** Open Recent children: validated entries (missing paths greyed) + Clear Menu. */
function buildRecentSubmenu(
  recentItems: RecentItem[],
  ops?: Pick<CommandOps, 'openRecentFile' | 'clearRecentFiles'>
): MenuItem[] {
  if (recentItems.length === 0) return [{ label: t('menu.noRecent'), disabled: true }]
  const items: MenuItem[] = recentItems.map((item) => ({
    label: item.name,
    title: item.path,
    disabled: !item.exists,
    action: () => void ops?.openRecentFile(item.path)
  }))
  items.push({ separator: true })
  items.push({ label: t('menu.clearMenu'), action: () => ops?.clearRecentFiles() })
  return items
}

// ---- global shortcuts ------------------------------------------------------

/**
 * Find the command whose global shortcut matches this key event.
 * Parity with the previous hand-written handler for chorded shortcuts:
 * Cmd/Ctrl required, Shift must match exactly, Alt is ignored. P08 adds
 * bare function keys (e.g. F8 for Focus Mode) — those match with no
 * modifiers at all.
 */
export function matchGlobalShortcut(e: KeyboardEvent, commands: Command[]): Command | null {
  const k = e.key.toLowerCase()
  const hasChordMod = e.ctrlKey || e.metaKey || e.altKey
  // P23: Option+F on macOS yields 'ƒ' — also match the physical KeyF code.
  const codeKey = e.code && /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : null
  for (const cmd of commands) {
    if (!cmd.bindGlobal || !cmd.shortcut) continue
    const parts = cmd.shortcut.split('+')
    const key = parts[parts.length - 1].toLowerCase()
    const needShift = parts.includes('Shift')
    const needCtrl = parts.includes('Ctrl')
    const needAlt = parts.includes('Alt')
    if (needCtrl) {
      if (!(e.ctrlKey || e.metaKey) || needShift !== e.shiftKey) continue
    } else if (needAlt) {
      // P23 Shift+Alt+F — no Ctrl/Cmd, Alt required, Shift exact.
      if (!e.altKey || e.ctrlKey || e.metaKey || needShift !== e.shiftKey) continue
    } else {
      // Bare shortcuts are function keys only — reject any modifier.
      if (hasChordMod || e.shiftKey || !/^f\d{1,2}$/.test(key)) continue
    }
    if (key === k || (codeKey && key === codeKey)) return cmd
  }
  return null
}
