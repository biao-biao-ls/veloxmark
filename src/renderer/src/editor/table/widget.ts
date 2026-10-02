/**
 * P10 interactive table widget (task 3.11 residual — TableWidget + col-grip +
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
import { judgeClickSemantics } from '../clickSemantics'
import { parseTableModel, renderInlineCell, type CellInfo, type TableModel } from './parse'
import {
  deleteColOp,
  deleteRowOp,
  insertColOp,
  insertRowOp,
  moveColOp,
  moveRowOp,
  resizeTableOp,
  setAlignOp,
  type TableOp
} from './ops'
import { bindTableChromeHost, mountTableToolbar } from './toolbar'
import { setActiveCell, setColWidth } from './state'
import {
  absorbNeighbor,
  deleteColWidths,
  dragEndWidths,
  insertColWidths,
  isDragCommit,
  MIN_COL_WIDTH,
  moveColWidths
} from './colWidth'
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
  commitActiveOnly,
  enterTableEdit,
  exitTableEdit,
  handleTsvPaste,
  moveCell,
  openTableContextMenu,
  openTableMenuAtActive,
  runTableOp,
  tryStructCmd
} from './commands'
import { menuKeyBindings, structKeyBindings, type Dir, type NestedNavFns } from './keymap'
import { undoWithAck } from '../../hooks/useToast'

// Public entry re-exports (3.11/3.12): lifecycle.ts binds activeNestedView /
// resolveWithFallback / exitTableEdit here; setup.ts binds setNestedPreviewField.
export { setNestedPreviewField, activeNestedView, resolveWithFallback, exitTableEdit }

/** Command callbacks injected into the nested session (cycle-break seam). */
const tableNav: NestedNavFns = {
  move: moveCell,
  exit: exitTableEdit,
  tsv: handleTsvPaste,
  struct: tryStructCmd,
  openMenu: openTableMenuAtActive,
  // FE-07/AC-OP-12: in-cell Mod-z fallback → main history +「已撤销」ack.
  undoMain: undoWithAck
}

/**
 * 7B: main-editor backstop bindings (prepended to setup.ts's keymap.of) —
 * tryStructCmd returns false outside table edit, so keys fall through to the
 * default bindings and nothing is hijacked globally.
 */
export const tableStructBindings = structKeyBindings(tryStructCmd)

/**
 * Q8 backstop: Shift+F10 / Menu key open the ⋮=right-click menu when table
 * edit is active (openTableMenuAtActive returns false outside → fall-through).
 */
export const tableMenuBindings = menuKeyBindings(openTableMenuAtActive)

// ---- widget ------------------------------------------------------------------

export interface TableWidgetActive {
  row: number
  col: number
  caret: number
}

