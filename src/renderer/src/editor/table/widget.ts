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
  liveNestedText,
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

export { setNestedPreviewField, activeNestedView, resolveWithFallback, exitTableEdit }

const tableNav: NestedNavFns = {
  move: moveCell,
  exit: exitTableEdit,
  tsv: handleTsvPaste,
  struct: tryStructCmd,
  openMenu: openTableMenuAtActive,
  undoMain: undoWithAck
}

export const tableStructBindings = structKeyBindings(tryStructCmd)

export const tableMenuBindings = menuKeyBindings(openTableMenuAtActive)


export interface TableWidgetActive {
  row: number
  col: number
  caret: number
}

export interface TableWidgetSpec {
  active: TableWidgetActive | null
  editing: boolean
  colWidths?: number[]
  theme: ThemeName
  i18nEpoch?: number
}

function widthsEqual(a?: number[], b?: number[]): boolean {
  if (a === b) return true
  if (!a || !b) return (a?.length ?? 0) === 0 && (b?.length ?? 0) === 0
  return a.length === b.length && a.every((w, i) => w === b[i])
}


export class TableWidget extends BlockWidget {
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
  }

  toDOM(view: EditorView): HTMLElement {
    this._view = view
    const model = parseTableModel(this.source, this.sourceFrom)
    const active = this.spec.active
    const editing = this.spec.editing

    const wrap = document.createElement('div')
    wrap.className = 'cm-md-table-wrap'
    if (editing) wrap.classList.add('cm-md-table-editing')
    wrap.dataset.tableFrom = String(this.sourceFrom)

    const table = document.createElement('table')
    table.className = 'cm-md-table'

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
        const headerRow = table.querySelector('thead tr')
        const cellEl = headerRow?.children[col] as HTMLElement | undefined
        if (!cellEl) return
        const startWidths = Array.from(headerRow?.children ?? []).map((c) =>
          Math.round((c as HTMLElement).getBoundingClientRect().width)
        )
        const startW = startWidths[col] ?? Math.round(cellEl.getBoundingClientRect().width)
        const startTableW = table.getBoundingClientRect().width
        const startTableStyleW = table.style.width
        const startX = e.clientX
        const contentW = wrap.clientWidth > 0 ? wrap.clientWidth : undefined
        const clamp = { min: MIN_COL_WIDTH, max: contentW }
        const isLast = col === startWidths.length - 1

        const pointerId = (e as MouseEvent & { pointerId?: number }).pointerId
        try {
          if (typeof pointerId === 'number') grip.setPointerCapture(pointerId)
        } catch {
        }

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
            table.style.width = `${startTableW + (next[col] - startW)}px`
          } else if (col + 1 < startWidths.length) {
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
          }
          const dx = ev.clientX - startX
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
        const key = handoffKey(this.sourceFrom, active.row, active.col)
        // CM runs toDOM before the old widget's destroy, so the handoff slot may still
        // be empty here — prefer the previous nested session's live text to prevent
        // old/new text committing in a death loop
        const handoffText = getHandoff(key)
        const cellText = liveNestedText(key) ?? handoffText ?? (cell?.text ?? '')
        mountCellEditor(el, cellText, this.spec.theme, view, active.caret, tableNav, key)
      } else {
        el.innerHTML = renderInlineCell(cell?.text ?? '')
        el.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return
          e.preventDefault()
          e.stopPropagation()
          const verdict = judgeClickSemantics({ hitTarget: 'table', selectionEmpty: true })
          if (verdict.kind !== 'edit') return
          let caret: number | undefined
          if (e.clientX !== 0 || e.clientY !== 0) {
            try {
              const pos = document.caretPositionFromPoint?.(e.clientX, e.clientY)
              if (pos && pos.offsetNode && el.contains(pos.offsetNode)) {
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
                caret = renderedLen > 0
                  ? Math.round((charOffset / renderedLen) * cellTextLen)
                  : undefined
              }
            } catch {
            }
          }
          activateCellAt(view, this.sourceFrom, uiRow, col, caret)
        })
      }
      if (uiRow === 0) {
        addColGrip(el, col)
      }
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        openTableContextMenu(view, this.sourceFrom, uiRow, col, e.clientX, e.clientY)
      })
    }

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
    bindTableChromeHost(wrap, { editing, view, zoneId: this.sourceFrom })

    const outer = document.createElement('div')
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
      const verdict = judgeClickSemantics({ hitTarget: 'table', selectionEmpty: true })
      if (verdict.kind !== 'edit') return
      enterTableEdit(view, this.sourceFrom)
    })
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
    destroyHandoff(dom, this._view, this.spec.active, this.sourceFrom)
  }

  ignoreEvent(): boolean {
    return true
  }
}

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
    const table: Record<string, (m: TableModel, x: number, y: number) => TableOp | null> = {
      insertRow: (m, x) => insertRowOp(m, x),
      deleteRow: (m, x) => deleteRowOp(m, x),
      insertCol: (m, x) => insertColOp(m, x),
      deleteCol: (m, x) => deleteColOp(m, x),
      moveRowUp: (m, x, y) => moveRowOp(m, x, y, -1),
      moveRowDown: (m, x, y) => moveRowOp(m, x, y, 1),
      moveColLeft: (m, x, y) => moveColOp(m, y, x, -1),
      moveColRight: (m, x, y) => moveColOp(m, y, x, 1),
      resizeTable: (m, x, y) => resizeTableOp(m, x, y),
      alignLeft: (m, x) => setAlignOp(m, x, 'left'),
      alignCenter: (m, x) => setAlignOp(m, x, 'center'),
      alignRight: (m, x) => setAlignOp(m, x, 'right')
    }
    const fn = table[kind]
    if (!fn) return false
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
