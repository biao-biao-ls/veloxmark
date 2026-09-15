import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { openSearchPanel } from '@codemirror/search'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { redo, undo } from '@codemirror/commands'
import Outline from './components/Outline'
import FileTree, { type TreeMenuRequest } from './components/FileTree'
import TreeMenu, { type TreeMenuItem } from './components/TreeMenu'
import MenuBar, { type MenuDef } from './components/MenuBar'
import { CloseIcon, MaximizeIcon, MinimizeIcon, MoonIcon, PanelIcon, SunIcon } from './components/Icons'
import { createExtensions, reconfigureTheme } from './editor/setup'
import { livePreviewConfig } from './editor/livePreview'
import type { ThemeName } from './editor/theme'
import { clearMermaidCache } from './editor/widgets'
import { extractOutline, type OutlineItem } from './outline/extract'

const WELCOME_MD = `# Welcome to VeloxMark

A **Markdown** editor with live preview — \`syntax\` markers disappear as you move away from a line, just like Typora.

## Features

- Live preview editing (WYSIWYG-style)
- *Italics*, **bold**, ~~strikethrough~~, \`inline code\`
- [Links](https://commonmark.org)
- Task lists:
  - [x] Open a file (Ctrl+O)
  - [ ] Try a math formula
- Mermaid diagrams and highlighted code

## Math

Inline math like $E = mc^2$ works, and display math:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
$$

## Code

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

## Diagram

\`\`\`mermaid
graph LR
  A[Write Markdown] --> B{Live Preview}
  B --> C[Looks beautiful]
  B --> D[Click to edit source]
\`\`\`

## Table

| Feature | Status | Notes |
| :------ | :----: | ----: |
| Live preview | ✅ | Typora-style |
| Math | ✅ | KaTeX |
| Mermaid | ✅ | click to edit |

> Tip: click any rendered block (code, math, diagram, table) to edit its source.
> Press \`Ctrl+O\` to open a \`.md\` file, \`Ctrl+S\` to save.
`

const HELP_MD = `# Markdown Syntax Reference

## Headings

Prefix with # (1–6 hashes):

\`\`\`markdown
# H1
## H2
### H3
\`\`\`

## Emphasis

\`\`\`markdown
**bold**  *italic*  ~~strikethrough~~  \`code\`
\`\`\`

## Lists

\`\`\`markdown
- unordered item
1. ordered item
- [ ] task
- [x] done
\`\`\`

## Quote & divider

\`\`\`markdown
> quoted text

---
\`\`\`

## Math (KaTeX)

\`\`\`markdown
inline: $a^2 + b^2 = c^2$

display:
$$
\\frac{1}{2}
$$
\`\`\`

## Diagrams (Mermaid)

\`\`\`markdown
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
\`\`\`

## Links & images

\`\`\`markdown
[text](https://example.com)
![alt](./image.png)
\`\`\`
`

function readStoredTheme(): ThemeName {
  const stored = localStorage.getItem('theme')
  return stored === 'dark' ? 'dark' : 'light'
}

