import { describe, expect, it } from 'vitest'
import type { DirNode } from '../../../../electron/shared/api'
import { ancestorDirPaths, isDirOpen, visibleRows } from './filetreeRows'

const dir = (name: string, path: string, children: DirNode[] = []): DirNode => ({
  name,
  path,
  isDir: true,
  children
})
const file = (name: string, path: string): DirNode => ({ name, path, isDir: false })
const paths = (rows: { node: DirNode }[]): string[] => rows.map((r) => r.node.path)

// win32-style tree: root.md + docs/ (intro.md + deep/a.md)
const tree: DirNode[] = [
  dir('docs', 'C:\\w\\docs', [
    dir('deep', 'C:\\w\\docs\\deep', [file('a.md', 'C:\\w\\docs\\deep\\a.md')]),
    file('intro.md', 'C:\\w\\docs\\intro.md')
  ]),
  file('root.md', 'C:\\w\\root.md')
]

describe('ancestorDirPaths', () => {
  it('collects strict ancestor dirs (win32 + posix)', () => {
    expect([...ancestorDirPaths('C:\\w\\docs\\deep\\a.md')]).toEqual([
      'C:\\w\\docs\\deep',
      'C:\\w\\docs',
      'C:\\w',
      'C:'
    ])
    expect([...ancestorDirPaths('/w/docs/a.md')]).toEqual(['/w/docs', '/w'])
  })

  it('excludes the path itself (folder rename targets stay strict)', () => {
    const set = ancestorDirPaths('C:\\w\\docs\\deep')
    expect(set.has('C:\\w\\docs\\deep')).toBe(false)
    expect(set.has('C:\\w\\docs')).toBe(true)
  })

  it('root-level file has no in-tree ancestors; null is empty', () => {
    // baseDirOf('C:\\a.md') = 'C:' — the drive prefix is a harmless extra.
    expect(ancestorDirPaths('C:\\a.md').has('C:\\w')).toBe(false)
    expect(ancestorDirPaths(null).size).toBe(0)
    expect(ancestorDirPaths('bare.md').size).toBe(0)
  })
})

describe('visibleRows (6C D1 default-collapsed)', () => {
  it('shows only root files + first-level dir labels by default', () => {
    const rows = visibleRows(tree, { expanded: {} })
    expect(paths(rows)).toEqual(['C:\\w\\docs', 'C:\\w\\root.md'])
  })

  it('user-expanded dirs contribute children (and stay open)', () => {
    const rows = visibleRows(tree, { expanded: { 'C:\\w\\docs': true } })
    expect(paths(rows)).toEqual([
      'C:\\w\\docs',
      'C:\\w\\docs\\deep',
      'C:\\w\\docs\\intro.md',
      'C:\\w\\root.md'
    ])
    expect(rows[0].open).toBe(true)
  })

  it('user-collapsed dirs hide children even below 100 entries (heuristic gone)', () => {
    const wide = dir('wide', 'C:\\w\\wide', [file('x.md', 'C:\\w\\wide\\x.md')])
    expect(paths(visibleRows([wide], { expanded: { 'C:\\w\\wide': false } }))).toEqual([
      'C:\\w\\wide'
    ])
  })
})

describe('visibleRows reveal chain (6C D2)', () => {
  const revealDirs = ancestorDirPaths('C:\\w\\docs\\deep\\a.md')

  it('default-opens the active file ancestor chain without touching expanded', () => {
    const rows = visibleRows(tree, { expanded: {}, revealDirs })
    expect(paths(rows)).toContain('C:\\w\\docs\\deep\\a.md')
    expect(paths(rows)).toContain('C:\\w\\docs\\intro.md') // sibling of the chain stays listed
  })

  it('user collapse wins over reveal (manual state is never reverted)', () => {
    const rows = visibleRows(tree, {
      expanded: { 'C:\\w\\docs': false },
      revealDirs
    })
    expect(paths(rows)).toEqual(['C:\\w\\docs', 'C:\\w\\root.md'])
  })

  it('manual expand elsewhere survives reveal (AC3)', () => {
    const other = dir('other', 'C:\\w\\other', [file('o.md', 'C:\\w\\other\\o.md')])
    const rows = visibleRows([...tree, other], {
      expanded: { 'C:\\w\\other': true },
      revealDirs
    })
    expect(paths(rows)).toContain('C:\\w\\other\\o.md')
    expect(paths(rows)).toContain('C:\\w\\docs\\deep\\a.md')
  })

  it('reveal of a root-level file adds nothing (already visible)', () => {
    const rows = visibleRows(tree, {
      expanded: {},
      revealDirs: ancestorDirPaths('C:\\w\\root.md')
    })
    expect(paths(rows)).toEqual(['C:\\w\\docs', 'C:\\w\\root.md'])
  })
})

describe('visibleRows rename chain (UX-P07-F4 force-open)', () => {
  it('rename ancestors force open even over an explicit user collapse', () => {
    const rows = visibleRows(tree, {
      expanded: { 'C:\\w\\docs': false },
      renameDirs: ancestorDirPaths('C:\\w\\docs\\deep\\new.md')
    })
    expect(paths(rows)).toContain('C:\\w\\docs\\deep')
  })

  it('isDirOpen precedence: rename > user > reveal > collapsed', () => {
    const base = {
      expanded: { 'C:\\w\\docs': false, 'C:\\w\\other': true },
      revealDirs: new Set(['C:\\w\\docs']),
      renameDirs: new Set(['C:\\w\\docs'])
    }
    expect(isDirOpen('C:\\w\\docs', base)).toBe(true) // rename force wins
    expect(isDirOpen('C:\\w\\other', base)).toBe(true) // user true
    expect(isDirOpen('C:\\w', { ...base, renameDirs: undefined })).toBe(false) // user false beats reveal
    expect(isDirOpen('C:\\w\\z', base)).toBe(false) // untouched, off-chain
  })
})
