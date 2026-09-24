/**
 * Math regex scanner (8B, extracted from handlers-math.ts) — pure functions,
 * unit-tested. @lezer/markdown has no math extension, so the block/inline
 * shapes live here as the single regex source for both the decoration pass
 * (`collectMathDecos`) and the edit-session exit helpers (`mathEdit.ts`, and
 * later 8C's error jump).
 *
 * ORDER CONTRACT for the decoration pass still lives in handlers-math.ts:
 * scan results must run after the tree pass so code/URL skip-ranges can be
 * applied (this module has no tree access — callers filter).
 */

export type MathMatchKind = 'block' | 'single' | 'inline'

export interface MathMatch {
  kind: MathMatchKind
  /** Absolute offsets including delimiters. */
  start: number
  end: number
  /** Inner TeX, trimmed (MathBlockWidget/preview render contract). */
  content: string
}

/**
 * Scan `text` for $$-blocks (multi-line / single-line) and $inline$ math.
 * `offset` shifts all reported positions (pass the slice origin). Block forms
 * win over inline: matches overlapping an accepted block are dropped, and a
 * single-line $$…$$ inside a multi-line block's span is dropped too.
 */
export function scanMath(text: string, offset = 0): MathMatch[] {
  const out: MathMatch[] = []
  const blockRanges: Array<[number, number]> = []
  const overlapsBlock = (start: number, end: number): boolean =>
    blockRanges.some(([a, b]) => start <= b && end >= a)

  // multi-line: $$ on its own lines
  const multiRe = /^([ \t]*\$\$[ \t]*\n)([\s\S]+?)(\n[ \t]*\$\$[ \t]*)$/gm
  for (const m of text.matchAll(multiRe)) {
    const start = offset + m.index!
    const end = start + m[0].length
    blockRanges.push([start, end])
    out.push({ kind: 'block', start, end, content: m[2].trim() })
  }

  // single-line: $$formula$$
  const singleRe = /^([ \t]*)\$\$([^$\n]+)\$\$[ \t]*$/gm
  for (const m of text.matchAll(singleRe)) {
    const start = offset + m.index!
    const end = start + m[0].length
    if (overlapsBlock(start, end)) continue
    blockRanges.push([start, end])
    out.push({ kind: 'single', start, end, content: m[2].trim() })
  }

  // inline: $tex$ — content has no leading/trailing space (a `$`-adjacent
  // space marks literal currency), no $$, and not inside an accepted block.
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

/**
 * Block-kind match containing `pos` (delimiters inclusive). Inline math is
 * NOT a block — Escape/chip exit never applies there (P09 mark rules own it).
 */
export function findMathBlockAt(text: string, pos: number): MathMatch | null {
  for (const m of scanMath(text)) {
    if (m.kind === 'inline') continue
    if (pos >= m.start && pos <= m.end) return m
  }
  return null
}
