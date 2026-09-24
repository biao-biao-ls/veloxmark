import { t } from '../../i18n'

/**
 * 7E: Excel-style rows×cols grid picker popover for existing tables
 * (对照 table-btn-1.png). Hovering selects the target dims anchored top-left
 * (grow right/down = add rows/cols, shrink left/up = drop them); the readout
 * shows `R × C`; click / Enter confirms ONCE (the caller dispatches one
 * resizeTableOp transaction); Escape / outside click cancels with no change.
 *
 * DOM singleton (ctxMenu pattern — one popover at a time). Keyboard semantics
 * are pure (`gridPickerKey`) and unit-tested; keys mirror the P22
 * TableInsertDialog grid, kept separate because that dialog also owns the
 * convert mode + form patching contract.
 */

export const GRID_MAX_ROW = 20
export const GRID_MAX_COL = 12

export type GridKeyOutcome =
  | { kind: 'move'; row: number; col: number }
  | { kind: 'pick'; row: number; col: number }
  | { kind: 'close' }

/** Pure key semantics for the picker grid: arrows clamp, Enter picks, Esc closes. */
export function gridPickerKey(key: string, row: number, col: number): GridKeyOutcome | null {
  if (key === 'ArrowDown') return { kind: 'move', row: Math.min(GRID_MAX_ROW, row + 1), col }
  if (key === 'ArrowUp') return { kind: 'move', row: Math.max(1, row - 1), col }
  if (key === 'ArrowRight') return { kind: 'move', row, col: Math.min(GRID_MAX_COL, col + 1) }
  if (key === 'ArrowLeft') return { kind: 'move', row, col: Math.max(1, col - 1) }
  if (key === 'Enter') return { kind: 'pick', row, col }
  if (key === 'Escape') return { kind: 'close' }
  return null
}

export interface GridPickerOpts {
  /** Initial highlight = current table dims. */
  initRow: number
  initCol: number
  /** Confirm callback — dims at pick time (≥1×1 guaranteed). */
  onPick: (rows: number, cols: number) => void
}

let openPicker: { el: HTMLElement; teardown: () => void } | null = null

function closePicker(): void {
  if (!openPicker) return
  const { el, teardown } = openPicker
  openPicker = null
  teardown()
  el.remove()
}

/** Open the grid picker anchored under `anchor` (closes any previous one). */
export function openGridPicker(anchor: HTMLElement, opts: GridPickerOpts): void {
  closePicker()

  let hoverRow = Math.max(1, Math.min(GRID_MAX_ROW, Math.trunc(opts.initRow) || 1))
  let hoverCol = Math.max(1, Math.min(GRID_MAX_COL, Math.trunc(opts.initCol) || 1))

  const el = document.createElement('div')
  el.className = 'table-grid-picker'
  el.tabIndex = 0
  el.setAttribute('role', 'grid')
  el.setAttribute('aria-label', t('table.gridPickerTitle'))

  const readout = document.createElement('div')
  readout.className = 'table-grid-picker-readout'

  const cells: HTMLElement[] = []
  for (let r = 1; r <= GRID_MAX_ROW; r++) {
    for (let c = 1; c <= GRID_MAX_COL; c++) {
      const cell = document.createElement('div')
      // Reuse the P22 dialog cell skin — same interaction, same look.
      cell.className = 'table-insert-cell'
      cell.dataset.row = String(r)
      cell.dataset.col = String(c)
      cell.addEventListener('mouseenter', () => setHover(r, c))
      cell.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        setHover(r, c)
        pick()
      })
      cells.push(cell)
      el.appendChild(cell)
    }
  }
  el.appendChild(readout)

  const paint = (): void => {
    for (const cell of cells) {
      const r = Number(cell.dataset.row)
      const c = Number(cell.dataset.col)
      cell.classList.toggle('is-hover', r <= hoverRow && c <= hoverCol)
    }
    readout.textContent = `${hoverRow} × ${hoverCol}`
  }
  const setHover = (r: number, c: number): void => {
    hoverRow = r
    hoverCol = c
    paint()
  }
  const pick = (): void => {
    const rows = hoverRow
    const cols = hoverCol
    closePicker()
    opts.onPick(rows, cols)
  }

  el.addEventListener('keydown', (e) => {
    const out = gridPickerKey(e.key, hoverRow, hoverCol)
    if (!out) return
    e.preventDefault()
    e.stopPropagation()
    if (out.kind === 'move') setHover(out.row, out.col)
    else if (out.kind === 'pick') pick()
    else closePicker()
  })

  // Outside mousedown cancels (zero change). Capture phase: runs before the
  // editor/table handlers that live under the anchor.
  const onOutside = (e: MouseEvent): void => {
    if (e.target instanceof Node && el.contains(e.target)) return
    closePicker()
  }
  document.addEventListener('mousedown', onOutside, true)
  const teardown = (): void => document.removeEventListener('mousedown', onOutside, true)

  const rect = anchor.getBoundingClientRect()
  el.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 180))}px`
  el.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 160)}px`
  document.body.appendChild(el)
  openPicker = { el, teardown }
  paint()
  el.focus()
}
