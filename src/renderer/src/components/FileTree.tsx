import { useState } from 'react'
import type { DirNode } from '../../../../electron/shared/api'
import { ChevronDownIcon, ChevronRightIcon } from './Icons'

export interface TreeMenuRequest {
  x: number
  y: number
  node: DirNode
}

interface Props {
  nodes: DirNode[]
  activePath: string | null
  onOpen: (path: string) => void
  onContextMenu: (req: TreeMenuRequest) => void
  depth?: number
}

/**
 * Recursive markdown file tree for the folder sidebar. Directories are
 * expanded by default; clicking a folder label toggles it, clicking a file
 * opens it in the editor, right-clicking either opens the tree context menu.
 */
export default function FileTree({
  nodes,
  activePath,
  onOpen,
  onContextMenu,
  depth = 0
}: Props): React.JSX.Element {
  if (nodes.length === 0) {
    return depth === 0 ? <div className="outline-empty">No markdown files</div> : <></>
  }
  return (
    <nav className="filetree">
      {nodes.map((node) =>
        node.isDir ? (
          <DirRow
            key={node.path}
            node={node}
            activePath={activePath}
            onOpen={onOpen}
            onContextMenu={onContextMenu}
            depth={depth}
          />
        ) : (
          <button
            key={node.path}
            className={`filetree-item${activePath === node.path ? ' filetree-active' : ''}`}
            style={{ paddingLeft: 12 + depth * 14 }}
            onClick={() => onOpen(node.path)}
            onContextMenu={(e) => {
              e.preventDefault()
              onContextMenu({ x: e.clientX, y: e.clientY, node })
            }}
            title={node.path}
          >
            {node.name}
          </button>
        )
      )}
    </nav>
  )
}

function DirRow({
  node,
  activePath,
  onOpen,
  onContextMenu,
  depth
}: {
  node: DirNode
  activePath: string | null
  onOpen: (path: string) => void
  onContextMenu: (req: TreeMenuRequest) => void
  depth: number
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  return (
    <div className="filetree-dir">
      <button
        className="filetree-item filetree-dir-label"
        style={{ paddingLeft: 12 + depth * 14 }}
        onClick={() => setOpen((v) => !v)}
        onContextMenu={(e) => {
          e.preventDefault()
          onContextMenu({ x: e.clientX, y: e.clientY, node })
        }}
        title={node.path}
      >
        {open ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
        <span className="filetree-dir-name">{node.name}</span>
      </button>
      {open && node.children && node.children.length > 0 && (
        <FileTree
          nodes={node.children}
          activePath={activePath}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
          depth={depth + 1}
        />
      )}
    </div>
  )
}