export interface TableWidgetSpec {
  active: TableWidgetActive | null
  /** AC-FN-29: edit chrome (toolbar/grips) on — true for the cell-active form
   *  AND the step-back edit form (`active: null`); decoupled from `active` so
   *  the toolbar survives the graded step-back. */
  editing: boolean
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
      other.spec.editing === this.spec.editing &&
      (other.spec.active?.row ?? -1) === (this.spec.active?.row ?? -1) &&
      (other.spec.active?.col ?? -1) === (this.spec.active?.col ?? -1) &&
      widthsEqual(other.spec.colWidths, this.spec.colWidths)
    )
    // caret intentionally excluded: caret-only changes reuse the DOM.
    // editing participates: quiet ↔ step-back form both have `active: null`
    // and MUST rebuild (toolbar mounts/unmounts on that edge).
  }

  toDOM(view: EditorView): HTMLElement {
    this._view = view // UX-P28: store for destroy() microtask dispatch.
    const model = parseTableModel(this.source, this.sourceFrom)
    const active = this.spec.active
    // AC-FN-29: edit chrome follows the edit session (spec.editing), not the
    // active cell — the step-back form keeps toolbar/grips with no nested editor.
    const editing = this.spec.editing

    const wrap = document.createElement('div')
    wrap.className = 'cm-md-table-wrap'
    if (editing) wrap.classList.add('cm-md-table-editing')
    wrap.dataset.tableFrom = String(this.sourceFrom)

    const table = document.createElement('table')
    table.className = 'cm-md-table'

    // FE-06: colgroup always present (bare <col> is a layout no-op) so the drag
    // path has uniform `col[data-col]` targets; a table whose columns are ALL
    // pinned sizes to their sum — that total is the PEND-10 "总宽" the rightmost
    // boundary is allowed to change (width:100% would freeze it at the wrap).
    const cg = document.createElement('colgroup')
    let pinnedSum = 0
    let allPinned = model.colCount > 0
    for (let c = 0; c < model.colCount; c++) {
      const col = document.createElement('col')
      col.dataset.col = String(c)
      const w = this.spec.colWidths?.[c]
      if (w && w > 0) {
        col.style.width = `${w}px`
        pinnedSum += w
      } else {
        allPinned = false
      }
      cg.appendChild(col)
    }
    table.appendChild(cg)
    if (allPinned) table.style.width = `${pinnedSum}px`

    // FE-03 (G-2 去把手，ADR Q2 删4留1): row/col +/- handle family is gone —
    // structure ops only run from toolbar / ⋮ menu / context menu / keymap.
    // Sole survivor: the col-width grip inside header th (`data-table-handle`
    // contract = {col-grip}).

    const addColGrip = (el: HTMLElement, col: number): void => {
      const grip = document.createElement('span')
      grip.className = 'cm-md-col-grip'
      grip.title = t('tableHandle.colGrip')
      grip.dataset.tableHandle = 'col-grip'
      grip.dataset.testid = 'col-grip'
      grip.dataset.col = String(col)
      grip.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        // UX-P28 F3: header cell is always children[col] (no handle offset).
        const headerRow = table.querySelector('thead tr')
        const cellEl = headerRow?.children[col] as HTMLElement | undefined
        if (!cellEl) return
        // FE-06 stale-instance-safe snapshots: absorb math trades RENDERED px
        // (what the user sees), never the stored map (0 = auto poisons sums).
        const startWidths = Array.from(headerRow?.children ?? []).map((c) =>
          Math.round((c as HTMLElement).getBoundingClientRect().width)
        )
        const startW = startWidths[col] ?? Math.round(cellEl.getBoundingClientRect().width)
        const startTableW = table.getBoundingClientRect().width
        const startTableStyleW = table.style.width
        const startX = e.clientX
        // 钳制上界 = 正文列宽 (wrap is the content-column box).
        const contentW = wrap.clientWidth > 0 ? wrap.clientWidth : undefined
        const clamp = { min: MIN_COL_WIDTH, max: contentW }
        const isLast = col === startWidths.length - 1

        // 防误触: pointer capture keeps the gesture owned by the grip even when
        // the cursor leaves the window; the end-threshold below turns a bare
        // click into a no-op (no tableColWidths writeback). Chrome fires
        // PointerEvent for mouse input — probe events may not carry an id.
        const pointerId = (e as MouseEvent & { pointerId?: number }).pointerId
        try {
          if (typeof pointerId === 'number') grip.setPointerCapture(pointerId)
        } catch {
          // synthetic/probe events may lack capture — document listeners cover them
        }

        // UI-IXD-16: vertical indicator line following the pointer while dragging.
        const line = document.createElement('div')
        line.className = 'cm-md-col-drag-line'
        line.dataset.testid = 'col-drag-line'
        line.style.display = 'none'
        wrap.appendChild(line)

        let painted = false
        const paint = (w: number): void => {
          const next = absorbNeighbor(startWidths, col, w, clamp)
          const paintCol = (c: number, width: number): void => {
            const colEl = table.querySelector(`col[data-col="${c}"]`) as HTMLElement | null
            if (colEl) colEl.style.width = `${width}px`
            else {
              const target = headerRow?.children[c] as HTMLElement | undefined
              if (target) target.style.minWidth = `${width}px`
            }
          }
          paintCol(col, next[col])
          if (isLast) {
            // 最右列例外: total follows the dragged width (clamped into the
            // content column by absorbNeighbor).
            table.style.width = `${startTableW + (next[col] - startW)}px`
          } else if (col + 1 < startWidths.length) {
            // 右邻吸收: the pair trades in real time, total untouched.
            paintCol(col + 1, next[col + 1])
          }
          painted = true
        }
        const revert = (): void => {
          if (!painted) return
          for (let c = 0; c < startWidths.length; c++) {
            const colEl = table.querySelector(`col[data-col="${c}"]`) as HTMLElement | null
            if (colEl) colEl.style.width = `${startWidths[c]}px`
          }
          table.style.width = startTableStyleW
          painted = false
        }
        const onMove = (ev: MouseEvent): void => {
          const dx = ev.clientX - startX
          if (!isDragCommit(dx)) return
          line.style.display = 'block'
          line.style.left = `${ev.clientX - wrap.getBoundingClientRect().left + wrap.scrollLeft}px`
          paint(Math.round(startW + dx))
        }
        const onUp = (ev: MouseEvent): void => {
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
          line.remove()
          try {
            if (typeof pointerId === 'number') grip.releasePointerCapture(pointerId)
          } catch {
            // capture may already be gone with the pointer
          }
          const dx = ev.clientX - startX
          // null = mistouch (click without movement) — widths stay untouched.
          const next = dragEndWidths(
            startWidths,
            col,
            Math.round(startW + dx),
            dx,
            clamp
          )
          if (!next) {
            revert()
            return
          }
          view.dispatch({
            effects: setColWidth.of({ tableFrom: this.sourceFrom, widths: next })
          })
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      })
      el.append(grip)
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
          // FE-09 AC-RULE-13 unified decision (ren-click:semantics): cell
          // content cannot host a text selection (preventDefault above), so
          // this press-release is a click gesture — writer path first → table
          // edit form (AC-FN-03 cell-activation path, zero-regression).
          const verdict = judgeClickSemantics({ hitTarget: 'table', selectionEmpty: true })
          if (verdict.kind !== 'edit') return
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
      // FE-03: only the col-width grip mounts (header cells) — the +/− handle
      // family is removed (G-2), structure ops live on the toolbar / ⋮ menu /
      // context menu / keymap four surfaces.
      // FE-10 (方案 A): the grip mounts on every header cell — rest state is
      // zero-paint via CSS (AC-FN-23), hover reveal is chromeState-debounced
      // (≥150ms, .cm-md-chrome-on), editing keeps the FE-03 hit strip.
      if (uiRow === 0) {
        addColGrip(el, col)
      }
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        openTableContextMenu(view, this.sourceFrom, uiRow, col, e.clientX, e.clientY)
      })
    }

    // UX-P28 F3: pure <table> — no handle th/tr. Handles are absolutely
    // positioned inside content cells via mountCell → addColGrip (FE-03).
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

    // Hover bar stays copy-only (7C moved ⊞ to the edit toolbar).
    const toolbarItems: BlockToolbarItem[] = [
      {
        label: t('toolbar.copy'),
        title: t('table.copyTitle'),
        onClick: (btn) => void this.copyWithFeedback(this.source, btn, t('toast.copiedTable'))
      }
    ]
    this.attachBlockToolbar(wrap, toolbarItems)
    // FE-10: table chrome 显隐宿主 — hover debounced micro reveal / edit
    // phase / hush reset all route through the chromeState machine.
    bindTableChromeHost(wrap, { editing, view, zoneId: this.sourceFrom })

    // Outer gap wrapper with a custom click-to-form: padding clicks commit any
    // pending cell text and land the table on its edit form WITHOUT an active
    // cell (AC-FN-29 graded step-back — the toolbar stays; only the AC-FN-21/22
    // quiet paths do the full exit). Table-internal blanks never quiet-exit.
    const outer = document.createElement('div')
    // .cm-md-table-outer: positioning scope for the 7C edit toolbar only —
    // the shared .cm-md-block-gap rule stays untouched.
    outer.className = 'cm-md-block-gap cm-md-table-outer'
    outer.appendChild(wrap)
    outer.addEventListener('mousedown', (e) => {
      if (
        e.target instanceof Element &&
        e.target.closest('.cm-md-block-toolbar, .cm-md-table, .cm-md-table-toolbar')
      ) {
        return
      }
      e.preventDefault()
      // FE-09 AC-RULE-13: gap press is a click gesture (unselectable padding)
      // — edit:table verdict routes to the table form's graded step-back
      // (AC-FN-29/AC-FN-03 miss path: enter/keep edit form, no active cell).
      const verdict = judgeClickSemantics({ hitTarget: 'table', selectionEmpty: true })
      if (verdict.kind !== 'edit') return
      enterTableEdit(view, this.sourceFrom)
    })
    // 7C: edit toolbar — mounted while the edit form is on (cell-active OR the
    // AC-FN-29 step-back form); dies with this widget DOM. Build-time
    // model/active paint only (align pressed state); events re-resolve.
    if (editing) {
      mountTableToolbar(outer, {
        view,
        sourceFrom: this.sourceFrom,
        model,
        row: active?.row ?? 0,
        col: active?.col ?? 0
      })
    }
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
  op(view: EditorView, from: number, kind: string, arg = 0, arg2 = 0): boolean {
    // 7A move kinds: arg = row (moveRow*) / col (moveCol*), arg2 = the anchor
    // (col for rows / row for cols) so nextActive follows the moved line.
    const table: Record<string, (m: TableModel, x: number, y: number) => TableOp | null> = {
      insertRow: (m, x) => insertRowOp(m, x),
      deleteRow: (m, x) => deleteRowOp(m, x),
      insertCol: (m, x) => insertColOp(m, x),
      deleteCol: (m, x) => deleteColOp(m, x),
      moveRowUp: (m, x, y) => moveRowOp(m, x, y, -1),
      moveRowDown: (m, x, y) => moveRowOp(m, x, y, 1),
      moveColLeft: (m, x, y) => moveColOp(m, y, x, -1),
      moveColRight: (m, x, y) => moveColOp(m, y, x, 1),
      // 7E: arg = rows, arg2 = cols (anchor defaults to 0,0 on the probe path).
      resizeTable: (m, x, y) => resizeTableOp(m, x, y),
      alignLeft: (m, x) => setAlignOp(m, x, 'left'),
      alignCenter: (m, x) => setAlignOp(m, x, 'center'),
      alignRight: (m, x) => setAlignOp(m, x, 'right')
    }
    const fn = table[kind]
    if (!fn) return false
    // wave③: drive the SAME userEvents as product paths so dispatch-layer
    // feedback (structure toasts) are exercised end-to-end by probes too.
    const userEvent =
      ({
        insertRow: 'input.table.insertRow',
        deleteRow: 'input.table.deleteRow',
        insertCol: 'input.table.insertCol',
        deleteCol: 'input.table.deleteCol',
        moveRowUp: 'input.table.moveRow',
        moveRowDown: 'input.table.moveRow',
        moveColLeft: 'input.table.moveCol',
        moveColRight: 'input.table.moveCol',
        resizeTable: 'input.table.resize',
        alignLeft: 'input.table.align',
        alignCenter: 'input.table.align',
        alignRight: 'input.table.align'
      } as Record<string, string>)[kind] ?? 'test.table.op'
    // FE-06/AC-ERR-03: probes run the SAME width-remap seam as product paths.
    const widthsRemap =
      ({
        insertCol: (w: readonly number[]) => insertColWidths(w, arg),
        deleteCol: (w: readonly number[]) => deleteColWidths(w, arg),
        moveColLeft: (w: readonly number[]) => moveColWidths(w, arg, arg - 1),
        moveColRight: (w: readonly number[]) => moveColWidths(w, arg, arg + 1),
        resizeTable: (w: readonly number[]) => [...w]
      } as Record<string, (w: readonly number[]) => readonly number[]>)[kind]
    runTableOp(view, from, (m) => fn(m, arg, arg2), userEvent, widthsRemap)
    return true
  },
  pasteTsv(view: EditorView, tsv: string): void {
    handleTsvPaste(view, tsv)
  }
}
if (typeof window !== 'undefined') {
  ;(window as unknown as { __veloxTable?: unknown }).__veloxTable = tableTestHook
}
