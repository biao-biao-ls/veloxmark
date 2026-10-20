import {
  ABBR_DEF_RE,
  ATTR_RE,
  DL_DEF_RE,
  FOOTNOTE_DEF_RE,
  parseAttrString
} from '../../editor/livePreview/extendedSyntax'
import { escapeHtml } from './ctx'


export function attrsFromTrailing(raw: string): string {
  const m = ATTR_RE.exec(raw)
  if (!m) return ''
  const parsed = parseAttrString(m[1])
  const id = parsed.id ? ` id="${escapeHtml(parsed.id)}"` : ''
  const cls = parsed.classes.length ? ` class="${escapeHtml(parsed.classes.join(' '))}"` : ''
  return id + cls
}

export function stripTrailingAttrs(inner: string): string {
  return inner.replace(/\{((?:[#.][\w-]+[ \t]*)+)\}[ \t]*$/, '')
}

export function isDefLineText(raw: string): boolean {
  return DL_DEF_RE.test(raw)
}

export function splitDefinitionList(raw: string): { term: string; defs: string[]; termOffset: number; defOffsets: number[] } | null {
  const lines = raw.split('\n')
  const nonEmpty: { text: string; offset: number }[] = []
  let offset = 0
  for (const line of lines) {
    if (line.trim() !== '') nonEmpty.push({ text: line, offset })
    offset += line.length + 1
  }
  if (nonEmpty.length < 2) return null
  if (isDefLineText(nonEmpty[0].text)) return null
  const term = nonEmpty[0].text
  const t = term.trim()
  if (/^(#{1,6}\s|```|~~~|\||[-*+]\s|\d+\.\s|>)/.test(t)) return null
  if (FOOTNOTE_DEF_RE.test(term) || ABBR_DEF_RE.test(term)) return null
  const defs: string[] = []
  const defOffsets: number[] = []
  for (const { text, offset } of nonEmpty.slice(1)) {
    const m = DL_DEF_RE.exec(text)
    if (!m) return null
    defs.push(m[2])
    defOffsets.push(offset + (text.length - m[2].length))
  }
  return { term, defs, termOffset: nonEmpty[0].offset, defOffsets }
}
