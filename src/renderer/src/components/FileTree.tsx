import { useEffect, useMemo, useRef, useState } from 'react'
import type { DirNode } from '../../../../electron/shared/api'
import { ChevronDownIcon, ChevronRightIcon, FileMdIcon, FolderIcon, FolderOpenIcon } from './Icons'
import { t } from '../i18n'
import { ancestorDirPaths, visibleRows, type FlatRow } from './filetreeRows'
import { sortTreeNodes } from '../filetree/sort'
import { usePreferences } from '../preferences/useStore'

/** node === null means the workspace root (empty-area context menu, P07). */
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
  /** P07 drag-drop: move srcPath into destDir. */
  onMove: (srcPath: string, destDir: string) => void
  /** UX-P07-F4: node currently in inline-rename mode (post-create IDE flow). */
  renamingPath?: string | null
  onRenameCommit: (node: DirNode, name: string) => void
  onRenameCancel: () => void
  /** 6D D3: controlled row selection (new-file target; 6G menus reuse). */
  selectedPath?: string | null
  onSelect?: (path: string, isDir: boolean) => void
}

// Fixed row height keeps the virtualization math exact; .filetree-item is
// line-height 1.6 * 13px ≈ 21px plus 2+2px padding → 25px with border-box.
const ROW_HEIGHT = 25
// Above this many visible rows, window the render (spacer divs, no abs pos).
const VIRTUALIZE_AT = 500
const OVERSCAN = 10

/** src of the in-flight drag; dragover can't read dataTransfer, so share it. */
let dragSrcPath: string | null = null

/**
 * Inline rename row (UX-P07-F4): appears after create, and any time the
 * workspace points renamingPath at a tree node. Enter/blur commits, Esc
 * cancels — the commit path reuses the hook's rename validation.
 */
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
    // IDE convention: select the basename, keep the extension editable away.
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
      style={{ paddingLeft: 12 + depth * 14 }}
      title={node.path}
    >
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

