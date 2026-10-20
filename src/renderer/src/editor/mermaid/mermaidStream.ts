import { StreamLanguage, StringStream } from '@codemirror/language'


const KEYWORDS = new Set([
  'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram',
  'stateDiagram-v2', 'erDiagram', 'journey', 'gantt', 'pie', 'mindmap',
  'timeline', 'quadrantChart', 'gitGraph', 'requirementDiagram',
  'subgraph', 'end', 'direction', 'click', 'style', 'linkStyle', 'classDef',
  'class', 'callback', 'accTitle', 'accDescr',
  'participant', 'actor', 'loop', 'alt', 'else', 'opt', 'par', 'and', 'rect',
  'note', 'over', 'activate', 'deactivate', 'autonumber',
  'state', 'transition',
  'theme', 'init', '%%{'
])

const ARROWS = [
  '-->', '---', '-.->', '-.-', '==>', '==', '===', 'o--o', 'x--x', '<-->',
  '--x', 'x--', '--|>', '|--', '->>', '<<->>', '->', '<-', '=>>', '<==>',
  '~~~', 'o--', '--o', 'x--', '--x'
].sort((a, b) => b.length - a.length)

function tryArrow(stream: StringStream): boolean {
  for (const a of ARROWS) {
    if (stream.match(a)) return true
  }
  return false
}

export const mermaidStreamLanguage = StreamLanguage.define({
  name: 'mermaid',

  startState() {
    return { inLabel: false }
  },

  token(stream: StringStream, state: { inLabel: boolean }): string | null {
    if (stream.sol()) state.inLabel = false

    if (stream.match('%%')) {
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.eatSpace()) return null

    if (stream.match(/^"[^"]*"?/)) return 'string'
    if (stream.match(/^'[^']*'?/)) return 'string'

    if (stream.match(/^#[0-9a-fA-F]{3,8}\b/)) return 'string.special'

    if (tryArrow(stream)) return 'operator'

    if (stream.match(/^\d+(\.\d+)?/)) return 'number'

    if (stream.match(/^[[\](){}|]/)) return 'bracket'
    if (stream.match(/^[,;:]/)) return 'punctuation'

    if (stream.match(/^[A-Za-z_][\w-]*/)) {
      const w = stream.current()
      if (KEYWORDS.has(w)) return 'keyword'
      return 'variableName'
    }

    stream.next()
    return null
  },

  languageData: {
    commentTokens: { line: '%%' }
  }
})
