import type { SyntaxNode } from '@lezer/common'
import { Decoration } from '@codemirror/view'
import { hide, type BuildCtx } from './handlers-ctx'
import {
  ABBR_DEF_RE,
  DL_DEF_RE,
  FOOTNOTE_DEF_RE,
  FOOTNOTE_REF_RE,
  HIGHLIGHT_RE,
  SUB_RE,
  SUP_RE,
  collectFootnoteDefs,
  escapeRegExp,
  parseFrontMatter
} from './extendedSyntax'
import { FootnoteDefBackWidget, FootnoteRefWidget, FrontMatterWidget } from '../widgets'

/**
 * P11 extended-syntax regex pass (split from handlers.ts, task 1D): front
 * matter, footnotes, `==highlight==`, pandoc sub/sup, abbreviations,
 * definition lists and trailing `{#id .class}` attributes.
 *
 * ORDER CONTRACT: runs after the tree pass (same as collectMathDecos) so
 * `resolveNode` can skip code / link / strikethrough interiors.
 */
// ---- P11 extended syntax (regex pass; @lezer/markdown has no extensions) ------

/**
 * Front matter, footnotes, `==highlight==`, pandoc sub/sup, abbreviations,
 * definition lists and trailing `{#id .class}` attributes. Runs after the
 * tree pass (same contract as collectMathDecos) so `resolveNode` can skip
 * code / link / strikethrough interiors.
 */
