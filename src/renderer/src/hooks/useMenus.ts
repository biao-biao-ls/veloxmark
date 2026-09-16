import { useCallback, useEffect, useMemo, type RefObject } from 'react'
import { openSearchPanel } from '@codemirror/search'
import { EditorView } from '@codemirror/view'
import { redo, undo } from '@codemirror/commands'
import type { MenuDef } from '../components/MenuBar'
import { HELP_MD } from '../content'

interface Args {
  viewRef: RefObject<EditorView | null>
  isMac: boolean
  newFile: () => void
  openFile: () => Promise<void>
  openFolder: () => Promise<void>
  saveFile: () => Promise<void>
  saveFileAs: () => Promise<boolean>
  toggleTheme: () => void
  loadContent: (content: string, path: string | null) => void
  toggleOutline: () => void
  editCut: () => void
  editCopy: () => void
  editPaste: () => Promise<void>
  editSelectAll: () => void
}

/** Format a 'Ctrl+Shift+O' shortcut for display (⌘/⇧ glyphs on macOS). */
function fmtShortcut(s: string, isMac: boolean): string {
  return isMac
    ? s.replace('Ctrl+', '⌘').replace('Shift+', '⇧').replace('Alt+', '⌥').replaceAll('+', '')
    : s
}

/**
 * In-app menu definitions, the global keydown shortcuts and the macOS native
 * menu dispatch. Transitional shape — R2 replaces the hand-written menus with
 * entries generated from the command registry.
 */
export function useMenus({
  viewRef,
  isMac,
  newFile,
  openFile,
  openFolder,
  saveFile,
  saveFileAs,
  toggleTheme,
  loadContent,
  toggleOutline,
  editCut,
  editCopy,
  editPaste,
  editSelectAll
}: Args) {
  // ---- in-app menu (replaces the native menu; follows app theme) ------------
  // macOS shows the same shortcuts with ⌘/⇧ glyphs; the native menu bar owns
  // the real accelerators there, this menu stays as themed UI on all platforms.
  const menus: MenuDef[] = useMemo(
    () => [
      {
        label: 'File',
        items: [
          { label: 'New', shortcut: fmtShortcut('Ctrl+N', isMac), action: () => newFile() },
          { label: 'Open…', shortcut: fmtShortcut('Ctrl+O', isMac), action: () => void openFile() },
          {
            label: 'Open Folder…',
            shortcut: fmtShortcut('Ctrl+Shift+O', isMac),
            action: () => void openFolder()
          },
          { separator: true },
          { label: 'Save', shortcut: fmtShortcut('Ctrl+S', isMac), action: () => void saveFile() },
          {
            label: 'Save As…',
            shortcut: fmtShortcut('Ctrl+Shift+S', isMac),
            action: () => void saveFileAs()
          }
        ]
      },
      {
        label: 'Edit',
        items: [
          {
            label: 'Undo',
            shortcut: fmtShortcut('Ctrl+Z', isMac),
            action: () => viewRef.current && undo(viewRef.current)
          },
          {
            label: 'Redo',
            shortcut: fmtShortcut('Ctrl+Y', isMac),
            action: () => viewRef.current && redo(viewRef.current)
          },
          { separator: true },
          { label: 'Cut', shortcut: fmtShortcut('Ctrl+X', isMac), action: () => editCut() },
          { label: 'Copy', shortcut: fmtShortcut('Ctrl+C', isMac), action: () => editCopy() },
          { label: 'Paste', shortcut: fmtShortcut('Ctrl+V', isMac), action: () => void editPaste() },
          { label: 'Select All', shortcut: fmtShortcut('Ctrl+A', isMac), action: () => editSelectAll() },
          { separator: true },
          {
            label: 'Find',
            shortcut: fmtShortcut('Ctrl+F', isMac),
            action: () => viewRef.current && openSearchPanel(viewRef.current)
          }
        ]
      },
      {
        label: 'View',
        items: [
          { label: 'Toggle Outline', action: () => toggleOutline() },
          { separator: true },
          { label: 'Zoom In', action: () => window.api.windowZoom('in') },
          { label: 'Zoom Out', action: () => window.api.windowZoom('out') },
          { label: 'Reset Zoom', action: () => window.api.windowZoom('reset') },
          { separator: true },
          { label: 'Toggle Developer Tools', action: () => window.api.windowToggleDevTools() },
          { separator: true },
          {
            label: 'Toggle Theme',
            shortcut: fmtShortcut('Ctrl+Shift+T', isMac),
            action: () => toggleTheme()
          }
        ]
      },
      {
        label: 'Help',
        items: [{ label: 'Markdown Syntax Reference', action: () => loadContent(HELP_MD, null) }]
      }
    ],
    [
      isMac,
      viewRef,
      newFile,
      openFile,
      openFolder,
      saveFile,
      saveFileAs,
      toggleTheme,
      loadContent,
      toggleOutline,
      editCut,
      editCopy,
      editPaste,
      editSelectAll
    ]
  )

  // ---- macOS native menu dispatch -------------------------------------------
  useEffect(() => {
    const offs = [
      window.api.onMenu('menu:toggleOutline', () => toggleOutline()),
      window.api.onMenu('menu:newFile', () => newFile()),
      window.api.onMenu('menu:openFile', () => void openFile()),
      window.api.onMenu('menu:openFolder', () => void openFolder()),
      window.api.onMenu('menu:saveFile', () => void saveFile()),
      window.api.onMenu('menu:saveFileAs', () => void saveFileAs()),
      window.api.onMenu('menu:toggleTheme', () => toggleTheme()),
      window.api.onMenu('menu:find', () => {
        const view = viewRef.current
        if (view) openSearchPanel(view)
      }),
      window.api.onMenu('menu:showHelp', () => {
        loadContent(HELP_MD, null)
      })
    ]
    return () => offs.forEach((off) => off())
  }, [
    viewRef,
    newFile,
    openFile,
    openFolder,
    saveFile,
    saveFileAs,
    toggleTheme,
    loadContent,
    toggleOutline
  ])

  // ---- global shortcuts (native accelerators are gone with the native menu) --
  // Only the six app-level commands are bound here: editor commands
  // (undo/copy/find …) stay with CodeMirror's keymap / native handling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (e.shiftKey && k === 't') {
        e.preventDefault()
        toggleTheme()
      } else if (e.shiftKey && k === 's') {
        e.preventDefault()
        void saveFileAs()
      } else if (e.shiftKey && k === 'o') {
        e.preventDefault()
        void openFolder()
      } else if (k === 'o') {
        e.preventDefault()
        void openFile()
      } else if (k === 's') {
        e.preventDefault()
        void saveFile()
      } else if (k === 'n') {
        e.preventDefault()
        newFile()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleTheme, openFile, openFolder, saveFile, saveFileAs, newFile])

  const formatShortcut = useCallback((s: string) => fmtShortcut(s, isMac), [isMac])
  return { menus, formatShortcut }
}
