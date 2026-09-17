import { useEffect, useMemo, useRef, useState } from 'react'
import type { DirNode } from '../../../../electron/shared/api'

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

const MAX_RESULTS = 50

/**
 * Subsequence fuzzy match with positional scoring (no dependency): every
 * query character must appear in order. Consecutive runs, word/path-segment
 * starts and earlier matches score higher; longer haystacks score lower.
 * Returns null when the query is not a subsequence of the text.
 */
function scoreMatch(query: string, text: string): number | null {
  if (query === '') return 0
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let ti = 0
  let score = 0
  let consecutive = 0
  let prev = -2
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti)
    if (idx === -1) return null
    if (idx === prev + 1) {
      consecutive++
      score += 6 + consecutive
    } else {
      consecutive = 0
    }
    if (idx === 0) score += 14
    else if ('/\\-_. '.includes(t[idx - 1])) score += 9
    score += 1
    prev = idx
    ti = idx + 1
  }
  // prefer compact names/paths on ties
  score -= Math.min(t.length, 80) * 0.1
  return score
}

/**
 * Quick Open (P07, Typora's "Go to File"): centered modal with a fuzzy
 * filename search over the folder workspace. Keyboard-first — arrow keys
 * move the selection, Enter opens, Escape closes.
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

  const results = useMemo(() => {
    const scored: { file: Candidate; score: number }[] = []
    for (const file of files) {
      // Match against the file name; fall back to the workspace-relative path
      // so "docs/rea" can find docs/readme.md.
      const score =
        scoreMatch(query, file.name) ??
        (query.includes('/') ? scoreMatch(query, file.rel) : null)
      if (score != null) scored.push({ file, score })
    }
    scored.sort((a, b) => b.score - a.score || a.file.rel.localeCompare(b.file.rel))
    const list = scored.slice(0, MAX_RESULTS).map((s) => s.file)
    // Empty query: browse the workspace in tree order instead of ranking.
    return query === '' ? files.slice(0, MAX_RESULTS) : list
  }, [files, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      // focus after the modal mounts
      requestAnimationFrame(() => inputRef.current?.focus())
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
    const file = results[index]
    if (!file) return
    onClose()
    onOpenFile(file.path)
  }

  return (
    <div className="dialog-overlay quickopen-overlay" onMouseDown={onClose}>
      <div
        className="quickopen-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Quick Open"
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
          placeholder="Search files by name…"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 ? (
          <div className="quickopen-list" ref={listRef} role="listbox">
            {results.map((file, i) => (
              <button
                key={file.path}
                className={`quickopen-item${i === selected ? ' quickopen-item-active' : ''}`}
                role="option"
                aria-selected={i === selected}
                onMouseMove={() => setSelected(i)}
                onClick={() => choose(i)}
                title={file.path}
              >
                <span className="quickopen-name">{file.name}</span>
                <span className="quickopen-path">{file.rel}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="quickopen-empty">
            {files.length === 0 ? 'No folder workspace open' : 'No matching files'}
          </div>
        )}
      </div>
    </div>
  )
}
