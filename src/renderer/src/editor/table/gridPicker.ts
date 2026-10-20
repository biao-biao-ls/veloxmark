import { t } from '../../i18n'
import { hushLayers } from '../../hooks/useHushLayer'
import { isDialogOverlayTarget } from '../../components/Dialog'


export const GRID_MAX_ROW = 20
export const GRID_MAX_COL = 12

export const GRID_AUTO_FIT_COL_PX = 96

export interface GridBounds {
  maxRow: number
  maxCol: number
}

export function gridUpperBound(initRow: number, initCol: number): GridBounds {
  const rows = Math.trunc(initRow)
  const cols = Math.trunc(initCol)
  return {
    maxRow: Math.max(GRID_MAX_ROW, Number.isFinite(rows) && rows > 0 ? rows : 1),
    maxCol: Math.max(GRID_MAX_COL, Number.isFinite(cols) && cols > 0 ? cols : 1)
  }
}

export type GridKeyOutcome =
  | { kind: 'move'; row: number; col: number }
  | { kind: 'pick'; row: number; col: number }
  | { kind: 'close' }

export function gridPickerKey(
  key: string,
  row: number,
  col: number,
  bounds: GridBounds
): GridKeyOutcome | null {
  if (key === 'ArrowDown') return { kind: 'move', row: Math.min(bounds.maxRow, row + 1), col }
  if (key === 'ArrowUp') return { kind: 'move', row: Math.max(1, row - 1), col }
  if (key === 'ArrowRight') return { kind: 'move', row, col: Math.min(bounds.maxCol, col + 1) }
  if (key === 'ArrowLeft') return { kind: 'move', row, col: Math.max(1, col - 1) }
  if (key === 'Enter') return { kind: 'pick', row, col }
  if (key === 'Escape') return { kind: 'close' }
  return null
}

export type GridPresetId = '1x1' | '2x2' | '3x3' | 'autoFit'

export const GRID_PRESETS: readonly { id: GridPresetId; labelKey: string }[] = [
  { id: '1x1', labelKey: 'table.gridPreset1x1' },
  { id: '2x2', labelKey: 'table.gridPreset2x2' },
  { id: '3x3', labelKey: 'table.gridPreset3x3' },
  { id: 'autoFit', labelKey: 'table.gridPresetAutoFit' }
]

export function estimateAutoFitCols(fitWidth: number, maxCols: number): number {
  const w = Math.trunc(fitWidth)
  const cap = Math.max(1, Math.trunc(maxCols) || 1)
  if (!Number.isFinite(w) || w <= 0) return 1
  return Math.max(1, Math.min(cap, Math.floor(w / GRID_AUTO_FIT_COL_PX)))
}

export interface PresetCtx {
  curRows: number
  curCols: number
  bounds: GridBounds
  fitWidth: number
}

export function presetDims(
  preset: GridPresetId,
  ctx: PresetCtx
): { rows: number; cols: number } {
  if (preset === '1x1') return { rows: 1, cols: 1 }
  if (preset === '2x2') return { rows: 2, cols: 2 }
  if (preset === '3x3') return { rows: 3, cols: 3 }
  const rows = Math.max(1, Math.min(ctx.bounds.maxRow, Math.trunc(ctx.curRows) || 1))
  return { rows, cols: estimateAutoFitCols(ctx.fitWidth, ctx.bounds.maxCol) }
}

export interface GridPickerOpts {
  initRow: number
  initCol: number
  fitWidth?: number
  onPick: (rows: number, cols: number) => void
}

let openPicker: { el: HTMLElement; teardown: () => void } | null = null
let hushOff: (() => void) | null = null

function closePicker(): void {
  if (!openPicker) return
  const { el, teardown } = openPicker
  openPicker = null
  hushOff?.()
  hushOff = null
  teardown()
  el.remove()
}

