import { describe, expect, it } from 'vitest'
import { normalizeColWidths, normalizeSession } from './store'

// ---- 7F: tableColWidths storage sanitizer ------------------------------------

describe('normalizeColWidths', () => {
  it('narrows the nested shape and drops non-object garbage', () => {
    expect(normalizeColWidths(undefined)).toEqual({})
    expect(normalizeColWidths(null)).toEqual({})
    expect(normalizeColWidths('x')).toEqual({})
    expect(normalizeColWidths(42)).toEqual({})
    expect(normalizeColWidths({ '/a.md': 'not-an-object' })).toEqual({})
    expect(normalizeColWidths({ '/a.md': { '0': 'nope' } })).toEqual({})
    expect(normalizeColWidths({ '/a.md': { '0': [] } })).toEqual({})
  })

  it('keeps valid widths and clamps to the MIN_COL_WIDTH drag floor with rounding', () => {
    // 扩展-4 (40/48 双最小宽地板收敛): floor = MIN_COL_WIDTH (colWidth.ts 单一声明点).
    expect(normalizeColWidths({ '/a.md': { '12': [100.4, 39.2, 8000] } })).toEqual({
      '/a.md': { '12': [100, 48, 8000] }
    })
    // 40–47px 存量宽同样抬到最小宽。
    expect(normalizeColWidths({ '/a.md': { '12': [45] } })).toEqual({
      '/a.md': { '12': [48] }
    })
  })

  it('collapses invalid slots to 0 without shifting later columns', () => {
    const out = normalizeColWidths({ '/a.md': { '0': [100, NaN, -5, 200] } })
    expect(out).toEqual({ '/a.md': { '0': [100, 0, 0, 200] } })
  })

  it('drops all-invalid tables and empty paths', () => {
    expect(normalizeColWidths({ '/a.md': { '0': [0, -1, NaN] } })).toEqual({})
    expect(normalizeColWidths({ '/a.md': {}, '/b.md': { '0': [120] } })).toEqual({
      '/b.md': { '0': [120] }
    })
  })

  it('normalizes a full multi-file record (AC2 storage boundary)', () => {
    const out = normalizeColWidths({
      '/docs/a.md': { '0': [120, 80], '200': [90.6] },
      '/docs/b.md': { '16': [70] },
      '': { '0': [50] }
    })
    // Empty-string path keys drop (untitled docs never persist, AC4).
    expect(out).toEqual({
      '/docs/a.md': { '0': [120, 80], '200': [91] },
      '/docs/b.md': { '16': [70] }
    })
  })
})

// ---- Q10 / IT-03 FE-02: quoteFolds storage sanitizer --------------------------

