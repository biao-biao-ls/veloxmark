import type { EditorView } from '@codemirror/view'
import { t } from '../../i18n'
import { confirmDeleteTable } from '../contextMenu/opsTable'
import { getCtxRuntime } from '../contextMenu/registry'
import { openTableContextMenu, runTableOp } from './commands'
import { openGridPicker } from './gridPicker'
import { resizeTableOp, setAlignOp } from './ops'
import type { TableModel } from './parse'
import { resolveTableModel } from './resolve'
import { getTableEdit } from './state'

export interface TableToolbarOpts {
  view: EditorView
  /** Widget identity hint — events re-resolve from here (stale-instance). */
  sourceFrom: number
  /** Build-time model — PAINT ONLY (align pressed states). */
  model: TableModel
  /** Build-time active cell (fallback anchors for the event-time reads). */
  row: number
  col: number
}

/**
 * 7C: edit-state table toolbar (对照 table-focus.png) — left group
 * 「⊞ + 对齐三键」, right group 「⋮ + 🗑」.
 *
 * Layout (spec layout section): absolute bar on the gap outer, just ABOVE the
 * wrap — NOT inside wrap (`overflow-x: auto` clips escaped children) and NOT
 * in the 28px col-handle band (the `data-table-handle` probe family lives
 * there and must stay clickable). Paint-only overlap with the previous block;
 * zero layout shift (UX-P28 F3). Built only while editing; the bar is part of
 * the widget DOM and dies with it.
 *
 * Stale-instance discipline: closures hold `view` + `sourceFrom` hint only —
 * dims/column/anchor re-resolve at event time (getTableEdit / resolveTableModel).
 */
export function mountTableToolbar(host: HTMLElement, opts: TableToolbarOpts): void {
  const { view, sourceFrom, model, row, col } = opts
  const bar = document.createElement('div')
  bar.className = 'cm-md-table-toolbar'
  const left = document.createElement('div')
  left.className = 'cm-md-table-toolbar-group'
  const right = document.createElement('div')
  right.className = 'cm-md-table-toolbar-group'

  const btn = (glyph: string, title: string, onClick: (b: HTMLButtonElement) => void): HTMLButtonElement => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'cm-md-table-handle-btn cm-md-table-toolbar-btn'
    b.textContent = glyph
    b.title = title
    // Never let toolbar presses fall through to outer's click-to-source.
    b.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    b.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      onClick(b)
    })
    return b
  }

  // ⊞ — 7E grid picker, moved here from the hover bar (its interim home).
  left.appendChild(
    btn('⊞', t('table.gridPickerTitle'), (b) => {
      const resolved = resolveTableModel(view, sourceFrom)
      if (!resolved) return
      openGridPicker(b, {
        initRow: resolved.model.cells.length,
        initCol: resolved.model.colCount,
        onPick: (rows, nextCols) => {
          const a = getTableEdit(view.state).active
          runTableOp(
            view,
            sourceFrom,
            (m) => resizeTableOp(m, rows, nextCols, a?.row ?? 0, a?.col ?? 0),
            'input.table.resize'
          )
        }
      })
    })
  )

  // Align keys (7.4) — same setAlignOp + input.table.align as the menu items;
  // pressed state paints the build-time colon row (rebuilds track the source).
  const alignAtBuild = model.aligns[col] ?? ''
  for (const a of [
    { glyph: '◧', title: t('ctx.alignLeft'), value: 'left' },
    { glyph: '▣', title: t('ctx.alignCenter'), value: 'center' },
    { glyph: '◨', title: t('ctx.alignRight'), value: 'right' }
  ]) {
    const b = btn(a.glyph, a.title, () => {
      const targetCol = getTableEdit(view.state).active?.col ?? col
      runTableOp(view, sourceFrom, (m) => setAlignOp(m, targetCol, a.value), 'input.table.align')
    })
    if (alignAtBuild === a.value) b.classList.add('is-pressed')
    left.appendChild(b)
  }

  // ⋮ — the SAME menu as a cell right-click (ids/items/disabled stay one surface).
  right.appendChild(
    btn('⋮', t('table.moreTitle'), (b) => {
      const act = getTableEdit(view.state).active
      const rect = b.getBoundingClientRect()
      openTableContextMenu(view, sourceFrom, act?.row ?? row, act?.col ?? col, rect.left, rect.bottom + 2)
    })
  )

  // 🗑 — same confirm + toast as the menu's deleteTable (shared flow).
  right.appendChild(
    btn('🗑', t('ctx.deleteTable'), () => {
      const resolved = resolveTableModel(view, sourceFrom)
      if (!resolved) return
      const rt = getCtxRuntime()
      if (!rt) return
      confirmDeleteTable(view, { from: resolved.model.tableFrom, to: resolved.model.tableTo }, rt)
    })
  )

  bar.append(left, right)
  host.appendChild(bar)
}
