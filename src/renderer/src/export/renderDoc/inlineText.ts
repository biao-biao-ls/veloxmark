import { renderKatexHtml } from '../../editor/render-helpers'
import { escapeRegExp } from '../../editor/livePreview/extendedSyntax'
import { escapeHtml, type RenderCtx } from './ctx'

// ---- text-run inline substitutions + math block detection (3.14) ----
// (3C: moved verbatim from export/renderDoc.ts.)

/**
 * Text run → escaped HTML with P11 inline substitutions (mirrors the live
 * preview regex passes): $math$, [^footnote], ==highlight==, ^sup^, ~sub~,
 * plus word-boundary abbreviation expansion in the plain gaps.
 */
export function renderTextRun(text: string, ctx?: RenderCtx): string {
  let out = ''
  let last = 0
  const re =
    /\$([^$\n]+?)\$|\[\^([^\]\s]+)\]|==([^=\n]+)==|\^([^\^\n]+?)\^|(?<!~)~([^~\n]+?)~(?!~)/g
  for (const m of text.matchAll(re)) {
    const gap = text.slice(last, m.index)
    const content = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5]
    if (m[1] !== undefined) {
      // Same guards as live preview: no padded / double-$ content.
      if (content !== content.trim() || content.includes('$$')) continue
    } else if (!content) {
      continue
    }
    out += escapeWithAbbrs(gap, ctx)
    if (m[1] !== undefined) {
      out += `<span class="export-math-inline">${renderKatexHtml(m[1], false)}</span>`
    } else if (m[2] !== undefined) {
      const id = m[2]
      const num = ctx?.footnoteNums.get(id)
      if (num != null) {
        out += `<sup class="export-footnote-ref" id="fnref-${escapeHtml(id)}"><a href="#fn-${escapeHtml(id)}">${num}</a></sup>`
      } else {
        out += `<sup class="export-footnote-ref">[${escapeHtml(id)}]</sup>`
      }
    } else if (m[3] !== undefined) {
      out += `<mark class="export-mark">${escapeWithAbbrs(m[3], ctx)}</mark>`
    } else if (m[4] !== undefined) {
      out += `<sup class="export-sup">${escapeWithAbbrs(m[4], ctx)}</sup>`
    } else if (m[5] !== undefined) {
      out += `<sub class="export-sub">${escapeWithAbbrs(m[5], ctx)}</sub>`
    }
    last = m.index + m[0].length
  }
  out += escapeWithAbbrs(text.slice(last), ctx)
  return out
}

/**
 * Escape plain text, expanding known abbreviations to <abbr title> — the
 * placeholder masking keeps replacements out of HTML-escaped tag soup.
 */
function escapeWithAbbrs(text: string, ctx?: RenderCtx): string {
  if (!ctx || ctx.abbrs.size === 0 || text === '') return escapeHtml(text)
  const keys = [...ctx.abbrs.keys()].sort((a, b) => b.length - a.length)
  const re = new RegExp(`(?<![\\w*])(${keys.map(escapeRegExp).join('|')})(?![\\w*])`, 'g')
  const slots: string[] = []
  const masked = text.replace(re, (_m, abbr: string) => {
    slots.push(abbr)
    return `${slots.length - 1}`
  })
  return escapeHtml(masked).replace(/(\d+)/g, (_m, i) => {
    const abbr = slots[Number(i)]
    return `<abbr title="${escapeHtml(ctx.abbrs.get(abbr) ?? '')}">${escapeHtml(abbr)}</abbr>`
  })
}

// ---- math block detection (paragraph level) ---------------------------------

export interface MathBlock {
  tex: string
}

/** If `text` is exactly one $$…$$ block, return its TeX. */
export function asMathBlock(text: string): MathBlock | null {
  const multi = /^[ \t]*\$\$[ \t]*\n([\s\S]+?)\n[ \t]*\$\$[ \t]*$/.exec(text)
  if (multi) return { tex: multi[1].trim() }
  const single = /^[ \t]*\$\$([^$\n]+)\$\$[ \t]*$/.exec(text)
  if (single) return { tex: single[1].trim() }
  return null
}
