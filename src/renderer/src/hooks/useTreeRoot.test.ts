import { describe, expect, it } from 'vitest'
import { explicitRootAfterActivate, isPathInside, resolveTreeRoot } from './useTreeRoot'

describe('resolveTreeRoot (6B D1 priority)', () => {
  it('explicit pin wins over active dir and recent root', () => {
    expect(
      resolveTreeRoot({ explicitRoot: 'C:\\proj', activePath: 'D:\\docs\\a.md', lastRoot: 'E:\\x' })
    ).toBe('C:\\proj')
  })

  it("active document's directory when nothing is pinned", () => {
    expect(
      resolveTreeRoot({ explicitRoot: null, activePath: 'D:\\docs\\sub\\a.md', lastRoot: 'E:\\x' })
    ).toBe('D:\\docs\\sub')
  })

  it('recent root for untitled / no tabs (AC4 fallback)', () => {
    expect(resolveTreeRoot({ explicitRoot: null, activePath: null, lastRoot: 'E:\\x' })).toBe('E:\\x')
  })

  it('pin survives with no active document', () => {
    expect(resolveTreeRoot({ explicitRoot: 'C:\\proj', activePath: null, lastRoot: 'E:\\x' })).toBe(
      'C:\\proj'
    )
  })

  it('POSIX paths resolve the same way', () => {
    expect(resolveTreeRoot({ explicitRoot: null, activePath: '/docs/sub/a.md', lastRoot: null })).toBe(
      '/docs/sub'
    )
  })

  it('null when there is nothing at all', () => {
    expect(resolveTreeRoot({ explicitRoot: null, activePath: null, lastRoot: null })).toBe(null)
  })
})

describe('isPathInside (boundary-safe)', () => {
  it('root itself counts as inside', () => {
    expect(isPathInside('C:\\proj', 'C:\\proj')).toBe(true)
    expect(isPathInside('C:\\proj\\', 'C:\\proj')).toBe(true)
  })

  it('descendants are inside regardless of separator style', () => {
    expect(isPathInside('C:\\proj', 'C:\\proj\\a.md')).toBe(true)
    expect(isPathInside('C:/proj', 'C:/proj/sub/a.md')).toBe(true)
    expect(isPathInside('C:\\proj\\', 'C:\\proj\\sub\\a.md')).toBe(true)
  })

  it('name-prefix siblings are NOT inside (C:\\proj vs C:\\project)', () => {
    expect(isPathInside('C:\\proj', 'C:\\project\\a.md')).toBe(false)
    expect(isPathInside('/docs', '/docs-backup/a.md')).toBe(false)
  })

  it('unrelated paths are outside', () => {
    expect(isPathInside('C:\\proj', 'D:\\other\\a.md')).toBe(false)
    expect(isPathInside('/docs', '/other/a.md')).toBe(false)
  })
})

describe('explicitRootAfterActivate (6B D1 pin invalidation)', () => {
  it('no pin stays null', () => {
    expect(explicitRootAfterActivate(null, 'C:\\proj\\a.md')).toBe(null)
  })

  it('pin survives with no active document (untitled/welcome)', () => {
    expect(explicitRootAfterActivate('C:\\proj', null)).toBe('C:\\proj')
  })

  it('pin survives while the active document stays inside', () => {
    expect(explicitRootAfterActivate('C:\\proj', 'C:\\proj\\a.md')).toBe('C:\\proj')
    expect(explicitRootAfterActivate('C:\\proj', 'C:\\proj\\sub\\deep\\b.md')).toBe('C:\\proj')
  })

  it('pin dies when activation lands outside (转跟随)', () => {
    expect(explicitRootAfterActivate('C:\\proj', 'D:\\elsewhere\\x.md')).toBe(null)
  })

  it('pin dies on name-prefix siblings too (boundary-safe)', () => {
    expect(explicitRootAfterActivate('C:\\proj', 'C:\\project\\x.md')).toBe(null)
    expect(explicitRootAfterActivate('/docs', '/docs-backup/x.md')).toBe(null)
  })
})
