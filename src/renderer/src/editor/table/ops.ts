import { formatTable, type TableModel } from './parse'

/**
 * P10 table operations — pure functions over a TableModel.
 *
 * Every op returns a whole-table replace `{ from, to, insert }` plus the next
 * active cell (UI coordinates), so the caller can dispatch one atomic,
 * doc-level transaction (undo reverts the op in one step).
 */
export interface TableOp {
  from: number
  to: number
  insert: string
  /** UI coordinates (row 0 = header) for the post-op active cell. */
  nextActive: { row: number; col: number }
}

/** Mutable grid view of the model: rows[0] = header, texts raw. */
export function modelToGrid(model: TableModel): string[][] {
  return model.cells.map((row) => {
    const r = row.map((c) => c.text)
    while (r.length < model.colCount) r.push('')
    return r.slice(0, model.colCount)
  })
}

function opFrom(model: TableModel, grid: string[][], nextActive: { row: number; col: number }): TableOp {
  return {
    from: model.tableFrom,
    to: model.tableTo,
    insert: formatTable(model.aligns, grid),
    nextActive: {
      row: Math.max(0, Math.min(nextActive.row, grid.length - 1)),
      col: Math.max(0, Math.min(nextActive.col, Math.max(0, (grid[0]?.length ?? 1) - 1)))
    }
  }
}

/** Apply a pending cell-text commit onto a grid copy (sentinel-safe). */
export function gridWithCellText(model: TableModel, row: number, col: number, text: string): string[][] {
  const grid = modelToGrid(model)
  if (!grid[row]) return grid
  while (grid[row].length <= col) grid[row].push('')
  grid[row][col] = text
  return grid
}

/** Insert an empty row after `afterUiRow` (-1 = above header / at top). */
export function insertRowOp(model: TableModel, afterUiRow: number): TableOp {
  const grid = modelToGrid(model)
  const at = Math.max(0, Math.min(afterUiRow + 1, grid.length))
  // Never insert between header and delimiter semantics: body rows only,
  // i.e. at index >= 1. Inserting "above header" prepends a body row after
  // the header would be wrong — put it at index 1 when at === 0.
  const idx = at === 0 ? 1 : at
  grid.splice(idx, 0, new Array(model.colCount).fill(''))
  return opFrom(model, grid, { row: idx, col: 0 })
}

/** Append an empty body row at the end (Tab on the last cell). */
export function appendRowOp(model: TableModel): TableOp {
  const grid = modelToGrid(model)
  grid.push(new Array(model.colCount).fill(''))
  return opFrom(model, grid, { row: grid.length - 1, col: 0 })
}

/**
 * Delete UI row `row`. Deleting the header promotes the first body row
 * (GFM requires a header). Returns null when deletion is not allowed.
 */
export function deleteRowOp(model: TableModel, row: number): TableOp | null {
  const grid = modelToGrid(model)
  if (grid.length <= 1) return null
  if (row < 0 || row >= grid.length) return null
  grid.splice(row, 1)
  return opFrom(model, grid, { row: Math.min(row, grid.length - 1), col: 0 })
}

/** Insert an empty column at `at` (0..colCount). */
export function insertColOp(model: TableModel, at: number): TableOp {
  const grid = modelToGrid(model)
  const idx = Math.max(0, Math.min(at, model.colCount))
  for (const row of grid) row.splice(idx, 0, '')
  const aligns = [...model.aligns]
  aligns.splice(idx, 0, '')
  const insert = formatTable(aligns, grid)
  return {
    from: model.tableFrom,
    to: model.tableTo,
    insert,
    nextActive: { row: 0, col: idx }
  }
}

/** Delete column `at`. Returns null for the last remaining column. */
export function deleteColOp(model: TableModel, at: number): TableOp | null {
  if (model.colCount <= 1) return null
  if (at < 0 || at >= model.colCount) return null
  const grid = modelToGrid(model)
  for (const row of grid) row.splice(at, 1)
  const aligns = model.aligns.filter((_, i) => i !== at)
  const insert = formatTable(aligns, grid)
  return {
    from: model.tableFrom,
    to: model.tableTo,
    insert,
    nextActive: { row: 0, col: Math.min(at, aligns.length - 1) }
  }
}

/**
 * 7A: swap UI row `row` with its neighbor `dir` (-1 up / 1 down). Header
 * (row 0) may move DOWN (= swap with the first body row — GFM header is
 * always the first row, so a swap simply exchanges header content); rows
 * never move past either edge. `col` anchors the post-op active cell on the
 * moved row. Returns null at edges (menu also disables the item).
 */
export function moveRowOp(model: TableModel, row: number, col: number, dir: -1 | 1): TableOp | null {
  const grid = modelToGrid(model)
  const target = row + dir
  if (row < 0 || row >= grid.length) return null
  if (target < 0 || target >= grid.length) return null
  ;[grid[row], grid[target]] = [grid[target], grid[row]]
  return opFrom(model, grid, { row: target, col })
}

/**
 * 7A: swap column `col` with its neighbor `dir` (-1 left / 1 right).
 * `aligns` travels with the column. `row` anchors the post-op active cell.
 * Returns null at edges (menu also disables the item).
 */
export function moveColOp(model: TableModel, row: number, col: number, dir: -1 | 1): TableOp | null {
  if (col < 0 || col >= model.colCount) return null
  const target = col + dir
  if (target < 0 || target >= model.colCount) return null
  const grid = modelToGrid(model)
  for (const r of grid) [r[col], r[target]] = [r[target], r[col]]
  const aligns = [...model.aligns]
  while (aligns.length < model.colCount) aligns.push('')
  ;[aligns[col], aligns[target]] = [aligns[target], aligns[col]]
  return {
    from: model.tableFrom,
    to: model.tableTo,
    insert: formatTable(aligns, grid),
    nextActive: { row, col: target }
  }
}