export function collectExtendedDecos(
  ctx: BuildCtx,
  resolveNode: (pos: number, side: -1 | 1) => SyntaxNode
): void {
  const { state, decos, blockTouched, markTouched } = ctx
  const doc = state.doc
  const full = state.sliceDoc(0, doc.length)

  /** True when pos sits inside code / URL / link / image / strikethrough. */
  const inInlineSyntax = (pos: number, allowLink = false): boolean => {
    for (let p: SyntaxNode | null = resolveNode(pos, 1); p; p = p.parent) {
      const n = p.name
      if (
        n === 'InlineCode' ||
        n === 'FencedCode' ||
        n === 'CodeText' ||
        n === 'URL' ||
        n === 'Image' ||
        n === 'Strikethrough' ||
        n === 'HTMLTag' ||
        (!allowLink && n === 'Link')
      ) {
        return true
      }
    }
    return false
  }

  // ---- front matter -----------------------------------------------------------
  const fm = parseFrontMatter(full)
  const bodyFrom = fm ? fm.end : 0
  if (fm && !blockTouched(0, fm.end)) {
    decos.push({
      from: 0,
      to: fm.end,
      value: Decoration.replace({
        widget: new FrontMatterWidget(fm.summary, fm.yaml, 0, fm.end, ctx.config.i18nEpoch ?? 0),
        block: true
      })
    })
  }

  // ---- footnotes ---------------------------------------------------------------
  const defs = collectFootnoteDefs(full)
  // UX-P11 F2: first in-body reference position per id — the ↩ return target.
  const firstRefPos = new Map<string, number>()
  for (const m of full.matchAll(FOOTNOTE_REF_RE)) {
    const start = m.index
    const end = start + m[0].length
    if (end <= bodyFrom) continue
    const lineStart = full.lastIndexOf('\n', start - 1) + 1
    if (full.startsWith(`[^${m[1]}]:`, lineStart)) continue
    if (inInlineSyntax(start, true)) continue
    if (!firstRefPos.has(m[1])) firstRefPos.set(m[1], start)
  }
  for (const def of defs.values()) {
    if (def.defFrom < bodyFrom) continue
    const defLine = doc.lineAt(def.defFrom)
    const lineFrom = defLine.from
    // Hide the `[^id]:` marker when the cursor is off the line (P09 rule).
    const markerTo = def.defFrom + def.id.length + 4 // `[^id]:`
    if (!markTouched(def.defFrom, markerTo)) {
      decos.push({ from: def.defFrom, to: markerTo, value: hide })
    }
    decos.push({
      from: lineFrom,
      to: lineFrom,
      value: Decoration.line({ class: 'cm-md-footnote-def' })
    })
    // Typora: definition line carries a trailing ↩ back to the first ref.
    const refPos = firstRefPos.get(def.id)
    if (refPos != null && !markTouched(defLine.to, defLine.to)) {
      decos.push({
        from: defLine.to,
        to: defLine.to,
        value: Decoration.replace({
          widget: new FootnoteDefBackWidget(def.id, refPos, ctx.config.i18nEpoch ?? 0)
        })
      })
    }
  }
  for (const m of full.matchAll(FOOTNOTE_REF_RE)) {
    const start = m.index
    const end = start + m[0].length
    if (end <= bodyFrom) continue
    // Not the `[^id]:` opening of a definition line itself.
    const lineStart = full.lastIndexOf('\n', start - 1) + 1
    if (full.startsWith(`[^${m[1]}]:`, lineStart)) continue
    // Footnote refs commonly parse as reference links — allow Link, skip code.
    if (inInlineSyntax(start, true)) continue
    if (markTouched(start, end)) continue
    const def = defs.get(m[1])
    decos.push({
      from: start,
      to: end,
      value: Decoration.replace({
        widget: new FootnoteRefWidget(m[1], def?.num, def?.defFrom, ctx.config.i18nEpoch ?? 0)
      })
    })
  }

  // ---- ==highlight== / ^sup^ / ~sub~ -------------------------------------------
  const inlineMarkPass = (
    re: RegExp,
    markClass: string,
    delimLen: number,
    contentGroup = 1
  ): void => {
    for (const m of full.matchAll(re)) {
      const start = m.index
      const end = start + m[0].length
      if (end <= bodyFrom) continue
      if (inInlineSyntax(start)) continue
      if (delimLen === 1 && markClass === 'cm-md-sub') {
        // `~~strike~~` overlap guard (single-tilde regex can land inside).
        if (full[start - 1] === '~' || full[end] === '~') continue
      }
      if (!m[contentGroup]) continue
      decos.push({ from: start, to: end, value: Decoration.mark({ class: markClass }) })
      // P09 mark rule: delimiters reveal only while the span is touched.
      if (!markTouched(start, end)) {
        decos.push({ from: start, to: start + delimLen, value: hide })
        decos.push({ from: end - delimLen, to: end, value: hide })
      }
    }
  }
  inlineMarkPass(HIGHLIGHT_RE, 'cm-md-highlight', 2)
  inlineMarkPass(SUP_RE, 'cm-md-sup', 1)
  inlineMarkPass(SUB_RE, 'cm-md-sub', 1)

  // ---- abbreviations ------------------------------------------------------------
  const abbrDefs = new Map<string, string>()
  {
    const lines = full.split('\n')
    let offset = 0
    for (const line of lines) {
      const m = ABBR_DEF_RE.exec(line)
      if (m && offset >= bodyFrom) {
        if (!abbrDefs.has(m[1])) abbrDefs.set(m[1], m[2].trim())
        const lineFrom = offset
        decos.push({
          from: lineFrom,
          to: lineFrom,
          value: Decoration.line({ class: 'cm-md-abbr-def' })
        })
        const hideEnd = offset + 2 + m[1].length + 2 // `*[id]:`
        if (!markTouched(offset, hideEnd)) {
          decos.push({ from: offset, to: hideEnd, value: hide })
        }
      }
      offset += line.length + 1
    }
  }
  for (const [abbr, title] of abbrDefs) {
    if (!title) continue
    const re = new RegExp(`(?<![\\w*])${escapeRegExp(abbr)}(?![\\w*])`, 'g')
    for (const m of full.matchAll(re)) {
      const start = m.index
      if (start < bodyFrom) continue
      const lineStart = full.lastIndexOf('\n', start - 1) + 1
      const lineEnd = full.indexOf('\n', start)
      const line = full.slice(lineStart, lineEnd === -1 ? full.length : lineEnd)
      if (ABBR_DEF_RE.test(line)) continue
      if (inInlineSyntax(start)) continue
      decos.push({
        from: start,
        to: start + abbr.length,
        value: Decoration.mark({
          class: 'cm-md-abbr',
          attributes: { title }
        })
      })
    }
  }

  // ---- definition lists (`term` line + `: definition` lines) --------------------
  {
    const lines = full.split('\n')
    const lineFroms: number[] = []
    let offset = 0
    for (const line of lines) {
      lineFroms.push(offset)
      offset += line.length + 1
    }
    const isDefLine = (i: number): boolean => i >= 0 && i < lines.length && DL_DEF_RE.test(lines[i])
    for (let i = 0; i < lines.length; i++) {
      const m = DL_DEF_RE.exec(lines[i])
      if (!m) continue
      const from = lineFroms[i]
      if (from < bodyFrom) continue
      if (inInlineSyntax(from + m[1].length + 1)) continue
      // Skip footnote definition lines (`[^id]: …`) — handled above.
      if (FOOTNOTE_DEF_RE.test(lines[i])) continue
      const markerLen = lines[i].length - m[2].length // indent + `:` + spaces
      if (!markTouched(from, from + markerLen)) {
        decos.push({ from, to: from + markerLen, value: hide })
      }
      decos.push({
        from,
        to: from,
        value: Decoration.line({ class: 'cm-md-dl-def' })
      })
      // Term: nearest non-empty, non-def line above (walks a `: a`/`: b` chain).
      let j = i - 1
      while (j >= 0 && (lines[j].trim() === '' || isDefLine(j))) {
        if (lines[j].trim() === '' && j - 1 >= 0 && lines[j - 1].trim() === '') break
        j--
      }
      if (j >= 0 && !isDefLine(j) && lines[j].trim() !== '') {
        const term = lines[j]
        // Heuristic guards: fence/heading/table/list markers are not terms.
        if (!/^(#{1,6}\s|```|~~~|\||[-*+]\s|\d+\.\s|>)/.test(term.trim())) {
          const termFrom = lineFroms[j]
          if (termFrom >= bodyFrom && !FOOTNOTE_DEF_RE.test(term) && !ABBR_DEF_RE.test(term)) {
            decos.push({
              from: termFrom,
              to: termFrom,
              value: Decoration.line({ class: 'cm-md-dl-term' })
            })
          }
        }
      }
    }
  }

  // ---- trailing inline attributes `{#id .class}` --------------------------------
  for (const m of full.matchAll(/\{((?:[#.][\w-]+[ \t]*)+)\}[ \t]*(?=\n|$)/g)) {
    const start = m.index
    const end = start + m[0].length
    if (end <= bodyFrom) continue
    if (inInlineSyntax(start)) continue
    if (!markTouched(start, end)) {
      decos.push({ from: start, to: end, value: hide })
    }
  }
}
