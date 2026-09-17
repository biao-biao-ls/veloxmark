/**
 * P10 table source parsing — Markdown text stays the single source of truth.
 *
 * Every cell records its absolute source range in the main document, so
 * editing operations can write back through precise `view.dispatch` changes
 * (or a whole-table replace for structural ops).
 */

export interface CellInfo {
  /** Cell source text, trimmed; `\|` escapes kept raw. */
  text: string
  /** Absolute doc offset of the trimmed cell content start. */
  from: number
  /** Absolute doc offset just past the trimmed cell content. */
  to: number
}

export interface TableModel {
  /** Per-column alignment from the delimiter row ('' | left | center | right). */
  aligns: string[]
  /** Column count taken from the header row (GFM authority). */
  colCount: number
  /**
   * UI rows: index 0 = header, 1..n = body. The delimiter row is NOT part of
   * this grid — it is alignment metadata (see delimiterLineFrom/To).
   * Short rows are padded with sentinel cells (`from === to === -1`).
   */
  cells: CellInfo[][]
  delimiterLineFrom: number
  delimiterLineTo: number
  /** Absolute source range of the whole table (full lines). */
  tableFrom: number
  tableTo: number
}

/** Sentinel for cells missing from a ragged source row. */
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

/**
 * Split one table row into cells, preserving each cell's absolute source
 * range. Same tokenization rules as the old `splitRow`: leading/trailing
 * pipes stripped, `\|` does not split, cell text trimmed (range matches the
 * trim — surrounding spaces live outside [from, to)).
 */
export function splitRowWithOffsets(line: string, lineDocFrom: number): CellInfo[] {
  const leadPad = line.length - line.trimStart().length
  let s = line.trim()
  // Doc position of s[0].
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
  return { text: raw.trim(), from: from + lead, to: to - trail }
}

function padRow(cells: CellInfo[], colCount: number): CellInfo[] {
  const row = cells.slice(0, colCount)
  while (row.length < colCount) row.push({ text: '', from: SENTINEL, to: SENTINEL })
  return row
}

/** True when the cell has no real source range (ragged-row padding). */
export function isSentinelCell(cell: CellInfo): boolean {
  return cell.from === SENTINEL
}

/**
 * Parse a whole table's source into a model with absolute cell ranges.
 * `tableFrom` must be the doc offset of the first character of `source`.
 */
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
  const colCount = Math.max(header.length, 1)

  const aligns = Array.from({ length: colCount }, (_, i) =>
    delim[i] ? alignmentOf(delim[i].text) : ''
  )

  const cells: CellInfo[][] = [padRow(header, colCount)]
  // used[1] is the delimiter row — alignment metadata only, NOT a UI row.
  for (let r = 2; r < used.length; r++) {
    cells.push(padRow(splitRowWithOffsets(used[r].l, lineStarts[used[r].i]), colCount))
  }

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

/**
 * Commit-time escaping: newlines become `<br>` (Typora Shift+Enter semantics),
 * bare pipes become `\|`. Already-escaped `\|` is left alone.
 */
export function escapeCell(text: string): string {
  return text.replace(/\r\n|\r|\n/g, '<br>').replace(/(?<!\\)\|/g, '\\|')
}

/** Unescape cell source for rendered display (`\|` → `|`). */
export function unescapeCell(text: string): string {
  return text.replaceAll('\\|', '|')
}

/** Render minimal inline markdown (**bold**, *italic*, `code`) as HTML. */
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

/** Minimum delimiter cell width for an alignment ('---' = 3). */
function delimiterText(align: string): string {
  if (align === 'center') return ':---:'
  if (align === 'left') return ':---'
  if (align === 'right') return '---:'
  return '---'
}

/**
 * Rebuild the table source with `|` characters column-aligned. Cell texts are
 * written raw (escapes preserved); padding counts source characters, which is
 * exactly what visual source alignment needs.
 */
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
