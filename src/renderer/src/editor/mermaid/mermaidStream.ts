import { StreamLanguage, StringStream } from '@codemirror/language'

// ---- step ④: mermaid keyword highlighting (StreamLanguage) ------------------
// Mounted via codeLangs.ts into markdown's `codeLanguages`, so the focused
// source panel AND source mode get token colors; the rendered widget keeps
// its SVG. Token names below are standard @lezer/highlight tag names —
// StreamLanguage's TokenTable resolves them, and syntaxColors.ts's
// HighlightStyle paints them (custom names would silently lose colors).
//
// Deliberately shallow: comments / diagram-keywords / arrow operators /
// strings / hex colors / numbers / brackets / identifiers. No semantics —
// the live preview below the panel is the real feedback loop.

const KEYWORDS = new Set([
  // diagram type headers
  'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram',
  'stateDiagram-v2', 'erDiagram', 'journey', 'gantt', 'pie', 'mindmap',
  'timeline', 'quadrantChart', 'gitGraph', 'requirementDiagram',
  // structure
  'subgraph', 'end', 'direction', 'click', 'style', 'linkStyle', 'classDef',
  'class', 'callback', 'accTitle', 'accDescr',
  // sequence
  'participant', 'actor', 'loop', 'alt', 'else', 'opt', 'par', 'and', 'rect',
  'note', 'over', 'activate', 'deactivate', 'autonumber',
  // state
  'state', 'transition',
  // misc directives
  'theme', 'init', '%%{'
])

const ARROWS = [
  '-->', '---', '-.->', '-.-', '==>', '==', '===', 'o--o', 'x--x', '<-->',
  '--x', 'x--', '--|>', '|--', '->>', '<<->>', '->', '<-', '=>>', '<==>',
  '~~~', 'o--', '--o', 'x--', '--x'
].sort((a, b) => b.length - a.length) // longest match first

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

    // line comments
    if (stream.match('%%')) {
      stream.skipToEnd()
      return 'comment'
    }
    // whitespace
    if (stream.eatSpace()) return null

    // quoted strings (node/edge labels)
    if (stream.match(/^"[^"]*"?/)) return 'string'
    if (stream.match(/^'[^']*'?/)) return 'string'

    // hex colors
    if (stream.match(/^#[0-9a-fA-F]{3,8}\b/)) return 'string.special'

    // arrows / edge operators (longest first)
    if (tryArrow(stream)) return 'operator'

    // numbers
    if (stream.match(/^\d+(\.\d+)?/)) return 'number'

    // brackets and punctuation
    if (stream.match(/^[[\](){}|]/)) return 'bracket'
    if (stream.match(/^[,;:]/)) return 'punctuation'

    // words: keywords or identifiers
    if (stream.match(/^[A-Za-z_][\w-]*/)) {
      const w = stream.current()
      if (KEYWORDS.has(w)) return 'keyword'
      return 'variableName'
    }

    // anything else (unicode labels etc.) — consume one char unstyled
    stream.next()
    return null
  },

  languageData: {
    commentTokens: { line: '%%' }
  }
})
