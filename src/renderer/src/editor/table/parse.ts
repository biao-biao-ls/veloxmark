
export interface CellInfo {
  text: string
  from: number
  to: number
}

export interface TableModel {
  aligns: string[]
  colCount: number
  cells: CellInfo[][]
  delimiterLineFrom: number
  delimiterLineTo: number
  tableFrom: number
  tableTo: number
}

const SENTINEL = -1

export function alignmentOf(delimiter: string): string {
  const d = delimiter.trim()
  const left = d.startsWith(':')
  const right = d.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  if (left) return 'left'
  return ''
}

export function effectiveAlign(align: string): string {
  return align === '' ? 'left' : align
}

export function splitRowWithOffsets(line: string, lineDocFrom: number): CellInfo[] {
  const leadPad = line.length - line.trimStart().length
  let s = line.trim()
  let cursor = lineDocFrom + leadPad
  if (s.startsWith('|')) {
    s = s.slice(1)
    cursor += 1
  }
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)

  const cells: CellInfo[] = []
  let cur = ''
  let curStart = cursor
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === '\\' && s[i + 1] === '|') {
      cur += '\\|'
      i += 2
      continue
    }
    if (ch === '|') {
      cells.push(trimmedCell(cur, curStart, cursor + i))
      cur = ''
      curStart = cursor + i + 1
      i += 1
      continue
    }
    cur += ch
    i += 1
  }
  cells.push(trimmedCell(cur, curStart, cursor + s.length))
  return cells
}

function trimmedCell(raw: string, from: number, to: number): CellInfo {
  const lead = raw.length - raw.trimStart().length
  const trail = raw.length - raw.trimEnd().length
  const lo = Math.min(from + lead, to - trail)
  const hi = Math.max(from + lead, to - trail)
  return { text: raw.trim(), from: lo, to: hi }
}

function padRow(cells: CellInfo[], colCount: number): CellInfo[] {
  const row = cells.slice(0, colCount)
  while (row.length < colCount) row.push({ text: '', from: SENTINEL, to: SENTINEL })
  return row
}

export function isSentinelCell(cell: CellInfo): boolean {
  return cell.from === SENTINEL
}

export function parseTableModel(source: string, tableFrom: number): TableModel {
  const lines = source.split('\n')
  const lineStarts: number[] = []
  let acc = tableFrom
  for (const l of lines) {
    lineStarts.push(acc)
    acc += l.length + 1
  }

  const used = lines
    .map((l, i) => ({ l, i }))
    .filter((x) => x.l.trim() !== '')

  const empty: TableModel = {
    aligns: [],
    colCount: 1,
    cells: [[{ text: '', from: SENTINEL, to: SENTINEL }]],
    delimiterLineFrom: tableFrom,
    delimiterLineTo: tableFrom,
    tableFrom,
    tableTo: tableFrom + source.length
  }
  if (used.length < 2) return empty

  const headerLine = used[0]
  const delimLine = used[1]
  const header = splitRowWithOffsets(headerLine.l, lineStarts[headerLine.i])
  const delim = splitRowWithOffsets(delimLine.l, lineStarts[delimLine.i])
  const bodyRows = used.slice(2).map((x) => splitRowWithOffsets(x.l, lineStarts[x.i]))
  let colCount = Math.max(header.length, 1)
  for (const r of bodyRows) colCount = Math.max(colCount, r.length)

  const aligns = Array.from({ length: colCount }, (_, i) =>
    delim[i] ? alignmentOf(delim[i].text) : ''
  )

  const cells: CellInfo[][] = [padRow(header, colCount), ...bodyRows.map((r) => padRow(r, colCount))]

  const last = used[used.length - 1]
  return {
    aligns,
    colCount,
    cells,
    delimiterLineFrom: lineStarts[delimLine.i],
    delimiterLineTo: lineStarts[delimLine.i] + delimLine.l.length,
    tableFrom,
    tableTo: lineStarts[last.i] + last.l.length
  }
}

export function escapeCell(text: string): string {
  // Must trim: parse reads cell text back as raw.trim(), and commit only replaces the
  // trimmed range. If a commit carries leading/trailing whitespace, the read-back value
  // never equals the committed value, and destroyHandoff->commitHandoff forms an endless
  // microtask commit loop on widget rebuilds (e.g. column resize), hanging the renderer.
  return text.replace(/\r\n|\r|\n/g, '<br>').replace(/(?<!\\)\|/g, '\\|').trim()
}

export function unescapeCell(text: string): string {
  return text.replaceAll('\\|', '|')
}

export function renderInlineCell(text: string): string {
  const escaped = unescapeCell(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

function delimiterText(align: string): string {
  if (align === 'center') return ':---:'
  if (align === 'left') return ':---'
  if (align === 'right') return '---:'
  return '---'
}

export function formatTable(aligns: string[], rows: string[][]): string {
  const colCount = Math.max(aligns.length, 1, ...rows.map((r) => r.length))
  const padCells = (row: string[]): string[] => {
    const out = row.slice(0, colCount)
    while (out.length < colCount) out.push('')
    return out
  }
  const grid = rows.map(padCells)
  const al = padCells(aligns)
  const widths: number[] = []
  for (let c = 0; c < colCount; c++) {
    let w = delimiterText(al[c]).length
    for (const row of grid) w = Math.max(w, row[c].length)
    widths.push(w)
  }
  const line = (cells: string[]): string =>
    `| ${cells.map((c, i) => c.padEnd(widths[i])).join(' | ')} |`
  const out: string[] = [line(grid[0]), line(al.map((a, i) => delimiterText(a).padEnd(widths[i])))]
  for (let r = 1; r < grid.length; r++) out.push(line(grid[r]))
  return out.join('\n')
}
