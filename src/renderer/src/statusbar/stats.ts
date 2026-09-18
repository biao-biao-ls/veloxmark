/**
 * P14/P15 document statistics — pure module so vitest (node env) can import
 * it without React/DOM. StatusBar.tsx re-exports these for App/e2e use.
 *
 * Word口径 (Typora-aligned, recorded in P14 docs): CJK char = 1 word;
 * western tokens split on whitespace count 1 each (token must contain a
 * letter or digit — pure punctuation skipped).
 */

export interface DocStats {
  /** 1-based cursor line. */
  line: number
  /** 1-based cursor column (display). */
  col: number
  /** Selection length in characters (0 = caret only). */
  selChars: number
  /** CJK chars + western words. */
  words: number
  /** Document length in characters (CodeMirror doc.length). */
  chars: number
  lines: number
  paragraphs: number
}

export const EMPTY_STATS: DocStats = {
  line: 1,
  col: 1,
  selChars: 0,
  words: 0,
  chars: 0,
  lines: 1,
  paragraphs: 0
}

/** CJK ideographs (incl. extension A + compatibility) — each counts as one word. */
const CJK_RE = /[㐀-䶿一-鿿豈-﫿]/g

/**
 * Full-document statistics. `text` is the CodeMirror doc string.
 * `paragraphs` counts non-empty lines (v1口径; blank-line-separated
 * paragraph grouping is a documented follow-up, not this pipeline's scope).
 */
export function computeDocStats(text: string): Omit<DocStats, 'line' | 'col' | 'selChars'> {
  const lines = text.length === 0 ? 1 : text.split('\n').length
  const paragraphs = text.split('\n').filter((ln) => ln.trim() !== '').length
  const cjk = text.match(CJK_RE)?.length ?? 0
  const rest = text.replace(CJK_RE, ' ')
  const words =
    cjk +
    rest
      .split(/\s+/)
      .filter((tok) => tok.length > 0 && /[\p{L}\p{N}]/u.test(tok)).length
  return { words, chars: text.length, lines, paragraphs }
}
