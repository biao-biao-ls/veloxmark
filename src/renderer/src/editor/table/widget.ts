/**
 * P10 interactive table widget (task 3.11 residual — TableWidget + handles +
 * col-width drag + tableTestHook; the public entry for the table modules).
 *
 * Markdown stays the single source of truth: the widget is still one block
 * replace over the whole table source, but its DOM is a real HTML table.
 * Clicking a cell activates cell-editing state (tableEditField) and mounts a
 * nested CodeMirror view on that cell — so inline marks follow the same
 * P09 live-preview rules as the main editor. Cell commits and row/col ops
 * write back to the table source via precise transactions.
 *
 * Stale-instance discipline (P05 ImageWidget precedent): widget instances are
 * recreated on every decoration rebuild and event closures must NOT capture
 * cell offsets. Every handler re-resolves the table model from `view.state`
 * at event time (resolveTableModel), anchored on `tableFrom` which the
 * tableEditField maps through doc changes.
 *
 * Split map (tasks 3.7–3.12, docs/specs/3B-split-table-widget/):
 *   - resolve.ts       model re-resolution (resolveTableModel/resolveWithFallback)
 *   - nestedSession.ts UX-P28 handoff protocol (getHandoff/destroyHandoff/
 *                      commitHandoff) + nested cell-editor mount/teardown
 *   - commands.ts      moveCell/runTableOp/commitActiveOnly/exitTableEdit/…
 *   - keymap.ts        in-cell keymap/theme/TSV-paste factories (nav injected)
 * This file is the single public entry (no table/index.ts barrel — 3.12):
 * consumers (handlers-code.ts / setup.ts / lifecycle.ts) import from here.
 */
import type { EditorView } from '@codemirror/view'
import type { ThemeName } from '../theme'
import { t } from '../../i18n'
import { BlockWidget, type BlockToolbarItem } from '../blockWidget'
import { parseTableModel, renderInlineCell, type CellInfo, type TableModel } from './parse'
import { deleteColOp, deleteRowOp, insertColOp, insertRowOp, setAlignOp } from './ops'
import { getTableEdit, setActiveCell, setColWidth } from './state'
import {
  activeNestedView,
  destroyHandoff,
  getHandoff,
  handoffKey,
  mountCellEditor,
  setNestedPreviewField
} from './nestedSession'
import { resolveTableModel, resolveWithFallback } from './resolve'
import {
  activateCellAt,
  clearTableEditAndFocusSource,
  commitActiveOnly,
  exitTableEdit,
  handleTsvPaste,
  moveCell,
  openTableContextMenu,
  runTableOp
} from './commands'
import type { Dir, NestedNavFns } from './keymap'

// Public entry re-exports (3.11/3.12): lifecycle.ts binds activeNestedView /
// resolveWithFallback / exitTableEdit here; setup.ts binds setNestedPreviewField.
export { setNestedPreviewField, activeNestedView, resolveWithFallback, exitTableEdit }

/** Command callbacks injected into the nested session (cycle-break seam). */
const tableNav: NestedNavFns = { move: moveCell, exit: exitTableEdit, tsv: handleTsvPaste }

// ---- widget ------------------------------------------------------------------

export interface TableWidgetActive {
  row: number
  col: number
  caret: number
}

export interface TableWidgetSpec {
  active: TableWidgetActive | null
  colWidths?: number[]
  theme: ThemeName
  /** wave④: UI-language epoch — handle/toolbar titles are t()-sourced; the
   *  epoch in eq() forces DOM rebuild on language flips. */
  i18nEpoch?: number
}

function widthsEqual(a?: number[], b?: number[]): boolean {
  if (a === b) return true
  if (!a || !b) return (a?.length ?? 0) === 0 && (b?.length ?? 0) === 0
  return a.length === b.length && a.every((w, i) => w === b[i])
}

function handleBtn(
  label: string,
  title: string,
  onClick: () => void,
  disabled = false
): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.className = 'cm-md-table-handle-btn'
  btn.textContent = label
  btn.title = title
  btn.disabled = disabled
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!btn.disabled) onClick()
  })
  return btn
}

// ---- UX-P28: pending text handoff (correctness-critical) ---------------------
// Producer/consumer pair lives in nestedSession (destroyHandoff/getHandoff) —
// the destroy↔mount protocol must not be split apart. See nestedSession.ts.

export class TableWidget extends BlockWidget {
  /** UX-P28: view reference set in toDOM, used by destroy for microtask dispatch. */
  private _view: EditorView | null = null

