import { describe, expect, it } from 'vitest'
import { normalizeColWidths } from './store'

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

  it('keeps valid widths and clamps to the 40px drag floor with rounding', () => {
    expect(normalizeColWidths({ '/a.md': { '12': [100.4, 39.2, 8000] } })).toEqual({
      '/a.md': { '12': [100, 40, 8000] }
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