export function openGridPicker(anchor: HTMLElement, opts: GridPickerOpts): void {
  closePicker()

  const bounds = gridUpperBound(opts.initRow, opts.initCol)
  let hoverRow = Math.max(1, Math.min(bounds.maxRow, Math.trunc(opts.initRow) || 1))
  let hoverCol = Math.max(1, Math.min(bounds.maxCol, Math.trunc(opts.initCol) || 1))
  let dragging = false

  const el = document.createElement('div')
  el.className = 'table-grid-picker'
  el.tabIndex = 0
  el.setAttribute('role', 'grid')
  el.setAttribute('aria-label', t('table.gridPickerTitle'))
  el.dataset.testid = 'grid-picker'

  const cellsWrap = document.createElement('div')
  cellsWrap.className = 'table-grid-picker-cells'
  cellsWrap.style.gridTemplateColumns = `repeat(${bounds.maxCol}, var(--grid-cell-size))`

  const readout = document.createElement('div')
  readout.className = 'table-grid-picker-readout'
  readout.dataset.testid = 'grid-picker-readout'
  const readoutDims = document.createElement('b')
  readout.appendChild(readoutDims)
  const readoutSuffix = document.createElement('span')
  readoutSuffix.className = 'table-grid-picker-readout-suffix'
  readoutSuffix.dataset.testid = 'grid-picker-readout-suffix'
  readoutSuffix.textContent = ` · ${t('table.gridScaleFull')}`
  readout.appendChild(readoutSuffix)

  const presets = document.createElement('div')
  presets.className = 'table-grid-picker-presets'

  const cells: HTMLElement[] = []
  for (let r = 1; r <= bounds.maxRow; r++) {
    for (let c = 1; c <= bounds.maxCol; c++) {
      const cell = document.createElement('div')
      cell.className = 'table-grid-cell'
      cell.dataset.row = String(r)
      cell.dataset.col = String(c)
      cell.dataset.testid = 'grid-cell'
      cell.addEventListener('mouseenter', () => setHover(r, c))
      cell.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        dragging = true
        setHover(r, c)
      })
      cells.push(cell)
      cellsWrap.appendChild(cell)
    }
  }

  const paint = (): void => {
    for (const cell of cells) {
      const r = Number(cell.dataset.row)
      const c = Number(cell.dataset.col)
      cell.classList.toggle('is-hover', r <= hoverRow && c <= hoverCol)
    }
    readoutDims.textContent = `${hoverRow} × ${hoverCol}`
  }
  const setHover = (r: number, c: number): void => {
    hoverRow = r
    hoverCol = c
    paint()
  }
  const pickDims = (rows: number, cols: number): void => {
    closePicker()
    opts.onPick(rows, cols)
  }
  const pick = (): void => pickDims(hoverRow, hoverCol)
  const applyPreset = (id: GridPresetId): void => {
    const target = presetDims(id, {
      curRows: opts.initRow,
      curCols: opts.initCol,
      bounds,
      fitWidth: opts.fitWidth ?? window.innerWidth
    })
    pickDims(target.rows, target.cols)
  }

  for (const p of GRID_PRESETS) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'btn table-grid-picker-preset'
    b.dataset.testid = `grid-preset-${p.id}`
    b.dataset.preset = p.id
    b.textContent = t(p.labelKey)
    b.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    b.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      applyPreset(p.id)
    })
    presets.appendChild(b)
  }

  el.append(cellsWrap, readout, presets)

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (hushLayers.consumeTop() !== 'none') {
        e.preventDefault()
        e.stopPropagation()
      }
      return
    }
    const out = gridPickerKey(e.key, hoverRow, hoverCol, bounds)
    if (!out) return
    e.preventDefault()
    e.stopPropagation()
    if (out.kind === 'move') setHover(out.row, out.col)
    else if (out.kind === 'pick') pick()
    else closePicker()
  })

  const onOutside = (e: MouseEvent): void => {
    if (e.target instanceof Node && el.contains(e.target)) return
    if (isDialogOverlayTarget(e.target)) return
    closePicker()
  }
  const onRelease = (e: MouseEvent): void => {
    if (!dragging) return
    dragging = false
    const btn =
      e.target instanceof Element ? e.target.closest('.table-grid-picker-preset') : null
    const preset = btn ? GRID_PRESETS.find((p) => p.id === btn.getAttribute('data-preset')) : null
    if (preset && presets.contains(btn)) {
      applyPreset(preset.id)
      return
    }
    pick()
  }
  document.addEventListener('mousedown', onOutside, true)
  document.addEventListener('mouseup', onRelease)
  const teardown = (): void => {
    document.removeEventListener('mousedown', onOutside, true)
    document.removeEventListener('mouseup', onRelease)
  }

  const host = anchor.closest('.app') ?? document.body
  host.appendChild(el)
  const rect = anchor.getBoundingClientRect()
  el.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - el.offsetWidth - 8))}px`
  el.style.top = `${Math.min(rect.bottom + 4, Math.max(8, window.innerHeight - el.offsetHeight - 8))}px`
  openPicker = { el, teardown }
  hushOff = hushLayers.register({
    id: 'grid-picker',
    tier: 'menu',
    close: () => closePicker(),
    owns: (target) => target instanceof Node && el.contains(target),
    isAlive: () => el.isConnected
  })
  paint()
  el.focus()
}
