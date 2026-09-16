import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { EditorView } from '@codemirror/view'
import { livePreviewConfig } from '../editor/livePreview'
import { WELCOME_MD } from '../content'

export type SidebarMode = 'outline' | 'files'

interface Args {
  viewRef: RefObject<EditorView | null>
  updateOutline: () => void
  setSidebarMode: (mode: SidebarMode) => void
}

/**
 * Single-file document state and operations: new/open/save/saveAs, dirty
 * tracking, and the system (Finder) open-file entry point.
 */
export function useFileOps({ viewRef, updateOutline, setSidebarMode }: Args) {
  const filePathRef = useRef<string | null>(null)
  const savedContentRef = useRef<string>(WELCOME_MD)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const syncAppState = useCallback((path: string | null, isDirty: boolean) => {
    filePathRef.current = path
    void window.api.setAppState({ filePath: path, dirty: isDirty })
  }, [])

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
    },
    [viewRef, syncAppState, updateOutline]
  )

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
  }, [confirmDiscard, loadContent, setSidebarMode])

  // Finder "Open With" / double-clicking a registered file (macOS open-file).
  const openFromSystem = useCallback(
    async (path: string) => {
      if (!viewRef.current) return
      if (!confirmDiscard()) return
      const content = await window.api.readFile(path)
      livePreviewConfig.baseDir = path.replace(/[\\/][^\\/]*$/, '')
      loadContent(content, path)
      setSidebarMode('outline')
    },
    [viewRef, confirmDiscard, loadContent, setSidebarMode]
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
  }, [viewRef, syncAppState])

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
    loadContent,
    confirmDiscard,
    newFile,
    openFile,
    openFromSystem,
    saveFile,
    saveFileAs
  }
}
