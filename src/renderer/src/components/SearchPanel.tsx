import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  SearchFileResult,
  SearchMatch,
  SearchOptions,
  SearchRunPayload
} from '../../../../electron/shared/api'
import { folderScanOptions } from '../hooks/useWorkspaceTree'
import { dialog } from './Dialog'
import { toast as showToast } from '../hooks/useToast'
import { t } from '../i18n'


function localRegexError(
  pattern: string,
  opts: { caseSensitive: boolean; wholeWord: boolean; regex: boolean }
): string | null {
  if (!opts.regex || !pattern) return null
  const body = opts.wholeWord ? `\b(?:${pattern})\b` : pattern
  try {
    new RegExp(body, opts.caseSensitive ? 'g' : 'gi')
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid regular expression'
  }
}

const VISIBLE_PER_FILE = 10
const DEBOUNCE_MS = 200
const MIN_SEARCHING_MS = 220

interface Props {
  folderPath: string | null
  currentFilePath: string | null
  dirty: boolean
  focusToken: number
  onOpenAt: (path: string, line: number, col: number) => Promise<void>
  onReloadIfOpen: (path: string) => Promise<void>
}

export default function SearchPanel({
  folderPath,
  currentFilePath,
  dirty,
  focusToken,
  onOpenAt,
  onReloadIfOpen
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
  const [staleResults, setStaleResults] = useState(false)

  const regexError = localRegexError(query, { caseSensitive, wholeWord, regex })

  const inputRef = useRef<HTMLInputElement | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const searchIdRef = useRef(0)
  const searchStartRef = useRef(0)
  const runRef = useRef<() => Promise<void>>(async () => {})
  const firstBatchRef = useRef(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const settleSearching = useCallback((searchId: number) => {
    const remain = MIN_SEARCHING_MS - (Date.now() - searchStartRef.current)
    const done = (): void => {
      if (searchIdRef.current === searchId) setSearching(false)
    }
    if (remain <= 0) done()
    else setTimeout(done, remain)
  }, [])

  const focusMatchAt = useCallback((idx: number) => {
    const list = resultsRef.current?.querySelectorAll<HTMLElement>('.search-match')
    if (!list || list.length === 0) return
    const clamped = Math.max(0, Math.min(idx, list.length - 1))
    list.forEach((m) => m.classList.remove('search-match-focus'))
    const el = list[clamped]
    el.classList.add('search-match-focus')
    el.focus()
  }, [])

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
      setStaleResults(false)
      return
    }
    if (localRegexError(query, { caseSensitive, wholeWord, regex })) {
      setSearching(false)
      return
    }
    setSearching(true)
    searchStartRef.current = Date.now()
    setError(null)
    setStaleResults(true)
    firstBatchRef.current = true
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

  useEffect(() => {
    return window.api.onSearchResults((payload: SearchRunPayload) => {
      if (payload.searchId !== searchIdRef.current) return
      if (payload.error) {
        setError(payload.error)
        settleSearching(payload.searchId)
        return
      }
      if (payload.files.length > 0) {
        if (firstBatchRef.current) {
          firstBatchRef.current = false
          setFiles(payload.files)
          setStaleResults(false)
        } else {
          setFiles((prev) => {
            const byPath = new Map(prev.map((f) => [f.path, f]))
            for (const f of payload.files) byPath.set(f.path, f)
            return [...byPath.values()]
          })
        }
      }
      if (payload.done) {
        if (firstBatchRef.current) {
          firstBatchRef.current = false
          setFiles([])
        }
        setStaleResults(false)
        settleSearching(payload.searchId)
        if (payload.totalMatches != null) setTotalMatches(payload.totalMatches)
      }
    })
  }, [])

  useEffect(() => {
    if (!folderPath || !query) {
      setFiles([])
      setTotalMatches(0)
      setSearching(false)
      setError(null)
      setStaleResults(false)
      return
    }
    if (localRegexError(query, { caseSensitive, wholeWord, regex })) return
    const timer = setTimeout(() => {
      timerRef.current = null
      void runRef.current()
    }, DEBOUNCE_MS)
    timerRef.current = timer
    return () => {
      clearTimeout(timer)
      if (timerRef.current === timer) timerRef.current = null
    }
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
      if (scope !== 'one') {
        showToast(t('search.replacedToast', { n: res.replaced }))
        void runRef.current()
        return
      }
      if (res.replaced === 0) {
        showToast(t('search.replaceStale'))
        void runRef.current()
        return
      }
      showToast(t('search.replacedToast', { n: res.replaced }))
      if (!path || !match) {
        void runRef.current()
        return
      }
      const hasSibling = files.some(
        (f) =>
          f.path === path &&
          f.matches.some((m) => m.line === match.line && m.col !== match.col)
      )
      if (hasSibling) {
        void runRef.current()
        return
      }
      setFiles((prev) =>
        prev
          .map((f) => {
            if (f.path !== path) return f
            const matches = f.matches.filter(
              (m) => !(m.line === match.line && m.col === match.col)
            )
            return { ...f, matches, matchCount: f.matchCount - 1 }
          })
          .filter((f) => f.matchCount > 0)
      )
      setTotalMatches((n) => Math.max(0, n - 1))
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
      files,
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
      <div className="search-bar">
        <input
          ref={inputRef}
          className="search-input"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (localRegexError(query, { caseSensitive, wholeWord, regex })) return
            if (!searching && !staleResults && files.length > 0) {
              focusMatchAt(0)
              return
            }
            if (timerRef.current != null) {
              clearTimeout(timerRef.current)
              timerRef.current = null
            }
            void runRef.current()
          }}
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
        {regexError ?? error ? (
          <div className="search-error">{regexError ?? error}</div>
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
      <div className={`search-results${staleResults ? ' is-stale' : ''}`} ref={resultsRef}>
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
                {dirty && currentFilePath === f.path && (
                  <span className="search-dirty-badge" title={t('search.dirtyBadgeTip')}>
                    {t('search.dirtyBadge')}
                  </span>
                )}
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
              {f.matchCount > f.matches.length && (
                <div className="search-truncated">
                  {t('search.truncated', { n: f.matchCount - f.matches.length })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