  constructor(
    readonly source: string,
    sourceFrom: number,
    sourceTo: number,
    readonly spec: TableWidgetSpec
  ) {
    super(sourceFrom, sourceTo)
  }

  eq(other: TableWidget): boolean {
    return (
      other.source === this.source &&
      other.sourceFrom === this.sourceFrom &&
      other.spec.theme === this.spec.theme &&
      (other.spec.i18nEpoch ?? 0) === (this.spec.i18nEpoch ?? 0) &&
      (other.spec.active?.row ?? -1) === (this.spec.active?.row ?? -1) &&
      (other.spec.active?.col ?? -1) === (this.spec.active?.col ?? -1) &&
      widthsEqual(other.spec.colWidths, this.spec.colWidths)
    )
    // caret intentionally excluded: caret-only changes reuse the DOM.
  }

  toDOM(view: EditorView): HTMLElement {
    this._view = view // UX-P28: store for destroy() microtask dispatch.
    const model = parseTableModel(this.source, this.sourceFrom)
    const active = this.spec.active
    const editing = active != null

    const wrap = document.createElement('div')
    wrap.className = 'cm-md-table-wrap'
    if (editing) wrap.classList.add('cm-md-table-editing')
    wrap.dataset.tableFrom = String(this.sourceFrom)

    const table = document.createElement('table')
    table.className = 'cm-md-table'

    if (this.spec.colWidths?.some((w) => w > 0)) {
      const cg = document.createElement('colgroup')
      for (let c = 0; c < model.colCount; c++) {
        const col = document.createElement('col')
        col.dataset.col = String(c)
        const w = this.spec.colWidths?.[c]
        if (w && w > 0) col.style.width = `${w}px`
        cg.appendChild(col)
      }
      table.appendChild(cg)
    }

    // UX-P28 F3: handle buttons are now absolutely positioned INSIDE content
    // cells (not separate th/td). Row buttons live in td[data-col="0"];
    // col buttons + grip live in header th. This eliminates handle th/tr
    // from the table DOM → pure <table> with zero layout shift.

    const addRowHandles = (el: HTMLElement, uiRow: number): void => {
      const canDeleteRow = model.cells.length > 1
      const btnInsert = handleBtn('+', t('tableHandle.insertRowBelow'), () =>
        runTableOp(view, this.sourceFrom, (m) => insertRowOp(m, uiRow), 'input.table.insertRow')
      )
      btnInsert.className = 'cm-md-table-handle-btn cm-md-table-btn-row-insert'
      btnInsert.dataset.tableHandle = 'row-insert'
      btnInsert.dataset.row = String(uiRow)
      const btnDelete = handleBtn('−', t('tableHandle.deleteRow'), () =>
        runTableOp(view, this.sourceFrom, (m) => deleteRowOp(m, uiRow), 'input.table.deleteRow'),
        !canDeleteRow
      )
      btnDelete.className = 'cm-md-table-handle-btn cm-md-table-btn-row-delete'
      btnDelete.dataset.tableHandle = 'row-delete'
      btnDelete.dataset.row = String(uiRow)
      el.append(btnInsert, btnDelete)
    }

    const addColHandles = (el: HTMLElement, col: number): void => {
      const canDeleteCol = model.colCount > 1
      const btnInsert = handleBtn('+', t('tableHandle.insertColLeft'), () =>
        runTableOp(view, this.sourceFrom, (m) => insertColOp(m, col), 'input.table.insertCol')
      )
      btnInsert.className = 'cm-md-table-handle-btn cm-md-table-btn-col-insert'
      btnInsert.dataset.tableHandle = 'col-insert-left'
      btnInsert.dataset.col = String(col)
      const btnDelete = handleBtn('−', t('tableHandle.deleteCol'), () =>
        runTableOp(view, this.sourceFrom, (m) => deleteColOp(m, col), 'input.table.deleteCol'),
        !canDeleteCol
      )
      btnDelete.className = 'cm-md-table-handle-btn cm-md-table-btn-col-delete'
      btnDelete.dataset.tableHandle = 'col-delete'
      btnDelete.dataset.col = String(col)
      const grip = document.createElement('span')
      grip.className = 'cm-md-col-grip'
      grip.title = t('tableHandle.colGrip')
      grip.dataset.tableHandle = 'col-grip'
      grip.dataset.col = String(col)
      grip.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        // UX-P28 F3: header cell is always children[col] (no handle offset).
        const headerRow = table.querySelector('thead tr')
        const cellEl = headerRow?.children[col] as HTMLElement | undefined
        if (!cellEl) return
        const startW = cellEl.getBoundingClientRect().width
        const startX = e.clientX
        const applyLive = (w: number): void => {
          const colEl = table.querySelector(`col[data-col="${col}"]`) as HTMLElement | null
          if (colEl) colEl.style.width = `${w}px`
          else {
            const target = headerRow?.children[col] as HTMLElement | undefined
            if (target) target.style.minWidth = `${w}px`
          }
        }
        const onMove = (ev: MouseEvent): void => {
          applyLive(Math.max(40, Math.round(startW + (ev.clientX - startX))))
        }
        const onUp = (ev: MouseEvent): void => {
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
          const w = Math.max(40, Math.round(startW + (ev.clientX - startX)))
          const current = getTableEdit(view.state).colWidths.get(this.sourceFrom) ?? []
          const next = [...current]
          while (next.length <= col) next.push(0)
          next[col] = w
          view.dispatch({ effects: setColWidth.of({ tableFrom: this.sourceFrom, widths: next }) })
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      })
      el.append(btnInsert, btnDelete, grip)
    }

