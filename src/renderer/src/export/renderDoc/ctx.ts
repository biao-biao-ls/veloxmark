import type { SyntaxNode, Tree } from '@lezer/common'
import type { ThemeName } from '../../editor/theme'


export type ImageMode = 'embed' | 'relative'

export interface RenderDocOptions {
  baseDir: string
  theme: ThemeName
  imageMode: ImageMode
}

export interface RenderCtx {
  doc: string
  tree: Tree
  opts: RenderDocOptions
  parts: string[]
  footnoteNums: Map<string, number>
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
