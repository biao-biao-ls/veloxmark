import { StreamLanguage, StringStream, type StreamParser } from '@codemirror/language'


export interface TokenRange {
  from: number
  to: number
  className: string
}

interface TexState {
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
    if (stream.match(/^\\[\\{}$%&_]/)) return 'escape'
    if (stream.match(/^%/)) {
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.match(/^\\[a-zA-Z]+/) || stream.match(/^\\./)) return 'keyword'
    if (stream.match(/^\d+(\.\d+)?/)) return 'number'
    if (stream.match(/^[{}_^&]/)) return 'punctuation'
    if (stream.match(/^[()[\]]/)) return 'bracket'
    if (stream.match(/^[=+*/<>.,;:!|?~-]/)) return 'operator'
    stream.next()
    return null
  }
}

export const texStreamLanguage = StreamLanguage.define(texParser)

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
      if (end === start) stream.next()
      if (style && end > start) {
        const className = CLASS_OF[style]
        if (className) ranges.push({ from: offset + start, to: offset + end, className })
      }
    }
    offset += lineText.length + 1
  }
  return ranges
}
