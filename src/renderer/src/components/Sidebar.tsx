import FileTree, { type TreeMenuRequest } from './FileTree'
import TreeMenu, { type TreeMenuItem } from './TreeMenu'
import Outline from './Outline'
import type { DirNode } from '@shared/ipc'
import type { OutlineItem } from '../outline/extract'
import type { SidebarMode } from '../hooks/useWorkspace'

interface Props {
  mode: SidebarMode
  folderPath: string | null
  folderName: string | null
  folderTree: DirNode[]
  activeFilePath: string | null
  outline: OutlineItem[]
  activePos: number | null
  treeMenu: TreeMenuRequest | null
  treeMenuItems: TreeMenuItem[]
  onOpenFile: (path: string) => void
  onTreeContextMenu: (req: TreeMenuRequest) => void
  onCloseTreeMenu: () => void
  onNewFile: (dirPath: string) => void
  onBackToFiles: () => void
  onGoToHeading: (pos: number) => void
}

/** Left sidebar: markdown file tree of the open folder, or the file outline. */
export default function Sidebar({
  mode,
  folderPath,
  folderName,
  folderTree,
  activeFilePath,
  outline,
  activePos,
  treeMenu,
  treeMenuItems,
  onOpenFile,
  onTreeContextMenu,
  onCloseTreeMenu,
  onNewFile,
  onBackToFiles,
  onGoToHeading
}: Props): React.JSX.Element {
  if (mode === 'files' && folderPath) {
    return (
      <aside className="sidebar">
        <div className="sidebar-header" title={folderPath}>
          <span className="sidebar-title">{folderName}</span>
          <button
            className="sidebar-action"
            onClick={() => onNewFile(folderPath)}
            title="New file"
          >
            +
          </button>
        </div>
        <FileTree
          nodes={folderTree}
          activePath={activeFilePath}
          onOpen={onOpenFile}
          onContextMenu={onTreeContextMenu}
        />
        {treeMenu && (
          <TreeMenu
            x={treeMenu.x}
            y={treeMenu.y}
            items={treeMenuItems}
            onClose={onCloseTreeMenu}
          />
        )}
      </aside>
    )
  }
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        {folderPath && (
          <button className="sidebar-back" onClick={onBackToFiles} title="Back to file list">
            ‹ Files
          </button>
        )}
        <span>Outline</span>
      </div>
      <Outline items={outline} activePos={activePos} onSelect={onGoToHeading} />
    </aside>
  )
}
