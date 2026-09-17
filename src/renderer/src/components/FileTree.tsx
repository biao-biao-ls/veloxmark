import { useEffect, useMemo, useRef, useState } from 'react'
import type { DirNode } from '../../../../electron/shared/api'
import { ChevronDownIcon, ChevronRightIcon } from './Icons'

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
}

interface FlatRow {
  node: DirNode
  depth: number
}

// Fixed row height keeps the virtualization math exact; .filetree-item is
// line-height 1.6 * 13px ≈ 21px plus 2+2px padding → 25px with border-box.
const ROW_HEIGHT = 25
// Above this many visible rows, window the render (spacer divs, no abs pos).
const VIRTUALIZE_AT = 500
const OVERSCAN = 10
// Directories with more children than this start collapsed — expanding a
// huge folder stays one click away without paying the initial render cost.
const COLLAPSE_CHILDREN_OVER = 100

/** src of the in-flight drag; dragover can't read dataTransfer, so share it. */
let dragSrcPath: string | null = null

/**
 * Flat markdown file tree for the folder sidebar. Visible rows are a
 * depth-first flattening of the expanded nodes (expand state is hoisted
 * here), which makes large workspaces windowable: above VIRTUALIZE_AT rows
 * only the scroll viewport (+overscan) is rendered, using top/bottom spacer
 * divs inside the sidebar's own scroll. Clicking a folder label toggles it,
 * clicking a file opens it, right-clicking opens the tree context menu;
 * files and folders are draggable onto folder rows.
 */
export default function FileTree({
  nodes,
  activePath,
  onOpen,
  onContextMenu,
  onMove
}: Props): React.JSX.Element {
  // undefined = "never touched" → fall back to the size-based default.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(0)
  const treeRef = useRef<HTMLElement | null>(null)

  const sep = window.api.platform === 'win32' ? '\\' : '/'

  const isExpanded = (node: DirNode): boolean =>
    expanded[node.path] ?? (node.children?.length ?? 0) <= COLLAPSE_CHILDREN_OVER

  const rows = useMemo(() => {
    const out: FlatRow[] = []
    const walk = (list: DirNode[], depth: number): void => {
      for (const node of list) {
        out.push({ node, depth })
        if (node.isDir && isExpanded(node) && node.children) walk(node.children, depth + 1)
      }
    }
    walk(nodes, 0)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, expanded])

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
    return <div className="outline-empty">No markdown files</div>
  }

  const isDropAllowed = (src: string, destDir: string): boolean =>
    src !== destDir && !destDir.startsWith(src + sep)

  const renderRow = ({ node, depth }: FlatRow): React.JSX.Element => {
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
      const open = isExpanded(node)
      return (
        <button
          key={node.path}
          className={`filetree-item filetree-dir-label${
            dropTarget === node.path ? ' filetree-drop-target' : ''
          }${virtualize ? ' filetree-item-fixed' : ''}`}
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
          onClick={() => setExpanded((m) => ({ ...m, [node.path]: !open }))}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onContextMenu({ x: e.clientX, y: e.clientY, node })
          }}
          title={node.path}
        >
          {open ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
          <span className="filetree-dir-name">{node.name}</span>
        </button>
      )
    }
    return (
      <button
        key={node.path}
        className={`filetree-item${activePath === node.path ? ' filetree-active' : ''}${
          virtualize ? ' filetree-item-fixed' : ''
        }`}
        style={pad}
        draggable
        onDragStart={startDrag}
        onDragEnd={endDrag}
        onClick={() => onOpen(node.path)}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onContextMenu({ x: e.clientX, y: e.clientY, node })
        }}
        title={node.path}
      >
        {node.name}
      </button>
    )
  }

  return (
    <nav className="filetree" ref={treeRef}>
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
