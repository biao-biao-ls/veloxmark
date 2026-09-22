/**
 * P27 block detection — pure function of editor state + optional viewport
 * coordinates. No menu DOM, no side effects: the context-menu registry and
 * any future caller (keyboard menu, hover palette) share one answer for
 * "what block is here".
 */
import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { parseCalloutMarker } from '../livePreview/callout'
import { parseFrontMatter } from '../livePreview/extendedSyntax'
import type { BlockHit, BlockKind } from './types'

/** Link/image span under `pos` with its URL text (lezer URL child, GFM). */
export function linkAtPos(
  state: EditorState,
  pos: number
): { from: number; to: number; href: string } | null {
  const tree = syntaxTree(state)
  const probes = [pos, Math.max(0, pos - 1), Math.min(state.doc.length, pos + 1)]
  for (const p of probes) {
    let node: SyntaxNode | null = tree.resolveInner(p, 1)
    for (; node; node = node.parent) {
      if (node.name === 'Link' || node.name === 'Image') {
        const url = node.getChild('URL')
        const href = url ? state.sliceDoc(url.from, url.to).trim() : ''
        if (href) return { from: node.from, to: node.to, href }
        // Autolink / reference links: first non-mark child text as fallback.
        break
      }
    }
  }
  return null
}

/** Source span of the markdown table containing `pos` (contiguous `|` lines). */
export function tableSpanAt(state: EditorState, pos: number): { from: number; to: number } | null {
  const lineNo = state.doc.lineAt(pos).number
  const isTableLine = (text: string): boolean => text.trim() !== '' && text.includes('|')
  let start = lineNo
  while (start > 1 && isTableLine(state.doc.line(start - 1).text)) start--
  let end = lineNo
  const last = state.doc.lines
  while (end < last && isTableLine(state.doc.line(end + 1).text)) end++
  if (!isTableLine(state.doc.line(start).text)) return null
  return { from: state.doc.line(start).from, to: state.doc.line(end).to }
}

