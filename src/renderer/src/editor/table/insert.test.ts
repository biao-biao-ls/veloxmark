import { describe, expect, it } from 'vitest'
import { buildTableMarkdown, convertSelectionToTable } from './insert'
import { parseDelimited, sniffDelimiter } from './ops'

describe('P22 buildTableMarkdown', () => {
  it('insert default 2×3 center: header 列1..3, :---: ×3, empty cell row', () => {
    const md = buildTableMarkdown(2, 3, 'center', true)
    const lines = md.split('\n')
    expect(lines[0]).toMatch(/^\|\s*列1\s*\|\s*列2\s*\|\s*列3\s*\|$/)
    expect((lines[1].match(/:---:/g) || []).length).toBe(3)
    expect(lines[2]).toMatch(/^\| +\| +\| +\|$/)
  })

  it('headerPrefix false → empty header cells', () => {
    const md = buildTableMarkdown(2, 2, '', false)
    const lines = md.split('\n')
    expect(lines[0].replace(/\s/g, '')).toBe('|||')
  })

  it('minimum size clamps to 1×1', () => {
    const md = buildTableMarkdown(0, 0, 'left', true)
    const lines = md.split('\n')
    expect(lines[0]).toContain('列1')
    expect(lines[1]).toContain(':---')
  })
})

describe('P22 parseDelimited + sniffDelimiter', () => {
  const tsv = '名称\t数量\n苹果\t3\n"香蕉\t大"\t5'
  const csv = '名称,数量\n苹果,3'
  const pipe = '| 名称 | 数量 |\n| 苹果 | 3 |'
  const spaces = '名称    数量\n苹果    3'

  it('sniff default tab / comma / pipe / spaces', () => {
    expect(sniffDelimiter(tsv)).toBe('tab')
    expect(sniffDelimiter(csv)).toBe('comma')
    expect(sniffDelimiter(pipe)).toBe('pipe')
    expect(sniffDelimiter(spaces)).toBe('spaces')
  })

  it('parseDelimited tab keeps quote-aware P10 behavior', () => {
    const grid = parseDelimited(tsv, 'tab')
    expect(grid).toEqual([
      ['名称', '数量'],
      ['苹果', '3'],
      ['香蕉\t大', '5']
    ])
  })

  it('parseDelimited comma / pipe / spaces', () => {
    expect(parseDelimited(csv, 'comma')).toEqual([
      ['名称', '数量'],
      ['苹果', '3']
    ])
    expect(parseDelimited(pipe, 'pipe')).toEqual([
      ['名称', '数量'],
      ['苹果', '3']
    ])
    expect(parseDelimited(spaces, 'spaces')).toEqual([
      ['名称', '数量'],
      ['苹果', '3']
    ])
  })
})

describe('P22 convertSelectionToTable', () => {
  it('TSV 3-line convert → 3-column table, first line becomes header', () => {
    const md = convertSelectionToTable('名称\t数量\t单价\n苹果\t3\t5.5\n香蕉\t2\t3', 'tab')
    const lines = md.split('\n')
    expect(lines[0].replace(/\s/g, '')).toBe('|名称|数量|单价|')
    expect(lines[1]).toContain('|')
    expect(lines[2].replace(/\s/g, '')).toBe('|苹果|3|5.5|')
  })

  it('ragged rows pad to max columns', () => {
    const md = convertSelectionToTable('a,b\n1,2,3', 'comma')
    const lines = md.split('\n')
    expect(lines[0].replace(/\s/g, '')).toBe('|a|b||')
    expect(lines[2].replace(/\s/g, '')).toBe('|1|2|3|')
  })
})