export default function App(): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const filePathRef = useRef<string | null>(null)
  const savedContentRef = useRef<string>(WELCOME_MD)

  // macOS uses the native traffic lights (hiddenInset) and menu-bar shortcuts;
  // Windows/Linux keep the custom titlebar buttons.
  const isMac = window.api.platform === 'darwin'

  const [theme, setTheme] = useState<ThemeName>(readStoredTheme)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [activePos, setActivePos] = useState<number | null>(null)
  const [showOutline, setShowOutline] = useState(true)
  const [isFullScreen, setIsFullScreen] = useState(false)
  // Folder workspace: when set, the sidebar can show the markdown file tree
  // and switch between it and the current file's outline.
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [folderTree, setFolderTree] = useState<DirNode[]>([])
  const [sidebarMode, setSidebarMode] = useState<'outline' | 'files'>('outline')
  const [treeMenu, setTreeMenu] = useState<TreeMenuRequest | null>(null)

  const syncAppState = useCallback((path: string | null, isDirty: boolean) => {
    filePathRef.current = path
    void window.api.setAppState({ filePath: path, dirty: isDirty })
  }, [])

  const updateOutline = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    setOutline(extractOutline(view.state))
  }, [])

  const updateActiveHeading = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const head = view.state.selection.main.head
    const line = view.state.doc.lineAt(head).from
    let active: number | null = null
    const items = extractOutline(view.state)
    for (const item of items) {
      if (item.pos <= line) active = item.pos
      else break
    }
    setActivePos(active)
  }, [])

  // ---- create editor --------------------------------------------------------
  useEffect(() => {
    if (!hostRef.current || viewRef.current) return

    livePreviewConfig.theme = theme

    const view = new EditorView({
      state: EditorState.create({
        doc: WELCOME_MD,
        extensions: createExtensions(
          {
            onChange: () => {
              const doc = view.state.doc.toString()
              const isDirty = doc !== savedContentRef.current
              setDirty(isDirty)
              syncAppState(filePathRef.current, isDirty)
              updateOutline()
            },
            onSelectionChanged: () => updateActiveHeading(),
            onTreeChanged: () => {
              updateOutline()
              updateActiveHeading()
            }
          },
          theme
        )
      }),
      parent: hostRef.current
    })
    viewRef.current = view
    updateOutline()

    // Editor is mounted — main may now deliver queued system open-file paths.
    window.api.rendererReady()
    // Push the initial clean state so main's dirty-close guard starts accurate
    // (it also sets the window title for the welcome document).
    syncAppState(null, false)

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- file operations ------------------------------------------------------
  const loadContent = useCallback((content: string, path: string | null) => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
      selection: { anchor: 0 },
      effects: EditorView.scrollIntoView(0, { y: 'start' })
    })
    savedContentRef.current = content
    setFilePath(path)
    setDirty(false)
    syncAppState(path, false)
    updateOutline()
  }, [syncAppState, updateOutline])

  const confirmDiscard = useCallback((): boolean => {
    if (!dirty) return true
    return window.confirm('Discard unsaved changes?')
  }, [dirty])

  const newFile = useCallback(() => {
    if (!confirmDiscard()) return
    loadContent('', null)
  }, [confirmDiscard, loadContent])

  const openFile = useCallback(async () => {
    if (!confirmDiscard()) return
    const result = await window.api.openFile()
    if (!result) return
    livePreviewConfig.baseDir = result.filePath.replace(/[\\/][^\\/]*$/, '')
    loadContent(result.content, result.filePath)
    // Single-file open always focuses the outline; an open folder (if any)
    // stays reachable via the sidebar back button.
    setSidebarMode('outline')
  }, [confirmDiscard, loadContent])

  // Load a folder workspace: sidebar switches to the markdown file tree.
  // The editor keeps its current document until a file is picked. Subscribing
  // the watcher delivers the initial tree and every subsequent refresh.
  const loadFolder = useCallback(async (dirPath: string) => {
    setFolderPath(dirPath)
    setSidebarMode('files')
    setShowOutline(true)
    await window.api.watchFolder(dirPath)
  }, [])

  const openFolder = useCallback(async () => {
    const result = await window.api.openFolder()
    if (!result) return
    await loadFolder(result.folderPath)
  }, [loadFolder])

  // Open a file picked from the folder tree — switches the sidebar to outline.
  const openFileFromTree = useCallback(
    async (path: string) => {
      if (filePathRef.current === path) {
        setSidebarMode('outline')
        return
      }
      if (!confirmDiscard()) return
      try {
        const content = await window.api.readFile(path)
        livePreviewConfig.baseDir = path.replace(/[\\/][^\\/]*$/, '')
        loadContent(content, path)
        setSidebarMode('outline')
      } catch (err) {
        window.alert(`Could not open file: ${err instanceof Error ? err.message : err}`)
      }
    },
    [confirmDiscard, loadContent]
  )

  // ---- folder tree operations (new / rename / delete) ------------------------
  // Tree refresh after each op comes from the watcher's folder:tree push —
  // no manual rescan here.

  const joinPath = useCallback((dir: string, name: string): string => {
    const sep = window.api.platform === 'win32' ? '\\' : '/'
    return dir.replace(/[\\/]+$/, '') + sep + name
  }, [])

  const treeNewFile = useCallback(
    async (dirPath: string) => {
      const name = window.prompt('New file name:')
      if (!name) return
      if (/[/\\]/.test(name) || name === '.' || name === '..') {
        window.alert('Invalid file name.')
        return
      }
      const fileName = /\.[^./\\]+$/.test(name) ? name : `${name}.md`
      try {
        await window.api.createFile(joinPath(dirPath, fileName))
      } catch (err) {
        window.alert(`Could not create file: ${err instanceof Error ? err.message : err}`)
      }
    },
    [joinPath]
  )

  const treeRename = useCallback(
    async (node: DirNode) => {
      const name = window.prompt(node.isDir ? 'Rename folder:' : 'Rename file:', node.name)
      if (!name || name === node.name) return
      if (/[/\\]/.test(name) || name === '.' || name === '..') {
        window.alert('Invalid name.')
        return
      }
      // sibling path: swap the last segment, keeping the original separator
      const newPath = node.path.slice(0, node.path.length - node.name.length) + name
      try {
        await window.api.renamePath(node.path, newPath)
      } catch (err) {
        window.alert(`Could not rename: ${err instanceof Error ? err.message : err}`)
        return
      }
      // keep the open editor attached when its file (or an ancestor folder) moves
      const current = filePathRef.current
      const sep = window.api.platform === 'win32' ? '\\' : '/'
      let movedTo: string | null = null
      if (current === node.path) {
        movedTo = newPath
      } else if (node.isDir && current && current.startsWith(node.path + sep)) {
        movedTo = newPath + current.slice(node.path.length)
      }
      if (movedTo) {
        setFilePath(movedTo)
        syncAppState(movedTo, dirty)
        // relative image paths resolve against the file's directory — follow the move
        livePreviewConfig.baseDir = movedTo.replace(/[\\/][^\\/]*$/, '')
      }
    },
    [dirty, syncAppState]
  )

  const treeDelete = useCallback(
    async (node: DirNode) => {
      const what = node.isDir ? 'folder' : 'file'
      if (!window.confirm(`Delete ${what} "${node.name}"? This cannot be undone.`)) return
      try {
        await window.api.deletePath(node.path)
      } catch (err) {
        window.alert(`Could not delete: ${err instanceof Error ? err.message : err}`)
        return
      }
      // if the open file is gone, detach it (buffer keeps its content → Save As)
      const current = filePathRef.current
      const sep = window.api.platform === 'win32' ? '\\' : '/'
      if (current === node.path || (node.isDir && current?.startsWith(node.path + sep))) {
        setFilePath(null)
        syncAppState(null, dirty)
      }
    },
    [dirty, syncAppState]
  )

  const treeMenuItems: TreeMenuItem[] = useMemo(() => {
    if (!treeMenu) return []
    const { node } = treeMenu
    if (node.isDir) {
      return [
        { label: 'New File', action: () => void treeNewFile(node.path) },
        { label: 'Rename', action: () => void treeRename(node) },
        { label: 'Delete', danger: true, action: () => void treeDelete(node) }
      ]
    }
    return [
      { label: 'Rename', action: () => void treeRename(node) },
      { label: 'Delete', danger: true, action: () => void treeDelete(node) }
    ]
  }, [treeMenu, treeNewFile, treeRename, treeDelete])

  // Finder "Open With" / double-clicking a registered file (macOS open-file).
  const openFromSystem = useCallback(
    async (path: string) => {
      if (!viewRef.current) return
      if (!confirmDiscard()) return
      try {
        const content = await window.api.readFile(path)
        livePreviewConfig.baseDir = path.replace(/[\\/][^\\/]*$/, '')
        loadContent(content, path)
        setSidebarMode('outline')
      } catch (err) {
        window.alert(`Could not open file: ${err instanceof Error ? err.message : err}`)
      }
    },
    [confirmDiscard, loadContent]
  )

  // Finder "Open" on a folder (macOS open-file with a directory path).
  const openFolderFromSystem = useCallback(
    (path: string) => {
      void loadFolder(path)
    },
    [loadFolder]
  )

  // Write the buffer to `target`. Handles the main-process conflict report
  // (file changed on disk since we opened it) by asking before overwriting.
  const writeBufferTo = useCallback(async (target: string): Promise<boolean> => {
    const view = viewRef.current
    if (!view) return false
    const content = view.state.doc.toString()
    let result = await window.api.writeFile(target, content)
    if (!result.ok && result.conflict) {
      const overwrite = window.confirm(
        `"${target.replace(/^.*[\\/]/, '')}" was changed on disk since it was opened. Overwrite those changes?`
      )
      if (!overwrite) return false
      result = await window.api.writeFile(target, content, { force: true })
    }
    if (!result.ok) {
      window.alert(`Could not save: ${result.error ?? 'unknown error'}`)
      return false
    }
    savedContentRef.current = content
    livePreviewConfig.baseDir = target.replace(/[\\/][^\\/]*$/, '')
    setDirty(false)
    syncAppState(target, false)
    return true
  }, [syncAppState])

  const saveFileAs = useCallback(async (): Promise<boolean> => {
    const target = await window.api.showSaveDialog(filePathRef.current ?? 'untitled.md')
    if (!target) return false
    const ok = await writeBufferTo(target)
    if (ok) setFilePath(target)
    return ok
  }, [writeBufferTo])

  const saveFile = useCallback(async (): Promise<boolean> => {
    if (!filePathRef.current) return saveFileAs()
    return writeBufferTo(filePathRef.current)
  }, [saveFileAs, writeBufferTo])

  // ---- theme ----------------------------------------------------------------
  const applyTheme = useCallback((next: ThemeName) => {
    setTheme(next)
    localStorage.setItem('theme', next)
    livePreviewConfig.theme = next
    clearMermaidCache()
    const view = viewRef.current
    if (view) reconfigureTheme(view, next)
  }, [])

  // ---- menu wiring ----------------------------------------------------------
  useEffect(() => {
    const offs = [
      window.api.onOpenPath((path) => void openFromSystem(path)),
      window.api.onOpenFolder((path) => openFolderFromSystem(path)),
      window.api.onFolderTree((tree) => setFolderTree(tree)),
      window.api.onFullScreen((full) => setIsFullScreen(full)),
      window.api.onMenu('menu:toggleOutline', () => setShowOutline((v) => !v)),
      window.api.onMenu('menu:newFile', () => newFile()),
      window.api.onMenu('menu:openFile', () => void openFile()),
      window.api.onMenu('menu:openFolder', () => void openFolder()),
      window.api.onMenu('menu:saveFile', () => void saveFile()),
      window.api.onMenu('menu:saveFileAs', () => void saveFileAs()),
      window.api.onMenu('menu:toggleTheme', () =>
        applyTheme(theme === 'dark' ? 'light' : 'dark')
      ),
      window.api.onMenu('menu:find', () => {
        const view = viewRef.current
        if (view) openSearchPanel(view)
      }),
      window.api.onMenu('menu:showHelp', () => {
        // Help replaces the current buffer — never drop unsaved changes silently.
        if (!confirmDiscard()) return
        loadContent(HELP_MD, null)
      }),
      // Main intercepted a window close because the buffer is dirty: save (or
      // abort if the user cancels Save As), then report so main can finish.
      window.api.onRequestSaveThenClose(() => {
        void saveFile().then((ok) => window.api.saveThenCloseResult(ok))
      })
    ]
    return () => offs.forEach((off) => off())
  }, [openFromSystem, openFolderFromSystem, newFile, openFile, openFolder, saveFile, saveFileAs, applyTheme, loadContent, theme, confirmDiscard])

  // ---- outline navigation ---------------------------------------------------
  const goToHeading = useCallback((pos: number) => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: 'center' }),
      scrollIntoView: true
    })
    view.focus()
  }, [])

  // ---- edit operations (used by the in-app Edit menu) -----------------------
  const editCopy = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    if (from !== to) void window.api.clipboardWrite(view.state.sliceDoc(from, to))
  }, [])

  const editCut = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    if (from === to) return
    void window.api.clipboardWrite(view.state.sliceDoc(from, to))
    view.dispatch({ changes: { from, to } })
  }, [])

  const editPaste = useCallback(async () => {
    const view = viewRef.current
    if (!view) return
    const text = await window.api.clipboardRead()
    if (text) view.dispatch(view.state.replaceSelection(text))
  }, [])

  const editSelectAll = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } })
  }, [])

  const toggleTheme = useCallback(() => {
    applyTheme(theme === 'dark' ? 'light' : 'dark')
  }, [applyTheme, theme])

  // ---- in-app menu (replaces the native menu; follows app theme) ------------
  // macOS shows the same shortcuts with ⌘/⇧ glyphs; the native menu bar owns
  // the real accelerators there, this menu stays as themed UI on all platforms.
  const fmtShortcut = useCallback(
    (s: string): string =>
      isMac
        ? s.replace('Ctrl+', '⌘').replace('Shift+', '⇧').replace('Alt+', '⌥').replaceAll('+', '')
        : s,
    [isMac]
  )

  const menus: MenuDef[] = useMemo(
    () => [
      {
        label: 'File',
        items: [
          { label: 'New', shortcut: fmtShortcut('Ctrl+N'), action: () => newFile() },
          { label: 'Open…', shortcut: fmtShortcut('Ctrl+O'), action: () => void openFile() },
          { label: 'Open Folder…', shortcut: fmtShortcut('Ctrl+Shift+O'), action: () => void openFolder() },
          { separator: true },
          { label: 'Save', shortcut: fmtShortcut('Ctrl+S'), action: () => void saveFile() },
          { label: 'Save As…', shortcut: fmtShortcut('Ctrl+Shift+S'), action: () => void saveFileAs() }
        ]
      },
      {
        label: 'Edit',
        items: [
          { label: 'Undo', shortcut: fmtShortcut('Ctrl+Z'), action: () => viewRef.current && undo(viewRef.current) },
          { label: 'Redo', shortcut: fmtShortcut('Ctrl+Y'), action: () => viewRef.current && redo(viewRef.current) },
          { separator: true },
          { label: 'Cut', shortcut: fmtShortcut('Ctrl+X'), action: () => editCut() },
          { label: 'Copy', shortcut: fmtShortcut('Ctrl+C'), action: () => editCopy() },
          { label: 'Paste', shortcut: fmtShortcut('Ctrl+V'), action: () => void editPaste() },
          { label: 'Select All', shortcut: fmtShortcut('Ctrl+A'), action: () => editSelectAll() },
          { separator: true },
          {
            label: 'Find',
            shortcut: fmtShortcut('Ctrl+F'),
            action: () => viewRef.current && openSearchPanel(viewRef.current)
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
          { label: 'Toggle Theme', shortcut: fmtShortcut('Ctrl+Shift+T'), action: () => toggleTheme() }
        ]
      },
      {
        label: 'Help',
        items: [
          {
            label: 'Markdown Syntax Reference',
            action: () => {
              if (!confirmDiscard()) return
              loadContent(HELP_MD, null)
            }
          }
        ]
      }
    ],
    [fmtShortcut, newFile, openFile, openFolder, saveFile, saveFileAs, editCut, editCopy, editPaste, editSelectAll, toggleTheme, loadContent, confirmDiscard]
  )

  // ---- global shortcuts (native accelerators are gone with the native menu) --
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

  const fileName = filePath ? filePath.replace(/^.*[\\/]/, '') : 'Untitled'
  const folderName = folderPath ? folderPath.replace(/^.*[\\/]/, '') || folderPath : null

  return (
    <div
      className={`app theme-${theme}${isMac ? ' platform-mac' : ''}${
        isFullScreen ? ' is-fullscreen' : ''
      }`}
    >
      <div
        className="titlebar"
        onDoubleClick={(e) => {
          const target = e.target as HTMLElement
          if (target.closest('button') || target.closest('.menubar')) return
          window.api.windowMaximizeRestore()
        }}
      >
        <img className="tb-logo" src="/icon.png" alt="VeloxMark" draggable={false} />
        <MenuBar menus={menus} />
        <span className="tb-title">
          {dirty && <span className="tb-dirty">• </span>}
          {fileName} — VeloxMark
        </span>
        <span className="tb-spacer" />
        <button
          className="tb-btn"
          onClick={() => setShowOutline((v) => !v)}
          title="Toggle outline"
        >
          <PanelIcon />
        </button>
        <button className="tb-btn" onClick={toggleTheme} title={`Toggle theme (${fmtShortcut('Ctrl+Shift+T')})`}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <div className="window-controls">
          <button
            className="wc-btn"
            onClick={() => window.api.windowMinimize()}
            title="Minimize"
          >
            <MinimizeIcon />
          </button>
          <button
            className="wc-btn"
            onClick={() => window.api.windowMaximizeRestore()}
            title="Maximize / Restore"
          >
            <MaximizeIcon />
          </button>
          <button
            className="wc-btn wc-close"
            onClick={() => window.api.windowClose()}
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      <div className="main">
        {showOutline && (
          <aside className="sidebar">
            {sidebarMode === 'files' && folderPath ? (
              <>
                <div className="sidebar-header" title={folderPath}>
                  <span className="sidebar-title">{folderName}</span>
                  <button
                    className="sidebar-action"
                    onClick={() => void treeNewFile(folderPath)}
                    title="New file"
                  >
                    +
                  </button>
                </div>
                <FileTree
                  nodes={folderTree}
                  activePath={filePath}
                  onOpen={(path) => void openFileFromTree(path)}
                  onContextMenu={setTreeMenu}
                />
                {treeMenu && (
                  <TreeMenu
                    x={treeMenu.x}
                    y={treeMenu.y}
                    items={treeMenuItems}
                    onClose={() => setTreeMenu(null)}
                  />
                )}
              </>
            ) : (
              <>
                <div className="sidebar-header">
                  {folderPath && (
                    <button
                      className="sidebar-back"
                      onClick={() => setSidebarMode('files')}
                      title="Back to file list"
                    >
                      ‹ Files
                    </button>
                  )}
                  <span>Outline</span>
                </div>
                <Outline items={outline} activePos={activePos} onSelect={goToHeading} />
              </>
            )}
          </aside>
        )}
        <div className="editor-host" ref={hostRef} />
      </div>
    </div>
  )
}
