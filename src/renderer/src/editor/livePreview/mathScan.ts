
export type MathMatchKind = 'block' | 'single' | 'inline'

export interface MathMatch {
  kind: MathMatchKind
  start: number
  end: number
  content: string
}

export function scanMath(text: string, offset = 0): MathMatch[] {
  const out: MathMatch[] = []
  const blockRanges: Array<[number, number]> = []
  const overlapsBlock = (start: number, end: number): boolean =>
    blockRanges.some(([a, b]) => start <= b && end >= a)

  const multiRe = /^([ \t]*\$\$[ \t]*\n)([\s\S]+?)(\n[ \t]*\$\$[ \t]*)$/gm
  for (const m of text.matchAll(multiRe)) {
    const start = offset + m.index!
    const end = start + m[0].length
    blockRanges.push([start, end])
    out.push({ kind: 'block', start, end, content: m[2].trim() })
  }

  const singleRe = /^([ \t]*)\$\$([^$\n]+)\$\$[ \t]*$/gm
  for (const m of text.matchAll(singleRe)) {
    const start = offset + m.index!
    const end = start + m[0].length
    if (overlapsBlock(start, end)) continue
    blockRanges.push([start, end])
    out.push({ kind: 'single', start, end, content: m[2].trim() })
  }

  const inlineRe = /\$([^$\n]+?)\$/g
  for (const m of text.matchAll(inlineRe)) {
    const start = offset + m.index!
    const end = start + m[0].length
    const content = m[1]
    if (content !== content.trim()) continue
    if (content.includes('$$')) continue
    if (overlapsBlock(start, end)) continue
    out.push({ kind: 'inline', start, end, content })
  }
  return out
}

export function findMathBlockAt(text: string, pos: number): MathMatch | null {
  for (const m of scanMath(text)) {
    if (m.kind === 'inline') continue
    if (pos >= m.start && pos <= m.end) return m
  }
  return null
}
