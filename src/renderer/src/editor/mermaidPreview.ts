import type { EditorState } from '@codemirror/state'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { codeBlockKey } from './livePreview/codeBlockUi'

/**
 * P25 route-B preview targets: mermaid fences located in the document.
 * The panel is a pure projection — every render reads `code` fresh from the
 * CM6 doc; nothing here holds writable editor state.
 */
export interface MermaidFence {
  from: number
  to: number
  /** Fence body without the ``` lines. */
  code: string
  /** FNV-1a of `code` — pin identity across edits. */
  hash: string
}

function fenceFromNode(state: EditorState, node: SyntaxNode): MermaidFence | null {
  if (node.name !== 'FencedCode') return null
  const infoNode = node.getChild('CodeInfo')
  const lang = infoNode ? state.sliceDoc(infoNode.from, infoNode.to).trim() : ''
  if (lang !== 'mermaid') return null
  const textNode = node.getChild('CodeText')
  let code = textNode ? state.sliceDoc(textNode.from, textNode.to) : ''
  if (code.startsWith('\n')) code = code.slice(1)
  if (code.endsWith('\n')) code = code.slice(0, -1)
  return { from: node.from, to: node.to, code, hash: codeBlockKey(code) }
}

/** Mermaid fence containing/adjacent to `pos` (walks up the syntax tree). */
export function mermaidFenceAt(state: EditorState, pos: number): MermaidFence | null {
  const tree = ensureSyntaxTree(state, Math.min(pos + 1, state.doc.length), 4000) ?? syntaxTree(state)
  for (let n: SyntaxNode | null = tree.resolveInner(pos, 1); n; n = n.parent) {
    const fence = fenceFromNode(state, n)
    if (fence) return fence
  }
  return null
}

/** All mermaid fences in document order (used to re-resolve a pinned fence). */
export function mermaidFences(state: EditorState): MermaidFence[] {
  const tree = ensureSyntaxTree(state, state.doc.length, 8000) ?? syntaxTree(state)
  const out: MermaidFence[] = []
  tree.iterate({
    enter(n) {
      if (n.name !== 'FencedCode') return true
      const fence = fenceFromNode(state, n.node)
      if (fence) out.push(fence)
      return true
    }
  })
  return out
}

/**
 * Pin follow-up: locate the pinned fence after a document edit. Content-hash
 * match first (pin identity); when the pinned block's own content changed,
 * follow the mermaid fence nearest the previous range ("hash 变化跟随更新").
 */
export function resolvePinnedFence(
  state: EditorState,
  prev: MermaidFence | null
): MermaidFence | null {
  if (!prev) return null
  const all = mermaidFences(state)
  if (all.length === 0) return null
  const byHash = all.find((f) => f.hash === prev.hash)
  if (byHash) return byHash
  let best = all[0]
  let bestD = Math.abs(all[0].from - prev.from)
  for (const f of all) {
    const d = Math.abs(f.from - prev.from)
    if (d < bestD) {
      best = f
      bestD = d
    }
  }
  return best
}
