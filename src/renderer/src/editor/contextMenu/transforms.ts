/**
 * P27 block/paragraph transforms — the edit operations behind the context
 * menu's 段落▶ / 格式▶ groups and the `headingN` / `paragraph` / `lift`
 * command ids. Pure view dispatches: no menu, no toast, single undo step.
 */
import type { EditorView } from '@codemirror/view'
import { formatMarkdown } from '../format'
import { indentListItem } from '../assists/lists'
import { formatTable, parseTableModel } from '../table/parse'
import { modelToGrid } from '../table/ops'
import { setActiveCell } from '../table/state'
import type { TableModel } from '../table/parse'

function selectionLineNumbers(view: EditorView): { start: number; end: number } {
  const sel = view.state.selection.main
  return {
    start: view.state.doc.lineAt(sel.from).number,
    end: view.state.doc.lineAt(sel.to).number
  }
}

/** level 1..6 = ATX heading; 0 = strip heading marks (paragraph). */
export function setHeadingLevel(view: EditorView, level: number): void {
  const { start, end } = selectionLineNumbers(view)
  const changes: { from: number; to: number; insert: string }[] = []
  for (let n = start; n <= end; n++) {
    const line = view.state.doc.line(n)
    const rest = line.text.replace(/^#{1,6}\s+/, '').replace(/^\s+/, '')
    const insert = level === 0 ? rest : `${'#'.repeat(level)} ${rest}`
    if (insert !== line.text) changes.push({ from: line.from, to: line.to, insert })
  }
  if (changes.length) view.dispatch({ changes, userEvent: 'input.contextMenu.heading' })
}

export function toggleBlockquote(view: EditorView): void {
  const { start, end } = selectionLineNumbers(view)
  const changes: { from: number; to: number; insert: string }[] = []
  for (let n = start; n <= end; n++) {
    const line = view.state.doc.line(n)
    const m = /^(>\s?)/.exec(line.text)
    const insert = m ? line.text.slice(m[1].length) : `> ${line.text}`
    if (insert !== line.text) changes.push({ from: line.from, to: line.to, insert })
  }
  if (changes.length) view.dispatch({ changes, userEvent: 'input.contextMenu.blockquote' })
}

const LIST_PREFIX_RE = /^(?:\s*)(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/

/** kind null = strip list markers back to plain paragraphs. */
export function convertList(view: EditorView, kind: 'ul' | 'ol' | 'task' | null): void {
  const { start, end } = selectionLineNumbers(view)
  const changes: { from: number; to: number; insert: string }[] = []
  let olIndex = 0
  for (let n = start; n <= end; n++) {
    const line = view.state.doc.line(n)
    const rest = line.text.replace(LIST_PREFIX_RE, '')
    let insert: string
    if (kind === null) insert = rest
    else if (kind === 'ul') insert = `- ${rest}`
    else if (kind === 'ol') insert = `${++olIndex}. ${rest}`
    else insert = `- [ ] ${rest}`
    if (insert !== line.text) changes.push({ from: line.from, to: line.to, insert })
  }
  if (changes.length) view.dispatch({ changes, userEvent: 'input.contextMenu.list' })
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

// ---- table helpers (context menu 表格区 + copyTable/formatTableSource) -------

export function tableSource(view: EditorView, from: number, to: number): string {
  return view.state.sliceDoc(from, to)
}

export function tableModelOf(view: EditorView, from: number, to: number): TableModel | null {
  try {
    return parseTableModel(view.state.sliceDoc(from, to), from)
  } catch {
    return null
  }
}

/** Aligned markdown source of the whole table (复制表格). */
export function tableMarkdown(view: EditorView, from: number, to: number): string | null {
  const model = tableModelOf(view, from, to)
  if (!model) return null
  return formatTable(model.aligns, modelToGrid(model))
}

/** P23 formatter applied to the table source range only; true if changed. */
export function formatTableSourceRange(view: EditorView, from: number, to: number): boolean {
  const src = view.state.sliceDoc(from, to)
  const result = formatMarkdown(src)
  const next = result.text.trimEnd()
  if (!next || next === src.trimEnd()) return false
  view.dispatch({
    changes: { from, to, insert: next },
    userEvent: 'input.contextMenu.formatTableSource'
  })
  return true
}

export function deleteTableRange(view: EditorView, from: number, to: number): void {
  // Absorb one trailing newline so the blank line doesn't pile up.
  const end = to < view.state.doc.length && view.state.sliceDoc(to, to + 1) === '\n' ? to + 1 : to
  const start = from > 0 && view.state.sliceDoc(from - 1, from) === '\n' ? from - 1 : from
  // UX-P28: explicitly clear active cell when deleting the table — prevents
  // dangling active pointing at a nonexistent table (lifecycle is a safety net
  // but explicit clear is cleaner and avoids one update where enterTable sees
  // a bogus isActive).
  view.dispatch({
    changes: { from: start, to: end, insert: '' },
    selection: { anchor: start },
    effects: setActiveCell.of(null),
    userEvent: 'input.contextMenu.deleteTable'
  })
}
