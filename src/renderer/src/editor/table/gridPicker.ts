import { t } from '../../i18n'
import { hushLayers } from '../../hooks/useHushLayer'
import { isDialogOverlayTarget } from '../../components/Dialog'

/**
 * 7E/FE-05: Excel-style rows×cols grid picker popover for existing tables
 * (对照 ui_02_table_edit.html .grid-pop). Hovering selects the target dims
 * anchored top-left (grow right/down = add rows/cols, shrink left/up = drop
 * them); the readout shows `R × C`; press-drag-release / Enter confirms ONCE
 * (AC-OP-07「拖选…并松开」— the caller dispatches one resizeTableOp
 * transaction); Escape / outside press cancels with no change. A preset row
 * under the readout (1×1 / 2×2 / 3×3 / 自动适应窗口) resizes straight to fixed
 * dims through the same onPick seam.
 *
 * FE-05 可选范围 (AC-RULE-12 / AC-ERR-13): the matrix upper bound is derived
 * per open as max(20, R0) × max(12, C0) — an over-limit table (e.g. 25×15)
 * keeps every existing row/column selectable; the picker never truncates
 * existing structure. Resize itself is purely the user's pick value (down to
 * 1×1 — AC-OP-07).
 *
 * DOM singleton (ctxMenu pattern — one popover at a time). Keyboard semantics
 * are pure (`gridPickerKey`) and unit-tested; keys mirror the P22
 * TableInsertDialog grid, kept separate because that dialog also owns the
 * convert mode + form patching contract.
 */

/** Base floors of the per-open upper bound (AC-RULE-12 「max(20,…)×max(12,…)」). */
export const GRID_MAX_ROW = 20
export const GRID_MAX_COL = 12

/** Nominal column width for the auto-fit estimate (see `estimateAutoFitCols`). */
export const GRID_AUTO_FIT_COL_PX = 96

export interface GridBounds {
  maxRow: number
  maxCol: number
}

/**
 * Runtime upper bound for one open: max(20, R0) × max(12, C0), per dimension
 * (a 25×10 table yields 25×12 — AC-ERR-13). Invalid dims fall back to 1×1
 * before the max, so the bound never collapses below the base floors.
 */
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

/** Pure key semantics: arrows clamp to `bounds`, Enter picks, Esc closes. */
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

/** Preset button ids (data-testid suffixes freeze the probe-facing literals). */
export type GridPresetId = '1x1' | '2x2' | '3x3' | 'autoFit'

export const GRID_PRESETS: readonly { id: GridPresetId; labelKey: string }[] = [
  { id: '1x1', labelKey: 'table.gridPreset1x1' },
  { id: '2x2', labelKey: 'table.gridPreset2x2' },
  { id: '3x3', labelKey: 'table.gridPreset3x3' },
  { id: 'autoFit', labelKey: 'table.gridPresetAutoFit' }
]

/**
 * Columns for「自动适应窗口」: available width ÷ nominal column width, clamped
 * to [1, maxCols]. Width is the editor content width at pick time (FE-05 裁决：
 * 任务称「既有窗口宽度估算列数逻辑」但代码库无此实现，取名义列宽折算 + 上界钳制).
 */
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
  /** Width available to the table at pick time (px). */
  fitWidth: number
}

/**
 * Target dims for a preset click. Fixed presets pick literal dims (always
 * within the 20×12 floor); autoFit keeps the current row count and derives
 * columns from the window width (see `estimateAutoFitCols`).
 */
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
  /** Current table dims — bound source AND initial highlight/readout (R0×C0). */
  initRow: number
  initCol: number
  /** Width available to the table (px) — auto-fit preset estimate source. */
  fitWidth?: number
  /** Confirm callback — dims at pick time (≥1×1 guaranteed). */
  onPick: (rows: number, cols: number) => void
}

let openPicker: { el: HTMLElement; teardown: () => void } | null = null
// FE-09: grid picker is a 'menu' tier hush layer (glb-hush:one-shot coverage).
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

