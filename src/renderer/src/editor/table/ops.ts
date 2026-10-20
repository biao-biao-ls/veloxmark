import { formatTable, type TableModel } from './parse'

export interface TableOp {
  from: number
  to: number
  insert: string
  nextActive: { row: number; col: number }
}

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

export function gridWithCellText(model: TableModel, row: number, col: number, text: string): string[][] {
  const grid = modelToGrid(model)
  if (!grid[row]) return grid
  while (grid[row].length <= col) grid[row].push('')
  grid[row][col] = text
  return grid
}

export function insertRowOp(model: TableModel, afterUiRow: number): TableOp {
  const grid = modelToGrid(model)
  const idx = Math.max(0, Math.min(afterUiRow + 1, grid.length))
  grid.splice(idx, 0, new Array(model.colCount).fill(''))
  return opFrom(model, grid, { row: idx, col: 0 })
}

export function appendRowOp(model: TableModel): TableOp {
  const grid = modelToGrid(model)
  grid.push(new Array(model.colCount).fill(''))
  return opFrom(model, grid, { row: grid.length - 1, col: 0 })
}

export function canDeleteRow(model: TableModel): boolean {
  return model.cells.length > 1
}

export function canDeleteCol(model: TableModel): boolean {
  return model.colCount > 1
}

export function deleteRowOp(model: TableModel, row: number): TableOp | null {
  if (!canDeleteRow(model)) return null
  const grid = modelToGrid(model)
  if (row < 0 || row >= grid.length) return null
  grid.splice(row, 1)
  return opFrom(model, grid, { row: Math.min(row, grid.length - 1), col: 0 })
}

export function insertColOp(model: TableModel, at: number): TableOp {
  const grid = modelToGrid(model)
  const idx = Math.max(0, Math.min(at, model.colCount))
  for (const row of grid) row.splice(idx, 0, '')
  const aligns = [...model.aligns]
  aligns.splice(idx, 0, 'left')
  const insert = formatTable(aligns, grid)
  return {
    from: model.tableFrom,
    to: model.tableTo,
    insert,
    nextActive: { row: 0, col: idx }
  }
}

export function deleteColOp(model: TableModel, at: number): TableOp | null {
  if (!canDeleteCol(model)) return null
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


export function insertRowAboveOp(model: TableModel, row: number): TableOp {
  return insertRowOp(model, row - 1)
}

export function insertRowBelowOp(model: TableModel, row: number): TableOp {
  return insertRowOp(model, row)
}

export function insertColLeftOp(model: TableModel, col: number): TableOp {
  return insertColOp(model, col)
}

export function insertColRightOp(model: TableModel, col: number): TableOp {
  return insertColOp(model, col + 1)
}

export function moveRowOp(model: TableModel, row: number, col: number, dir: -1 | 1): TableOp | null {
  const grid = modelToGrid(model)
  const target = row + dir
  if (row < 0 || row >= grid.length) return null
  if (target < 0 || target >= grid.length) return null
  ;[grid[row], grid[target]] = [grid[target], grid[row]]
  return opFrom(model, grid, { row: target, col })
}

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

export function resizeTableOp(
  model: TableModel,
  rows: number,
  cols: number,
  anchorRow = 0,
  anchorCol = 0
): TableOp | null {
  const tRows = Math.trunc(rows)
  const tCols = Math.trunc(cols)
  if (tRows < 1 || tCols < 1) return null
  const grid = modelToGrid(model)
  if (tRows === grid.length && tCols === model.colCount) return null
  while (grid.length < tRows) grid.push(new Array(tCols).fill(''))
  if (grid.length > tRows) grid.length = tRows
  for (const r of grid) {
    while (r.length < tCols) r.push('')
    if (r.length > tCols) r.length = tCols
  }
  const aligns = [...model.aligns]
  while (aligns.length < model.colCount) aligns.push('')
  aligns.length = model.colCount
  while (aligns.length < tCols) aligns.push('')
  if (aligns.length > tCols) aligns.length = tCols
  return {
    from: model.tableFrom,
    to: model.tableTo,
    insert: formatTable(aligns, grid),
    nextActive: {
      row: Math.max(0, Math.min(anchorRow, tRows - 1)),
      col: Math.max(0, Math.min(anchorCol, tCols - 1))
    }
  }
}

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

export function writeCellOp(model: TableModel, row: number, col: number, text: string): TableOp {
  const grid = gridWithCellText(model, row, col, text)
  return opFrom(model, grid, { row, col })
}

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

export function pasteCellOp(model: TableModel, row: number, col: number, text: string): TableOp {
  return writeCellOp(model, row, col, escapeForCell(text))
}

function escapeForCell(text: string): string {
  return text.replace(/\r\n|\r|\n/g, '<br>').replace(/(?<!\\)\|/g, '\\|')
}


export type DelimKind = 'tab' | 'comma' | 'pipe' | 'spaces'

function splitCsvLine(line: string): string[] {
  return line.split(',').map((c) => c.trim())
}

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
