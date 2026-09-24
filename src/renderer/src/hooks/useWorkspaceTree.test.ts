import { describe, expect, it } from 'vitest'
import { resolveNewFileTarget } from './useWorkspaceTree'

describe('resolveNewFileTarget (6D D3 priority)', () => {
  it('selected directory wins over everything', () => {
    expect(
      resolveNewFileTarget({
        selection: { path: 'C:\\proj\\docs', isDir: true },
        activePath: 'D:\\other\\a.md',
        root: 'C:\\proj'
      })
    ).toBe('C:\\proj\\docs')
  })

  it('selected file resolves to its directory', () => {
    expect(
      resolveNewFileTarget({
        selection: { path: 'C:\\proj\\docs\\a.md', isDir: false },
        activePath: 'C:\\proj\\b.md',
        root: 'C:\\proj'
      })
    ).toBe('C:\\proj\\docs')
  })

  it('no selection → active document directory', () => {
    expect(
      resolveNewFileTarget({
        selection: null,
        activePath: 'C:\\proj\\docs\\a.md',
        root: 'C:\\proj'
      })
    ).toBe('C:\\proj\\docs')
  })

  it('no selection, no active document → root', () => {
    expect(resolveNewFileTarget({ selection: null, activePath: null, root: 'C:\\proj' })).toBe(
      'C:\\proj'
    )
  })

  it('POSIX paths resolve the same way', () => {
    expect(
      resolveNewFileTarget({
        selection: { path: '/docs/sub/a.md', isDir: false },
        activePath: null,
        root: '/docs'
      })
    ).toBe('/docs/sub')
  })

  it('null when there is no root context at all (6.4a unfiled)', () => {
    expect(resolveNewFileTarget({ selection: null, activePath: null, root: null })).toBe(null)
  })
})
