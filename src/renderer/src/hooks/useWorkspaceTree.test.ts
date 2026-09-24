import { describe, expect, it } from 'vitest'
import { isInvalidTreeName, resolveNewFileTarget, withMarkdownSuffix } from './useWorkspaceTree'

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

describe('withMarkdownSuffix (6G name rules)', () => {
  it('extension-less file name gets .md; explicit extension kept', () => {
    expect(withMarkdownSuffix('note', 'file')).toBe('note.md')
    expect(withMarkdownSuffix('note.txt', 'file')).toBe('note.txt')
    expect(withMarkdownSuffix('archive.tar.gz', 'file')).toBe('archive.tar.gz')
  })

  it('dirs are never suffixed', () => {
    expect(withMarkdownSuffix('docs', 'dir')).toBe('docs')
    expect(withMarkdownSuffix('no.ext', 'dir')).toBe('no.ext')
  })

  it('a trailing dot-segment counts as an extension (matches the old prompt rule)', () => {
    expect(withMarkdownSuffix('v1.2', 'file')).toBe('v1.2')
  })
})

describe('isInvalidTreeName (6G name rules)', () => {
  it('rejects separators and dot-segments', () => {
    expect(isInvalidTreeName('a/b')).toBe(true)
    expect(isInvalidTreeName('a\\b')).toBe(true)
    expect(isInvalidTreeName('.')).toBe(true)
    expect(isInvalidTreeName('..')).toBe(true)
  })

  it('accepts ordinary names (empty is handled as cancel before this)', () => {
    expect(isInvalidTreeName('note')).toBe(false)
    expect(isInvalidTreeName('note.md')).toBe(false)
    expect(isInvalidTreeName('.hidden')).toBe(false)
    expect(isInvalidTreeName('')).toBe(false)
  })
})
