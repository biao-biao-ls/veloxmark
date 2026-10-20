
export interface DocStats {
  line: number
  col: number
  selChars: number
  words: number
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

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g

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
