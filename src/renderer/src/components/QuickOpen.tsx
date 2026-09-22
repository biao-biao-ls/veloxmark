import { useEffect, useMemo, useRef, useState } from 'react'
import type { DirNode } from '../../../../electron/shared/api'
import { t } from '../i18n'

interface Props {
  open: boolean
  /** Workspace file tree — flattened into the candidate list. */
  nodes: DirNode[]
  /** Used to show paths relative to the workspace root. */
  folderPath: string | null
  onOpenFile: (path: string) => void
  onClose: () => void
}

interface Candidate {
  name: string
  path: string
  /** Workspace-relative path with `/` separators, for display + matching. */
  rel: string
}

interface ResultRow {
  file: Candidate
  /** Matched character indices inside `file.name` (empty = no highlight). */
  indices: number[]
}

const MAX_RESULTS = 50

/**
 * Subsequence fuzzy match with positional scoring (no dependency): every
 * query character must appear in order. Consecutive runs, word/path-segment
 * starts and earlier matches score higher; longer haystacks score lower.
 * Returns null when the query is not a subsequence of the text; otherwise
 * the score plus the matched indices (UX-P07-F6 highlight contract).
 */
function scoreMatch(query: string, text: string): { score: number; indices: number[] } | null {
  if (query === '') return { score: 0, indices: [] }
  const q = query.toLowerCase()
  const low = text.toLowerCase()
  const indices: number[] = []
  let ti = 0
  let score = 0
  let consecutive = 0
  let prev = -2
  for (let qi = 0; qi < q.length; qi++) {
    const idx = low.indexOf(q[qi], ti)
    if (idx === -1) return null
    indices.push(idx)
    if (idx === prev + 1) {
      consecutive++
      score += 6 + consecutive
    } else {
      consecutive = 0
    }
    if (idx === 0) score += 14
    else if ('/\\-_. '.includes(low[idx - 1])) score += 9
    score += 1
    prev = idx
    ti = idx + 1
  }
  // prefer compact names/paths on ties
  score -= Math.min(low.length, 80) * 0.1
  return { score, indices }
}

/** Render `name` with fuzzy-hit characters wrapped in <mark> runs. */
function HighlightedName({ name, indices }: { name: string; indices: number[] }): React.JSX.Element {
  if (indices.length === 0) return <>{name}</>
  const parts: React.ReactNode[] = []
  let prev = 0
  let key = 0
  let i = 0
  while (i < indices.length) {
    let j = i
    while (j + 1 < indices.length && indices[j + 1] === indices[j] + 1) j++
    const s = indices[i]
    const e = indices[j] + 1
    if (s > prev) parts.push(<span key={key++}>{name.slice(prev, s)}</span>)
    parts.push(<mark key={key++}>{name.slice(s, e)}</mark>)
    prev = e
    i = j + 1
  }
  if (prev < name.length) parts.push(<span key={key++}>{name.slice(prev)}</span>)
  return <>{parts}</>
}

/**
 * Quick Open (P07, Typora's "Go to File"): centered modal with a fuzzy
 * filename search over the folder workspace. Keyboard-first — arrow keys
 * move the selection, Enter opens, Escape closes. Closing restores focus to
 * the element that had it before the palette opened (editor fallback).
 */
export default function QuickOpen({
  open,
  nodes,
  folderPath,
  onOpenFile,
  onClose
}: Props): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  // UX-P07-F7: focus-restore contract — capture on open, restore on close.
  const restoreRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)

  const files = useMemo<Candidate[]>(() => {
    const out: Candidate[] = []
    const prefix = folderPath
      ? folderPath.replace(/[\\/]+$/, '') + (window.api.platform === 'win32' ? '\\' : '/')
      : ''
    const walk = (list: DirNode[]): void => {
      for (const node of list) {
        if (node.isDir) walk(node.children ?? [])
        else
          out.push({
            name: node.name,
            path: node.path,
            rel: prefix && node.path.startsWith(prefix) ? node.path.slice(prefix.length).replaceAll('\\', '/') : node.name
          })
        }
    }
    walk(nodes)
    return out
  }, [nodes, folderPath])

  const results = useMemo<ResultRow[]>(() => {
    const scored: { file: Candidate; score: number; indices: number[] }[] = []
    for (const file of files) {
      // Match against the file name; fall back to the workspace-relative path
      // so "docs/rea" can find docs/readme.md.
      const nameHit = scoreMatch(query, file.name)
      const relHit = !nameHit && query.includes('/') ? scoreMatch(query, file.rel) : null
      const hit = nameHit ?? relHit
      if (hit) scored.push({ file, score: hit.score, indices: nameHit ? nameHit.indices : [] })
    }
    scored.sort((a, b) => b.score - a.score || a.file.rel.localeCompare(b.file.rel))
    const list = scored.slice(0, MAX_RESULTS).map((s) => ({ file: s.file, indices: s.indices }))
    // Empty query: browse the workspace in tree order instead of ranking.
    return query === '' ? files.slice(0, MAX_RESULTS).map((f) => ({ file: f, indices: [] })) : list
  }, [files, query])

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true
      // Menus/dialogs may have left focus on BODY — remember the real target
      // only when it is meaningful; close falls back to .cm-content.
      const active = document.activeElement
      restoreRef.current =
        active instanceof HTMLElement && active !== document.body && !active.closest('.menubar')
          ? active
          : null
      setQuery('')
      setSelected(0)
      // focus after the modal mounts
      requestAnimationFrame(() => inputRef.current?.focus())
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false
      const el = restoreRef.current
      restoreRef.current = null
      const target =
        el && el.isConnected && document.contains(el) ? el : document.querySelector<HTMLElement>('.cm-content')
      if (target instanceof HTMLElement) target.focus()
    }
  }, [open])

  useEffect(() => {
    setSelected(0)
  }, [query])

  // Keep the highlighted row inside the scroll viewport.
  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected, results])

  if (!open) return null

  const choose = (index: number): void => {
    const row = results[index]
    if (!row) return
    onClose()
    onOpenFile(row.file.path)
  }

  return (
    <div className="dialog-overlay quickopen-overlay" onMouseDown={onClose}>
      <div
        className="quickopen-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('quick.title')}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // keep keys away from the global shortcut handler and the editor
          e.stopPropagation()
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelected((i) => Math.min(results.length - 1, i + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelected((i) => Math.max(0, i - 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            choose(selected)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
      >
        <input
          ref={inputRef}
          className="quickopen-input"
          type="text"
          placeholder={t('quick.placeholder')}
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 ? (
          <div className="quickopen-list" ref={listRef} role="listbox">
            {results.map((row, i) => (
              <button
                key={row.file.path}
                className={`quickopen-item${i === selected ? ' quickopen-item-active' : ''}`}
                role="option"
                aria-selected={i === selected}
                onMouseMove={() => setSelected(i)}
                onClick={() => choose(i)}
                title={row.file.path}
              >
                <span className="quickopen-name">
                  <HighlightedName name={row.file.name} indices={row.indices} />
                </span>
                <span className="quickopen-path">{row.file.rel}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="quickopen-empty">
            {files.length === 0 ? t('quick.noFolder') : t('quick.noMatch')}
          </div>
        )}
      </div>
    </div>
  )
}
