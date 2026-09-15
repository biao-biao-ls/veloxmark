import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { openSearchPanel } from '@codemirror/search'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { redo, undo } from '@codemirror/commands'
import Outline from './components/Outline'
import MenuBar, { type MenuDef } from './components/MenuBar'
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
  }, [confirmDiscard, loadContent])

  // Finder "Open With" / double-clicking a registered file (macOS open-file).
  const openFromSystem = useCallback(
    async (path: string) => {
      if (!viewRef.current) return
      if (!confirmDiscard()) return
      const content = await window.api.readFile(path)
      livePreviewConfig.baseDir = path.replace(/[\\/][^\\/]*$/, '')
      loadContent(content, path)
    },
    [confirmDiscard, loadContent]
  )

  const saveFileAs = useCallback(async (): Promise<boolean> => {
    const view = viewRef.current
    if (!view) return false
    const target = await window.api.showSaveDialog(filePathRef.current ?? 'untitled.md')
    if (!target) return false
    const content = view.state.doc.toString()
    await window.api.writeFile(target, content)
    savedContentRef.current = content
    livePreviewConfig.baseDir = target.replace(/[\\/][^\\/]*$/, '')
    setFilePath(target)
    setDirty(false)
    syncAppState(target, false)
    return true
  }, [syncAppState])

  const saveFile = useCallback(async () => {
    const view = viewRef.current
    if (!view) return
    if (!filePathRef.current) {
      await saveFileAs()
      return
    }
    const content = view.state.doc.toString()
    await window.api.writeFile(filePathRef.current, content)
    savedContentRef.current = content
    setDirty(false)
    syncAppState(filePathRef.current, false)
  }, [saveFileAs, syncAppState])

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
      window.api.onFullScreen((full) => setIsFullScreen(full)),
      window.api.onMenu('menu:toggleOutline', () => setShowOutline((v) => !v)),
      window.api.onMenu('menu:newFile', () => newFile()),
      window.api.onMenu('menu:openFile', () => void openFile()),
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
        loadContent(HELP_MD, null)
      })
    ]
    return () => offs.forEach((off) => off())
  }, [openFromSystem, newFile, openFile, saveFile, saveFileAs, applyTheme, loadContent, theme])

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
        items: [{ label: 'Markdown Syntax Reference', action: () => loadContent(HELP_MD, null) }]
      }
    ],
    [fmtShortcut, newFile, openFile, saveFile, saveFileAs, editCut, editCopy, editPaste, editSelectAll, toggleTheme, loadContent]
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
  }, [toggleTheme, openFile, saveFile, saveFileAs, newFile])

  const fileName = filePath ? filePath.replace(/^.*[\\/]/, '') : 'Untitled'

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
          ☰
        </button>
        <button className="tb-btn" onClick={toggleTheme} title={`Toggle theme (${fmtShortcut('Ctrl+Shift+T')})`}>
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <div className="window-controls">
          <button
            className="wc-btn"
            onClick={() => window.api.windowMinimize()}
            title="Minimize"
          >
            ─
          </button>
          <button
            className="wc-btn"
            onClick={() => window.api.windowMaximizeRestore()}
            title="Maximize / Restore"
          >
            ❐
          </button>
          <button
            className="wc-btn wc-close"
            onClick={() => window.api.windowClose()}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="main">
        {showOutline && (
          <aside className="sidebar">
            <div className="sidebar-header">Outline</div>
            <Outline items={outline} activePos={activePos} onSelect={goToHeading} />
          </aside>
        )}
        <div className="editor-host" ref={hostRef} />
      </div>
    </div>
  )
}
