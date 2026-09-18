import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  SearchFileResult,
  SearchMatch,
  SearchOptions,
  SearchRunPayload
} from '../../../../electron/shared/api'
import { folderScanOptions } from '../hooks/useWorkspaceTree'
import type { SidebarMode } from '../preferences/store'
import { dialog } from './Dialog'

/**
 * P13 folder-wide search/replace sidebar view.
 *
 * The panel owns the query state; search execution lives in the main process
 * (electron/ipc/search.ts) with results streamed on `search:results`. Batches
 * for a stale searchId are dropped so rapid typing never shows old results.
 */

const VISIBLE_PER_FILE = 10
const DEBOUNCE_MS = 200

interface Props {
  folderPath: string | null
  /** Open document path — its dirty buffer is excluded from replaces. */
  currentFilePath: string | null
  dirty: boolean
  /** Incremented by Ctrl+Shift+F to focus the query box. */
  focusToken: number
  onOpenAt: (path: string, line: number, col: number) => Promise<void>
  onReloadIfOpen: (path: string) => Promise<void>
  onSwitchMode: (mode: SidebarMode) => void
}

export default function SearchPanel({
  folderPath,
  currentFilePath,
  dirty,
  focusToken,
  onOpenAt,
  onReloadIfOpen,
  onSwitchMode
}: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [regex, setRegex] = useState(false)
  const [files, setFiles] = useState<SearchFileResult[]>([])
  const [totalMatches, setTotalMatches] = useState(0)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const inputRef = useRef<HTMLInputElement | null>(null)
  const searchIdRef = useRef(0)
  // Latest-run closure for the debounce timer and replace re-runs.
  const runRef = useRef<() => Promise<void>>(async () => {})

  const runSearch = useCallback(async (): Promise<void> => {
    if (!folderPath || !query) {
      setFiles([])
      setTotalMatches(0)
      setSearching(false)
      setError(null)
      return
    }
    setSearching(true)
    setError(null)
    setFiles([])
    setTotalMatches(0)
    setExpanded(new Set())
    const options: SearchOptions = {
      caseSensitive,
      wholeWord,
      regex,
      scanOptions: folderScanOptions()
    }
    const res = await window.api.searchRun(folderPath, query, options)
    searchIdRef.current = res.searchId
    if (res.error) {
      setError(res.error)
      setSearching(false)
    }
  }, [folderPath, query, caseSensitive, wholeWord, regex])
  runRef.current = runSearch

  // Stream subscription — mount only; batches are filtered by searchId.
  useEffect(() => {
    return window.api.onSearchResults((payload: SearchRunPayload) => {
      if (payload.searchId !== searchIdRef.current) return
      if (payload.error) {
        setError(payload.error)
        setSearching(false)
        return
      }
      if (payload.files.length > 0) {
        setFiles((prev) => {
          const byPath = new Map(prev.map((f) => [f.path, f]))
          for (const f of payload.files) byPath.set(f.path, f)
          return [...byPath.values()]
        })
      }
      if (payload.done) {
        setSearching(false)
        if (payload.totalMatches != null) setTotalMatches(payload.totalMatches)
      }
    })
  }, [])

  // Debounced "search as you type".
  useEffect(() => {
    if (!folderPath || !query) {
      setFiles([])
      setTotalMatches(0)
      setSearching(false)
      setError(null)
      return
    }
    const timer = setTimeout(() => {
      void runRef.current()
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, caseSensitive, wholeWord, regex, folderPath])

  useEffect(() => {
    if (focusToken > 0) inputRef.current?.focus()
  }, [focusToken])

  const doReplace = useCallback(
    async (scope: 'one' | 'file' | 'all', path?: string, match?: SearchMatch) => {
      if (!folderPath || !query) return
      if (scope === 'all') {
        const ok = await dialog.confirm({
          title: 'Replace All',
          message: `Replace ${totalMatches} match(es) for "${query}" across ${files.length} file(s)? This writes files on disk.`,
          confirmLabel: 'Replace All',
          danger: true
        })
        if (!ok) return
      }
      const skipPaths = dirty && currentFilePath ? [currentFilePath] : []
      const res = await window.api.searchReplace({
        rootPath: folderPath,
        pattern: query,
        options: { caseSensitive, wholeWord, regex, scanOptions: folderScanOptions() },
        replace: replaceText,
        scope,
        path,
        line: match?.line,
        col: match?.col,
        skipPaths
      })
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.skipped.length > 0) {
        await dialog.alert({
          title: 'Replace Skipped',
          message: `Skipped (open with unsaved changes):\n${res.skipped.join('\n')}`
        })
      }
      if (currentFilePath && !dirty && res.written.includes(currentFilePath)) {
        await onReloadIfOpen(currentFilePath)
      }
      void runRef.current()
    },
    [
      folderPath,
      query,
      replaceText,
      caseSensitive,
      wholeWord,
      regex,
      dirty,
      currentFilePath,
      totalMatches,
      files.length,
      onReloadIfOpen
    ]
  )

  const toggleExpanded = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }, [])

  return (
    <div className="search-panel">
      <div className="sidebar-header">
        <button className="sidebar-back" onClick={() => onSwitchMode('files')} title="Back to file list">
          ‹ Files
        </button>
        <button className="sidebar-back" onClick={() => onSwitchMode('outline')} title="Back to outline">
          ‹ Outline
        </button>
        <span>Search</span>
      </div>
      <div className="search-bar">
        <input
          ref={inputRef}
          className="search-input"
          placeholder="Search in folder…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />
        <div className="search-toggles">
          <button
            className={`search-toggle${caseSensitive ? ' active' : ''}`}
            title="Match case"
            onClick={() => setCaseSensitive((v) => !v)}
          >
            Aa
          </button>
          <button
            className={`search-toggle${wholeWord ? ' active' : ''}`}
            title="Whole word"
            onClick={() => setWholeWord((v) => !v)}
          >
            W
          </button>
          <button
            className={`search-toggle${regex ? ' active' : ''}`}
            title="Regular expression"
            onClick={() => setRegex((v) => !v)}
          >
            .*
          </button>
        </div>
      </div>
      <div className="search-replace-row">
        <input
          className="search-replace-input"
          placeholder="Replace…"
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          spellCheck={false}
        />
        <button
          className="search-replace-all"
          disabled={totalMatches === 0 || searching}
          onClick={() => void doReplace('all')}
        >
          Replace All
        </button>
      </div>
      <div className="search-status">
        {error ? (
          <div className="search-error">{error}</div>
        ) : !folderPath ? (
          <div className="search-empty">Open a folder to search across files</div>
        ) : searching ? (
          <div className="search-hint">Searching…</div>
        ) : query && files.length === 0 ? (
          <div className="search-empty">No results</div>
        ) : query ? (
          <div className="search-count">
            {totalMatches} match(es) in {files.length} file(s)
          </div>
        ) : null}
      </div>
      <div className="search-results">
        {files.map((f) => {
          const isOpen = expanded.has(f.path)
          const shown = isOpen ? f.matches : f.matches.slice(0, VISIBLE_PER_FILE)
          return (
            <div key={f.path} className="search-file">
              <div className="search-file-header">
                <span className="search-file-name" title={f.path}>
                  {f.relPath}
                </span>
                <span className="search-file-count">{f.matchCount}</span>
                <button
                  className="search-file-replace"
                  title="Replace all matches in this file"
                  onClick={() => void doReplace('file', f.path)}
                >
                  ⇄
                </button>
              </div>
              {shown.map((m, i) => (
                <div
                  key={`${m.line}-${m.col}-${i}`}
                  className="search-match"
                  onClick={() => void onOpenAt(f.path, m.line, m.col)}
                  title={f.path}
                >
                  <span className="search-match-line">{m.line}</span>
                  <span className="search-match-text">
                    {m.lineText.slice(0, m.snippetCol)}
                    <mark>{m.lineText.slice(m.snippetCol, m.snippetCol + m.length) || '​'}</mark>
                    {m.lineText.slice(m.snippetCol + m.length)}
                  </span>
                  <button
                    className="search-match-replace"
                    title="Replace this match"
                    onClick={(e) => {
                      e.stopPropagation()
                      void doReplace('one', f.path, m)
                    }}
                  >
                    r
                  </button>
                </div>
              ))}
              {f.matches.length > VISIBLE_PER_FILE && (
                <button className="search-more" onClick={() => toggleExpanded(f.path)}>
                  {isOpen ? 'Show less' : `+${f.matches.length - VISIBLE_PER_FILE} more`}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
