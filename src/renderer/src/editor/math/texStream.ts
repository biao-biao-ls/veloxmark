import { StreamLanguage, StringStream, type StreamParser } from '@codemirror/language'

// ---- step ④: TeX tokenizer for the focused math panel -----------------------
// `$$…$$` is a regex-scan block (mathScan), not a fenced code — no markdown
// codeLanguages hook — so unlike mermaid this tokenizer is driven as a
// DECORATION pass (P29 pattern) from handlers-math.buildFocusedMathPanel.
// Classes map 1:1 to the .cm-md-tex-* rules syntaxColors.texCss generates.
//
// Shallow on purpose: commands / escapes / comments / numbers / braces /
// operators. The KaTeX preview below the panel is the feedback loop.

export interface TokenRange {
  /** Inclusive start offset, relative to the tokenized string. */
  from: number
  /** Exclusive end offset. */
  to: number
  /** Decoration class, e.g. `cm-md-tex-command`. */
  className: string
}

interface TexState {
  // reserved for future multi-line constructs (\begin…\end); single-line now
}

const CLASS_OF: Record<string, string> = {
  keyword: 'cm-md-tex-command',
  comment: 'cm-md-tex-comment',
  number: 'cm-md-tex-number',
  operator: 'cm-md-tex-op',
  punctuation: 'cm-md-tex-brace',
  bracket: 'cm-md-tex-brace',
  escape: 'cm-md-tex-escape'
}

export const texParser: StreamParser<TexState> = {
  name: 'tex',

  startState(): TexState {
    return {}
  },

  token(stream: StringStream): string | null {
    // escaped backslash / escaped symbol: \\ \{ \} \$ \% \_
    if (stream.match(/^\\[\\{}$%&_]/)) return 'escape'
    // % comment to end of line
    if (stream.match(/^%/)) {
      stream.skipToEnd()
      return 'comment'
    }
    // \command (letters) or \symbol commands (\, \; \! \{ \} …)
    if (stream.match(/^\\[a-zA-Z]+/) || stream.match(/^\\./)) return 'keyword'
    // numbers (incl. decimals)
    if (stream.match(/^\d+(\.\d+)?/)) return 'number'
    // braces / sub-superscript / alignment
    if (stream.match(/^[{}_^&]/)) return 'punctuation'
    if (stream.match(/^[()[\]]/)) return 'bracket'
    // math operators
    if (stream.match(/^[=+*/<>.,;:!|?~-]/)) return 'operator'
    // letters and anything else: consume one char unstyled
    stream.next()
    return null
  }
}

export const texStreamLanguage = StreamLanguage.define(texParser)

/**
 * Pure: token ranges for a TeX source string (decoration-pass driver).
 * Spans with no style are omitted. DOM-less — safe for snapshot states.
 */
export function texTokenRanges(tex: string): TokenRange[] {
  const ranges: TokenRange[] = []
  let offset = 0
  for (const lineText of tex.split('\n')) {
    const stream = new StringStream(lineText, 4, 2)
    const state = texParser.startState ? texParser.startState(2) : {}
    while (!stream.eol()) {
      const start = stream.pos
      const style = texParser.token(stream, state)
      const end = stream.pos
      if (end === start) stream.next() // safety: never spin on zero-progress
      if (style && end > start) {
        const className = CLASS_OF[style]
        if (className) ranges.push({ from: offset + start, to: offset + end, className })
      }
    }
    offset += lineText.length + 1 // + newline
  }
  return ranges
}
