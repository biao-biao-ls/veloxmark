import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { EditorView } from '@codemirror/view'
import { updateLivePreviewConfig } from '../editor/setup'
import { dialog } from '../components/Dialog'
import { WELCOME_MD } from '../content'
import { addRecentFile, patchSession } from '../preferences/store'

export type SidebarMode = 'outline' | 'files'

interface Args {
  viewRef: RefObject<EditorView | null>
  updateOutline: () => void
  setSidebarMode: (mode: SidebarMode) => void
  /** P03 session restore only — suppress the outline switch for one open. */
  restoringRef: RefObject<boolean>
}

/**
 * Single-file document state and operations: new/open/save/saveAs, dirty
 * tracking, and the system (Finder) open-file entry point.
 */
export function useFileOps({ viewRef, updateOutline, setSidebarMode, restoringRef }: Args) {
  const filePathRef = useRef<string | null>(null)
  const savedContentRef = useRef<string>(WELCOME_MD)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const syncAppState = useCallback((path: string | null, isDirty: boolean) => {
    filePathRef.current = path
    void window.api.setAppState({ filePath: path, dirty: isDirty })
  }, [])

  /** Point relative image resolution at the directory of `path`. */
  const setBaseDir = useCallback(
    (path: string) => {
      const view = viewRef.current
      if (view) {
        updateLivePreviewConfig(view, { baseDir: path.replace(/[\\/][^\\/]*$/, '') })
      }
    },
    [viewRef]
  )

  const loadContent = useCallback(
    (content: string, path: string | null) => {
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
      // P03: any successful open lands in Recent Files and session memory.
      if (path) {
        addRecentFile(path)
        patchSession({ lastFilePath: path })
      }
    },
    [viewRef, syncAppState, updateOutline]
  )

  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    if (!dirty) return true
    return dialog.confirm({
      title: 'Unsaved Changes',
      message: 'Discard unsaved changes?',
      confirmLabel: 'Discard'
    })
  }, [dirty])

  const newFile = useCallback(async () => {
    if (!(await confirmDiscard())) return
    loadContent('', null)
  }, [confirmDiscard, loadContent])

  const openFile = useCallback(async () => {
    if (!(await confirmDiscard())) return
    const result = await window.api.openFile()
    if (!result) return
    setBaseDir(result.filePath)
    loadContent(result.content, result.filePath)
    // Single-file open always focuses the outline; an open folder (if any)
    // stays reachable via the sidebar back button.
    setSidebarMode('outline')
  }, [confirmDiscard, loadContent, setSidebarMode, setBaseDir])

  // Finder "Open With" / double-clicking a registered file (macOS open-file).
  const openFromSystem = useCallback(
    async (path: string) => {
      if (!viewRef.current) return
      if (!(await confirmDiscard())) return
      const content = await window.api.readFile(path)
      setBaseDir(path)
      loadContent(content, path)
      setSidebarMode('outline')
    },
    [viewRef, confirmDiscard, loadContent, setSidebarMode, setBaseDir]
  )

  const saveFileAs = useCallback(async (): Promise<boolean> => {
    const view = viewRef.current
    if (!view) return false
    const target = await window.api.showSaveDialog(filePathRef.current ?? 'untitled.md')
    if (!target) return false
    const content = view.state.doc.toString()
    await window.api.writeFile(target, content)
    savedContentRef.current = content
    setBaseDir(target)
    setFilePath(target)
    setDirty(false)
    syncAppState(target, false)
    // P03: Save As to a new path also becomes the recent/session file.
    addRecentFile(target)
    patchSession({ lastFilePath: target })
    return true
  }, [viewRef, syncAppState, setBaseDir])

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
  }, [viewRef, saveFileAs, syncAppState])

  // Open a specific path (Recent Files entries, session restore). Existence
  // is checked here so a deleted file alerts instead of throwing.
  const openRecentFile = useCallback(
    async (path: string) => {
      if (!viewRef.current) return
      if (!(await confirmDiscard())) return
      if (!(await window.api.pathExists(path))) {
        await dialog.alert({ title: 'File Not Found', message: `No longer exists:\n${path}` })
        return
      }
      const content = await window.api.readFile(path)
      setBaseDir(path)
      loadContent(content, path)
      // Session restore re-establishes its own sidebar mode after this call;
      // a normal open (Recent Files) switches to the document outline.
      if (!restoringRef.current) setSidebarMode('outline')
    },
    [viewRef, confirmDiscard, loadContent, setSidebarMode, setBaseDir, restoringRef]
  )

  // macOS Finder "Open With" delivers paths before/after mount — subscribe here.
  useEffect(() => {
    return window.api.onOpenPath((path) => void openFromSystem(path))
  }, [openFromSystem])

  return {
    filePath,
    dirty,
    setDirty,
    setFilePath,
    filePathRef,
    savedContentRef,
    syncAppState,
    setBaseDir,
    loadContent,
    confirmDiscard,
    newFile,
    openFile,
    openFromSystem,
    openRecentFile,
    saveFile,
    saveFileAs
  }
}
