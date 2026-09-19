import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { EditorView } from '@codemirror/view'
import { updateLivePreviewConfig } from '../editor/setup'
import { dialog } from '../components/Dialog'
import { WELCOME_MD } from '../content'
import { addRecentFile, patchSession } from '../preferences/store'
import { t } from '../i18n'

export type SidebarMode = 'outline' | 'files' | 'search'

interface Args {
  viewRef: RefObject<EditorView | null>
  updateOutline: () => void
  setSidebarMode: (mode: SidebarMode) => void
  /** P03 session restore only — suppress the outline switch for one open. */
  restoringRef: RefObject<boolean>
}

/**
 * Single-file document state and operations: new/open/save/saveAs, dirty
 * tracking, P12 three-option discard/close gates, and the system (Finder)
 * open-file entry point.
 *
 * Dirty tracking (P12 micro-opt): a ref flag is set on every change and
 * cleared on save — no per-keystroke full-document compare. Programmatic
 * loads set `suppressDirtyRef` around their dispatch so onChange skips.
 */
export function useFileOps({ viewRef, updateOutline, setSidebarMode, restoringRef }: Args) {
  const filePathRef = useRef<string | null>(null)
  const savedContentRef = useRef<string>(WELCOME_MD)
  const dirtyRef = useRef(false)
  /** True only while loadContent is replacing the document. */
  const suppressDirtyRef = useRef(false)
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
      // P18: set the path BEFORE the replace dispatch. foldField drops the
      // outgoing document's fold keys inside that transaction (their headings
      // are gone) and fold sync persists the current set under
      // filePathRef.current — if the ref still named the outgoing file, its
      // session folds would be wiped by the switch itself.
      filePathRef.current = path
      setFilePath(path)
      suppressDirtyRef.current = true
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
        selection: { anchor: 0 },
        effects: EditorView.scrollIntoView(0, { y: 'start' })
      })
      suppressDirtyRef.current = false
      savedContentRef.current = content
      dirtyRef.current = false
      setDirty(false)
      syncAppState(path, false)
      updateOutline()
      // P03: any successful open lands in Recent Files and session memory.
      // P19: programmatic loads (recent files, e2e, drafts) must also point
      // relative image/link resolution at the file's directory — saveFileAs/
      // openFile already did this, but loadContent alone left baseDir stale.
      if (path) {
        setBaseDir(path)
        addRecentFile(path)
        patchSession({ lastFilePath: path, lastCursor: 0 })
      } else {
        patchSession({ lastCursor: 0 })
      }
    },
    [viewRef, syncAppState, setBaseDir, updateOutline]
  )

  const saveFileAs = useCallback(async (): Promise<boolean> => {
    const view = viewRef.current
    if (!view) return false
    const target = await window.api.showSaveDialog(filePathRef.current ?? 'untitled.md')
    if (!target) return false
    const content = view.state.doc.toString()
    await window.api.writeFile(target, content)
    savedContentRef.current = content
    dirtyRef.current = false
    setBaseDir(target)
    setFilePath(target)
    setDirty(false)
    syncAppState(target, false)
    // P12: a successful save retires both the target's and the Untitled drafts.
    void window.api.draftDiscard(target)
    void window.api.draftDiscard(null)
    // P03: Save As to a new path also becomes the recent/session file.
    addRecentFile(target)
    patchSession({ lastFilePath: target })
    return true
  }, [viewRef, syncAppState, setBaseDir])

  /** Save the current document; false when a Save As dialog is cancelled. */
  const saveFile = useCallback(async (): Promise<boolean> => {
    const view = viewRef.current
    if (!view) return false
    if (!filePathRef.current) return saveFileAs()
    const content = view.state.doc.toString()
    await window.api.writeFile(filePathRef.current, content)
    savedContentRef.current = content
    dirtyRef.current = false
    setDirty(false)
    syncAppState(filePathRef.current, false)
    void window.api.draftDiscard(filePathRef.current)
    return true
  }, [viewRef, saveFileAs, syncAppState])

  /**
   * P12 three-option gate before discarding dirty content (open/new/switch).
   * Save → saveFile (false when Save As is cancelled = abort the operation);
   * Don't Save → drop the associated draft; Cancel → abort.
   */
  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    if (!dirtyRef.current) return true
    const choice = await dialog.choose({
      title: t('dialog.unsavedTitle'),
      message: t('dialog.unsavedSwitch'),
      confirmLabel: t('dialog.save'),
      discardLabel: t('dialog.dontSave'),
      cancelLabel: t('dialog.cancel')
    })
    if (choice === 'cancel') return false
    if (choice === 'discard') {
      void window.api.draftDiscard(filePathRef.current)
      return true
    }
    return saveFile()
  }, [saveFile])

  /**
   * P12 close intercept handler — also reachable via window.__veloxP12 for
   * CDP. Returns whether main may proceed with the close.
   */
  const queryClose = useCallback(async (): Promise<boolean> => {
    if (!dirtyRef.current) return true
    const choice = await dialog.choose({
      title: t('dialog.unsavedTitle'),
      message: t('dialog.unsavedClose'),
      confirmLabel: t('dialog.save'),
      discardLabel: t('dialog.dontSave'),
      cancelLabel: t('dialog.cancel')
    })
    if (choice === 'cancel') return false
    if (choice === 'discard') {
      void window.api.draftDiscard(filePathRef.current)
      return true
    }
    // Save As cancelled → keep the window open.
    return saveFile()
  }, [saveFile])

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

  // Open a specific path (Recent Files entries, session restore). Existence
  // is checked here so a deleted file alerts instead of throwing.
  const openRecentFile = useCallback(
    async (path: string) => {
      if (!viewRef.current) return
      if (!(await confirmDiscard())) return
      if (!(await window.api.pathExists(path))) {
        await dialog.alert({ title: t('dialog.fileNotFound'), message: t('dialog.fileGone', { path }) })
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

  /**
   * P13: open a workspace path (search results, deep links) under the same
   * dirty gate as every other open. Unlike openFileFromTree this leaves the
   * sidebar mode untouched — the search panel stays visible while results
   * are reviewed — and optionally places the cursor at a byte offset.
   */
  const openFileByPath = useCallback(
    async (path: string, pos?: number): Promise<boolean> => {
      if (!(await confirmDiscard())) return false
      if (filePathRef.current !== path) {
        const content = await window.api.readFile(path)
        setBaseDir(path)
        loadContent(content, path)
      }
      const view = viewRef.current
      if (view && pos != null) {
        const anchor = Math.min(Math.max(pos, 0), view.state.doc.length)
        view.dispatch({
          selection: { anchor },
          effects: EditorView.scrollIntoView(anchor, { y: 'center' }),
          scrollIntoView: true
        })
        view.focus()
      }
      return true
    },
    [confirmDiscard, loadContent, setBaseDir, viewRef, filePathRef]
  )

  return {
    filePath,
    dirty,
    setDirty,
    setFilePath,
    filePathRef,
    savedContentRef,
    dirtyRef,
    suppressDirtyRef,
    syncAppState,
    setBaseDir,
    loadContent,
    confirmDiscard,
    queryClose,
    newFile,
    openFile,
    openFromSystem,
    openRecentFile,
    openFileByPath,
    saveFile,
    saveFileAs
  }
}
