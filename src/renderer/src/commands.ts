import type { RefObject } from 'react'
import { openSearchPanel } from '@codemirror/search'
import { redo, undo } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'
import type { MenuDef, MenuItem } from './components/MenuBar'
import { HELP_MD } from './content'
import { transformPaste } from './editor/assists'
import { insertClipboardImage } from './editor/images'
import { livePreviewConfigFacet } from './editor/livePreview'

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
      label: 'New',
      shortcut: 'Ctrl+N',
      bindGlobal: true,
      run: () => void ops.newFile()
    },
    {
      id: 'openFile',
      label: 'Open…',
      shortcut: 'Ctrl+O',
      bindGlobal: true,
      run: () => void ops.openFile()
    },
    {
      id: 'openFolder',
      label: 'Open Folder…',
      shortcut: 'Ctrl+Shift+O',
      bindGlobal: true,
      run: () => void ops.openFolder()
    },
    {
      id: 'saveFile',
      label: 'Save',
      shortcut: 'Ctrl+S',
      bindGlobal: true,
      run: () => void ops.saveFile()
    },
    {
      id: 'saveFileAs',
      label: 'Save As…',
      shortcut: 'Ctrl+Shift+S',
      bindGlobal: true,
      run: () => void ops.saveFileAs()
    },
    {
      id: 'openPreferences',
      label: 'Preferences…',
      shortcut: 'Ctrl+,',
      bindGlobal: true,
      run: () => ops.openPreferences()
    },
    {
      id: 'exportPdf',
      label: 'PDF…',
      run: () => ops.exportDocument('pdf')
    },
    {
      id: 'exportHtml',
      label: 'HTML…',
      run: () => ops.exportDocument('html')
    },
    // ---- Edit --------------------------------------------------------------
    {
      id: 'undo',
      label: 'Undo',
      shortcut: 'Ctrl+Z',
      run: () => {
        const v = view()
        if (v) undo(v)
      }
    },
    {
      id: 'redo',
      label: 'Redo',
      shortcut: 'Ctrl+Y',
      run: () => {
        const v = view()
        if (v) redo(v)
      }
    },
    {
      id: 'cut',
      label: 'Cut',
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
      label: 'Copy',
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
      label: 'Paste',
      shortcut: 'Ctrl+V',
      run: () => {
        const v = view()
        if (!v) return
        // The menu paste goes through IPC (no DOM event), so the P05 clipboard
        // bitmap check must run here too — a screenshot paste lands in assets/.
        void insertClipboardImage(v, () =>
          v.state.facet(livePreviewConfigFacet).baseDir
            ? Promise.resolve(true)
            : ops.saveFileAs()
        ).then((handled) => {
          if (handled) return
          void window.api.clipboardRead().then((text) => {
            if (!text) return
            // Same transform as the DOM paste handler (URL → link / <url>).
            const changes = transformPaste(v.state, text)
            if (changes) v.dispatch({ changes, userEvent: 'input.paste', scrollIntoView: true })
            else v.dispatch(v.state.replaceSelection(text))
          })
        })
      }
    },
    {
      id: 'selectAll',
      label: 'Select All',
      shortcut: 'Ctrl+A',
      run: () => {
        const v = view()
        if (!v) return
        v.dispatch({ selection: { anchor: 0, head: v.state.doc.length } })
      }
    },
    {
      id: 'find',
      label: 'Find',
      shortcut: 'Ctrl+F',
      run: () => {
        const v = view()
        if (v) openSearchPanel(v)
      }
    },
    // ---- View --------------------------------------------------------------
    { id: 'toggleOutline', label: 'Toggle Outline', run: () => ops.toggleOutline() },
    { id: 'zoomIn', label: 'Zoom In', run: () => window.api.windowZoom('in') },
    { id: 'zoomOut', label: 'Zoom Out', run: () => window.api.windowZoom('out') },
    { id: 'zoomReset', label: 'Reset Zoom', run: () => window.api.windowZoom('reset') },
    {
      id: 'toggleDevTools',
      label: 'Toggle Developer Tools',
      run: () => window.api.windowToggleDevTools()
    },
    {
      id: 'toggleTheme',
      label: 'Toggle Theme',
      shortcut: 'Ctrl+Shift+T',
      bindGlobal: true,
      run: () => ops.toggleTheme()
    },
    // ---- Help --------------------------------------------------------------
    {
      id: 'showHelp',
      label: 'Markdown Syntax Reference',
      run: () => ops.loadContent(HELP_MD, null)
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
    label: 'File',
    items: [
      'newFile',
      'openFile',
      'openFolder',
      { recent: true },
      { separator: true },
      'saveFile',
      'saveFileAs',
      { separator: true },
      { export: true },
      { separator: true },
      'openPreferences'
    ]
  },
  {
    label: 'Edit',
    items: [
      'undo',
      'redo',
      { separator: true },
      'cut',
      'copy',
      'paste',
      'selectAll',
      { separator: true },
      'find'
    ]
  },
  {
    label: 'View',
    items: [
      'toggleOutline',
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
  { label: 'Help', items: ['showHelp'] }
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
    label: menu.label,
    items: menu.items.map((item): MenuItem => {
      if (typeof item === 'object' && 'separator' in item) return { separator: true }
      if (typeof item === 'object' && 'recent' in item) {
        return { label: 'Open Recent', submenu: buildRecentSubmenu(recentItems, ops) }
      }
      if (typeof item === 'object' && 'export' in item) {
        return {
          label: 'Export',
          submenu: ['exportPdf', 'exportHtml'].map((id) => {
            const cmd = byId.get(id)
            if (!cmd) throw new Error(`export submenu references unknown command "${id}"`)
            return { label: cmd.label, action: cmd.run }
          })
        }
      }
      const cmd = byId.get(item)
      if (!cmd) throw new Error(`menu layout references unknown command "${item}"`)
      return {
        label: cmd.label,
        shortcut: cmd.shortcut ? fmtShortcut(cmd.shortcut, isMac) : undefined,
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
  if (recentItems.length === 0) return [{ label: 'No Recent Files', disabled: true }]
  const items: MenuItem[] = recentItems.map((item) => ({
    label: item.name,
    title: item.path,
    disabled: !item.exists,
    action: () => void ops?.openRecentFile(item.path)
  }))
  items.push({ separator: true })
  items.push({ label: 'Clear Menu', action: () => ops?.clearRecentFiles() })
  return items
}

// ---- global shortcuts ------------------------------------------------------

/**
 * Find the command whose global shortcut matches this key event.
 * Parity with the previous hand-written handler: Cmd/Ctrl required, Shift
 * must match exactly, Alt is ignored.
 */
export function matchGlobalShortcut(e: KeyboardEvent, commands: Command[]): Command | null {
  if (!(e.ctrlKey || e.metaKey)) return null
  const k = e.key.toLowerCase()
  for (const cmd of commands) {
    if (!cmd.bindGlobal || !cmd.shortcut) continue
    const parts = cmd.shortcut.split('+')
    const key = parts[parts.length - 1].toLowerCase()
    const needShift = parts.includes('Shift')
    if (key === k && needShift === e.shiftKey) return cmd
  }
  return null
}
