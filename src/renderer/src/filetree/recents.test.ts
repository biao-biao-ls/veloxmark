/**
 * 6F recents 模型单测——验证表：upsert 去重移动、置顶序、历史挤出（10）、
 * 置顶上限（5）、移除、路径同一性（大小写/分隔符）。
 */
import { describe, expect, it } from 'vitest'
import {
  RECENT_HISTORY_MAX,
  RECENT_PINNED_MAX,
  removeRecent,
  togglePinRecent,
  upsertRecent,
  visibleRecents,
  type RecentFolder
} from './recents'

const paths = (list: RecentFolder[]): string[] => list.map((e) => e.path)

describe('upsertRecent', () => {
  it('新路径进历史区首；再用旧路径 → 去重前移到历史首', () => {
    let list = upsertRecent([], 'C:\\w\\a')
    list = upsertRecent(list, 'C:\\w\\b')
    expect(paths(list)).toEqual(['C:\\w\\b', 'C:\\w\\a'])
    list = upsertRecent(list, 'C:\\w\\a')
    expect(paths(list)).toEqual(['C:\\w\\a', 'C:\\w\\b'])
  })

  it('已是历史首 → 返回原引用（不制造新数组）', () => {
    const list = upsertRecent([], '/w/a')
    expect(upsertRecent(list, '/w/a')).toBe(list)
  })

  it('置顶项被使用时位置不动（返回原引用）', () => {
    let list = upsertRecent([], '/w/a')
    list = togglePinRecent(list, '/w/a')
    list = upsertRecent(list, '/w/b')
    expect(upsertRecent(list, '/w/a')).toBe(list)
    expect(paths(list)).toEqual(['/w/a', '/w/b'])
  })

  it(`历史挤出：超过 ${RECENT_HISTORY_MAX} 挤出最旧未置顶`, () => {
    let list: RecentFolder[] = []
    for (let i = 1; i <= RECENT_HISTORY_MAX + 2; i++) list = upsertRecent(list, `/w/f${i}`)
    expect(list).toHaveLength(RECENT_HISTORY_MAX)
    expect(paths(list)).toEqual([
      '/w/f12',
      '/w/f11',
      '/w/f10',
      '/w/f9',
      '/w/f8',
      '/w/f7',
      '/w/f6',
      '/w/f5',
      '/w/f4',
      '/w/f3'
    ])
  })

  it('路径同一性：大小写与分隔符不敏感（去重移动仍生效）', () => {
    let list = upsertRecent([], 'C:\\Work\\Docs')
    list = upsertRecent(list, '/w/other')
    list = upsertRecent(list, 'c:/work/docs/')
    expect(paths(list)).toEqual(['c:/work/docs/', '/w/other'])
  })
})

describe('togglePinRecent', () => {
  it('置顶进置顶组（显示序 = 置顶组 + 历史组）；再点取消 → 回落历史首', () => {
    let list: RecentFolder[] = []
    for (const p of ['/w/a', '/w/b', '/w/c']) list = upsertRecent(list, p)
    // 使用序 MRU = [c, b, a]；置顶 c 后历史剩 [b, a]
    list = togglePinRecent(list, '/w/c')
    expect(paths(list)).toEqual(['/w/c', '/w/b', '/w/a'])
    expect(list[0].pinned).toBe(true)
    list = togglePinRecent(list, '/w/c')
    expect(paths(list)).toEqual(['/w/c', '/w/b', '/w/a'])
    expect(list[0].pinned).toBeUndefined()
  })

  it('多个置顶保持相对序、恒排历史前', () => {
    let list: RecentFolder[] = []
    for (const p of ['/w/a', '/w/b', '/w/c']) list = upsertRecent(list, p)
    list = togglePinRecent(list, '/w/b')
    list = togglePinRecent(list, '/w/a')
    expect(paths(list)).toEqual(['/w/b', '/w/a', '/w/c'])
    expect(list.slice(0, 2).every((e) => e.pinned)).toBe(true)
  })

  it(`置顶上限 ${RECENT_PINNED_MAX}：满员后再置顶新项 = no-op`, () => {
    let list: RecentFolder[] = []
    for (let i = 1; i <= RECENT_PINNED_MAX + 2; i++) {
      list = upsertRecent(list, `/w/f${i}`)
      if (i <= RECENT_PINNED_MAX) list = togglePinRecent(list, `/w/f${i}`)
    }
    expect(list.filter((e) => e.pinned)).toHaveLength(RECENT_PINNED_MAX)
    const before = list
    expect(togglePinRecent(list, '/w/f7')).toBe(list)
    expect(before).toBe(list)
  })

  it('置顶不被历史挤出（占独立槽位）', () => {
    let list = togglePinRecent([], '/w/pin')
    for (let i = 1; i <= RECENT_HISTORY_MAX + 3; i++) list = upsertRecent(list, `/w/h${i}`)
    expect(list[0]).toEqual({ path: '/w/pin', pinned: true })
    expect(list).toHaveLength(1 + RECENT_HISTORY_MAX)
  })
})

describe('removeRecent', () => {
  it('移除置顶/历史项即时生效；不存在的路径返回原引用', () => {
    let list: RecentFolder[] = []
    for (const p of ['/w/a', '/w/b', '/w/c']) list = upsertRecent(list, p)
    list = togglePinRecent(list, '/w/c')
    list = removeRecent(list, '/w/a')
    expect(paths(list)).toEqual(['/w/c', '/w/b'])
    const before = list
    expect(removeRecent(list, '/w/ghost')).toBe(before)
    list = removeRecent(list, '/w/C/') // 大小写/分隔符归一命中
    expect(paths(list)).toEqual(['/w/b'])
  })
})

describe('visibleRecents', () => {
  it('显示序 = 置顶组（≤5）+ 历史组（≤10），乱序输入也归位', () => {
    const messy: RecentFolder[] = [
      { path: '/w/h1' },
      { path: '/w/p1', pinned: true },
      { path: '/w/h2' },
      { path: '/w/p2', pinned: true }
    ]
    expect(paths(visibleRecents(messy))).toEqual(['/w/p1', '/w/p2', '/w/h1', '/w/h2'])
  })
})
