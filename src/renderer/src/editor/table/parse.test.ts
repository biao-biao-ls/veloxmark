import { describe, expect, it } from 'vitest'
import {
  alignmentOf,
  effectiveAlign,
  formatTable,
  parseTableModel,
  renderInlineCell,
  splitRowWithOffsets,
  unescapeCell
} from './parse'
import { parseTsv } from './ops'

describe('alignmentOf', () => {
  it('maps delimiter cells to alignment strings', () => {
    expect(alignmentOf('---')).toBe('')
    expect(alignmentOf(':---')).toBe('left')
    expect(alignmentOf('---:')).toBe('right')
    expect(alignmentOf(':---:')).toBe('center')
    expect(alignmentOf(' :---: ')).toBe('center')
  })
})

describe('effectiveAlign — GFM 默认左对齐归一（UI-IXD-04 / CHANGE-14）', () => {
  it('`---`（解析为 \'\'）渲染即左对齐，回显归一为 left', () => {
    expect(effectiveAlign('')).toBe('left')
    expect(effectiveAlign('left')).toBe('left')
  })

  it('显式标记原样透传，不改写冒号行语义', () => {
    expect(effectiveAlign('center')).toBe('center')
    expect(effectiveAlign('right')).toBe('right')
  })
})

describe('splitRowWithOffsets', () => {
  it('splits pipes and records absolute trimmed ranges', () => {
    // doc offset of line start = 10
    const line = '| a | bb |'
    const cells = splitRowWithOffsets(line, 10)
    expect(cells.map((c) => c.text)).toEqual(['a', 'bb'])
    // '| a | bb |' — first cell content 'a' at line offset 2 → doc 12
    expect(cells[0].from).toBe(12)
    expect(cells[0].to).toBe(13)
    expect(cells[1].from).toBe(16)
    expect(cells[1].to).toBe(18)
  })

  it('keeps escaped pipes inside a cell', () => {
    const cells = splitRowWithOffsets('| a\\|b | c |', 0)
    expect(cells.map((c) => c.text)).toEqual(['a\\|b', 'c'])
  })

  it('handles rows without outer pipes', () => {
    expect(splitRowWithOffsets('a | b', 0).map((c) => c.text)).toEqual(['a', 'b'])
  })

  it('空白格区间规范化：全空白 raw 不倒置 {from>to}，取 raw 全跨（写回可达）', () => {
    // line = '| a |   |' at 10：中格 raw='   ' 占 [15,18)
    const cells = splitRowWithOffsets('| a |   |', 10)
    expect(cells.map((c) => c.text)).toEqual(['a', ''])
    const blank = cells[1]
    expect(blank.from).toBeLessThanOrEqual(blank.to) // 修前 from=18>to=15 倒置
    expect([blank.from, blank.to]).toEqual([15, 18]) // 规范化为 raw 全跨
  })

  it('空内容格（||）保持空区间 from===to，插入点合法', () => {
    const cells = splitRowWithOffsets('| a ||', 0)
    expect(cells.map((c) => c.text)).toEqual(['a', ''])
    expect(cells[1].from).toBe(cells[1].to)
  })
})

describe('parseTableModel', () => {
  const src = '| Name | Value |\n| --- | :---: |\n| a | 1 |\n| longer | 22 |'
  it('derives colCount, aligns and header/body split', () => {
    const model = parseTableModel(src, 100)
    expect(model.colCount).toBe(2)
    expect(model.aligns).toEqual(['', 'center'])
    // cells[0] = header; delimiter row is metadata, not a UI row.
    expect(model.cells).toHaveLength(3)
    expect(model.cells[0].map((c) => c.text)).toEqual(['Name', 'Value'])
    expect(model.cells[1].map((c) => c.text)).toEqual(['a', '1'])
    expect(model.cells[2].map((c) => c.text)).toEqual(['longer', '22'])
    // Absolute offsets shift with tableFrom.
    expect(model.cells[1][0].from).toBe(100 + src.indexOf(' a ') + 1)
  })
})

describe('renderInlineCell', () => {
  it('renders bold/italic/code and escapes HTML', () => {
    expect(renderInlineCell('**b** and *i* and `c`')).toBe(
      '<strong>b</strong> and <em>i</em> and <code>c</code>'
    )
    expect(renderInlineCell('<script>x</script>')).toBe('&lt;script&gt;x&lt;/script&gt;')
  })

  it('unescapes \\| for display', () => {
    expect(unescapeCell('a\\|b')).toBe('a|b')
    expect(renderInlineCell('a\\|b')).toBe('a|b')
  })
})

describe('formatTable', () => {
  it('pads columns and emits alignment delimiters', () => {
    const out = formatTable(['', 'center'], [
      ['Name', 'Value'],
      ['a', 'b']
    ])
    expect(out.split('\n')).toEqual([
      '| Name | Value |',
      '| ---  | :---: |',
      '| a    | b     |'
    ])
  })
})

describe('parseTsv', () => {
  it('splits tab-separated rows', () => {
    expect(parseTsv('a\tb\nc\td')).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ])
  })
})
