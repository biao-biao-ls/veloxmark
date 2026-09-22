import { describe, expect, it } from 'vitest'
import { faultNextFormatOnce, formatMarkdown } from './format'

const fmt = (s: string): string => formatMarkdown(s).text

describe('P23 formatMarkdown rules', () => {
  it('trailing whitespace stripped; exactly-2 kept; 3+ compressed to 2', () => {
    expect(fmt('hello   \nworld  \nplain \n')).toBe('hello  \nworld  \nplain\n')
  })

  it('ATX normalize: missing space, multi space, closing sequence', () => {
    expect(fmt('#标题\n##   多空格标题   \n### 标题 ###\n')).toBe(
      '# 标题\n\n## 多空格标题\n\n### 标题\n'
    )
  })

  it('blank line inserted before heading / fence / table when missing', () => {
    const input = ['前段', '# 标题', '正文', '```js', 'code', '```', 'para', '| a |', '| - |', '| 1 |', ''].join(
      '\n'
    )
    const out = fmt(input)
    expect(out).toContain('前段\n\n# 标题')
    expect(out).toContain('正文\n\n```js')
    expect(out).toMatch(/para\n\n\|\s*a\s*\|/)
  })

  it('≥2 blank lines compressed to 1', () => {
    expect(fmt('a\n\n\n\n\nb\n')).toBe('a\n\nb\n')
  })

  it('unordered markers unified to - (hr untouched)', () => {
    expect(fmt('* a\n+ b\n- c\n* * *\n')).toBe('- a\n- b\n- c\n* * *\n')
  })

  it('ordered renumber 3. 7. 1. → 1. 2. 3.; nested lists independent', () => {
    const input = ['3. first', '7. second', '1. third', '', '1. outer', '   9. inner', '   3. inner2', '2. outer2', ''].join('\n')
    const out = fmt(input)
    // blank lines do not split a CommonMark list — counters continue (4, 5)
    expect(out).toBe('1. first\n2. second\n3. third\n\n4. outer\n   1. inner\n   2. inner2\n5. outer2\n')
  })

  it('skewed table reformatted; cell contents preserved', () => {
    const input = ['| 名称 | 数量 |', '|---|--:|', '|苹果|3|', ''].join('\n')
    const out = fmt(input)
    const lines = out.split('\n')
    expect(lines[0]).toMatch(/^\|\s*名称\s*\|\s*数量\s*\|$/)
    expect(lines[1]).toContain('---')
    expect(lines[1]).toContain('---:')
    expect(lines[2]).toContain('苹果')
    expect(lines[2]).toContain('3')
  })

  it('dirty table + trailing spaces inside an unclosed fence stay untouched', () => {
    const input = ['```', '|a|b|', '|---|', '|1|2|   ', 'fence body   ', ''].join('\n')
    const res = formatMarkdown(input)
    // wave⑥-6 F1: structured warnings — line + kind, i18n resolved at render.
    expect(res.warnings.length).toBe(1)
    expect(res.warnings[0]).toEqual({ line: 1, kind: 'unclosed-fence' })
    expect(res.text).toContain('|a|b|\n|---|\n|1|2|   \nfence body   ')
  })

  it('wave⑥-6 F3: fault seam throws once, then formatting resumes', () => {
    faultNextFormatOnce()
    expect(() => formatMarkdown('* a\n')).toThrow(/fault injection/)
    expect(formatMarkdown('* a\n').text).toBe('- a\n')
  })

  it('fence content preserved; open-fence language trimmed', () => {
    const input = ['```  js  ', 'let x = 1   ', '```', ''].join('\n')
    expect(fmt(input)).toBe('```js\nlet x = 1   \n```\n')
  })

  it('quote marker normalized to single space', () => {
    expect(fmt('>引用\n>  双空格\n>\n> 已有\n')).toBe('> 引用\n> 双空格\n>\n> 已有\n')
  })

  it('file ends with exactly one newline; empty input stays empty', () => {
    expect(fmt('正文\n\n\n')).toBe('正文\n')
    expect(fmt('')).toBe('')
  })

  it('fence body not renumbered / marker-unified', () => {
    const input = ['```md', '* a', '3. b', '```', '', '* c', ''].join('\n')
    const out = fmt(input)
    expect(out).toBe('```md\n* a\n3. b\n```\n\n- c\n')
  })
})
