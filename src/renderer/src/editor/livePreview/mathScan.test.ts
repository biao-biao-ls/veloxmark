import { describe, expect, it } from 'vitest'
import { findMathBlockAt, scanMath } from './mathScan'

describe('scanMath', () => {
  it('scans multi-line $$ blocks with trimmed content', () => {
    const text = 'before\n$$\n x = y \n$$\nafter'
    const ms = scanMath(text)
    expect(ms).toHaveLength(1)
    expect(ms[0].kind).toBe('block')
    expect(ms[0].content).toBe('x = y')
    expect(text.slice(ms[0].start, ms[0].end)).toBe('$$\n x = y \n$$')
  })

  it('scans single-line $$…$$ as single', () => {
    const ms = scanMath('$$a+b$$')
    expect(ms).toHaveLength(1)
    expect(ms[0]).toMatchObject({ kind: 'single', content: 'a+b' })
  })

  it('drops a single-line match inside a multi-line block span', () => {
    const ms = scanMath('$$\n$$x$$\n$$')
    // only the multi-line block survives (inner $$x$$ is its content line)
    expect(ms.filter((m) => m.kind !== 'inline')).toHaveLength(1)
    expect(ms[0].kind).toBe('block')
    expect(ms[0].content).toBe('$$x$$')
  })

  it('scans inline $…$ with the pre-8B matchAll semantics (parity)', () => {
    // Behavior-preserving extraction: matchAll advances lastIndex past
    // REJECTED matches too, so (a) mid-line $$z$$ leaks an inner $z$ (single
    // blocks are line-anchored only), and (b) a rejected `$ $` can shadow a
    // following real `$w$`. Both quirks predate 8B — documented as-is.
    const ms = scanMath('a $x$ b $ y $ c $$z$$ $w$')
    const inline = ms.filter((m) => m.kind === 'inline')
    expect(inline.map((m) => m.content)).toEqual(['x', 'z'])
  })

  it('keeps inline out of block spans', () => {
    const ms = scanMath('$$\n$y$\n$$')
    expect(ms.some((m) => m.kind === 'inline')).toBe(false)
  })

  it('applies the offset to all positions', () => {
    const ms = scanMath('$$a$$', 10)
    expect(ms[0].start).toBe(10)
    expect(ms[0].end).toBe(15)
  })
})

describe('findMathBlockAt', () => {
  const text = 'pre\n$$\nx\n$$\nmid\n$$y$$\nend'

  it('finds the containing block (delimiters inclusive)', () => {
    const multi = findMathBlockAt(text, text.indexOf('x'))
    expect(multi?.kind).toBe('block')
    const atOpen = findMathBlockAt(text, text.indexOf('$$\nx'))
    expect(atOpen?.kind).toBe('block')
    const single = findMathBlockAt(text, text.indexOf('y'))
    expect(single?.kind).toBe('single')
  })

  it('returns null outside blocks and never for inline math', () => {
    expect(findMathBlockAt(text, 0)).toBeNull()
    expect(findMathBlockAt(text, text.indexOf('mid'))).toBeNull()
    expect(findMathBlockAt('a $x$ b', 3)).toBeNull()
  })
})
