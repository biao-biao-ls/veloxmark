/** pathUtil boundary cases (task 3.2) — win/posix separators, bare names, roots. */
import { describe, expect, it } from 'vitest'
import { baseDirOf, baseNameOf, pathKey, pathsEqual } from './pathUtil'

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

describe('pathKey', () => {
  it('collapses both separators to `/` (canonical compare key)', () => {
    expect(pathKey('D:\\w\\docs\\a.md')).toBe('D:/w/docs/a.md')
    expect(pathKey('D:/w/docs/a.md')).toBe('D:/w/docs/a.md')
    expect(pathKey('a.md')).toBe('a.md')
    expect(pathKey('')).toBe('')
  })
})

describe('pathsEqual', () => {
  it('is separator-insensitive (win scan `\` vs open-path `/`)', () => {
    expect(pathsEqual('D:\\w\\intro.md', 'D:/w/intro.md')).toBe(true)
    expect(pathsEqual('D:/w/intro.md', 'D:\\w\\intro.md')).toBe(true)
    expect(pathsEqual('D:\\w\\intro.md', 'D:\\w\\intro.md')).toBe(true)
  })

  it('still distinguishes different basenames/dirs', () => {
    expect(pathsEqual('D:\\w\\intro.md', 'D:\\w\\root.md')).toBe(false)
    expect(pathsEqual('D:\\w\\intro.md', 'D:\\w\\intro.md.bak')).toBe(false)
    expect(pathsEqual('D:\\w\\intro.md', '')).toBe(false)
  })
})