describe('normalizeSession quoteFolds', () => {
  it('passes a valid quoteFolds map through untouched', () => {
    const out = normalizeSession({
      quoteFolds: { '/docs/a.md': ['q:12:3', 'q:40:8'], '/docs/b.md': ['q:1:1'] }
    })
    expect(out.quoteFolds).toEqual({
      '/docs/a.md': ['q:12:3', 'q:40:8'],
      '/docs/b.md': ['q:1:1']
    })
  })

  it('defaults quoteFolds to {} when the key is missing (old session JSON)', () => {
    expect(normalizeSession({}).quoteFolds).toEqual({})
    expect(normalizeSession(null).quoteFolds).toEqual({})
    expect(normalizeSession(undefined).quoteFolds).toEqual({})
  })

  it('discards a non-object quoteFolds value without throwing', () => {
    expect(normalizeSession({ quoteFolds: 'x' }).quoteFolds).toEqual({})
    expect(normalizeSession({ quoteFolds: 42 }).quoteFolds).toEqual({})
    expect(normalizeSession({ quoteFolds: null }).quoteFolds).toEqual({})
    expect(normalizeSession({ quoteFolds: [] }).quoteFolds).toEqual({})
    expect(normalizeSession({ quoteFolds: true }).quoteFolds).toEqual({})
  })

  it('drops entries whose value is not an array', () => {
    const out = normalizeSession({
      quoteFolds: { '/a.md': 'bad', '/b.md': 7, '/c.md': { ids: [] }, '/d.md': ['q:1:1'] }
    })
    expect(out.quoteFolds).toEqual({ '/d.md': ['q:1:1'] })
  })

  it('drops non-string elements and prunes entries that filter empty', () => {
    const out = normalizeSession({
      quoteFolds: { '/a.md': [1, {}, null, 'q:1:1', true], '/b.md': [1, {}], '/c.md': [] }
    })
    expect(out.quoteFolds).toEqual({ '/a.md': ['q:1:1'] })
  })

  it('drops empty-string file keys', () => {
    const out = normalizeSession({
      quoteFolds: { '': ['q:1:1'], '/a.md': ['q:2:2'] }
    })
    expect(out.quoteFolds).toEqual({ '/a.md': ['q:2:2'] })
  })

  it('drops every polluted entry of the AC-NF-14 pollution sample', () => {
    // Stage-2 manual pollution: {"a.md":"bad","b.md":[1,{}],"": ["x"]}
    const out = normalizeSession({
      quoteFolds: { 'a.md': 'bad', 'b.md': [1, {}], '': ['x'] }
    })
    expect(out.quoteFolds).toEqual({})
  })

  it('never throws on arbitrary garbage (AC-NF-14-3)', () => {
    expect(() => normalizeSession({ quoteFolds: Symbol('x') })).not.toThrow()
    expect(() => normalizeSession('x')).not.toThrow()
    expect(() => normalizeSession(42)).not.toThrow()
    expect(() =>
      normalizeSession({ quoteFolds: { '/a.md': [{}, [2]] }, headingFolds: 'nope' })
    ).not.toThrow()
  })

  it('leaves every other session key semantically unchanged', () => {
    const out = normalizeSession({
      sidebarVisible: true,
      sidebarMode: 'files',
      sidebarWidth: 300,
      lastFilePath: '/docs/a.md',
      lastFolderPath: '/docs',
      recentFiles: ['/docs/a.md', '/docs/b.md'],
      lastCursor: 12,
      headingFolds: { '/docs/a.md': ['2:Hi'] },
      tableColWidths: { '/docs/a.md': { '0': [120, 80] } },
      mermaidPreviewPin: true,
      openTabs: ['/docs/a.md'],
      activePath: '/docs/a.md',
      quoteFolds: { 'a.md': 'bad' }
    })
    expect(out.quoteFolds).toEqual({})
    expect(out.headingFolds).toEqual({ '/docs/a.md': ['2:Hi'] })
    expect(out.tableColWidths).toEqual({ '/docs/a.md': { '0': [120, 80] } })
    expect(out.sidebarVisible).toBe(true)
    expect(out.sidebarMode).toBe('files')
    expect(out.sidebarWidth).toBe(300)
    expect(out.lastFilePath).toBe('/docs/a.md')
    expect(out.lastFolderPath).toBe('/docs')
    expect(out.recentFiles).toEqual(['/docs/a.md', '/docs/b.md'])
    expect(out.lastCursor).toBe(12)
    expect(out.mermaidPreviewPin).toBe(true)
    expect(out.openTabs).toEqual(['/docs/a.md'])
    expect(out.activePath).toBe('/docs/a.md')
  })
})

// ---- Q10 / IT-02 FE-09: headingFolds sanitizer + 折叠记忆口径统一 ----------

