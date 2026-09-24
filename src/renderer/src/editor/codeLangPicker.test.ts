import { describe, expect, it } from 'vitest'
import {
  buildLangItems,
  filterLangs,
  langDisplayName,
  langPickKey,
  type LangItem
} from './codeLangPicker'

describe('langDisplayName (9.3 readable names)', () => {
  it('maps hljs canonical ids and aliases to display names', () => {
    expect(langDisplayName('typescript')).toBe('TypeScript')
    expect(langDisplayName('ts')).toBe('TypeScript')
    expect(langDisplayName('javascript')).toBe('JavaScript')
  })

  it('unknown ids pass through raw (mermaid is not an hljs language)', () => {
    expect(langDisplayName('mermaid')).toBe('mermaid')
    expect(langDisplayName('notalang')).toBe('notalang')
  })

  it('empty info string reads "text" (CodeBlockWidget label contract)', () => {
    expect(langDisplayName('')).toBe('text')
  })
})

describe('buildLangItems (common first, rest alpha)', () => {
  const all: LangItem[] = [
    { id: 'python', label: 'Python' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'alpha', label: 'Alpha' },
    { id: 'mermaid', label: 'mermaid' }
  ]

  it('orders curated commons first in commonIds order, skipping absent ids', () => {
    const items = buildLangItems(all, ['typescript', 'mermaid', 'missing'])
    expect(items.map((it) => it.id)).toEqual(['typescript', 'mermaid', 'alpha', 'python'])
  })

  it('empty commonIds sorts everything by label', () => {
    const items = buildLangItems(all, [])
    expect(items.map((it) => it.id)).toEqual(['alpha', 'mermaid', 'python', 'typescript'])
  })
})

describe('filterLangs', () => {
  const items: LangItem[] = [
    { id: 'typescript', label: 'TypeScript' },
    { id: 'python', label: 'Python' },
    { id: 'mermaid', label: 'mermaid' }
  ]

  it('blank/whitespace query returns the full list', () => {
    expect(filterLangs(items, '')).toEqual(items)
    expect(filterLangs(items, '   ')).toEqual(items)
  })

  it('matches id and label, case-insensitive substrings', () => {
    expect(filterLangs(items, 'type').map((it) => it.id)).toEqual(['typescript'])
    expect(filterLangs(items, 'script').map((it) => it.id)).toEqual(['typescript'])
    expect(filterLangs(items, 'MERMAID').map((it) => it.id)).toEqual(['mermaid'])
  })

  it('no match → empty', () => {
    expect(filterLangs(items, 'zzz')).toEqual([])
  })
})

describe('langPickKey', () => {
  it('arrows move with clamping at both edges', () => {
    expect(langPickKey('ArrowDown', 0, 3)).toEqual({ kind: 'move', index: 1 })
    expect(langPickKey('ArrowDown', 2, 3)).toEqual({ kind: 'move', index: 2 })
    expect(langPickKey('ArrowUp', 1, 3)).toEqual({ kind: 'move', index: 0 })
    expect(langPickKey('ArrowUp', 0, 3)).toEqual({ kind: 'move', index: 0 })
  })

  it('Enter picks the highlighted index (empty/out-of-range = no-op)', () => {
    expect(langPickKey('Enter', 1, 3)).toEqual({ kind: 'pick', index: 1 })
    expect(langPickKey('Enter', 0, 0)).toBeNull()
    expect(langPickKey('Enter', 5, 3)).toBeNull()
  })

  it('Escape closes; unrelated keys are null (typing falls through)', () => {
    expect(langPickKey('Escape', 0, 3)).toEqual({ kind: 'close' })
    expect(langPickKey('a', 0, 3)).toBeNull()
    expect(langPickKey('Backspace', 0, 3)).toBeNull()
  })
})
