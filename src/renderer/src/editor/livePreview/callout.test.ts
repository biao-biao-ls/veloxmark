import { describe, expect, it } from 'vitest'
import { DEFAULT_CALLOUT_TITLES, parseCalloutMarker } from './callout'

describe('parseCalloutMarker', () => {
  it('parses bare [!NOTE] with no title and no fold', () => {
    const m = parseCalloutMarker('>[!NOTE]')
    expect(m).not.toBeNull()
    expect(m!.type).toBe('note')
    expect(m!.title).toBe('')
    expect(m!.fold).toBe('none')
    expect(m!.unknown).toBe(false)
    expect(m!.rawType).toBe('NOTE')
    expect(m!.markerText).toBe('[!NOTE]')
  })

  it('parses custom title + optional space after > (case-insensitive TYPE)', () => {
    const m = parseCalloutMarker('> [!warning] 磁盘不足')
    expect(m!.type).toBe('warning')
    expect(m!.title).toBe('磁盘不足')
    expect(m!.unknown).toBe(false)
  })

  it('parses default-closed fold marker', () => {
    const m = parseCalloutMarker('> [!NOTE]-')
    expect(m!.fold).toBe('closed')
    expect(m!.title).toBe('')
  })

  it('parses default-open fold marker with title', () => {
    const m = parseCalloutMarker('> [!NOTE]+ 展开标题')
    expect(m!.fold).toBe('open')
    expect(m!.title).toBe('展开标题')
  })

  it('unknown TYPE → note styling; custom title kept (acceptance ③)', () => {
    const m = parseCalloutMarker('> [!FOO] x')
    expect(m!.type).toBe('note')
    expect(m!.unknown).toBe(true)
    expect(m!.title).toBe('x')
    expect(m!.rawType).toBe('FOO')
  })

  it('unknown TYPE keeps empty source title — display falls back to rawType', () => {
    const m = parseCalloutMarker('> [!FOO]')
    expect(m!.title).toBe('')
    expect(m!.unknown).toBe(true)
    expect(m!.rawType).toBe('FOO')
  })

  it('plain quotes are not callouts', () => {
    expect(parseCalloutMarker('> 普通引用')).toBeNull()
    expect(parseCalloutMarker('> quote with words')).toBeNull()
  })

  it('marker must sit at the start of the quoted line', () => {
    expect(parseCalloutMarker('> text before [!NOTE] later')).toBeNull()
  })

  it('accepts extra spaces after > and around TYPE', () => {
    const m = parseCalloutMarker('>  [! important ]  ')
    expect(m).not.toBeNull()
    expect(m!.type).toBe('important')
  })

  it('covers all 8 known types', () => {
    for (const type of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION', 'INFO', 'SUCCESS', 'DANGER']) {
      const m = parseCalloutMarker(`> [!${type}] t`)
      expect(m, type).not.toBeNull()
      expect(m!.type).toBe(type.toLowerCase())
      expect(m!.unknown).toBe(false)
      expect(m!.title).toBe('t')
    }
  })

  it('markerStart/End span the marker (+ fold char + one space)', () => {
    const line = '> [!NOTE]- body here'
    const m = parseCalloutMarker(line)!
    expect(line.slice(m.markerStart, m.markerEnd)).toBe('[!NOTE]- ')
    expect(m.markerText).toBe('[!NOTE]-')
  })

  it('zh default titles are the documented names', () => {
    expect(DEFAULT_CALLOUT_TITLES.zh).toEqual({
      note: '注意',
      tip: '提示',
      important: '重要',
      warning: '警告',
      caution: '谨慎',
      info: '信息',
      success: '成功',
      danger: '危险'
    })
  })
})
