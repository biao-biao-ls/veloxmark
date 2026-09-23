import {
  ABBR_DEF_RE,
  ATTR_RE,
  DL_DEF_RE,
  FOOTNOTE_DEF_RE,
  parseAttrString
} from '../../editor/livePreview/extendedSyntax'
import { escapeHtml } from './ctx'

// ---- block attribute & definition-list helpers (3.14) ----
// (3C: moved verbatim from export/renderDoc.ts.)

/** Trailing `{#id .class}` on a block's raw source → ` id="…" class="…"`. */
export function attrsFromTrailing(raw: string): string {
  const m = ATTR_RE.exec(raw)
  if (!m) return ''
  const parsed = parseAttrString(m[1])
  const id = parsed.id ? ` id="${escapeHtml(parsed.id)}"` : ''
  const cls = parsed.classes.length ? ` class="${escapeHtml(parsed.classes.join(' '))}"` : ''
  return id + cls
}

/** Strip a trailing `{…}` attribute span from rendered inner HTML (escaped text). */
export function stripTrailingAttrs(inner: string): string {
  return inner.replace(/\{((?:[#.][\w-]+[ \t]*)+)\}[ \t]*$/, '')
}

/** True when a block-level paragraph *starts* with `: ` (definition-list body). */
export function isDefLineText(raw: string): boolean {
  return DL_DEF_RE.test(raw)
}

/**
 * Pandoc-style DL packed into ONE paragraph (`term\n: def1\n: def2`, no blank
 * lines — CommonMark keeps them in a single Paragraph; lezer has no DL node).
 * Returns term + definition texts when every non-empty line fits the shape.
 */
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
  const defOffsets: number[] = [] // offset of each def's *content* (after marker)
  for (const { text, offset } of nonEmpty.slice(1)) {
    const m = DL_DEF_RE.exec(text)
    if (!m) return null
    defs.push(m[2])
    defOffsets.push(offset + (text.length - m[2].length))
  }
  return { term, defs, termOffset: nonEmpty[0].offset, defOffsets }
}
