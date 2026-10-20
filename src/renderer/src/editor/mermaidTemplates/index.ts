import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'
import { getLang, type Lang } from '../../i18n'
import type { MermaidBodies, MermaidTemplate, MermaidTemplateId, TemplateBody } from './types'
import { BODIES_EN } from './en'
import { BODIES_ZH } from './zh'
import { BODIES_JA } from './ja'
import { BODIES_KO } from './ko'
import { BODIES_ES } from './es'
import { BODIES_PT } from './pt'
import { BODIES_FR } from './fr'
import { BODIES_DE } from './de'
import { BODIES_RU } from './ru'

export type { MermaidBodies, MermaidTemplate, MermaidTemplateId, TemplateBody } from './types'

// Every UI language provides a full body pack in ./<lang>.ts (key parity enforced by MermaidBodies).
const TEMPLATE_BODIES: Record<Lang, MermaidBodies> = {
  en: BODIES_EN,
  zh: BODIES_ZH,
  ja: BODIES_JA,
  ko: BODIES_KO,
  es: BODIES_ES,
  pt: BODIES_PT,
  fr: BODIES_FR,
  de: BODIES_DE,
  ru: BODIES_RU
}

function tpl(id: MermaidTemplateId, body: string, firstToken: string): MermaidTemplate {
  const normalized = body.endsWith('\n') ? body : `${body}\n`
  const code = '```mermaid\n' + normalized + '```'
  return {
    id,
    labelKey: `mermaid.tpl.${id}`,
    code,
    cursorOffset: code.indexOf(firstToken)
  }
}

const TEMPLATE_IDS: MermaidTemplateId[] = [
  'flowchart',
  'sequence',
  'class',
  'state',
  'er',
  'gantt',
  'pie'
]

export function getMermaidTemplates(lang: Lang = getLang()): MermaidTemplate[] {
  return TEMPLATE_IDS.map((id) => {
    const localized = TEMPLATE_BODIES[lang]?.[id] ?? BODIES_EN[id]
    return tpl(id, localized.body, localized.firstToken)
  })
}

export function isCursorInMermaidFence(state: EditorState): boolean {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(state.selection.main.head, -1)
  while (node) {
    if (node.name === 'FencedCode') {
      const info = node.getChild('CodeInfo')
      const lang = info ? state.sliceDoc(info.from, info.to).trim() : ''
      return lang === 'mermaid'
    }
    node = node.parent
  }
  return false
}
