import type { DirNode } from '../../../../electron/shared/api'
import { baseDirOf, pathKey } from '../pathUtil'

export interface FlatRow {
  node: DirNode
  depth: number
  open: boolean
}

export interface VisibleRowsOpts {
  expanded: Record<string, boolean>
  revealDirs?: ReadonlySet<string>
  renameDirs?: ReadonlySet<string>
}

export interface FileListRow {
  node: DirNode
  relDir: string
}

export function flattenFiles(nodes: DirNode[], sep = '/'): FileListRow[] {
  const out: FileListRow[] = []
  const walk = (list: DirNode[], prefix: string): void => {
    for (const node of list) {
      if (node.isDir) walk(node.children ?? [], prefix + node.name + sep)
      else out.push({ node, relDir: prefix })
    }
  }
  walk(nodes, '')
  return out
}

export function ancestorDirPaths(path: string | null): Set<string> {
  const out = new Set<string>()
  if (!path) return out
  let dir = baseDirOf(path)
  while (dir && dir !== path && !out.has(dir)) {
    out.add(dir)
    const parent = baseDirOf(dir)
    if (parent === dir) break
    dir = parent
  }
  return out
}

function setHasPath(set: ReadonlySet<string> | undefined, path: string): boolean {
  if (!set) return false
  if (set.has(path)) return true
  const key = pathKey(path)
  for (const p of set) if (pathKey(p) === key) return true
  return false
}

export function isDirOpen(path: string, opts: VisibleRowsOpts): boolean {
  if (setHasPath(opts.renameDirs, path)) return true
  const user = opts.expanded[path]
  if (user !== undefined) return user
  return setHasPath(opts.revealDirs, path)
}

export function visibleRows(nodes: DirNode[], opts: VisibleRowsOpts): FlatRow[] {
  const out: FlatRow[] = []
  const walk = (list: DirNode[], depth: number): void => {
    for (const node of list) {
      const open = node.isDir && isDirOpen(node.path, opts)
      out.push({ node, depth, open })
      if (open && node.children) walk(node.children, depth + 1)
    }
  }
  walk(nodes, 0)
  return out
}
