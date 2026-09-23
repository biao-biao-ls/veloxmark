/** pathUtil boundary cases (task 3.2) — win/posix separators, bare names, roots. */
import { describe, expect, it } from 'vitest'
import { baseDirOf, baseNameOf } from './pathUtil'

describe('baseDirOf', () => {
  it('strips the last segment and separator (posix)', () => {
    expect(baseDirOf('/a/b/c.md')).toBe('/a/b')
    expect(baseDirOf('docs/readme.md')).toBe('docs')
  })

  it('strips the last segment and separator (windows)', () => {
    expect(baseDirOf('C:\\docs\\a.md')).toBe('C:\\docs')
    expect(baseDirOf('D:\\x\\y\\z.txt')).toBe('D:\\x\\y')
  })

  it('handles bare names and empty input', () => {
    expect(baseDirOf('a.md')).toBe('a.md') // no separator → unchanged
    expect(baseDirOf('')).toBe('')
  })
})

describe('baseNameOf', () => {
  it('returns the final segment (posix/windows)', () => {
    expect(baseNameOf('/a/b/c.md')).toBe('c.md')
    expect(baseNameOf('C:\\docs\\a.md')).toBe('a.md')
  })

  it('handles bare names and root-ish input', () => {
    expect(baseNameOf('a.md')).toBe('a.md')
    expect(baseNameOf('/')).toBe('')
    expect(baseNameOf('')).toBe('')
  })
})
