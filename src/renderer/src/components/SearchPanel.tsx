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
import { t } from '../i18n'

/**
 * P13 folder-wide search/replace sidebar view.
 *
 * The panel owns the query state; search execution lives in the main process
 * (electron/ipc/search.ts) with results streamed on `search:results`. Batches
 * for a stale searchId are dropped so rapid typing never shows old results.
 */

const VISIBLE_PER_FILE = 10
const DEBOUNCE_MS = 200
// P13: keep the "searching…" state visible for a minimum window so fast IPC
// results don't flash the hint away mid-frame (professional async feedback).
const MIN_SEARCHING_MS = 220

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
  /** Sidebar mode to return to via the single back button (P13-F3). */
  backMode?: SidebarMode
}

export default function SearchPanel({
  folderPath,
  currentFilePath,
  dirty,
  focusToken,
  onOpenAt,
  onReloadIfOpen,
  onSwitchMode,
  backMode = 'files'
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
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const searchIdRef = useRef(0)
  const searchStartRef = useRef(0)
  // Latest-run closure for the debounce timer and replace re-runs.
  const runRef = useRef<() => Promise<void>>(async () => {})

  /** Clear `searching` no earlier than MIN_SEARCHING_MS after this run began;
   *  a newer run (searchId bump) supersedes any pending clear. */
  const settleSearching = useCallback((searchId: number) => {
    const remain = MIN_SEARCHING_MS - (Date.now() - searchStartRef.current)
    const done = (): void => {
      if (searchIdRef.current === searchId) setSearching(false)
    }
    if (remain <= 0) done()
    else setTimeout(done, remain)
  }, [])

  /** P13-F1: keyboard focus for result rows — imperative class so the state
   *  is visible synchronously (focus-visible CSS + probe className sample). */
  const focusMatchAt = useCallback((idx: number) => {
    const list = resultsRef.current?.querySelectorAll<HTMLElement>('.search-match')
    if (!list || list.length === 0) return
    const clamped = Math.max(0, Math.min(idx, list.length - 1))
    list.forEach((m) => m.classList.remove('search-match-focus'))
    const el = list[clamped]
    el.classList.add('search-match-focus')
    el.focus()
  }, [])

  /** Panel-level keyboard contract: ↑↓ walk results, Enter/Space open,
   *  Esc returns to the query box (VS Code search-panel parity). */
  const onPanelKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const list = resultsRef.current
        ? [...resultsRef.current.querySelectorAll<HTMLElement>('.search-match')]
        : []
      const target = e.target as HTMLElement
      const active = document.activeElement as HTMLElement | null
      const rowFromActive = (active?.closest?.('.search-match') as HTMLElement | null) ?? null
      const rowInList = rowFromActive && resultsRef.current?.contains(rowFromActive) ? rowFromActive : null

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (list.length === 0) return
        const idx = rowInList ? list.indexOf(rowInList) : -1
        // ArrowDown from the query box is the entry path into the list.
        if (idx === -1) {
          if (e.key === 'ArrowDown' && target.classList.contains('search-input')) {
            e.preventDefault()
            focusMatchAt(0)
          }
          return
        }
        e.preventDefault()
        focusMatchAt(e.key === 'ArrowDown' ? idx + 1 : idx - 1)
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (rowInList) {
          e.preventDefault()
          rowInList.click()
        }
      } else if (e.key === 'Escape') {
        if (rowInList) {
          e.preventDefault()
          list.forEach((m) => m.classList.remove('search-match-focus'))
          inputRef.current?.focus()
        }
      }
    },
    [focusMatchAt]
  )

  const runSearch = useCallback(async (): Promise<void> => {
    if (!folderPath || !query) {
      setFiles([])
      setTotalMatches(0)
      setSearching(false)
      setError(null)
      return
    }
    setSearching(true)
    searchStartRef.current = Date.now()
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
      settleSearching(res.searchId)
    }
  }, [folderPath, query, caseSensitive, wholeWord, regex, settleSearching])
  runRef.current = runSearch

  // Stream subscription — mount only; batches are filtered by searchId.
  useEffect(() => {
    return window.api.onSearchResults((payload: SearchRunPayload) => {
      if (payload.searchId !== searchIdRef.current) return
      if (payload.error) {
        setError(payload.error)
        settleSearching(payload.searchId)
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
        settleSearching(payload.searchId)
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
          title: t('search.replaceAllTitle'),
          message: t('search.replaceAllMsg', { total: totalMatches, query, files: files.length }),
          confirmLabel: t('search.replaceAll'),
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
          title: t('search.skippedTitle'),
          message: t('search.skippedMsg', { paths: res.skipped.join('\n') })
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
    <div className="search-panel" onKeyDown={onPanelKeyDown}>
      <div className="sidebar-header">
        {/* P13-F3: single back (to previous mode) + segmented mode identity */}
        <button
          className="sidebar-back"
          onClick={() => onSwitchMode(backMode)}
          title={backMode === 'outline' ? t('search.backOutline') : t('search.backFiles')}
        >
          {backMode === 'outline' ? t('search.backOutline') : t('search.backFiles')}
        </button>
        <span>{t('search.title')}</span>
        <div className="sidebar-mode-seg" role="tablist" aria-label={t('search.title')}>
          <button
            type="button"
            role="tab"
            aria-selected="false"
            onClick={() => onSwitchMode('files')}
            title={t('search.modeFiles')}
          >
            {t('search.modeFiles')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected="false"
            onClick={() => onSwitchMode('outline')}
            title={t('outline.title')}
          >
            {t('outline.title')}
          </button>
          <button type="button" role="tab" aria-selected="true" aria-current="page" className="seg-current">
            {t('search.title')}
          </button>
        </div>
      </div>
      <div className="search-bar">
        <input
          ref={inputRef}
          className="search-input"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />
        <div className="search-toggles">
          <button
            className={`search-toggle${caseSensitive ? ' active' : ''}`}
            title={t('search.matchCase')}
            onClick={() => setCaseSensitive((v) => !v)}
          >
            Aa
          </button>
          <button
            className={`search-toggle${wholeWord ? ' active' : ''}`}
            title={t('search.wholeWord')}
            onClick={() => setWholeWord((v) => !v)}
          >
            W
          </button>
          <button
            className={`search-toggle${regex ? ' active' : ''}`}
            title={t('search.regex')}
            onClick={() => setRegex((v) => !v)}
          >
            .*
          </button>
        </div>
      </div>
      <div className="search-replace-row">
        <input
          className="search-replace-input"
          placeholder={t('search.replacePlaceholder')}
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          spellCheck={false}
        />
        <button
          className="search-replace-all"
          disabled={totalMatches === 0 || searching}
          onClick={() => void doReplace('all')}
        >
          {t('search.replaceAll')}
        </button>
      </div>
      <div className="search-status">
        {error ? (
          <div className="search-error">{error}</div>
        ) : !folderPath ? (
          <div className="search-empty">{t('search.emptyFolder')}</div>
        ) : searching ? (
          <div className="search-hint">{t('search.searching')}</div>
        ) : query && files.length === 0 ? (
          <div className="search-empty">{t('search.noResults')}</div>
        ) : query ? (
          <div className="search-count">
            {t('search.count', { total: totalMatches, files: files.length })}
          </div>
        ) : null}
      </div>
      <div className="search-results" ref={resultsRef}>
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
                {/* P13-F2: unified icon replace entry — title + aria-label carry the copy */}
                <button
                  className="search-file-replace"
                  title={t('search.replaceFile')}
                  aria-label={t('search.replaceFile')}
                  onClick={() => void doReplace('file', f.path)}
                >
                  ⇄
                </button>
              </div>
              {shown.map((m, i) => (
                <div
                  key={`${m.line}-${m.col}-${i}`}
                  className="search-match"
                  role="button"
                  tabIndex={0}
                  onClick={() => void onOpenAt(f.path, m.line, m.col)}
                  onFocus={(e) => e.currentTarget.classList.add('search-match-focus')}
                  onBlur={(e) => e.currentTarget.classList.remove('search-match-focus')}
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
                    title={t('search.replaceOne')}
                    aria-label={t('search.replaceOne')}
                    onClick={(e) => {
                      e.stopPropagation()
                      void doReplace('one', f.path, m)
                    }}
                  >
                    ⇄
                  </button>
                </div>
              ))}
              {f.matches.length > VISIBLE_PER_FILE && (
                <button className="search-more" onClick={() => toggleExpanded(f.path)}>
                  {isOpen ? t('search.showLess') : t('search.more', { n: f.matches.length - VISIBLE_PER_FILE })}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