/**
 * Flat markdown file tree for the folder sidebar. Visible rows come from
 * `filetreeRows.visibleRows` (depth-first flatten of open nodes — 6C: default
 * collapsed, active-file ancestor chain revealed, rename chain forced open),
 * which makes large workspaces windowable: above VIRTUALIZE_AT rows only the
 * scroll viewport (+overscan) is rendered, using top/bottom spacer divs inside
 * the sidebar's own scroll. Clicking a folder label toggles it, clicking a
 * file opens it, right-clicking opens the tree context menu; files and
 * folders are draggable onto folder rows. Empty-area right-click (nav
 * surface) opens the workspace-root menu (UX-P07-F0).
 */
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
  onSelect
}: Props): React.JSX.Element {
  // 6C D1: untouched dirs are collapsed (no size heuristic); only explicit
  // user toggles live here — reveal-derived openness never writes this map.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(0)
  const treeRef = useRef<HTMLElement | null>(null)

  const sep = window.api.platform === 'win32' ? '\\' : '/'

  // 6C D2: strict-ancestor dirs of the active file are default-open (derived,
  // never written to `expanded`) so the active row is reachable; user collapse
  // still wins. Rename ancestors force open (UX-P07-F4).
  const revealDirs = useMemo(() => ancestorDirPaths(activePath), [activePath])
  const renameDirs = useMemo(() => ancestorDirPaths(renamingPath ?? null), [renamingPath])
  // 6E D4: sort is a pure pre-pass on the scan tree (per-level; shared with the
  // 6.12 list fork) — inserted before the 6C flatten seam. Reactive to the
  // ops-panel sort row via preferences (instant re-sort, spec AC1).
  const fileTreeSort = usePreferences().fileTreeSort
  const sortedNodes = useMemo(() => sortTreeNodes(nodes, fileTreeSort), [nodes, fileTreeSort])
  const rows = useMemo(
    () => visibleRows(sortedNodes, { expanded, revealDirs, renameDirs }),
    [sortedNodes, expanded, revealDirs, renameDirs]
  )

  // The sidebar is the scroll parent — track it so the window follows scroll.
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

  // 6C D3/D5: reveal scroll — center the active row once it becomes visible
  // (tab switch, root change, or tree data arriving late). Re-scroll only when
  // the target path changes or first appears, so unrelated tree churn (e.g.
  // manual expand/collapse elsewhere) never jitters the viewport.
  const lastRevealRef = useRef<{ path: string | null; found: boolean }>({ path: null, found: false })
  useEffect(() => {
    const idx = rows.findIndex((r) => r.node.path === activePath)
    const found = idx >= 0
    const last = lastRevealRef.current
    if (found && last.path === activePath && last.found) return
    lastRevealRef.current = { path: activePath, found }
    if (!found) return
    const side = treeRef.current?.closest('.sidebar')
    if (!side) return
    // row i sits at treeTop + i*ROW_H inside the sidebar's scroll space.
    const treeTop = treeRef.current?.offsetTop ?? 0
    const rowTop = treeTop + idx * ROW_HEIGHT
    side.scrollTop = Math.max(0, rowTop - side.clientHeight / 2 + ROW_HEIGHT / 2)
  }, [activePath, rows])

  // UX-P07-F5: Esc cancels an in-flight drag (drop indicator + shared src).
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

  const virtualize = rows.length > VIRTUALIZE_AT
  let start = 0
  let end = rows.length
  if (virtualize && viewportH > 0) {
    // row i sits at treeTop + i*ROW_H inside the sidebar's scroll space.
    const treeTop = treeRef.current?.offsetTop ?? 0
    start = Math.max(0, Math.floor((scrollTop - treeTop) / ROW_HEIGHT) - OVERSCAN)
    end = Math.min(rows.length, Math.ceil((scrollTop + viewportH - treeTop) / ROW_HEIGHT) + OVERSCAN)
  }

  if (nodes.length === 0) {
    return <div className="outline-empty">{t('tree.noMarkdown')}</div>
  }

  const isDropAllowed = (src: string, destDir: string): boolean =>
    src !== destDir && !destDir.startsWith(src + sep)

  const renderRow = ({ node, depth, open }: FlatRow): React.JSX.Element => {
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
    const pad = { paddingLeft: 12 + depth * 14 }
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
            selectedPath === node.path ? ' filetree-selected' : ''
          }${dropTarget === node.path ? ' filetree-drop-target' : ''}${
            virtualize ? ' filetree-item-fixed' : ''
          }`}
          style={pad}
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
            // ignore leaves into our own children — the highlight would flicker
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
            // 6D D3: the click selects the row (new-file target) and toggles it.
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
          {open ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
          <span className="filetree-icon">
            {open ? <FolderOpenIcon size={13} /> : <FolderIcon size={13} />}
          </span>
          <span className="filetree-dir-name">{node.name}</span>
        </button>
      )
    }
    return (
      <button
        key={node.path}
        className={`filetree-item${activePath === node.path ? ' filetree-active' : ''}${
          selectedPath === node.path ? ' filetree-selected' : ''
        }${virtualize ? ' filetree-item-fixed' : ''}`}
        style={pad}
        draggable
        onDragStart={startDrag}
        onDragEnd={endDrag}
        onClick={() => {
          // 6D D3: select then open (selection doubles as the new-file target).
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
        <span className="filetree-icon">
          <FileMdIcon size={13} />
        </span>
        {node.name}
      </button>
    )
  }

  return (
    <nav
      className="filetree"
      ref={treeRef}
      onContextMenu={(e) => {
        // Rows stopPropagation; anything landing on the nav surface itself is
        // empty-area → workspace-root menu (UX-P07-F0).
        if ((e.target as HTMLElement).closest?.('.filetree-item')) return
        e.preventDefault()
        e.stopPropagation()
        onContextMenu({ x: e.clientX, y: e.clientY, node: null })
      }}
    >
      {virtualize ? (
        <>
          <div style={{ height: start * ROW_HEIGHT }} />
          {rows.slice(start, end).map(renderRow)}
          <div style={{ height: (rows.length - end) * ROW_HEIGHT }} />
        </>
      ) : (
        rows.map(renderRow)
      )}
    </nav>
  )
}
