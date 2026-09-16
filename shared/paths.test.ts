import { describe, expect, it } from 'vitest'
import { basenameOf, dirnameOf, isUnderPath, joinPath, rebaseUnder, replaceBasename } from './paths'

describe('dirnameOf', () => {
  it('strips the last segment with either separator', () => {
    expect(dirnameOf('/notes/a.md')).toBe('/notes')
    expect(dirnameOf('C:\\notes\\a.md')).toBe('C:\\notes')
    expect(dirnameOf('/notes/sub/a.md')).toBe('/notes/sub')
  })

  it('ignores trailing separators on the input', () => {
    expect(dirnameOf('/notes/a.md/')).toBe('/notes')
  })
})

describe('basenameOf', () => {
  it('returns the last segment with either separator', () => {
    expect(basenameOf('/notes/a.md')).toBe('a.md')
    expect(basenameOf('C:\\notes\\a.md')).toBe('a.md')
    expect(basenameOf('a.md')).toBe('a.md')
  })
})

describe('joinPath', () => {
  it('joins with the platform separator', () => {
    expect(joinPath('/notes', 'a.md', 'linux')).toBe('/notes/a.md')
    expect(joinPath('C:\\notes', 'a.md', 'win32')).toBe('C:\\notes\\a.md')
  })

  it('strips trailing separators from the dir', () => {
    expect(joinPath('/notes/', 'a.md', 'linux')).toBe('/notes/a.md')
  })
})

describe('replaceBasename', () => {
  it('swaps the last segment keeping the separator', () => {
    expect(replaceBasename('/notes/a.md', 'b.md')).toBe('/notes/b.md')
    expect(replaceBasename('C:\\notes\\a.md', 'b.md')).toBe('C:\\notes\\b.md')
  })
})

describe('isUnderPath', () => {
  it('detects direct and nested children', () => {
    expect(isUnderPath('/notes/sub/a.md', '/notes', 'linux')).toBe(true)
    expect(isUnderPath('/notes/a.md', '/notes', 'linux')).toBe(true)
  })

  it('rejects siblings with a shared prefix and the root itself', () => {
    expect(isUnderPath('/notes2/a.md', '/notes', 'linux')).toBe(false)
    expect(isUnderPath('/notes', '/notes', 'linux')).toBe(false)
  })

  it('uses the windows separator on win32', () => {
    expect(isUnderPath('C:\\notes\\a.md', 'C:\\notes', 'win32')).toBe(true)
    expect(isUnderPath('C:/notes/a.md', 'C:\\notes', 'win32')).toBe(false)
  })
})

describe('rebaseUnder', () => {
  it('moves a child path from one root to another', () => {
    expect(rebaseUnder('/old/sub/a.md', '/old', '/new')).toBe('/new/sub/a.md')
  })
})