    const mountCell = (el: HTMLElement, uiRow: number, col: number, cell: CellInfo | undefined): void => {
      el.dataset.row = String(uiRow)
      el.dataset.col = String(col)
      const align = model.aligns[col]
      if (align) el.style.textAlign = align
      const isActive = active != null && active.row === uiRow && active.col === col
      if (isActive) {
        // UX-P28 D1: consume the pending handoff if this mount matches the
        // handoff cell — the destroy→remount cycle preserves pending text.
        const handoffText = getHandoff(handoffKey(this.sourceFrom, active.row, active.col))
        const cellText = handoffText ?? (cell?.text ?? '')
        mountCellEditor(el, cellText, this.spec.theme, view, active.caret, tableNav)
      } else {
        el.innerHTML = renderInlineCell(cell?.text ?? '')
        el.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return
          e.preventDefault()
          e.stopPropagation()
          // UX-P28 F2: map click position to caret offset within the rendered
          // cell text, then clamp to cell source length. Plain cells render
          // identically (exact); rich cells approximate (P2 exempt).
          // Skip synthetic (0,0) events (probe hooks) → default end-of-cell.
          let caret: number | undefined
          if (e.clientX !== 0 || e.clientY !== 0) {
            try {
              const pos = document.caretPositionFromPoint?.(e.clientX, e.clientY)
              if (pos && pos.offsetNode && el.contains(pos.offsetNode)) {
                // Walk text nodes to compute char offset within td.textContent.
                const walker = document.createTreeWalker(
                  el,
                  NodeFilter.SHOW_TEXT
                )
                let charOffset = 0
                while (walker.nextNode()) {
                  const node = walker.currentNode
                  if (node === pos.offsetNode) {
                    charOffset += pos.offset
                    break
                  }
                  charOffset += (node.textContent ?? '').length
                }
                const renderedLen = (el.textContent ?? '').length
                const cellTextLen = (cell?.text ?? '').length
                // Proportional mapping: rendered text may differ from source
                // (markdown marks stripped); clamp to cell source length.
                caret = renderedLen > 0
                  ? Math.round((charOffset / renderedLen) * cellTextLen)
                  : undefined
              }
            } catch {
              // caretPositionFromPoint may throw on edge cases; fall back to default.
            }
          }
          activateCellAt(view, this.sourceFrom, uiRow, col, caret)
        })
      }
      // UX-P28 F3: add absolutely-positioned handle buttons in editing mode.
      // Row buttons → first body column cells (td[data-col="0"], uiRow > 0).
      // Col buttons + grip → header cells (uiRow === 0).
      if (editing) {
        if (uiRow === 0) {
          addColHandles(el, col)
        } else if (col === 0) {
          addRowHandles(el, uiRow)
        }
      }
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        openTableContextMenu(view, this.sourceFrom, uiRow, col, e.clientX, e.clientY)
      })
    }

    // UX-P28 F3: pure <table> — no handle th/tr. Handles are absolutely
    // positioned inside content cells via mountCell → addRowHandles/addColHandles.
    const thead = document.createElement('thead')

    const headerCells = model.cells[0] ?? []
    const htr = document.createElement('tr')
    for (let c = 0; c < model.colCount; c++) {
      const th = document.createElement('th')
      mountCell(th, 0, c, headerCells[c])
      htr.appendChild(th)
    }
    thead.appendChild(htr)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    for (let r = 1; r < model.cells.length; r++) {
      const tr = document.createElement('tr')
      for (let c = 0; c < model.colCount; c++) {
        const td = document.createElement('td')
        mountCell(td, r, c, model.cells[r][c])
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    wrap.appendChild(table)

    const toolbarItems: BlockToolbarItem[] = [
      {
        label: t('toolbar.copy'),
        title: t('table.copyTitle'),
        onClick: (btn) => void this.copyWithFeedback(this.source, btn, t('toast.copiedTable'))
      }
    ]
    this.attachBlockToolbar(wrap, toolbarItems)

    // Outer gap wrapper with a custom click-to-source: padding clicks commit
    // any pending cell text, exit cell editing, and jump the cursor to the
    // table source (which then reveals the raw Markdown — existing escape hatch).
    const outer = document.createElement('div')
    outer.className = 'cm-md-block-gap'
    outer.appendChild(wrap)
    outer.addEventListener('mousedown', (e) => {
      if (e.target instanceof Element && e.target.closest('.cm-md-block-toolbar, .cm-md-table')) {
        return
      }
      e.preventDefault()
      clearTableEditAndFocusSource(view, this.sourceFrom)
    })
    return outer
  }

  destroy(dom: HTMLElement): void {
    // UX-P28 D1 handoff protocol (both ends in nestedSession): capture pending
    // text, stash one-shot handoff, schedule the microtask commit, tear down.
    destroyHandoff(dom, this._view, this.spec.active, this.sourceFrom)
  }

  ignoreEvent(): boolean {
    return true
  }
}

