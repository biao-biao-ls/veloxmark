import type { SyntaxNode } from '@lezer/common'
import { textOf, type RenderCtx } from './ctx'
import { renderFencedCode } from './code'
import { renderInlineChildren } from './inline'

// ---- lists & tables (3.15) ----
// (3C: moved verbatim from export/renderDoc.ts.)

/**
 * GFM task done-mark: `[x]` / `[X]` → checked, `[ ]` → unchecked. Case-
 * insensitive, same predicate as the edit side
 * (editor/livePreview/handlers-tree.ts `isTaskDoneText`, contextMenu/detect.ts
 * `[ xX]` → checked) so export HTML/PDF/富文本 match the editor view
 * (AC-OP-18 判据 2). Mirrored locally instead of importing the live-preview
 * module: one regex must not pull the widget/context-menu import graph into
 * the static export pipeline — keep both call sites' comments pointing here.
 */
const TASK_DONE_RE = /\[x\]/i

// ---- lists -------------------------------------------------------------------

export async function renderList(node: SyntaxNode, ctx: RenderCtx): Promise<string> {
  const ordered = node.name === 'OrderedList'
  let startAttr = ''
  if (ordered) {
    const firstMark = node.firstChild?.getChild('ListMark')
    if (firstMark) {
      const num = parseInt(textOf(ctx, firstMark), 10)
      if (Number.isFinite(num) && num !== 1) startAttr = ` start="${num}"`
    }
  }

  const items: string[] = []
  for (let item = node.firstChild; item; item = item.nextSibling) {
    if (item.name !== 'ListItem') continue
    items.push(await renderListItem(item, ctx))
  }
  const tag = ordered ? 'ol' : 'ul'
  return `<${tag}${startAttr}>\n${items.join('\n')}\n</${tag}>`
}

async function renderListItem(item: SyntaxNode, ctx: RenderCtx): Promise<string> {
  let checkbox = ''
  const content: string[] = []
  for (let child = item.firstChild; child; child = child.nextSibling) {
    switch (child.name) {
      case 'ListMark':
        break
      case 'Task': {
        // Task wraps TaskMarker + the item's inline content.
        const marker = child.getChild('TaskMarker')
        if (marker) {
          checkbox = `<input type="checkbox" disabled${TASK_DONE_RE.test(textOf(ctx, marker)) ? ' checked' : ''}> `
        }
        content.push(await renderInlineChildren(child, ctx, (n) => n.name !== 'TaskMarker'))
        break
      }
      case 'Paragraph':
        // Tight-list item: emit the paragraph's inline content without <p>.
        content.push(await renderInlineChildren(child, ctx))
        break
      default:
        if (child.name === 'BulletList' || child.name === 'OrderedList') {
          content.push(await renderList(child, ctx))
        } else if (child.name === 'FencedCode') {
          content.push(await renderFencedCode(child, ctx))
        } else {
          content.push(await renderInlineChildren(child, ctx))
        }
        break
    }
  }
  return `<li>${checkbox}${content.join('')}</li>`
}

// ---- tables ------------------------------------------------------------------

/**
 * GFM 行的单元格槽位（列序）。空单元格在 lezer 树中没有 TableCell 节点——
 * 只剩相邻的 TableDelimiter 管道，故按管道结构数槽位，再把非空 TableCell
 * 节点映射到各自位置（与 editor/table/parse.ts padRow 的哨兵补空同口径）。
 * 首个 TableDelimiter 是行首管道不开槽；无行尾管道时收尾补最后一格。
 */
function rowCellSlots(row: SyntaxNode): (SyntaxNode | null)[] {
  const slots: (SyntaxNode | null)[] = []
  let current: SyntaxNode | null = null
  let isLeading = true
  for (let child = row.firstChild; child; child = child.nextSibling) {
    if (child.name === 'TableCell') {
      current = child
      isLeading = false
    } else if (child.name === 'TableDelimiter') {
      if (!isLeading) {
        slots.push(current)
        current = null
      }
      isLeading = false
    }
  }
  if (current) slots.push(current)
  return slots
}

export async function renderTable(node: SyntaxNode, ctx: RenderCtx): Promise<string> {
  // Alignment row: the TableDelimiter line following TableHeader.
  const aligns: string[] = []
  let headerNode: SyntaxNode | null = null
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === 'TableHeader') headerNode = child
    else if (child.name === 'TableDelimiter' && aligns.length === 0) {
      // Splitting '|:--|--:|' yields ['', ':--', '--:', ''] — drop the empty
      // edge segments so aligns[i] lines up with cell index i.
      const segments = textOf(ctx, child)
        .split('|')
        .map((s) => s.trim())
        .filter((s, i, arr) => !(s === '' && (i === 0 || i === arr.length - 1)))
      for (const d of segments) {
        const left = d.startsWith(':')
        const right = d.endsWith(':')
        aligns.push(left && right ? 'center' : right ? 'right' : left ? 'left' : '')
      }
    }
  }

  // Rectified column count: max cell count across rows (editor padRow parity).
  const rowNodes: SyntaxNode[] = []
  if (headerNode) rowNodes.push(headerNode)
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === 'TableRow') rowNodes.push(child)
  }
  const width = rowNodes.reduce((w, r) => Math.max(w, rowCellSlots(r).length), aligns.length)

  const renderRow = async (row: SyntaxNode, isHeader: boolean): Promise<string> => {
    const slots = rowCellSlots(row)
    const cells: string[] = []
    for (let i = 0; i < width; i++) {
      const cell = slots[i] ?? null
      const inner = cell ? await renderInlineChildren(cell, ctx) : ''
      const align = aligns[i] ? ` style="text-align:${aligns[i]}"` : ''
      cells.push(isHeader ? `<th${align}>${inner}</th>` : `<td${align}>${inner}</td>`)
    }
    return `<tr>${cells.join('')}</tr>`
  }

  const rows: string[] = []
  const bodyRows: string[] = []
  for (const [i, row] of rowNodes.entries()) {
    if (i === 0 && headerNode && row === headerNode) rows.push(await renderRow(row, true))
    else bodyRows.push(await renderRow(row, false))
  }
  const head = rows.length ? `<thead>\n${rows.join('\n')}\n</thead>` : ''
  const body = bodyRows.length ? `<tbody>\n${bodyRows.join('\n')}\n</tbody>` : ''
  return `<table>${head}${body}</table>`
}
