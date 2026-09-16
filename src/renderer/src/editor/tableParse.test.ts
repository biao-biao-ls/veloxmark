import { describe, expect, it } from 'vitest'
import { alignmentOf, renderInlineCell, splitRow } from './tableParse'

describe('splitRow', () => {
  it('splits cells and strips outer pipes', () => {
    expect(splitRow('| a | b | c |')).toEqual(['a', 'b', 'c'])
    expect(splitRow('a | b | c')).toEqual(['a', 'b', 'c'])
  })

  it('keeps escaped pipes inside a cell', () => {
    expect(splitRow('| a \\| b | c |')).toEqual(['a | b', 'c'])
  })

  it('trims cell whitespace', () => {
    expect(splitRow('|  a  |  b  |')).toEqual(['a', 'b'])
  })
})

describe('alignmentOf', () => {
  it('maps delimiter cells to CSS text-align values', () => {
    expect(alignmentOf('---')).toBe('')
    expect(alignmentOf(':---')).toBe('left')
    expect(alignmentOf('---:')).toBe('right')
    expect(alignmentOf(':---:')).toBe('center')
  })

  it('tolerates surrounding whitespace', () => {
    expect(alignmentOf(' :---: ')).toBe('center')
  })
})

describe('renderInlineCell', () => {
  it('escapes HTML before applying inline markdown', () => {
    expect(renderInlineCell('<b>')).toBe('&lt;b&gt;')
  })

  it('renders bold, italic and code', () => {
    expect(renderInlineCell('**x**')).toBe('<strong>x</strong>')
    expect(renderInlineCell('*x*')).toBe('<em>x</em>')
    expect(renderInlineCell('`x`')).toBe('<code>x</code>')
  })
})