// Test/debug hook for CDP scripts (scripts/cdp-p10.mjs) — same pattern as
// window.__veloxEditor. DOM mousedown/contextmenu paths are exercised with
// synthetic events; these helpers drive nav/ops deterministically.
// P15: attached behind a window guard — vitest imports this module in a
// DOM-less node environment for buildDecorations snapshot tests.
const tableTestHook = {
  get nested(): EditorView | null {
    return activeNestedView()
  },
  resolve(view: EditorView, from: number): TableModel | null {
    return resolveTableModel(view, from)?.model ?? null
  },
  activate(view: EditorView, from: number, row: number, col: number, caret?: number): void {
    activateCellAt(view, from, row, col, caret)
  },
  move(view: EditorView, dir: Dir): boolean {
    const n = activeNestedView()
    if (!n) return false
    moveCell(n, view, dir)
    return true
  },
  setCellDoc(text: string): boolean {
    const n = activeNestedView()
    if (!n) return false
    n.dispatch({ changes: { from: 0, to: n.state.doc.length, insert: text } })
    return true
  },
  commit(view: EditorView): void {
    commitActiveOnly(view)
  },
  clearEdit(view: EditorView): void {
    view.dispatch({ effects: setActiveCell.of(null) })
  },
  op(view: EditorView, from: number, kind: string, arg = 0): boolean {
    const table = {
      insertRow: (m: TableModel, x: number) => insertRowOp(m, x),
      deleteRow: (m: TableModel, x: number) => deleteRowOp(m, x),
      insertCol: (m: TableModel, x: number) => insertColOp(m, x),
      deleteCol: (m: TableModel, x: number) => deleteColOp(m, x),
      alignLeft: (m: TableModel, x: number) => setAlignOp(m, x, 'left'),
      alignCenter: (m: TableModel, x: number) => setAlignOp(m, x, 'center'),
      alignRight: (m: TableModel, x: number) => setAlignOp(m, x, 'right')
    }[kind]
    if (!table) return false
    // wave③: drive the SAME userEvents as product paths so dispatch-layer
    // feedback (structure toasts) are exercised end-to-end by probes too.
    const userEvent =
      ({
        insertRow: 'input.table.insertRow',
        deleteRow: 'input.table.deleteRow',
        insertCol: 'input.table.insertCol',
        deleteCol: 'input.table.deleteCol',
        alignLeft: 'input.table.align',
        alignCenter: 'input.table.align',
        alignRight: 'input.table.align'
      } as Record<string, string>)[kind] ?? 'test.table.op'
    runTableOp(view, from, (m) => table(m, arg), userEvent)
    return true
  },
  pasteTsv(view: EditorView, tsv: string): void {
    handleTsvPaste(view, tsv)
  }
}
if (typeof window !== 'undefined') {
  ;(window as unknown as { __veloxTable?: unknown }).__veloxTable = tableTestHook
}
