import { parser as mdParser, GFM } from '@lezer/markdown'
import { imageSizeMarkdown } from '../../editor/markdown-image-ext'
import {
  ABBR_DEF_RE,
  type FootnoteDef,
  collectFootnoteDefs,
  parseFrontMatter
} from '../../editor/livePreview/extendedSyntax'
import { renderBlockChildren } from './block'
import { escapeHtml, type RenderCtx, type RenderDocOptions } from './ctx'
import { renderTextRun } from './inlineText'

export type { ImageMode, RenderDocOptions } from './ctx'

/**
 * Static-document renderer (P04 export) — entry module of export/renderDoc/.
 *
 * Walks the *same* GFM tree the live preview decorates (`@lezer/markdown` +
 * GFM, as used inside @codemirror/lang-markdown) and emits semantic HTML.
 * Unlike live preview there is no cursor-touched concept — markers are always
 * hidden and every block is rendered. KaTeX / mermaid / highlight.js go
 * through the shared helpers extracted from widgets.ts.
 *
 * Parallel contracts (task 3C/3.16 — keep in sync by hand; both sides are
 * behavior and no test links them):
 * - Math regexes (inlineText.ts) ↔ livePreview/handlers-math.ts
 *   (collectMathDecos): lezer has no math extension, so block math is
 *   detected on paragraph text and inline math on text runs — the two
 *   strategies must match or export and live preview disagree.
 * - Image size syntax ↔ editor/markdown-image-ext (the imageSizeMarkdown
 *   parser extension must stay paired with editor/image-parse.ts).
 * - Emitted class names are an export/CSS contract: `export-*` (incl.
 *   `export-callout`/`export-callout-*`, `export-mermaid*`, `export-code*`)
 *   are styled by export/exportCss.ts + export/inlineStyles.ts; renaming a
 *   class here requires updating both.
 */

export async function renderDoc(markdown: string, opts: RenderDocOptions): Promise<string> {
  // P11: strip front matter from the walked source; surface `title` as an h1.
  const fm = parseFrontMatter(markdown)
  const body = fm ? markdown.slice(fm.end) : markdown
  const tree = mdParser.configure([GFM, imageSizeMarkdown]).parse(body)

  // Footnote numbering is first-reference order in the body (defs excluded).
  const defs = collectFootnoteDefs(body)
  const footnoteNums = new Map<string, number>()
  const footnotes: FootnoteDef[] = []
  for (const def of defs.values()) {
    footnoteNums.set(def.id, def.num)
    footnotes.push(def)
  }
  footnotes.sort((a, b) => a.num - b.num)

  // Abbreviation definitions — titles attach to <abbr> usages in the body.
  const abbrs = new Map<string, string>()
  for (const line of body.split('\n')) {
    const m = ABBR_DEF_RE.exec(line)
    if (m && !abbrs.has(m[1])) abbrs.set(m[1], m[2].trim())
  }

  const ctx: RenderCtx = {
    doc: body,
    tree,
    opts,
    parts: [],
    footnoteNums,
    abbrs
  }
  if (fm?.summary.title) {
    ctx.parts.push(`<h1 class="export-fm-title">${escapeHtml(fm.summary.title)}</h1>`)
  }
  await renderBlockChildren(tree.topNode, ctx)
  if (footnotes.length) {
    const items = footnotes
      .map((def) => {
        const text = renderTextRun(def.text, ctx)
        const back = `<a href="#fnref-${escapeHtml(def.id)}" class="export-footnote-backref">↩</a>`
        return `<li id="fn-${escapeHtml(def.id)}">${text} ${back}</li>`
      })
      .join('\n')
    ctx.parts.push(`<hr class="export-footnotes-sep">\n<ol class="export-footnotes">\n${items}\n</ol>`)
  }
  return ctx.parts.join('\n')
}
