import { useEffect, useMemo, useRef, useState } from 'react'
import { openSearchPanel } from '@codemirror/search'
import { redo, undo } from '@codemirror/commands'
import Titlebar from './components/Titlebar'
import Sidebar from './components/Sidebar'
import type { MenuDef } from './components/MenuBar'
import { MenuChannel } from '@shared/ipc'
import { basenameOf } from '@shared/paths'
import { useTheme } from './hooks/useTheme'
import { useDocument } from './hooks/useDocument'
import { useWorkspace } from './hooks/useWorkspace'
import { HELP_MD } from './content/docs'

/** Ctrl+... → ⌘/⇧/⌥ glyphs on macOS; plain text elsewhere. */
function fmtShortcut(s: string, isMac: boolean): string {
  return isMac
    ? s.replace('Ctrl+', '⌘').replace('Shift+', '⇧').replace('Alt+', '⌥').replaceAll('+', '')
    : s
}

export default function App(): React.JSX.Element {
  // macOS uses the native traffic lights (hiddenInset) and menu-bar shortcuts;
  // Windows/Linux keep the custom titlebar buttons.
  const isMac = window.api.platform === 'darwin'

  const { theme, toggleTheme } = useTheme()
  const doc = useDocument(theme)
  const ws = useWorkspace({
    filePath: doc.filePath,
    openPathFromDisk: doc.openPathFromDisk,
    reattachIfUnder: doc.reattachIfUnder,
    detachIfUnder: doc.detachIfUnder
  })

  const [showOutline, setShowOutline] = useState(true)
  const [isFullScreen, setIsFullScreen] = useState(false)

  // ---- app-level actions ----------------------------------------------------
  const showHelp = (): void => {
    // Help replaces the current buffer — never drop unsaved changes silently.
    if (!doc.confirmDiscard()) return
    doc.loadContent(HELP_MD, null)
  }

  const openFile = async (): Promise<void> => {
    if (await doc.openFile()) ws.setSidebarMode('outline')
  }

  // Finder "Open With" / double-clicking a registered file (macOS open-file).
  const openFromSystem = async (path: string): Promise<void> => {
    if (await doc.openPathFromDisk(path)) ws.setSidebarMode('outline')
  }

  // Latest-render handlers, read by the event subscriptions below. Doc/ws
  // callbacks are stable (useCallback), but the composed actions above are not;
  // the ref lets listeners subscribe exactly once.
  const actionsRef = useRef({
    showHelp,
    openFile,
    openFromSystem,
    doc,
    ws,
    toggleTheme
  })
  actionsRef.current = { showHelp, openFile, openFromSystem, doc, ws, toggleTheme }

  // ---- menu / system event wiring ------------------------------------------
  useEffect(() => {
    const a = (): typeof actionsRef.current => actionsRef.current
    const offs = [
      window.api.onOpenPath((path) => void a().openFromSystem(path)),
      window.api.onOpenFolder((path) => void a().ws.loadFolder(path)),
      window.api.onFullScreen(setIsFullScreen),
      window.api.onMenu(MenuChannel.toggleOutline, () => setShowOutline((v) => !v)),
      window.api.onMenu(MenuChannel.newFile, () => a().doc.newFile()),
      window.api.onMenu(MenuChannel.openFile, () => void a().openFile()),
      window.api.onMenu(MenuChannel.openFolder, () => void a().ws.openFolder()),
      window.api.onMenu(MenuChannel.saveFile, () => void a().doc.saveFile()),
      window.api.onMenu(MenuChannel.saveFileAs, () => void a().doc.saveFileAs()),
      window.api.onMenu(MenuChannel.toggleTheme, () => a().toggleTheme()),
      window.api.onMenu(MenuChannel.find, () => {
        const view = a().doc.getView()
        if (view) openSearchPanel(view)
      }),
      window.api.onMenu(MenuChannel.showHelp, () => a().showHelp()),
      // Main intercepted a window close because the buffer is dirty: save (or
      // abort if the user cancels Save As), then report so main can finish.
      window.api.onRequestSaveThenClose(() => {
        void a()
          .doc.saveFile()
          .then((ok) => window.api.saveThenCloseResult(ok))
      })
    ]
    return () => offs.forEach((off) => off())
  }, [])

  // ---- global shortcuts (native accelerators are gone with the native menu) --
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return
      const { doc, ws, toggleTheme, openFile } = actionsRef.current
      const k = e.key.toLowerCase()
      if (e.shiftKey && k === 't') {
        e.preventDefault()
        toggleTheme()
      } else if (e.shiftKey && k === 's') {
        e.preventDefault()
        void doc.saveFileAs()
      } else if (e.shiftKey && k === 'o') {
        e.preventDefault()
        void ws.openFolder()
      } else if (k === 'o') {
        e.preventDefault()
        void openFile()
      } else if (k === 's') {
        e.preventDefault()
        void doc.saveFile()
      } else if (k === 'n') {
        e.preventDefault()
        doc.newFile()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- in-app menu (replaces the native menu; follows app theme) ------------
  // macOS shows the same shortcuts with ⌘/⇧ glyphs; the native menu bar owns
  // the real accelerators there, this menu stays as themed UI on all platforms.
  // Menu actions resolve handlers at click time via actionsRef, so the def
  // only depends on isMac (shortcut glyphs) and memoizes cleanly.
  const menus: MenuDef[] = useMemo(() => {
    const f = (s: string): string => fmtShortcut(s, isMac)
    const a = (): typeof actionsRef.current => actionsRef.current
    return [
      {
        label: 'File',
        items: [
          { label: 'New', shortcut: f('Ctrl+N'), action: () => a().doc.newFile() },
          { label: 'Open…', shortcut: f('Ctrl+O'), action: () => void a().openFile() },
          { label: 'Open Folder…', shortcut: f('Ctrl+Shift+O'), action: () => void a().ws.openFolder() },
          { separator: true },
          { label: 'Save', shortcut: f('Ctrl+S'), action: () => void a().doc.saveFile() },
          { label: 'Save As…', shortcut: f('Ctrl+Shift+S'), action: () => void a().doc.saveFileAs() }
        ]
      },
      {
        label: 'Edit',
        items: [
          {
            label: 'Undo',
            shortcut: f('Ctrl+Z'),
            action: () => {
              const view = a().doc.getView()
              if (view) undo(view)
            }
          },
          {
            label: 'Redo',
            shortcut: f('Ctrl+Y'),
            action: () => {
              const view = a().doc.getView()
              if (view) redo(view)
            }
          },
          { separator: true },
          { label: 'Cut', shortcut: f('Ctrl+X'), action: () => a().doc.editCut() },
          { label: 'Copy', shortcut: f('Ctrl+C'), action: () => a().doc.editCopy() },
          { label: 'Paste', shortcut: f('Ctrl+V'), action: () => void a().doc.editPaste() },
          { label: 'Select All', shortcut: f('Ctrl+A'), action: () => a().doc.editSelectAll() },
          { separator: true },
          {
            label: 'Find',
            shortcut: f('Ctrl+F'),
            action: () => {
              const view = a().doc.getView()
              if (view) openSearchPanel(view)
            }
          }
        ]
      },
      {
        label: 'View',
        items: [
          { label: 'Toggle Outline', action: () => setShowOutline((v) => !v) },
          { separator: true },
          { label: 'Zoom In', action: () => window.api.windowZoom('in') },
          { label: 'Zoom Out', action: () => window.api.windowZoom('out') },
          { label: 'Reset Zoom', action: () => window.api.windowZoom('reset') },
          { separator: true },
          { label: 'Toggle Developer Tools', action: () => window.api.windowToggleDevTools() },
          { separator: true },
          { label: 'Toggle Theme', shortcut: f('Ctrl+Shift+T'), action: () => a().toggleTheme() }
        ]
      },
      {
        label: 'Help',
        items: [{ label: 'Markdown Syntax Reference', action: () => a().showHelp() }]
      }
    ]
  }, [isMac])

  const fileName = doc.filePath ? basenameOf(doc.filePath) : 'Untitled'
  const folderName = ws.folderPath
    ? basenameOf(ws.folderPath) || ws.folderPath
    : null

  return (
    <div
      className={`app theme-${theme}${isMac ? ' platform-mac' : ''}${
        isFullScreen ? ' is-fullscreen' : ''
      }`}
    >
      <Titlebar
        menus={menus}
        fileName={fileName}
        dirty={doc.dirty}
        theme={theme}
        themeShortcut={fmtShortcut('Ctrl+Shift+T', isMac)}
        isMac={isMac}
        onToggleOutline={() => setShowOutline((v) => !v)}
        onToggleTheme={toggleTheme}
      />
      <div className="main">
        {showOutline && (
          <Sidebar
            mode={ws.sidebarMode}
            folderPath={ws.folderPath}
            folderName={folderName}
            folderTree={ws.folderTree}
            activeFilePath={doc.filePath}
            outline={doc.outline}
            activePos={doc.activePos}
            treeMenu={ws.treeMenu}
            treeMenuItems={ws.treeMenuItems}
            onOpenFile={(path) => void ws.openFileFromTree(path)}
            onTreeContextMenu={ws.setTreeMenu}
            onCloseTreeMenu={() => ws.setTreeMenu(null)}
            onNewFile={(dirPath) => void ws.treeNewFile(dirPath)}
            onBackToFiles={() => ws.setSidebarMode('files')}
            onGoToHeading={doc.goToHeading}
          />
        )}
        <div className="editor-host" ref={doc.hostRef} />
      </div>
    </div>
  )
}