/** Set column alignment ('' | 'left' | 'center' | 'right') + format table. */
export function setAlignOp(model: TableModel, col: number, align: string): TableOp | null {
  if (col < 0 || col >= model.colCount) return null
  const grid = modelToGrid(model)
  const aligns = [...model.aligns]
  while (aligns.length < model.colCount) aligns.push('')
  aligns[col] = align
  return {
    from: model.tableFrom,
    to: model.tableTo,
    insert: formatTable(aligns, grid),
    nextActive: { row: 0, col }
  }
}

/** Write one cell's text via whole-table rebuild (sentinel-safe commit path). */
export function writeCellOp(model: TableModel, row: number, col: number, text: string): TableOp {
  const grid = gridWithCellText(model, row, col, text)
  return opFrom(model, grid, { row, col })
}

/**
 * Parse clipboard text as TSV (Excel). Trailing newline dropped; quoted
 * fields unescaped (`""` → `"`, embedded tabs/newlines honored).
 */
export function parseTsv(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines.map((line) => {
    const fields: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"'
            i++
          } else inQuotes = false
        } else cur += ch
      } else if (ch === '"' && cur === '') {
        inQuotes = true
      } else if (ch === '\t') {
        fields.push(cur)
        cur = ''
      } else cur += ch
    }
    fields.push(cur)
    return fields
  })
}

/**
 * Paste a TSV matrix with its top-left at (row, col). Grows the table as
 * needed (new body rows / new columns, delimiter extended with `---`).
 * Cells are escaped (`|` → `\|`, newlines → `<br>`).
 */
export function pasteTsvOp(model: TableModel, row: number, col: number, tsv: string): TableOp | null {
  const matrix = parseTsv(tsv)
  if (matrix.length === 0 || matrix[0].length === 0) return null
  const grid = modelToGrid(model)
  const needCols = col + matrix[0].length
  const needRows = row + matrix.length
  const aligns = [...model.aligns]
  while (aligns.length < needCols) aligns.push('')
  const growRow = (r: string[]): void => {
    while (r.length < needCols) r.push('')
  }
  for (const r of grid) growRow(r)
  while (grid.length < needRows) {
    const fresh = new Array(needCols).fill('')
    grid.push(fresh)
  }
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      grid[row + r][col + c] = matrix[r][c]
        .replace(/\r\n|\r|\n/g, '<br>')
        .replace(/(?<!\\)\|/g, '\\|')
    }
  }
  return {
    from: model.tableFrom,
    to: model.tableTo,
    insert: formatTable(aligns, grid),
    nextActive: {
      row: Math.min(row + matrix.length - 1, grid.length - 1),
      col: Math.min(col + matrix[0].length - 1, needCols - 1)
    }
  }
}

/** Cut/copy/paste a single cell's raw source through the system clipboard. */
export function pasteCellOp(model: TableModel, row: number, col: number, text: string): TableOp {
  return writeCellOp(model, row, col, escapeForCell(text))
}

function escapeForCell(text: string): string {
  return text.replace(/\r\n|\r|\n/g, '<br>').replace(/(?<!\\)\|/g, '\\|')
}

// ---- P22: delimited-text conversion (convert-selection-to-table) -------------

export type DelimKind = 'tab' | 'comma' | 'pipe' | 'spaces'

/** Split one CSV line — no quote handling (documented: content delimiters may split cells). */
function splitCsvLine(line: string): string[] {
  return line.split(',').map((c) => c.trim())
}

/**
 * P22: split delimited plain text into a cell matrix. Empty lines are
 * ignored; cell contents are kept raw (delimiters inside a cell may split
 * it — GFM has no CSV quoting, documented in P22.md). Tab mode goes through
 * the P10 TSV parser so Excel quotes/newlines survive.
 */
export function parseDelimited(text: string, delim: DelimKind): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n').filter((l) => l.trim() !== '')
  if (lines.length === 0) return []
  if (delim === 'tab') return parseTsv(lines.join('\n'))
  return lines.map((line) => {
    if (delim === 'comma') return splitCsvLine(line)
    if (delim === 'pipe') {
      let s = line.trim()
      if (s.startsWith('|')) s = s.slice(1)
      if (s.endsWith('|')) s = s.slice(0, -1)
      return s.split('|').map((c) => c.trim())
    }
    return line
      .trim()
      .split(/\s{2,}|\t+/)
      .map((c) => c.trim())
  })
}

/**
 * P22 default delimiter for the convert dialog: Tab wins when any line has
 * one; else comma when ≥50% of lines contain commas (and commas beat pipes);
 * else pipe when ≥50% have them; else multi-space; else a comma-ish fallback.
 */
export function sniffDelimiter(text: string): DelimKind {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '')
  if (lines.length === 0) return 'tab'
  const n = lines.length
  const count = (re: RegExp): number => lines.filter((l) => re.test(l)).length
  if (count(/\t/) > 0) return 'tab'
  const commaLines = count(/,/)
  const pipeLines = count(/\|/)
  if (commaLines / n >= 0.5 && commaLines >= pipeLines) return 'comma'
  if (pipeLines / n >= 0.5) return 'pipe'
  if (count(/\s{2,}/) > 0) return 'spaces'
  return commaLines > 0 ? 'comma' : 'tab'
}
