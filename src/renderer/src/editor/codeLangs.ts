import { LanguageDescription, LanguageSupport } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { mermaidStreamLanguage } from './mermaid/mermaidStream'


const mermaidDescription = LanguageDescription.of({
  name: 'mermaid',
  alias: ['mmd'],
  load: () => Promise.resolve(new LanguageSupport(mermaidStreamLanguage))
})

export const codeLanguageList: readonly LanguageDescription[] = [
  ...languages,
  mermaidDescription
]

export function matchCodeLanguage(info: string): LanguageDescription | null {
  const word = /\S*/.exec(info)?.[0] ?? ''
  if (!word) return null
  return LanguageDescription.matchLanguageName(codeLanguageList, word, true)
}
