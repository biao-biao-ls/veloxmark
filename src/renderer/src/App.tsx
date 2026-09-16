import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import Outline from './components/Outline'
import FileTree from './components/FileTree'
import TreeMenu from './components/TreeMenu'
import Titlebar from './components/Titlebar'
import { createExtensions } from './editor/setup'
import { extractOutline, type OutlineItem } from './outline/extract'
import { WELCOME_MD } from './content'
import { useFileOps } from './hooks/useFileOps'
import { useWorkspaceTree } from './hooks/useWorkspaceTree'
import { useAppTheme } from './hooks/useAppTheme'
import { useMenus } from './hooks/useMenus'

export default function App(): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)

  // macOS: native traffic lights + menu-bar shortcuts; Win/Linux: custom titlebar.
  const isMac = window.api.platform === 'darwin'

  const { theme, applyTheme } = useAppTheme(viewRef)
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [activePos, setActivePos] = useState<number | null>(null)
  const [showOutline, setShowOutline] = useState(true)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [sidebarMode, setSidebarMode] = useState<'outline' | 'files'>('outline')

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
    for (const item of extractOutline(view.state)) {
      if (item.pos <= line) active = item.pos
      else break
    }
    setActivePos(active)
  }, [])

  const fileOps = useFileOps({ viewRef, updateOutline, setSidebarMode })
  const { dirty, setDirty, filePath, filePathRef, syncAppState, savedContentRef } = fileOps

  const workspace = useWorkspaceTree({
    filePathRef,
    dirty,
    confirmDiscard: fileOps.confirmDiscard,
    loadContent: fileOps.loadContent,
    setBaseDir: fileOps.setBaseDir,
    setFilePath: fileOps.setFilePath,
    syncAppState,
    setSidebarMode,
    setShowOutline
  })

  // ---- create editor --------------------------------------------------------
  useEffect(() => {
    if (!hostRef.current || viewRef.current) return

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

  const toggleTheme = useCallback(() => {
    applyTheme(theme === 'dark' ? 'light' : 'dark')
  }, [applyTheme, theme])

  const toggleOutline = useCallback(() => setShowOutline((v) => !v), [])

  const { menus, formatShortcut } = useMenus({
    viewRef,
    isMac,
    newFile: fileOps.newFile,
    openFile: fileOps.openFile,
    openFolder: workspace.openFolder,
    saveFile: fileOps.saveFile,
    saveFileAs: fileOps.saveFileAs,
    toggleTheme,
    loadContent: fileOps.loadContent,
    toggleOutline
  })

  // Fullscreen state is pushed from main (traffic-light / F11 transitions).
  useEffect(() => {
    return window.api.onFullScreen((full) => setIsFullScreen(full))
  }, [])

  const fileName = filePath ? filePath.replace(/^.*[\\/]/, '') : 'Untitled'
  const folderName = workspace.folderPath
    ? workspace.folderPath.replace(/^.*[\\/]/, '') || workspace.folderPath
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
        dirty={dirty}
        theme={theme}
        toggleOutline={toggleOutline}
        toggleTheme={toggleTheme}
        formatShortcut={formatShortcut}
      />

      <div className="main">
        {showOutline && (
          <aside className="sidebar">
            {sidebarMode === 'files' && workspace.folderPath ? (
              <>
                <div className="sidebar-header" title={workspace.folderPath}>
                  <span className="sidebar-title">{folderName}</span>
                  <button
                    className="sidebar-action"
                    onClick={() => void workspace.treeNewFile(workspace.folderPath!)}
                    title="New file"
                  >
                    +
                  </button>
                </div>
                <FileTree
                  nodes={workspace.folderTree}
                  activePath={filePath}
                  onOpen={(path) => void workspace.openFileFromTree(path)}
                  onContextMenu={workspace.setTreeMenu}
                />
                {workspace.treeMenu && (
                  <TreeMenu
                    x={workspace.treeMenu.x}
                    y={workspace.treeMenu.y}
                    items={workspace.treeMenuItems}
                    onClose={() => workspace.setTreeMenu(null)}
                  />
                )}
              </>
            ) : (
              <>
                <div className="sidebar-header">
                  {workspace.folderPath && (
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
