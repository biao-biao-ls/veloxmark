import type { EditorView } from '@codemirror/view'
import type { Line } from '@codemirror/state'
import { indentListItem } from '../assists/lists'

function selectionLineNumbers(view: EditorView): { start: number; end: number } {
  const sel = view.state.selection.main
  return {
    start: view.state.doc.lineAt(sel.from).number,
    end: view.state.doc.lineAt(sel.to).number
  }
}

export function applyLineChanges(
  view: EditorView,
  startLine: number,
  endLine: number,
  edit: (line: Line) => { from: number; to: number; insert: string } | null,
  userEvent: string
): void {
  const changes: { from: number; to: number; insert: string }[] = []
  for (let n = startLine; n <= endLine; n++) {
    const ch = edit(view.state.doc.line(n))
    if (ch) changes.push(ch)
  }
  if (changes.length) view.dispatch({ changes, userEvent })
}

export function setHeadingLevel(view: EditorView, level: number): void {
  const { start, end } = selectionLineNumbers(view)
  applyLineChanges(view, start, end, (line) => {
    const rest = line.text.replace(/^#{1,6}\s+/, '').replace(/^\s+/, '')
    const insert = level === 0 ? rest : `${'#'.repeat(level)} ${rest}`
    return insert !== line.text ? { from: line.from, to: line.to, insert } : null
  }, 'input.contextMenu.heading')
}

export function toggleBlockquote(view: EditorView): void {
  const { start, end } = selectionLineNumbers(view)
  applyLineChanges(view, start, end, (line) => {
    const m = /^(>\s?)/.exec(line.text)
    const insert = m ? line.text.slice(m[1].length) : `> ${line.text}`
    return insert !== line.text ? { from: line.from, to: line.to, insert } : null
  }, 'input.contextMenu.blockquote')
}

const LIST_PREFIX_RE = /^(?:\s*)(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/

export function convertList(view: EditorView, kind: 'ul' | 'ol' | 'task' | null): void {
  const { start, end } = selectionLineNumbers(view)
  let olIndex = 0
  applyLineChanges(view, start, end, (line) => {
    const rest = line.text.replace(LIST_PREFIX_RE, '')
    let insert: string
    if (kind === null) insert = rest
    else if (kind === 'ul') insert = `- ${rest}`
    else if (kind === 'ol') insert = `${++olIndex}. ${rest}`
    else insert = `- [ ] ${rest}`
    return insert !== line.text ? { from: line.from, to: line.to, insert } : null
  }, 'input.contextMenu.list')
}

const INLINE_MARK_PAIRS: Array<[RegExp, string]> = [
  [/\*\*(.+?)\*\*/g, '$1'],
  [/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1'],
  [/~~(.+?)~~/g, '$1'],
  [/`([^`\n]+)`/g, '$1'],
  [/==(.+?)==/g, '$1']
]

export function clearInlineFormat(view: EditorView): void {
  const sel = view.state.selection.main
  if (sel.empty) return
  const text = view.state.sliceDoc(sel.from, sel.to)
  let out = text
  for (const [re, rep] of INLINE_MARK_PAIRS) out = out.replace(re, rep)
  if (out !== text) {
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: out },
      userEvent: 'input.contextMenu.clearFormat'
    })
  }
}

export function liftBlock(view: EditorView): boolean {
  return indentListItem(view, -1)
}

export function wrapFencedCode(view: EditorView): void {
  const sel = view.state.selection.main
  const text = view.state.sliceDoc(sel.from, sel.to)
  const insert = text ? `\`\`\`\n${text}\n\`\`\`` : '```\n\n```'
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert },
    selection: {
      anchor: sel.from + (text ? 4 : 4),
      head: sel.from + (text ? 4 : 4)
    },
    userEvent: 'input.contextMenu.code'
  })
}

export function selectionOrDocMarkdown(view: EditorView): string {
  const sel = view.state.selection.main
  return sel.empty ? view.state.doc.toString() : view.state.sliceDoc(sel.from, sel.to)
}

export function markdownToPlainText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`{1,3}[^`\n]*`{1,3}/g, (m) => m.replace(/`/g, ''))
    .replace(/==(.+?)==/g, '$1')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\|/g, ' ')
    .replace(/^[-*+=]{3,}\s*$/gm, '')
}

