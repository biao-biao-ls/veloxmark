/**
 * P27 block/paragraph transforms — the edit operations behind the context
 * menu's 段落▶ / 格式▶ groups and the `headingN` / `paragraph` / `lift`
 * command ids. Pure view dispatches: no menu, no toast, single undo step.
 *
 * Table source helpers moved to ../table/source.ts (task 4.3 = 2.17).
 */
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

/**
 * Dispatch convention (task 4.3 = 2.17): build per-line changes over line
 * numbers [startLine..endLine] and fire a single undoable dispatch. `edit`
 * returns the change for a line (null = leave untouched). Shared with
 * contextMenu/blockHelpers (indentLines) — keep this the only home of the
 * pattern.
 */
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

/** level 1..6 = ATX heading; 0 = strip heading marks (paragraph). */
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

/** kind null = strip list markers back to plain paragraphs. */
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

/** Strip bold/italic/strike/code/highlight marks inside the selection lines. */
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

/** Promote / exit-list: indent the current list item one level out. */
export function liftBlock(view: EditorView): boolean {
  return indentListItem(view, -1)
}

/** `code` command — wrap the selection in (or insert) a fenced code block. */
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

/** Whole-doc or selection markdown (context menu 复制为…▶ Markdown). */
export function selectionOrDocMarkdown(view: EditorView): string {
  const sel = view.state.selection.main
  return sel.empty ? view.state.doc.toString() : view.state.sliceDoc(sel.from, sel.to)
}

/** Pragmatic plain-text projection of markdown source for 复制为…▶ 纯文本. */
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

// Table source helpers (tableSource dead-export removed) live in
// ../table/source.ts since task 4.3 = 2.17.
