import type { SyntaxNode } from '@lezer/common'
import { textOf, type RenderCtx } from './ctx'
import { renderFencedCode } from './code'
import { renderInlineChildren } from './inline'

// ---- lists & tables (3.15) ----
// (3C: moved verbatim from export/renderDoc.ts.)

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
          checkbox = `<input type="checkbox" disabled${textOf(ctx, marker).includes('x') ? ' checked' : ''}> `
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

  const renderRow = async (row: SyntaxNode, isHeader: boolean): Promise<string> => {
    const cells: string[] = []
    let i = 0
    for (let cell = row.firstChild; cell; cell = cell.nextSibling) {
      if (cell.name !== 'TableCell') continue
      const inner = await renderInlineChildren(cell, ctx)
      const align = aligns[i] ? ` style="text-align:${aligns[i]}"` : ''
      cells.push(isHeader ? `<th${align}>${inner}</th>` : `<td${align}>${inner}</td>`)
      i++
    }
    return `<tr>${cells.join('')}</tr>`
  }

  const rows: string[] = []
  if (headerNode) rows.push(await renderRow(headerNode, true))
  const bodyRows: string[] = []
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === 'TableRow') bodyRows.push(await renderRow(child, false))
  }
  const head = rows.length ? `<thead>\n${rows.join('\n')}\n</thead>` : ''
  const body = bodyRows.length ? `<tbody>\n${bodyRows.join('\n')}\n</tbody>` : ''
  return `<table>${head}${body}</table>`
}
