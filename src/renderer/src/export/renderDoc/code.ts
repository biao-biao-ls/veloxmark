import type { SyntaxNode } from '@lezer/common'
import { renderMermaid } from '../../editor/mermaid'
import { highlightCodeHtml } from '../../editor/render-helpers'
import { escapeHtml, textOf, type RenderCtx } from './ctx'

// ---- fenced code / mermaid (3.15) ----
// (3C: moved verbatim from export/renderDoc.ts.)

// ---- fenced code / mermaid ---------------------------------------------------

export async function renderFencedCode(node: SyntaxNode, ctx: RenderCtx): Promise<string> {
  const infoNode = node.getChild('CodeInfo')
  const lang = infoNode ? textOf(ctx, infoNode).trim() : ''
  const textNode = node.getChild('CodeText')
  let code = textNode ? textOf(ctx, textNode) : ''
  if (code.startsWith('\n')) code = code.slice(1)
  if (code.endsWith('\n')) code = code.slice(0, -1)

  if (lang === 'mermaid') {
    try {
      const svg = await renderMermaid(code, ctx.opts.theme)
      return `<div class="export-mermaid">${svg}</div>`
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `<div class="export-mermaid"><div class="export-mermaid-error">Mermaid error: ${escapeHtml(message)}</div></div>`
    }
  }
  return codeBlockHtml(lang, highlightCodeHtml(code, lang))
}

export function codeBlockHtml(lang: string, highlighted: string): string {
  const label = lang ? `<div class="export-code-lang">${escapeHtml(lang)}</div>` : ''
  return `<div class="export-code">${label}<pre><code class="hljs">${highlighted}</code></pre></div>`
}
