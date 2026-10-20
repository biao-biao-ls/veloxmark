import { useEffect, useMemo, useRef, useState } from 'react'
import type { DirNode } from '../../../../electron/shared/api'
import { ChevronIcon, FileMdIcon, FolderIcon, FolderOpenIcon } from './Icons'
import { t } from '../i18n'
import { ancestorDirPaths, flattenFiles, visibleRows, type FlatRow } from './filetreeRows'
import { resolveKey, toVisibleRows, type VisibleRow } from './filetreeKeys'
import { pathsEqual } from '../pathUtil'
import { sortTreeNodes } from '../filetree/sort'
import { usePreferences } from '../preferences/useStore'

export interface TreeMenuRequest {
  x: number
  y: number
  node: DirNode | null
}

interface Props {
  nodes: DirNode[]
  activePath: string | null
  onOpen: (path: string) => void
  onContextMenu: (req: TreeMenuRequest) => void
  onMove: (srcPath: string, destDir: string) => void
  renamingPath?: string | null
  onRenameCommit: (node: DirNode, name: string) => void
  onRenameCancel: () => void
  selectedPath?: string | null
  onSelect?: (path: string, isDir: boolean) => void
  pendingCreate?: { parentPath: string; kind: 'file' | 'dir' } | null
  onCreateCommit: (name: string) => void
  onCreateCancel: () => void
}

const ROW_HEIGHT = 28

const depthStyle = (depth: number): React.CSSProperties =>
  ({ '--tree-depth': depth }) as React.CSSProperties

const indentGuides = (depth: number): React.ReactNode[] =>
  Array.from({ length: depth }, (_, i) => (
    <i
      key={`guide-${i}`}
      className="filetree-guide"
      style={{ left: `calc(var(--tree-indent) * ${i} + var(--tree-indent) / 2)` }}
    />
  ))
type ViewRow = (FlatRow & { relDir?: string; keyIndex: number }) | { create: 'file' | 'dir'; depth: number }
const VIRTUALIZE_AT = 500
const OVERSCAN = 10
const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'])

let dragSrcPath: string | null = null

function RenameRow({
  node,
  depth,
  virtualize,
  onCommit,
  onCancel
}: {
  node: DirNode
  depth: number
  virtualize: boolean
  onCommit: (node: DirNode, name: string) => void
  onCancel: () => void
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    const dot = node.name.lastIndexOf('.')
    el.setSelectionRange(0, dot > 0 ? dot : node.name.length)
  }, [node.name])

  const commit = (value: string): void => {
    if (doneRef.current) return
    doneRef.current = true
    onCommit(node, value.trim())
  }

  return (
    <div
      className={`filetree-item filetree-renaming${virtualize ? ' filetree-item-fixed' : ''}`}
      style={depthStyle(depth)}
      title={node.path}
    >
      {indentGuides(depth)}
      <span className="filetree-twisty empty">·</span>
      <input
        ref={inputRef}
        className="filetree-rename-input"
        defaultValue={node.name}
        aria-label={node.isDir ? t('tree.renameFolder') : t('tree.renameFile')}
        spellCheck={false}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') {
            e.preventDefault()
            commit((e.target as HTMLInputElement).value)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            if (doneRef.current) return
            doneRef.current = true
            onCancel()
          }
        }}
        onBlur={(e) => commit(e.target.value)}
      />
    </div>
  )
}

function CreateRow({
  kind,
  depth,
  virtualize,
  onCommit,
  onCancel
}: {
  kind: 'file' | 'dir'
  depth: number
  virtualize: boolean
  onCommit: (name: string) => void
  onCancel: () => void
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const commit = (value: string): void => {
    if (doneRef.current) return
    doneRef.current = true
    onCommit(value.trim())
  }

  return (
    <div
      className={`filetree-item filetree-renaming${virtualize ? ' filetree-item-fixed' : ''}`}
      style={depthStyle(depth)}
    >
      {indentGuides(depth)}
      <span className="filetree-twisty empty">·</span>
      <input
        ref={inputRef}
        className="filetree-rename-input"
        defaultValue=""
        placeholder={t('tree.namePlaceholder')}
        aria-label={kind === 'dir' ? t('tree.newFolder') : t('tree.newFile')}
        spellCheck={false}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') {
            e.preventDefault()
            commit((e.target as HTMLInputElement).value)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            if (doneRef.current) return
            doneRef.current = true
            onCancel()
          }
        }}
        onBlur={(e) => commit(e.target.value)}
      />
    </div>
  )
}

