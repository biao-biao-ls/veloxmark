/**
 * Pure GFM table parsing helpers. Kept free of DOM/CodeMirror imports so the
 * logic is unit-testable in node (see tableParse.test.ts).
 */

/** Render minimal inline markdown (**bold**, *italic*, `code`) as HTML. */
export function renderInlineCell(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

/** Split one table row into cells, honoring `\|` escapes. */
export function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells: string[] = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\' && s[i + 1] === '|') {
      cur += '|'
      i++
    } else if (ch === '|') {
      cells.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur.trim())
  return cells
}

/** Column alignment from a delimiter cell (`:---`, `:---:`, `---:`). */
export function alignmentOf(delimiter: string): string {
  const d = delimiter.trim()
  const left = d.startsWith(':')
  const right = d.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  if (left) return 'left'
  return ''
}
