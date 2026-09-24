/**
 * 6E 排序纯逻辑单测——验证表：自然 vs 字典、mtime/birthtime 升降、groupFolders
 * on/off、缺省时间排后、空目录、状态机（互斥单选 + 再按翻转）。
 */
import { describe, expect, it } from 'vitest'
import type { DirNode } from '../../../../electron/shared/api'
import {
  DEFAULT_TREE_SORT,
  compareNatural,
  pressSortKey,
  sortTreeNodes,
  toggleGroupFolders,
  type TreeSortOptions
} from './sort'

function f(name: string, times: { mtimeMs?: number; birthtimeMs?: number } = {}): DirNode {
  return { name, path: `/root/${name}`, isDir: false, ...times }
}

function d(
  name: string,
  children: DirNode[],
  times: { mtimeMs?: number; birthtimeMs?: number } = {}
): DirNode {
  return { name, path: `/root/${name}`, isDir: true, children, ...times }
}

const names = (list: DirNode[]): string[] => list.map((n) => n.name)
const opts = (patch: Partial<TreeSortOptions> = {}): TreeSortOptions => ({
  ...DEFAULT_TREE_SORT,
  ...patch
})

describe('compareNatural', () => {
  it('数字感知：2.md < 10.md', () => {
    expect(compareNatural('2.md', '10.md')).toBeLessThan(0)
  })
})

describe('sortTreeNodes', () => {
  it('自然序 = 数字感知（2.md < 10.md）；文件名排序 = 字典序（10.md < 2.md）', () => {
    const nodes = [f('10.md'), f('2.md'), f('1.md')]
    expect(names(sortTreeNodes(nodes, opts({ key: 'natural' })))).toEqual([
      '1.md',
      '2.md',
      '10.md'
    ])
    expect(names(sortTreeNodes(nodes, opts({ key: 'name' })))).toEqual([
      '1.md',
      '10.md',
      '2.md'
    ])
  })

  it('mtime 升/降序', () => {
    const nodes = [f('old.md', { mtimeMs: 1 }), f('new.md', { mtimeMs: 3 }), f('mid.md', { mtimeMs: 2 })]
    expect(
      names(sortTreeNodes(nodes, opts({ key: 'mtime', dir: 'asc' })))
    ).toEqual(['old.md', 'mid.md', 'new.md'])
    expect(
      names(sortTreeNodes(nodes, opts({ key: 'mtime', dir: 'desc' })))
    ).toEqual(['new.md', 'mid.md', 'old.md'])
  })

  it('birthtime 升/降序', () => {
    const nodes = [
      f('born-late.md', { birthtimeMs: 20 }),
      f('born-early.md', { birthtimeMs: 10 })
    ]
    expect(
      names(sortTreeNodes(nodes, opts({ key: 'birthtime', dir: 'asc' })))
    ).toEqual(['born-early.md', 'born-late.md'])
    expect(
      names(sortTreeNodes(nodes, opts({ key: 'birthtime', dir: 'desc' })))
    ).toEqual(['born-late.md', 'born-early.md'])
  })

  it('缺省时间戳恒排后（升降皆是）', () => {
    const nodes = [f('b.md', { mtimeMs: 1 }), f('ghost.md'), f('a.md', { mtimeMs: 2 })]
    expect(
      names(sortTreeNodes(nodes, opts({ key: 'mtime', dir: 'asc' })))
    ).toEqual(['b.md', 'a.md', 'ghost.md'])
    expect(
      names(sortTreeNodes(nodes, opts({ key: 'mtime', dir: 'desc' })))
    ).toEqual(['a.md', 'b.md', 'ghost.md'])
  })

  it('groupFolders on = 目录聚组在前；off = 文件目录混排', () => {
    const nodes = [
      f('z.md', { mtimeMs: 1 }),
      d('a-dir', [], { mtimeMs: 3 }),
      f('a.md', { mtimeMs: 2 })
    ]
    // on：目录组（a-dir）在前，文件组内 mtime asc
    expect(
      names(sortTreeNodes(nodes, opts({ groupFolders: true, key: 'mtime', dir: 'asc' })))
    ).toEqual(['a-dir', 'z.md', 'a.md'])
    // off：三者按 mtime 混排
    expect(
      names(sortTreeNodes(nodes, opts({ groupFolders: false, key: 'mtime', dir: 'asc' })))
    ).toEqual(['z.md', 'a.md', 'a-dir'])
  })

  it('组内同键同升降；desc 时目录组仍在前', () => {
    const nodes = [d('b-dir', []), d('a-dir', []), f('z.md'), f('a.md')]
    expect(
      names(sortTreeNodes(nodes, opts({ groupFolders: true, key: 'natural', dir: 'desc' })))
    ).toEqual(['b-dir', 'a-dir', 'z.md', 'a.md'])
  })

  it('递归：子层各自排序', () => {
    const tree = [d('docs', [f('10.md'), f('2.md')])]
    const sorted = sortTreeNodes(tree, opts({ key: 'natural' }))
    expect(names(sorted[0].children ?? [])).toEqual(['2.md', '10.md'])
  })

  it('空目录 / 空数组', () => {
    expect(sortTreeNodes([], opts())).toEqual([])
    expect(names(sortTreeNodes([d('empty', [])], opts()))).toEqual(['empty'])
  })

  it('纯函数：不改入参', () => {
    const kids = [f('10.md'), f('2.md')]
    const nodes = [d('docs', kids)]
    sortTreeNodes(nodes, opts({ key: 'natural' }))
    expect(names(kids)).toEqual(['10.md', '2.md'])
    expect(names(nodes[0].children ?? [])).toEqual(['10.md', '2.md'])
  })
})

describe('排序状态机', () => {
  it('点按未选中键 → 选中并保持升降', () => {
    const cur = opts({ key: 'natural', dir: 'desc' })
    expect(pressSortKey(cur, 'mtime')).toEqual({ ...cur, key: 'mtime' })
  })

  it('点按已选中键 → 翻转升降', () => {
    expect(pressSortKey(opts({ key: 'name', dir: 'asc' }), 'name').dir).toBe('desc')
    expect(pressSortKey(opts({ key: 'name', dir: 'desc' }), 'name').dir).toBe('asc')
  })

  it('toggleGroupFolders 翻转分组', () => {
    expect(toggleGroupFolders(opts({ groupFolders: true })).groupFolders).toBe(false)
    expect(toggleGroupFolders(opts({ groupFolders: false })).groupFolders).toBe(true)
  })
})
