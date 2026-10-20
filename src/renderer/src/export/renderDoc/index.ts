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


export async function renderDoc(markdown: string, opts: RenderDocOptions): Promise<string> {
  const fm = parseFrontMatter(markdown)
  const body = fm ? markdown.slice(fm.end) : markdown
  const tree = mdParser.configure([GFM, imageSizeMarkdown]).parse(body)

  const defs = collectFootnoteDefs(body)
  const footnoteNums = new Map<string, number>()
  const footnotes: FootnoteDef[] = []
  for (const def of defs.values()) {
    footnoteNums.set(def.id, def.num)
    footnotes.push(def)
  }
  footnotes.sort((a, b) => a.num - b.num)

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