describe('normalizeSession headingFolds', () => {
  it('passes a valid headingFolds map through untouched', () => {
    const out = normalizeSession({
      headingFolds: { '/docs/a.md': ['2:第一章', '3:小节'], '/docs/b.md': ['1:标题'] }
    })
    expect(out.headingFolds).toEqual({
      '/docs/a.md': ['2:第一章', '3:小节'],
      '/docs/b.md': ['1:标题']
    })
  })

  it('defaults headingFolds to {} when the key is missing (AC-NF-14 old session JSON)', () => {
    expect(normalizeSession({}).headingFolds).toEqual({})
    expect(normalizeSession(null).headingFolds).toEqual({})
    expect(normalizeSession(undefined).headingFolds).toEqual({})
  })

  it('discards a non-object headingFolds value without throwing (AC-NF-14)', () => {
    expect(normalizeSession({ headingFolds: 'x' }).headingFolds).toEqual({})
    expect(normalizeSession({ headingFolds: 123 }).headingFolds).toEqual({})
    expect(normalizeSession({ headingFolds: null }).headingFolds).toEqual({})
    expect(normalizeSession({ headingFolds: [] }).headingFolds).toEqual({})
    expect(normalizeSession({ headingFolds: true }).headingFolds).toEqual({})
  })

  it('drops entries whose value is not a string[] (脏数据丢弃不抛错)', () => {
    const out = normalizeSession({
      headingFolds: { '/a.md': 'bad', '/b.md': 7, '/c.md': { ids: [] }, '/d.md': ['2:Hi'] }
    })
    expect(out.headingFolds).toEqual({ '/d.md': ['2:Hi'] })
  })

  it('drops non-string and empty-string elements (两族清洗规则统一)', () => {
    for (const key of ['headingFolds', 'quoteFolds'] as const) {
      const out = normalizeSession({ [key]: { '/a.md': [123, null, '', '2:Hi', {}, 'q:1:x'] } })
      expect(out[key]).toEqual({ '/a.md': ['2:Hi', 'q:1:x'] })
    }
  })

  it('drops empty-string file keys and entries that filter empty', () => {
    const out = normalizeSession({
      headingFolds: { '': ['2:Hi'], '/a.md': [123, null], '/b.md': ['3:小节'] }
    })
    expect(out.headingFolds).toEqual({ '/b.md': ['3:小节'] })
  })

  it('drops every type-junk entry of the AC-NF-14 pollution sample', () => {
    // Manual pollution: {"a.md":"bad","b.md":[1,{},""],"":["x"]} + one legal entry.
    // (Ghost keys like "2:ghost" are legal strings here — dropped by the
    // useFoldSync live-key filter at write-back/restore, not by the sanitizer.)
    const out = normalizeSession({
      headingFolds: { 'a.md': 'bad', 'b.md': [1, {}, ''], '': ['x'], '/ok.md': ['2:第一章'] }
    })
    expect(out.headingFolds).toEqual({ '/ok.md': ['2:第一章'] })
  })

  it('never throws on arbitrary garbage alongside quoteFolds (AC-NF-14-3)', () => {
    expect(() => normalizeSession({ headingFolds: Symbol('x') })).not.toThrow()
    expect(() =>
      normalizeSession({ headingFolds: { '/a.md': [{}, [2], Symbol('y')] }, quoteFolds: 'nope' })
    ).not.toThrow()
    expect(normalizeSession({ headingFolds: { '/a.md': [{}, [2], Symbol('y')] } }).headingFolds).toEqual(
      {}
    )
  })
})

describe('fold-memory storage shape (AC-RULE-14 / Q10 零 schema 变更)', () => {
  it('pins the SessionState key set — no parallel fold keys may appear', () => {
    expect(Object.keys(normalizeSession({})).sort()).toEqual(
      [
        'activePath',
        'headingFolds',
        'lastCursor',
        'lastFilePath',
        'lastFolderPath',
        'mermaidPreviewPin',
        'openTabs',
        'quoteFolds',
        'recentFiles',
        'sidebarMode',
        'sidebarVisible',
        'sidebarWidth',
        'tableColWidths'
      ].sort()
    )
  })

  it('types headingFolds as Record<string, string[]> at runtime', () => {
    const out = normalizeSession({
      headingFolds: { '/docs/a.md': ['2:第一章'], '/docs/b.md': [] },
      quoteFolds: { '/docs/a.md': ['q:1:行'] }
    })
    for (const family of [out.headingFolds, out.quoteFolds]) {
      for (const [path, ids] of Object.entries(family)) {
        expect(typeof path).toBe('string')
        expect(Array.isArray(ids)).toBe(true)
        for (const id of ids) expect(typeof id).toBe('string')
      }
    }
  })

  it('survives the localStorage serialize→parse→normalize round-trip (跨重启读路径)', () => {
    const written = {
      ...normalizeSession({}),
      headingFolds: { '/docs/a.md': ['2:第一章', '3:小节'] },
      quoteFolds: { '/docs/a.md': ['q:1:首行'] }
    }
    const stored = JSON.stringify(written) // patchSession write shape
    const reloaded = normalizeSession(JSON.parse(stored)) // restart read shape
    expect(reloaded.headingFolds).toEqual({ '/docs/a.md': ['2:第一章', '3:小节'] })
    expect(reloaded.quoteFolds).toEqual({ '/docs/a.md': ['q:1:首行'] })
  })
})