export default function FileTree({
  nodes,
  activePath,
  onOpen,
  onContextMenu,
  onMove,
  renamingPath,
  onRenameCommit,
  onRenameCancel,
  selectedPath,
  onSelect,
  pendingCreate,
  onCreateCommit,
  onCreateCancel
}: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(0)
  const treeRef = useRef<HTMLElement | null>(null)

  const sep = window.api.platform === 'win32' ? '\\' : '/'

  const revealDirs = useMemo(() => ancestorDirPaths(activePath), [activePath])
  const createDirs = useMemo(
    () => (pendingCreate ? ancestorDirPaths(pendingCreate.parentPath + sep + 'n') : null),
    [pendingCreate, sep]
  )
  const renameDirs = useMemo(() => {
    const dirs = ancestorDirPaths(renamingPath ?? null)
    if (createDirs) for (const d of createDirs) dirs.add(d)
    return dirs
  }, [renamingPath, createDirs])
  const prefs = usePreferences()
  const fileTreeSort = prefs.fileTreeSort
  const fileTreeView = prefs.fileTreeView
  const sortedNodes = useMemo(() => sortTreeNodes(nodes, fileTreeSort), [nodes, fileTreeSort])
  const rows = useMemo(() => {
    if (fileTreeView === 'list') {
      const flat = flattenFiles(sortedNodes, sep)
      const relByPath = new Map(flat.map((r) => [r.node.path, r.relDir]))
      const sorted = sortTreeNodes(
        flat.map((r) => r.node),
        fileTreeSort
      )
      return sorted.map((node) => ({
        node,
        depth: 0,
        open: false,
        relDir: relByPath.get(node.path) ?? ''
      }))
    }
    return visibleRows(sortedNodes, { expanded, revealDirs, renameDirs })
  }, [fileTreeView, sortedNodes, fileTreeSort, sep, expanded, revealDirs, renameDirs])

  const keyRows = useMemo(() => toVisibleRows(rows), [rows])
  const [focusIndex, setFocusIndex] = useState(-1)
  const [kbdNav, setKbdNav] = useState(false)
  const activeIdx = useMemo(
    () => keyRows.findIndex((r) => pathsEqual(r.path, activePath ?? '')),
    [keyRows, activePath]
  )
  const tabStop =
    focusIndex >= 0 && focusIndex < keyRows.length
      ? focusIndex
      : activeIdx >= 0
        ? activeIdx
        : keyRows.length > 0
          ? 0
          : -1
  const pendingFocusRef = useRef<number | null>(null)
  useEffect(() => {
    const idx = pendingFocusRef.current
    if (idx == null) return
    const el = treeRef.current?.querySelector<HTMLElement>(`[data-nav-index="${idx}"]`)
    if (!el) return
    pendingFocusRef.current = null
    el.focus()
  })

  const scrollRowIntoView = (idx: number): void => {
    const side = treeRef.current?.closest('.sidebar')
    if (!side) return
    const treeTop = treeRef.current?.offsetTop ?? 0
    const rowTop = treeTop + idx * ROW_HEIGHT
    const rowBottom = rowTop + ROW_HEIGHT
    const viewTop = side.scrollTop
    const viewBottom = viewTop + side.clientHeight
    let next = viewTop
    if (rowTop < viewTop) next = rowTop
    else if (rowBottom > viewBottom) next = rowBottom - side.clientHeight
    else return
    const clamped = Math.max(0, next)
    side.scrollTop = clamped
    setScrollTop(clamped)
  }

  const onTreeKeyDown = (e: React.KeyboardEvent): void => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-nav-index]')
    if (target && NAV_KEYS.has(e.key)) setKbdNav(true)
    const cur = target ? Number(target.dataset.navIndex) : tabStop
    const result = resolveKey({ rows: keyRows, focusIndex: cur }, e.key)
    if (result.action === 'none') {
      if (keyRows.length > 0 && target && NAV_KEYS.has(e.key)) e.preventDefault()
      return
    }
    e.preventDefault()
    switch (result.action) {
      case 'move':
      case 'first':
      case 'last': {
        pendingFocusRef.current = result.nextIndex
        setFocusIndex(result.nextIndex)
        scrollRowIntoView(result.nextIndex)
        break
      }
      case 'collapse':
      case 'expand': {
        const row = keyRows[cur]
        setExpanded((m) => ({ ...m, [row.path]: result.action === 'expand' }))
        break
      }
      case 'open': {
        const row = keyRows[cur]
        onSelect?.(row.path, false)
        onOpen(row.path)
        break
      }
    }
  }

  const viewRows = useMemo((): ViewRow[] => {
    const base: ViewRow[] = rows.map((r, i) => ({ ...r, keyIndex: i }))
    if (!pendingCreate) return base
    let at = 0
    let depth = 0
    if (fileTreeView !== 'list') {
      const i = base.findIndex(
        (r) => 'node' in r && r.node.isDir && r.node.path === pendingCreate.parentPath
      )
      if (i >= 0) {
        at = i + 1
        depth = (base[i] as FlatRow).depth + 1
      }
    }
    base.splice(at, 0, { create: pendingCreate.kind, depth })
    return base
  }, [rows, pendingCreate, fileTreeView])

  useEffect(() => {
    const side = treeRef.current?.closest('.sidebar')
    if (!side) return
    const onScroll = (): void => {
      setScrollTop(side.scrollTop)
      setViewportH(side.clientHeight)
    }
    side.addEventListener('scroll', onScroll, { passive: true })
    setViewportH(side.clientHeight)
    return () => side.removeEventListener('scroll', onScroll)
  }, [])

  const lastRevealRef = useRef<{ path: string | null; found: boolean }>({ path: null, found: false })
  useEffect(() => {
    const idx = viewRows.findIndex(
      (r) => 'node' in r && pathsEqual(r.node.path, activePath ?? '')
    )
    const found = idx >= 0
    const last = lastRevealRef.current
    if (found && last.path === activePath && last.found) return
    lastRevealRef.current = { path: activePath, found }
    if (!found) return
    const side = treeRef.current?.closest('.sidebar')
    if (!side) return
    const treeTop = treeRef.current?.offsetTop ?? 0
    const rowTop = treeTop + idx * ROW_HEIGHT
    side.scrollTop = Math.max(0, rowTop - side.clientHeight / 2 + ROW_HEIGHT / 2)
  }, [activePath, viewRows])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (!dragSrcPath && dropTarget === null) return
      e.preventDefault()
      dragSrcPath = null
      setDropTarget(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dropTarget])

  const virtualize = viewRows.length > VIRTUALIZE_AT
  let start = 0
  let end = viewRows.length
  if (virtualize && viewportH > 0) {
    const treeTop = treeRef.current?.offsetTop ?? 0
    start = Math.max(0, Math.floor((scrollTop - treeTop) / ROW_HEIGHT) - OVERSCAN)
    end = Math.min(
      viewRows.length,
      Math.ceil((scrollTop + viewportH - treeTop) / ROW_HEIGHT) + OVERSCAN
    )
  }

  if (nodes.length === 0 && !pendingCreate) {
    return <div className="outline-empty">{t('tree.noMarkdown')}</div>
  }

  const isDropAllowed = (src: string, destDir: string): boolean =>
    src !== destDir && !destDir.startsWith(src + sep)

  const renderRow = (item: ViewRow): React.JSX.Element => {
    if ('create' in item) {
      return (
        <CreateRow
          key="__create__"
          kind={item.create}
          depth={item.depth}
          virtualize={virtualize}
          onCommit={onCreateCommit}
          onCancel={onCreateCancel}
        />
      )
    }
    const { node, depth, open, relDir } = item
    if (renamingPath && node.path === renamingPath) {
      return (
        <RenameRow
          key={node.path}
          node={node}
          depth={depth}
          virtualize={virtualize}
          onCommit={onRenameCommit}
          onCancel={onRenameCancel}
        />
      )
    }
    const pad = depthStyle(depth)
    const startDrag = (e: React.DragEvent): void => {
      dragSrcPath = node.path
      e.dataTransfer.setData('text/plain', node.path)
      e.dataTransfer.effectAllowed = 'move'
    }
    const endDrag = (): void => {
      dragSrcPath = null
      setDropTarget(null)
    }
    if (node.isDir) {
      return (
        <button
          key={node.path}
          className={`filetree-item filetree-dir-label${
            selectedPath && pathsEqual(selectedPath, node.path) ? ' filetree-selected' : ''
          }${dropTarget === node.path ? ' filetree-drop-target' : ''}${
            item.keyIndex === focusIndex && kbdNav ? ' filetree-kbd-focus' : ''
          }${virtualize ? ' filetree-item-fixed' : ''}`}
          style={pad}
          tabIndex={item.keyIndex === tabStop ? 0 : -1}
          data-nav-index={item.keyIndex}
          data-nav-focus={item.keyIndex === focusIndex ? '' : undefined}
          onFocus={() => setFocusIndex(item.keyIndex)}
          onPointerDown={() => setKbdNav(false)}
          draggable
          onDragStart={startDrag}
          onDragEnd={endDrag}
          onDragOver={(e) => {
            const src = dragSrcPath
            if (!src || !isDropAllowed(src, node.path)) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setDropTarget(node.path)
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
            setDropTarget((t) => (t === node.path ? null : t))
          }}
          onDrop={(e) => {
            e.preventDefault()
            const src = e.dataTransfer.getData('text/plain') || dragSrcPath
            setDropTarget(null)
            if (src && isDropAllowed(src, node.path)) onMove(src, node.path)
          }}
          onClick={() => {
            onSelect?.(node.path, true)
            setExpanded((m) => ({ ...m, [node.path]: !open }))
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onContextMenu({ x: e.clientX, y: e.clientY, node })
          }}
          title={node.path}
        >
          {indentGuides(depth)}
          <span className="filetree-twisty">
            <ChevronIcon className={open ? 'is-open' : undefined} />
          </span>
          <span className="filetree-icon is-folder">
            {open ? <FolderOpenIcon size={13} /> : <FolderIcon size={13} />}
          </span>
          <span className="filetree-dir-name">{node.name}</span>
        </button>
      )
    }
    return (
      <button
        key={node.path}
        className={`filetree-item${
          activePath && pathsEqual(activePath, node.path) ? ' filetree-active' : ''
        }${selectedPath && pathsEqual(selectedPath, node.path) ? ' filetree-selected' : ''}${
          item.keyIndex === focusIndex && kbdNav ? ' filetree-kbd-focus' : ''
        }${
          virtualize ? ' filetree-item-fixed' : ''
        }`}
        style={pad}
        tabIndex={item.keyIndex === tabStop ? 0 : -1}
        data-nav-index={item.keyIndex}
        data-nav-focus={item.keyIndex === focusIndex ? '' : undefined}
        onFocus={() => setFocusIndex(item.keyIndex)}
        onPointerDown={() => setKbdNav(false)}
        draggable
        onDragStart={startDrag}
        onDragEnd={endDrag}
        onClick={() => {
          onSelect?.(node.path, false)
          onOpen(node.path)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onContextMenu({ x: e.clientX, y: e.clientY, node })
        }}
        title={node.path}
      >
        {indentGuides(depth)}
        <span className="filetree-twisty empty">·</span>
        <span className="filetree-icon">
          <FileMdIcon size={13} />
        </span>
        {relDir === undefined ? (
          node.name
        ) : (
          <>
            <span className="filetree-list-name">{node.name}</span>
            {relDir ? <span className="filetree-list-sub">{relDir}</span> : null}
          </>
        )}
      </button>
    )
  }

  return (
    <nav
      className="filetree"
      ref={treeRef}
      onKeyDown={onTreeKeyDown}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setFocusIndex(-1)
        setKbdNav(false)
        pendingFocusRef.current = null
      }}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest?.('.filetree-item')) return
        e.preventDefault()
        e.stopPropagation()
        onContextMenu({ x: e.clientX, y: e.clientY, node: null })
      }}
    >
      {virtualize ? (
        <>
          <div style={{ height: start * ROW_HEIGHT }} />
          {viewRows.slice(start, end).map(renderRow)}
          <div style={{ height: (viewRows.length - end) * ROW_HEIGHT }} />
        </>
      ) : (
        viewRows.map(renderRow)
      )}
    </nav>
  )
}
