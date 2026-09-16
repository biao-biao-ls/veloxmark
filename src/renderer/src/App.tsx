import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import Outline from './components/Outline'
import FileTree from './components/FileTree'
import TreeMenu from './components/TreeMenu'
import Titlebar from './components/Titlebar'
import Preferences from './components/Preferences'
import { DialogHost } from './components/Dialog'
import { createExtensions, updateEditingAssists, updateShowLineNumbers } from './editor/setup'
import { readEditingAssistsConfig } from './editor/assists'
import { extractOutline, type OutlineItem } from './outline/extract'
import { WELCOME_MD } from './content'
import { useFileOps } from './hooks/useFileOps'
import { useWorkspaceTree } from './hooks/useWorkspaceTree'
import { useAppTheme } from './hooks/useAppTheme'
import { useMenus } from './hooks/useMenus'
import { usePreferences, useSession } from './preferences/useStore'
import {
  clearRecentFiles,
  getPreferences,
  getSession,
  patchSession
} from './preferences/store'
import type { RecentItem } from './commands'

export default function App(): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  // True only while the startup restore is replaying lastFile/lastFolder, so
  // openRecentFile does not fight the restored sidebar mode.
  const restoringRef = useRef(false)
  // Separate from restoringRef: that one brackets the async restore body, while
  // this stays false from first render until the restore attempt is resolved,
  // so the session-persistence effects below cannot write during the gap.
  // State rather than a ref, because flipping it must re-run those effects —
  // a ref would leave them permanently skipped after their mount run.
  const [sessionSynced, setSessionSynced] = useState(false)

  // macOS: native traffic lights + menu-bar shortcuts; Win/Linux: custom titlebar.
  const isMac = window.api.platform === 'darwin'

  const { theme, toggleTheme } = useAppTheme(viewRef)
  const prefs = usePreferences()
  const session = useSession()
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [activePos, setActivePos] = useState<number | null>(null)
  // P03: sidebar visibility/mode/width come from session memory; with no
  // memory yet, visibility falls back to the "sidebar open by default" pref.
  const [showOutline, setShowOutline] = useState(
    () => getSession().sidebarVisible ?? getPreferences().sidebarDefaultOpen
  )
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [sidebarMode, setSidebarMode] = useState<'outline' | 'files'>(
    () => getSession().sidebarMode ?? 'outline'
  )
  const [sidebarWidth, setSidebarWidth] = useState(() => getSession().sidebarWidth ?? 240)
  const [sidebarResizing, setSidebarResizing] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)

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

  const fileOps = useFileOps({ viewRef, updateOutline, setSidebarMode, restoringRef })
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

  // ---- P03: session persistence ---------------------------------------------
  // These effects fire on mount, which is *before* the restore effect runs and
  // while restoringRef is still false. Writing then would overwrite the saved
  // session with the initial React state — sidebarVisible true, mode 'outline',
  // width 240 — wiping recents, last paths and the stored sidebar layout on
  // every launch. Gate on sessionSynced, which the restore effect flips once
  // the saved state has been applied; flipping it re-runs these effects, so
  // the restored values are written back and later edits keep persisting.
  useEffect(() => {
    if (!sessionSynced) return
    patchSession({ sidebarVisible: showOutline })
  }, [sessionSynced, showOutline])
  useEffect(() => {
    if (!sessionSynced) return
    patchSession({ sidebarMode })
  }, [sessionSynced, sidebarMode])
  useEffect(() => {
    if (!sessionSynced) return
    patchSession({ sidebarWidth })
  }, [sessionSynced, sidebarWidth])

  // Validated Recent Files entries for the File menu (and the macOS native
  // menu, which receives the same list over IPC).
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const files = session.recentFiles
      const items = await Promise.all(
        files.map(async (path) => ({
          path,
          name: path.replace(/^.*[\\/]/, ''),
          exists: await window.api.pathExists(path)
        }))
      )
      if (!cancelled) setRecentItems(items)
    })()
    return () => {
      cancelled = true
    }
  }, [session.recentFiles])

  useEffect(() => {
    void window.api.setRecentFiles(recentItems.map(({ path, exists }) => ({ path, exists })))
  }, [recentItems])

  // Native-menu Open Recent / Clear Menu clicks arrive with payloads.
  useEffect(() => {
    const offOpen = window.api.onMenu('menu:openRecent', (path?: string) => {
      if (path) void fileOps.openRecentFile(path)
    })
    const offClear = window.api.onMenu('menu:clearRecent', () => clearRecentFiles())
    return () => {
      offOpen()
      offClear()
    }
  }, [fileOps.openRecentFile])

  // Minimal session restore (full snapshot restore belongs to P12): reopen the
  // last folder workspace and file. System open-file events queued in main
  // arrive right after rendererReady and simply replace whatever we load here.
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    if (!getPreferences().restoreLastSession) {
      setSessionSynced(true)
      return
    }
    const saved = getSession()
    void (async () => {
      restoringRef.current = true
      try {
        if (saved.lastFolderPath && (await window.api.pathExists(saved.lastFolderPath))) {
          await workspace.loadFolder(saved.lastFolderPath)
        }
        if (saved.lastFilePath && (await window.api.pathExists(saved.lastFilePath))) {
          await fileOps.openRecentFile(saved.lastFilePath)
        }
        // Reapply the stored mode last, so restoring a file inside a folder
        // workspace comes back in files mode (acceptance criterion 2).
        if (saved.sidebarMode) setSidebarMode(saved.sidebarMode)
      } catch {
        // restore is best-effort
      } finally {
        restoringRef.current = false
        // Re-enable the session-persistence effects only now, so they fire for
        // the restored state rather than clobbering it mid-boot.
        setSessionSynced(true)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- editor preference toggles (live reconfigure) --------------------------
  useEffect(() => {
    const view = viewRef.current
    if (view) updateShowLineNumbers(view, prefs.showLineNumbers)
  }, [prefs.showLineNumbers])

  useEffect(() => {
    const view = viewRef.current
    if (view) {
      updateEditingAssists(view, {
        enabled: prefs.typingAssistsEnabled,
        wrapBareUrlOnPaste: prefs.wrapBareUrlOnPaste
      })
    }
  }, [prefs.typingAssistsEnabled, prefs.wrapBareUrlOnPaste])

  // ---- sidebar drag-resize ---------------------------------------------------
  const startSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setSidebarResizing(true)
    const onMove = (ev: MouseEvent): void =>
      setSidebarWidth(Math.min(480, Math.max(160, ev.clientX)))
    const onUp = (): void => {
      setSidebarResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

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
          // Read from the store, not the closure: this effect runs once ([]),
          // so a `theme` captured here would be the mount-time value and a
          // theme chosen before the editor mounts would never reach it.
          getPreferences().theme === 'dark' ? 'dark' : 'light',
          readEditingAssistsConfig(),
          getPreferences().showLineNumbers
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

  const toggleOutline = useCallback(() => setShowOutline((v) => !v), [])

  const { menus, formatShortcut } = useMenus({
    viewRef,
    isMac,
    recentItems,
    newFile: fileOps.newFile,
    openFile: fileOps.openFile,
    openFolder: workspace.openFolder,
    saveFile: fileOps.saveFile,
    saveFileAs: fileOps.saveFileAs,
    toggleTheme,
    loadContent: fileOps.loadContent,
    toggleOutline,
    openPreferences: () => setShowPreferences(true),
    openRecentFile: fileOps.openRecentFile,
    clearRecentFiles
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
          <aside className="sidebar" style={{ width: sidebarWidth }}>
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
        {showOutline && (
          <div
            className={`sidebar-resizer${sidebarResizing ? ' resizing' : ''}`}
            onMouseDown={startSidebarResize}
          />
        )}
        <div className="editor-host" ref={hostRef} />
      </div>
      <Preferences open={showPreferences} onClose={() => setShowPreferences(false)} />
      <DialogHost />
    </div>
  )
}
