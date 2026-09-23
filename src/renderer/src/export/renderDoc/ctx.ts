import type { SyntaxNode, Tree } from '@lezer/common'
import type { ThemeName } from '../../editor/theme'

// ---- render context & base helpers (3.13) ----
// (3C: moved verbatim from export/renderDoc.ts.)

export type ImageMode = 'embed' | 'relative'

export interface RenderDocOptions {
  /** Directory relative images resolve against (same as live preview baseDir). */
  baseDir: string
  /** Mermaid theme — follow the export theme choice. */
  theme: ThemeName
  /** Embed images as data URLs, or keep markdown srcs as relative paths. */
  imageMode: ImageMode
}

export interface RenderCtx {
  doc: string
  tree: Tree
  opts: RenderDocOptions
  parts: string[]
  /** Footnote id → display number (first-reference order). */
  footnoteNums: Map<string, number>
  /** Abbreviation id → expansion (from `*[id]: …` definition lines). */
  abbrs: Map<string, string>
}

export function textOf(ctx: RenderCtx, node: SyntaxNode): string {
  return ctx.doc.slice(node.from, node.to)
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