function kindFromSyntax(node: SyntaxNode | null, state: EditorState, pos: number): BlockHit | null {
  if (!node) return null
  const line = state.doc.lineAt(pos)
  const base = { pos, lineFrom: line.from, lineTo: line.to }
  const walk = (n: SyntaxNode | null): BlockKind | BlockHit | null => {
    for (let cur = n; cur; cur = cur.parent) {
      const m = /^ATXHeading([1-6])$/.exec(cur.name) ?? /^SetextHeading([1-2])$/.exec(cur.name)
      if (m) return { ...base, kind: 'heading' as const, headingLevel: Number(m[1]) }
      if (cur.name === 'FencedCode' || cur.name === 'CodeBlock') {
        const text = state.sliceDoc(cur.from, Math.min(cur.to, cur.from + 200))
        const lang = /^\s*`{3,}\s*([A-Za-z0-9_-]*)/.exec(text)?.[1]?.toLowerCase() ?? ''
        return { ...base, kind: lang === 'mermaid' ? ('mermaid' as const) : ('code-block' as const) }
      }
      if (cur.name === 'Blockquote') {
        const first = state.doc.lineAt(cur.from).text
        return parseCalloutMarker(first)
          ? ({ ...base, kind: 'callout' as const } as BlockHit)
          : ({ ...base, kind: 'blockquote' as const } as BlockHit)
      }
      if (cur.name === 'Table' || cur.name === 'TableHeader' || cur.name === 'TableRow') {
        return { ...base, kind: 'table-cell' as const }
      }
      if (cur.name === 'Link' || cur.name === 'Image') {
        const url = cur.getChild('URL')
        const href = url ? state.sliceDoc(url.from, url.to).trim() : ''
        return {
          ...base,
          kind: cur.name === 'Image' ? ('image' as const) : ('link' as const),
          href: href || undefined
        }
      }
      if (cur.name === 'ListItem') {
        const text = state.sliceDoc(cur.from, Math.min(cur.to, cur.from + 80))
        const task = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]/.exec(text)
        if (task) return { ...base, kind: 'task-item' as const, checked: task[1].toLowerCase() === 'x' }
        const ol = /^\s*\d+[.)]\s/.test(text)
        return { ...base, kind: ol ? ('list-ol' as const) : ('list-ul' as const) }
      }
      if (cur.name === 'FootnoteReference') return { ...base, kind: 'footnote-ref' as const }
      if (cur.name === 'Frontmatter') return { ...base, kind: 'front-matter' as const }
      if (cur.name === 'HorizontalRule') {
        // FM opening fence is not an HR hit (kindFromLine/parseFrontMatter own it).
        const t = state.doc.lineAt(cur.from).text
        if (!(cur.from === 0 && /^---\s*$/.test(t))) return { ...base, kind: 'empty' as const }
      }
    }
    return null
  }
  const found = walk(node)
  if (found && typeof found === 'object' && 'kind' in found) return found
  return null
}

function kindFromLine(state: EditorState, pos: number): BlockHit {
  const line = state.doc.lineAt(pos)
  const text = line.text
  const base = { pos, lineFrom: line.from, lineTo: line.to }
  const trimmed = text.trim()

  // Front matter: fenced `---` region at the very top of the document.
  if (line.number <= 2 && /^---\s*$/.test(text) && line.from === 0) {
    let end = line.number
    const last = state.doc.lines
    while (end < last && !/^---\s*$/.test(state.doc.line(end + 1).text)) end++
    return { ...base, kind: 'front-matter' }
  }
  const h = /^(#{1,6})\s+/.exec(text)
  if (h) return { ...base, kind: 'heading', headingLevel: h[1].length }
  if (trimmed === '' || pos >= state.doc.length) return { ...base, kind: 'empty' }
  const task = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]/.exec(text)
  if (task) return { ...base, kind: 'task-item', checked: task[1].toLowerCase() === 'x' }
  if (/^\s*(?:[-*+])\s+/.test(text)) return { ...base, kind: 'list-ul' }
  if (/^\s*\d+[.)]\s+/.test(text)) return { ...base, kind: 'list-ol' }
  if (/^>\s?/.test(text)) {
    return parseCalloutMarker(text) ? { ...base, kind: 'callout' } : { ...base, kind: 'blockquote' }
  }
  if (/^\s*`{3,}/.test(text)) {
    return { ...base, kind: /^\s*`{3,}\s*mermaid/i.test(text) ? 'mermaid' : 'code-block' }
  }
  if (/^\$\$\s*$/.test(trimmed)) return { ...base, kind: 'math-block' }
  if (trimmed.includes('|') && state.doc.lines >= line.number + 1) {
    const span = tableSpanAt(state, pos)
    if (span) return { ...base, kind: 'table-cell' }
  }
  return { ...base, kind: 'paragraph' }
}

/** Classify the block at `pos` (syntax tree first, line text as fallback). */
export function detectAtPos(view: EditorView, pos: number): BlockHit {
  const state = view.state
  const p = Math.max(0, Math.min(pos, state.doc.length))
  const line = state.doc.lineAt(p)
  // Front matter is a document-level fact — resolve BEFORE widget/syntax paths.
  // lezer classifies the leading `---` fence as HorizontalRule in docs where the
  // FM node is absent from the parse tree, and the collapsed card widget makes
  // coordsAtPos(0) land outside `.cm-md-frontmatter`; either way a right-click
  // on the fm region must hit kind 'front-matter'.
  const fm = parseFrontMatter(state.doc.toString())
  if (fm && p <= fm.end) return { pos: p, lineFrom: line.from, lineTo: line.to, kind: 'front-matter' }
  // Math/code/image/front-matter DOM widgets are more specific than syntax.
  try {
    const coords = view.coordsAtPos(p)
    if (coords) {
      const el = document.elementFromPoint((coords.left + coords.right) / 2, (coords.top + coords.bottom) / 2)
      const hit = detectFromElement(el, state, p)
      if (hit) return hit
    }
  } catch {
    /* heightmap desync etc. — fall through to syntax */
  }
  const node = syntaxTree(state).resolveInner(p, 1)
  const viaSyntax = kindFromSyntax(node, state, p)
  if (viaSyntax) return finishHit(state, viaSyntax)
  const viaLine = kindFromLine(state, p)
  return finishHit(state, viaLine)
}

function finishHit(state: EditorState, hit: BlockHit): BlockHit {
  if (hit.kind === 'link' && !hit.href) {
    const l = linkAtPos(state, hit.pos)
    if (l) hit.href = l.href
  }
  if (hit.kind === 'table-cell' && !hit.table) {
    const span = tableSpanAt(state, hit.pos)
    if (span) {
      const line = state.doc.lineAt(hit.pos)
      const before = line.text.slice(0, Math.max(0, hit.pos - line.from))
      const col = Math.max(0, before.split('|').length - 2)
      const startLine = state.doc.lineAt(span.from).number
      hit.table = { ...span, row: Math.max(0, line.number - startLine), col }
    }
  }
  return hit
}

/** DOM-first classification for elementFromPoint results (widgets + cells). */
function detectFromElement(el: Element | null, state: EditorState, pos: number): BlockHit | null {
  if (!el || !(el instanceof HTMLElement)) return null
  const line = state.doc.lineAt(pos)
  const base = { pos, lineFrom: line.from, lineTo: line.to }

  const checkbox = el.closest?.('input.cm-md-task')
  if (checkbox) {
    return { ...base, kind: 'task-checkbox', checked: (checkbox as HTMLInputElement).checked }
  }
  const td = el.closest?.('.cm-md-table td, .cm-md-table th')
  if (td instanceof HTMLElement) {
    const span = tableSpanAt(state, pos)
    return {
      ...base,
      kind: 'table-cell',
      table: {
        from: span?.from ?? line.from,
        to: span?.to ?? line.to,
        row: Number(td.dataset.row ?? '0'),
        col: Number(td.dataset.col ?? '0')
      }
    }
  }
  if (el.closest?.('.cm-md-mermaid')) return { ...base, kind: 'mermaid' }
  if (el.closest?.('.cm-md-code-block')) return { ...base, kind: 'code-block' }
  if (el.closest?.('.cm-md-math-block')) return { ...base, kind: 'math-block' }
  if (el.closest?.('.cm-md-math-inline')) return { ...base, kind: 'math-inline' }
  if (el.closest?.('.cm-md-frontmatter')) return { ...base, kind: 'front-matter' }
  if (el.closest?.('.cm-md-image-wrap') || el.closest?.('.cm-md-image')) {
    const wrap = el.closest?.('.cm-md-image-wrap')
    const img = (wrap?.querySelector('img.cm-md-image') as HTMLImageElement | null)
      ?? el.closest?.('img.cm-md-image')
    const domSrc = img?.getAttribute('src') || undefined
    const syn = linkAtPos(state, pos) // Image-node syntax fallback（dom 无 src 时）
    return { ...base, kind: 'image', href: domSrc ?? syn?.href }
  }
  const linkEl = el.closest?.('.cm-md-link')
  if (linkEl) {
    const l = linkAtPos(state, pos)
    return { ...base, kind: 'link', href: l?.href }
  }
  return null
}

/**
 * Detect the block under viewport coordinates (right-click target). Falls
 * back to the selection head when the coordinates resolve to nothing.
 */
export function detectAtCoords(view: EditorView, x: number, y: number): BlockHit {
  let pos: number | null = null
  try {
    pos = view.posAtCoords({ x, y })
  } catch {
    pos = null
  }
  if (pos == null) pos = view.state.selection.main.head
  // DOM-first at the CURSOR coords: replaced widgets (fm card/code/mermaid) make
  // posAtCoords resolve to the widget edge — elementFromPoint(x,y) sees what the
  // user actually right-clicked. detectFromElement returns null on plain text,
  // so syntax/line classification still covers the non-widget cases.
  try {
    const el = document.elementFromPoint(x, y)
    const domHit = detectFromElement(el, view.state, pos)
    if (domHit) return finishHit(view.state, domHit)
  } catch {
    /* fall through */
  }
  return detectAtPos(view, pos)
}
