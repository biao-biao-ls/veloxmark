import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { createExtensions, reconfigureTheme } from '../editor/setup'
import { livePreviewConfig } from '../editor/livePreview'
import type { ThemeName } from '../editor/theme'
import { extractOutline, type OutlineItem } from '../outline/extract'
import { WELCOME_MD } from '../content/docs'
import { dirnameOf, isUnderPath, rebaseUnder } from '@shared/paths'

/** Everything about the open document: the editor view and file semantics. */
export interface DocumentController {
  hostRef: React.RefObject<HTMLDivElement | null>
  filePath: string | null
  dirty: boolean
  outline: OutlineItem[]
  activePos: number | null
  getView: () => EditorView | null
  loadContent: (content: string, path: string | null) => void
  confirmDiscard: () => boolean
  newFile: () => void
  /** Open via dialog. Resolves true when a file was loaded. */
  openFile: () => Promise<boolean>
  /** Open a known path (tree click / system open). Resolves true when loaded. */
  openPathFromDisk: (path: string) => Promise<boolean>
  saveFile: () => Promise<boolean>
  saveFileAs: () => Promise<boolean>
  goToHeading: (pos: number) => void
  editCopy: () => void
  editCut: () => void
  editPaste: () => Promise<void>
  editSelectAll: () => void
  /** Keep the editor attached when the open file (or an ancestor dir) moves. */
  reattachIfUnder: (oldPath: string, isDir: boolean, newPath: string) => void
  /** Detach (keep buffer → Save As) when the open file is deleted. */
  detachIfUnder: (path: string, isDir: boolean) => void
}

export function useDocument(theme: ThemeName): DocumentController {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const filePathRef = useRef<string | null>(null)
  const savedContentRef = useRef<string>(WELCOME_MD)

  const [filePath, setFilePath] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [activePos, setActivePos] = useState<number | null>(null)

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

  // Theme switches reconfigure the live editor (create ran once with the
  // initial theme).
  const appliedThemeRef = useRef(theme)
  useEffect(() => {
    if (appliedThemeRef.current === theme) return
    appliedThemeRef.current = theme
    const view = viewRef.current
    if (view) reconfigureTheme(view, theme)
  }, [theme])

  // ---- file operations ------------------------------------------------------
  const loadContent = useCallback(
    (content: string, path: string | null) => {
      const view = viewRef.current
      if (!view) return
      // Set before dispatch: the transaction rebuilds decorations, and image
      // widgets resolve relative srcs against baseDir at build time.
      if (path) livePreviewConfig.baseDir = dirnameOf(path)
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
    [syncAppState, updateOutline]
  )

  const confirmDiscard = useCallback((): boolean => {
    if (!dirty) return true
    return window.confirm('Discard unsaved changes?')
  }, [dirty])

  const newFile = useCallback(() => {
    if (!confirmDiscard()) return
    loadContent('', null)
  }, [confirmDiscard, loadContent])

  const openFile = useCallback(async (): Promise<boolean> => {
    if (!confirmDiscard()) return false
    const result = await window.api.openFile()
    if (!result) return false
    loadContent(result.content, result.filePath)
    return true
  }, [confirmDiscard, loadContent])

  const openPathFromDisk = useCallback(
    async (path: string): Promise<boolean> => {
      if (!viewRef.current) return false
      if (!confirmDiscard()) return false
      try {
        const content = await window.api.readFile(path)
        loadContent(content, path)
        return true
      } catch (err) {
        window.alert(`Could not open file: ${err instanceof Error ? err.message : err}`)
        return false
      }
    },
    [confirmDiscard, loadContent]
  )

  // Write the buffer to `target`. Handles the main-process conflict report
  // (file changed on disk since we opened it) by asking before overwriting.
  const writeBufferTo = useCallback(
    async (target: string): Promise<boolean> => {
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
      livePreviewConfig.baseDir = dirnameOf(target)
      setDirty(false)
      syncAppState(target, false)
      return true
    },
    [syncAppState]
  )

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

  // ---- path follow (folder tree rename / delete) ----------------------------
  const reattachIfUnder = useCallback(
    (oldPath: string, isDir: boolean, newPath: string) => {
      const current = filePathRef.current
      let movedTo: string | null = null
      if (current === oldPath) {
        movedTo = newPath
      } else if (isDir && current && isUnderPath(current, oldPath, window.api.platform)) {
        movedTo = rebaseUnder(current, oldPath, newPath)
      }
      if (movedTo) {
        setFilePath(movedTo)
        syncAppState(movedTo, dirty)
        // relative image paths resolve against the file's directory — follow the move
        livePreviewConfig.baseDir = dirnameOf(movedTo)
      }
    },
    [dirty, syncAppState]
  )

  const detachIfUnder = useCallback(
    (path: string, isDir: boolean) => {
      const current = filePathRef.current
      if (current === path || (isDir && current && isUnderPath(current, path, window.api.platform))) {
        // buffer keeps its content → Save As
        setFilePath(null)
        syncAppState(null, dirty)
      }
    },
    [dirty, syncAppState]
  )

  return {
    hostRef,
    filePath,
    dirty,
    outline,
    activePos,
    getView: () => viewRef.current,
    loadContent,
    confirmDiscard,
    newFile,
    openFile,
    openPathFromDisk,
    saveFile,
    saveFileAs,
    goToHeading,
    editCopy,
    editCut,
    editPaste,
    editSelectAll,
    reattachIfUnder,
    detachIfUnder
  }
}
