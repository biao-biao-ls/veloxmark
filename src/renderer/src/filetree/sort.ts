import type { DirNode } from '../../../../electron/shared/api'

export type TreeSortKey = 'natural' | 'name' | 'mtime' | 'birthtime'
export type TreeSortDir = 'asc' | 'desc'

export interface TreeSortOptions {
  groupFolders: boolean
  key: TreeSortKey
  dir: TreeSortDir
}

export const DEFAULT_TREE_SORT: TreeSortOptions = {
  groupFolders: true,
  key: 'natural',
  dir: 'asc'
}

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const nameCollator = new Intl.Collator(undefined, { numeric: false, sensitivity: 'base' })

export function compareNatural(a: string, b: string): number {
  return naturalCollator.compare(a, b)
}

export function compareName(a: string, b: string): number {
  return nameCollator.compare(a, b)
}

function tieBreak(a: DirNode, b: DirNode): number {
  const byName = nameCollator.compare(a.name, b.name)
  return byName !== 0 ? byName : nameCollator.compare(a.path, b.path)
}

function compareByTime(a: DirNode, b: DirNode, key: 'mtime' | 'birthtime', dir: TreeSortDir): number {
  const av = key === 'mtime' ? a.mtimeMs : a.birthtimeMs
  const bv = key === 'mtime' ? b.mtimeMs : b.birthtimeMs
  if (av == null && bv == null) return tieBreak(a, b)
  if (av == null) return 1
  if (bv == null) return -1
  if (av !== bv) return dir === 'asc' ? av - bv : bv - av
  return tieBreak(a, b)
}

function compareNodes(a: DirNode, b: DirNode, opts: TreeSortOptions): number {
  const flip = opts.dir === 'desc' ? -1 : 1
  if (opts.key === 'mtime' || opts.key === 'birthtime') {
    return compareByTime(a, b, opts.key, opts.dir)
  }
  const cmp = opts.key === 'natural' ? compareNatural(a.name, b.name) : compareName(a.name, b.name)
  if (cmp !== 0) return cmp * flip
  return tieBreak(a, b) * flip
}

export function sortTreeNodes(nodes: DirNode[], opts: TreeSortOptions): DirNode[] {
  const sorted = (list: DirNode[]): DirNode[] => [...list].sort((a, b) => compareNodes(a, b, opts))
  const sortLevel = (list: DirNode[]): DirNode[] => {
    const mapped = list.map((n) => (n.children ? { ...n, children: sortLevel(n.children) } : n))
    if (!opts.groupFolders) return sorted(mapped)
    return [...sorted(mapped.filter((n) => n.isDir)), ...sorted(mapped.filter((n) => !n.isDir))]
  }
  return sortLevel(nodes)
}


export function pressSortKey(current: TreeSortOptions, key: TreeSortKey): TreeSortOptions {
  if (current.key === key) {
    return { ...current, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  }
  return { ...current, key }
}

export function toggleGroupFolders(current: TreeSortOptions): TreeSortOptions {
  return { ...current, groupFolders: !current.groupFolders }
}
