/**
 * P22 table insertion helpers — pure builders + the insert transaction.
 *
 * `buildTableMarkdown` / `convertSelectionToTable` are node-testable (they
 * only need formatTable); `insertTableAtCursor` takes an EditorView and is
 * exercised by scripts/cdp-p22.mjs.
 */
import { syntaxTree } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { formatTable } from './parse'
import { parseDelimited, type DelimKind } from './ops'

export type TableAlign = '' | 'left' | 'center' | 'right'

/**
 * GFM table source for the insert dialog. `rows` counts the header row;
 * header cells are `列1…列N` when `headerPrefix` is on, empty otherwise.
 */
export function buildTableMarkdown(
  rows: number,
  cols: number,
  align: TableAlign,
  headerPrefix: boolean
): string {
  const r = Math.max(1, Math.floor(rows))
  const c = Math.max(1, Math.floor(cols))
  const grid: string[][] = []
  const header: string[] = []
  for (let i = 0; i < c; i++) header.push(headerPrefix ? `列${i + 1}` : '')
  grid.push(header)
  for (let i = 1; i < r; i++) grid.push(new Array(c).fill(''))
  return formatTable(new Array(c).fill(align), grid)
}

/** Delimited selection → GFM table (first line becomes the header). */
export function convertSelectionToTable(text: string, delim: DelimKind): string {
  const grid = parseDelimited(text, delim)
  if (grid.length === 0) return ''
  const cols = Math.max(...grid.map((row) => row.length), 1)
  const padded = grid.map((row) => {
    const out = row.slice()
    while (out.length < cols) out.push('')
    return out
  })
  return formatTable(new Array(cols).fill(''), padded)
}

export interface InsertTableResult {
  ok: boolean
  /** true when the cursor sat inside Table/FencedCode and the insert moved. */
  movedAfterBlock: boolean
}

function padBefore(doc: { sliceString: (f: number, t?: number) => string }, at: number): string {
  if (at === 0) return ''
  if (doc.sliceString(at - 1, at) !== '\n') return '\n\n'
  if (at >= 2 && doc.sliceString(at - 2, at) === '\n\n') return ''
  return '\n'
}

function padAfter(
  doc: { sliceString: (f: number, t?: number) => string; length: number },
  at: number
): string {
  if (at >= doc.length) return '\n'
  if (doc.sliceString(at, at + 1) !== '\n') return '\n\n'
  if (at + 2 <= doc.length && doc.sliceString(at, at + 2) === '\n\n') return ''
  return '\n'
}

/**
 * Insert `md` as a table at the cursor with blank-line padding. When the
 * cursor sits inside a Table or FencedCode node the table lands after that
 * block instead (source stays intact; caller shows the "moved" toast).
 * Selection lands on the header's first cell (offset 2 into the table md).
 */
export function insertTableAtCursor(view: EditorView, md: string): InsertTableResult {
  const { state } = view
  const pos = state.selection.main.from
  const tree = syntaxTree(state)
  let node: SyntaxNode | null = tree.resolveInner(pos, 1)
  let movedAfterBlock = false
  let insertAt = pos
  for (; node; node = node.parent) {
    if (node.name === 'Table' || node.name === 'FencedCode') {
      insertAt = state.doc.lineAt(node.to).to
      movedAfterBlock = true
      break
    }
  }
  const lead = padBefore(state.doc, insertAt)
  const tail = padAfter(state.doc, insertAt)
  const insert = lead + md + tail
  const cursor = insertAt + lead.length + 2 // `| ` → first cell content
  view.dispatch({
    changes: { from: insertAt, insert },
    selection: { anchor: cursor },
    userEvent: 'input.tableInsert',
    scrollIntoView: true
  })
  return { ok: true, movedAfterBlock }
}

/** Convert path: replace the selection in place (refused inside Table/FencedCode). */
export function convertSelectionAtCursor(
  view: EditorView,
  text: string,
  delim: DelimKind
): { ok: boolean; reason?: 'in-block' | 'empty'; md?: string } {
  const { state } = view
  const sel = state.selection.main
  if (sel.from === sel.to) return { ok: false, reason: 'empty' }
  const tree = syntaxTree(state)
  let node: SyntaxNode | null = tree.resolveInner(sel.from, 1)
  for (; node; node = node.parent) {
    if (node.name === 'Table' || node.name === 'FencedCode') {
      return { ok: false, reason: 'in-block' }
    }
  }
  const md = convertSelectionToTable(text, delim)
  if (!md) return { ok: false, reason: 'empty' }
  const lead = padBefore(state.doc, sel.from)
  const tail = padAfter(state.doc, sel.to)
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: lead + md + tail },
    selection: { anchor: sel.from + lead.length + 2 },
    userEvent: 'input.tableConvert',
    scrollIntoView: true
  })
  return { ok: true, md }
}