/** Open the grid picker anchored under `anchor` (closes any previous one). */
export function openGridPicker(anchor: HTMLElement, opts: GridPickerOpts): void {
  closePicker()

  const bounds = gridUpperBound(opts.initRow, opts.initCol)
  let hoverRow = Math.max(1, Math.min(bounds.maxRow, Math.trunc(opts.initRow) || 1))
  let hoverCol = Math.max(1, Math.min(bounds.maxCol, Math.trunc(opts.initCol) || 1))
  /** Press-drag-release (AC-OP-07): true from cell press until the pick. */
  let dragging = false

  const el = document.createElement('div')
  el.className = 'table-grid-picker'
  el.tabIndex = 0
  el.setAttribute('role', 'grid')
  el.setAttribute('aria-label', t('table.gridPickerTitle'))
  el.dataset.testid = 'grid-picker'

  const cellsWrap = document.createElement('div')
  cellsWrap.className = 'table-grid-picker-cells'
  // Dynamic column count: the bound is per-open (max 20×12 floor, wider for
  // over-limit tables) so the template can't live in static CSS.
  cellsWrap.style.gridTemplateColumns = `repeat(${bounds.maxCol}, var(--grid-cell-size))`

  const readout = document.createElement('div')
  readout.className = 'table-grid-picker-readout'
  readout.dataset.testid = 'grid-picker-readout'
  // ui_02 .grid-pop-label (line 668): <b>R × C</b> · 缩放整表 — dims live in <b>
  // (accent/600), the「· 缩放整表」suffix is a gray (--fg-dim) tail (N1 补齐,
  // 间隔点与空格口径逐字对齐设计 DOM：space + U+00B7 + space).
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
      // ui_02 .gcell.sel is uniform — no solid anchor cell (批 E FE-05#5).
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
  /** Shared by the preset click and the drag-release-over-preset path. */
  const applyPreset = (id: GridPresetId): void => {
    // autoFit keeps the TABLE's current rows (init R0), not the hover pick —
    // the preset resizes the live table, independent of the pending selection.
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
    // FE-09 扩展-5: Esc is owned by the hush bus (one-shot quiet / modal
    // topmost, glb-hush:one-shot) — same delegation as MenuBar/EditorContextMenu,
    // never gridPicker's own close (that path bypassed the bus and could not
    // yield to a modal). close() reuses closePicker via the registration below.
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

  // Outside mousedown cancels (zero change). Capture phase: runs before the
  // editor/table handlers that live under the anchor.
  const onOutside = (e: MouseEvent): void => {
    if (e.target instanceof Node && el.contains(e.target)) return
    // FE-09 PEND-04: modal overlay owns its gestures — yield, don't close.
    if (isDialogOverlayTarget(e.target)) return
    closePicker()
  }
  // AC-OP-07: release confirms ONCE after a cell press-drag (a plain click is
  // press+release on one cell). Release over a preset button after a cell
  // press runs THAT preset (mouseup never synthesizes a click across elements
  // — the old drop was a silent dead zone with zero feedback, IT-01-FE-05
  // Minor); elsewhere the hover pick confirms. A plain preset click keeps its
  // own click path (mousedown on the button never sets `dragging` → this
  // handler bails, no double pick).
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

  // Theme vars (--widget-surface/--bg/--accent-*) are declared on the theme
  // wrapper (.app.theme-*), NOT :root — mount inside it or every surface var
  // resolves blank (UI-ELEM-02「无空白不可见」/ PRD ⊞ 网格选择器空白缺陷).
  // position:fixed keeps viewport coordinates; .app carries no transform.
  const host = anchor.closest('.app') ?? document.body
  host.appendChild(el)
  // Position after mount so the dynamic-height popover (over-limit matrices
  // scroll) can be clamped fully on-screen (AC-RULE-10 边缘可达).
  const rect = anchor.getBoundingClientRect()
  el.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - el.offsetWidth - 8))}px`
  el.style.top = `${Math.min(rect.bottom + 4, Math.max(8, window.innerHeight - el.offsetHeight - 8))}px`
  openPicker = { el, teardown }
  // FE-09 layering registration — close() reuses closePicker (keeps teardown).
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
