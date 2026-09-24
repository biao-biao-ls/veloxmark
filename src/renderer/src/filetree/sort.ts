/**
 * 6E 文件树排序（tasks 6.9/6.10）——纯逻辑叶模块。
 *
 * 语义（spec AC4/AC5 + 2026-09-23 拍板）：
 * - `natural`   自然排序：数字感知（`2.md` < `10.md`），Intl.Collator numeric；
 * - `name`      按文件名：字典序（`10.md` < `2.md`），同一 collator 关 numeric；
 * - `mtime`/`birthtime`  按修改/创建时间，缺省时间戳（扫描未带）**恒排后**，
 *   升降只作用于有效时间戳之间；
 * - `groupFolders`（默认开）：目录聚组在前；关 = 文件目录按当前键混排。
 *
 * 排序只在渲染进程内存数据上做（D：比较器不回主进程重扫）；时间戳由主进程
 * 扫描时 stat 采集（`DirNode.mtimeMs`/`birthtimeMs` 可选字段）。纯函数、不改
 * 入参（children 数组换新，节点对象复用）——树/列表两种视图共用。
 */
import type { DirNode } from '../../../../electron/shared/api'

export type TreeSortKey = 'natural' | 'name' | 'mtime' | 'birthtime'
export type TreeSortDir = 'asc' | 'desc'

export interface TreeSortOptions {
  /** AC5：按文件夹分组（目录聚组在前）；false = 文件目录混排。 */
  groupFolders: boolean
  key: TreeSortKey
  dir: TreeSortDir
}

/** 2026-09-23 拍板：分组默认开、自然序默认键、默认升序。 */
export const DEFAULT_TREE_SORT: TreeSortOptions = {
  groupFolders: true,
  key: 'natural',
  dir: 'asc'
}

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const nameCollator = new Intl.Collator(undefined, { numeric: false, sensitivity: 'base' })

/** 自然序文件名比较：数字感知（`2.md` < `10.md`）。 */
export function compareNatural(a: string, b: string): number {
  return naturalCollator.compare(a, b)
}

/** 文件名字典序：纯字符序（`10.md` < `2.md`）。 */
export function compareName(a: string, b: string): number {
  return nameCollator.compare(a, b)
}

/** 同名/同戳的确定性收尾（locale 比较对 `a`/`A` 等可判 0）。 */
function tieBreak(a: DirNode, b: DirNode): number {
  const byName = nameCollator.compare(a.name, b.name)
  return byName !== 0 ? byName : nameCollator.compare(a.path, b.path)
}

function compareByTime(a: DirNode, b: DirNode, key: 'mtime' | 'birthtime', dir: TreeSortDir): number {
  const av = key === 'mtime' ? a.mtimeMs : a.birthtimeMs
  const bv = key === 'mtime' ? b.mtimeMs : b.birthtimeMs
  // 缺省时间戳恒排后，与升降无关（AC 验证表「缺省时间排后」）。
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

/**
 * 递归排序整棵扫描树（每层各自排序；children 数组换新，节点对象复用）。
 * groupFolders: true → 每层目录组在前，组内同键同升降；false → 单组混排。
 */
export function sortTreeNodes(nodes: DirNode[], opts: TreeSortOptions): DirNode[] {
  const sorted = (list: DirNode[]): DirNode[] => [...list].sort((a, b) => compareNodes(a, b, opts))
  const sortLevel = (list: DirNode[]): DirNode[] => {
    const mapped = list.map((n) => (n.children ? { ...n, children: sortLevel(n.children) } : n))
    if (!opts.groupFolders) return sorted(mapped)
    return [...sorted(mapped.filter((n) => n.isDir)), ...sorted(mapped.filter((n) => !n.isDir))]
  }
  return sortLevel(nodes)
}

// ---- 排序状态机（6.9：四键互斥单选，点按选中/再按翻转升降） --------------------

/** 点按排序键：未选中 → 选中（保持升降）；已选中 → 翻转升降。 */
export function pressSortKey(current: TreeSortOptions, key: TreeSortKey): TreeSortOptions {
  if (current.key === key) {
    return { ...current, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  }
  return { ...current, key }
}

/** 翻转「按文件夹分组」。 */
export function toggleGroupFolders(current: TreeSortOptions): TreeSortOptions {
  return { ...current, groupFolders: !current.groupFolders }
}
