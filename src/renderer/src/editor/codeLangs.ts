import { LanguageDescription, LanguageSupport } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { mermaidStreamLanguage } from './mermaid/mermaidStream'

// ---- step ③: fenced-code mixed parsing (markdown `codeLanguages`) -----------
// `markdown({ codeLanguages })` mounts each fence's language parser as an
// overlay on CodeText (@lezer/markdown parseCode) — the edit state then gets
// incremental, tree-based highlighting via the theme's HighlightStyle
// (syntaxColors.ts values), replacing the retired P29 hljs token marks.
//
// Language list: @codemirror/language-data's lazy LanguageDescription set
// (~40 languages, dynamic-import chunks — first use of a language parses with
// a skipping parser until its chunk lands, then re-parses automatically).
// Coverage gap (accepted): picker ids with no Lezer grammar — `diff`, `ini`,
// `makefile`, `dockerfile` — keep their focused panel uncolored; the rendered
// widget (hljs) still colors them.

/**
 * The mermaid "language": a StreamLanguage keyword highlighter (cheap
 * synchronous load — StreamLanguage ships in @codemirror/language's bundle).
 */
const mermaidDescription = LanguageDescription.of({
  name: 'mermaid',
  alias: ['mmd'],
  load: () => Promise.resolve(new LanguageSupport(mermaidStreamLanguage))
})

export const codeLanguageList: readonly LanguageDescription[] = [
  ...languages,
  mermaidDescription
]

/** Match a fence info string's first word against the language list. */
export function matchCodeLanguage(info: string): LanguageDescription | null {
  const word = /\S*/.exec(info)?.[0] ?? ''
  if (!word) return null
  return LanguageDescription.matchLanguageName(codeLanguageList, word, true)
}
