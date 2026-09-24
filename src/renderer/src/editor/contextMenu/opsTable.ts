/**
 * Table-cell delta（2C 自 registry.ts 平移）—— P10 migration ops + 三个文档级
 * 表格动作，在统一 item 平面上重建。ids are the cdp-p10/cdp-p27 contract；
 * labels 走 i18n。
 *
 * 文件末 `registerContextMenuOps('table-cell', …)` 是**模块级自举副作用**：经
 * registry.ts barrel 的 re-export 链在 registry 首次 import 时注册，与拆分前
 * 时序等价。UX-P28 B3 的 setActiveCell 语义注释随 factory 迁移。
 */
import type { EditorView } from '@codemirror/view'
import { t } from '../../i18n'
import {
  deleteColOp,
  deleteRowOp,
  insertColOp,
  insertRowOp,
  moveColOp,
  moveRowOp,
  pasteCellOp,
  setAlignOp,
  writeCellOp,
  type TableOp
} from '../table/ops'
import { unescapeCell, type TableModel } from '../table/parse'
import {
  deleteTableRange,
  formatTableSourceRange,
  tableMarkdown,
  tableModelOf
} from '../table/source'
import { getTableEdit, setActiveCell } from '../table/state'
import { registerContextMenuOps } from './deltaRegistry'
import { sep } from './menuSkeleton'
import type { CtxMenuItem, CtxRuntime } from './types'

// ---- table delta (P10 migration: one unified menu) ---------------------------

export interface TableDeltaDeps {
  view: EditorView
  tableFrom: number
  row: number
  col: number
  runOp: (opFn: (m: TableModel) => TableOp | null, userEvent: string) => boolean
  cellClipboard: (mode: 'cut' | 'copy' | 'paste') => void
  modelSpan: () => { from: number; to: number }
}

/**
 * Table-cell delta ops — the P10 context menu's product functions, rebuilt on
 * the unified item surface. Ids are the cdp-p10/cdp-p27 contract; labels go
 * through i18n (the old menu hard-coded English).
 */
export function tableDeltaItems(deps: TableDeltaDeps, rt: CtxRuntime): CtxMenuItem[] {
  const { view, tableFrom, row, col } = deps
  // 7A boundary disable (first half of the double insurance — the ops return
  // null at edges too): fresh dims at menu-build time via modelSpan re-parse.
  const dims = (() => {
    const s = deps.modelSpan()
    const m = tableModelOf(view, s.from, s.to)
    return { rows: m?.cells.length ?? 0, cols: m?.colCount ?? 0 }
  })()
  return [
    {
      id: 'insertRowAbove',
      label: t('ctx.insertRowAbove'),
      run: () => deps.runOp((m) => insertRowAboveOp(m, row), 'input.table.insertRow')
    },
    {
      id: 'insertRowBelow',
      label: t('ctx.insertRowBelow'),
      run: () => deps.runOp((m) => insertRowBelowOp(m, row), 'input.table.insertRow')
    },
    {
      id: 'deleteRow',
      label: t('ctx.deleteRow'),
      danger: true,
      run: () => {
        // wave③ toast 统一：结构删除需要完成反馈（插入/对齐保持安静——表格即时可见变化）。
        if (deps.runOp((m) => deleteRowOpSafe(m, row), 'input.table.deleteRow')) {
          rt.toast(t('toast.rowDeleted'))
        }
      }
    },
    {
      id: 'insertColLeft',
      label: t('ctx.insertColLeft'),
      run: () => deps.runOp((m) => insertColLeftOp(m, col), 'input.table.insertCol')
    },
    {
      id: 'insertColRight',
      label: t('ctx.insertColRight'),
      run: () => deps.runOp((m) => insertColRightOp(m, col), 'input.table.insertCol')
    },
    {
      id: 'deleteCol',
      label: t('ctx.deleteCol'),
      danger: true,
      run: () => {
        if (deps.runOp((m) => deleteColOpSafe(m, col), 'input.table.deleteCol')) {
          rt.toast(t('toast.colDeleted'))
        }
      }
    },
    {
      id: 'moveRowUp',
      label: t('ctx.moveRowUp'),
      disabled: row <= 0,
      run: () => deps.runOp((m) => moveRowUpOp(m, row, col), 'input.table.moveRow')
    },
    {
      id: 'moveRowDown',
      label: t('ctx.moveRowDown'),
      disabled: row >= dims.rows - 1,
      run: () => deps.runOp((m) => moveRowDownOp(m, row, col), 'input.table.moveRow')
    },
    {
      id: 'moveColLeft',
      label: t('ctx.moveColLeft'),
      disabled: col <= 0,
      run: () => deps.runOp((m) => moveColLeftOp(m, row, col), 'input.table.moveCol')
    },
    {
      id: 'moveColRight',
      label: t('ctx.moveColRight'),
      disabled: col >= dims.cols - 1,
      run: () => deps.runOp((m) => moveColRightOp(m, row, col), 'input.table.moveCol')
    },
    {
      id: 'alignLeft',
      label: t('ctx.alignLeft'),
      run: () => deps.runOp((m) => setAlignLeftOp(m, col), 'input.table.align')
    },
    {
      id: 'alignCenter',
      label: t('ctx.alignCenter'),
      run: () => deps.runOp((m) => setAlignCenterOp(m, col), 'input.table.align')
    },
    {
      id: 'alignRight',
      label: t('ctx.alignRight'),
      run: () => deps.runOp((m) => setAlignRightOp(m, col), 'input.table.align')
    },
    sep('table-sep-cell'),
    { id: 'cutCell', label: t('ctx.cutCell'), run: () => deps.cellClipboard('cut') },
    { id: 'copyCell', label: t('ctx.copyCell'), run: () => deps.cellClipboard('copy') },
    { id: 'pasteCell', label: t('ctx.pasteCell'), run: () => deps.cellClipboard('paste') },
    sep('table-sep-doc'),
    {
      id: 'copyTable',
      label: t('ctx.copyTable'),
      run: () => {
        const span = deps.modelSpan()
        const md = tableMarkdown(view, span.from, span.to)
        if (!md) return
        void rt.clipboardWrite(md).then(() => rt.toast(t('toast.copiedTable')))
      }
    },
    {
      id: 'formatTableSource',
      label: t('ctx.formatTableSource'),
      run: () => {
        const span = deps.modelSpan()
        const changed = formatTableSourceRange(view, span.from, span.to)
        rt.toast(t(changed ? 'toast.tableFormatted' : 'toast.tableUnchanged'))
      }
    },
    {
      id: 'deleteTable',
      label: t('ctx.deleteTable'),
      danger: true,
      run: () => {
        const span = deps.modelSpan()
        void rt
          .confirm({
            title: t('ctx.deleteTable'),
            message: t('ctx.deleteTableConfirm'),
            confirmLabel: t('ctx.deleteTable'),
            danger: true
          })
          .then((ok) => {
            if (ok) {
              deleteTableRange(view, span.from, span.to)
              rt.toast(t('toast.tableDeleted'))
            }
          })
      }
    }
  ]
}

// Op adapters — thin wrappers over the P10 pure ops; deps.runOp supplies the
// dispatch path (widget folds pending cell text; source-mode path dispatches
// straight).
const insertRowAboveOp = (m: TableModel, row: number): TableOp | null => insertRowOp(m, row - 1)
const insertRowBelowOp = (m: TableModel, row: number): TableOp | null => insertRowOp(m, row)
const deleteRowOpSafe = (m: TableModel, row: number): TableOp | null => deleteRowOp(m, row)
const insertColLeftOp = (m: TableModel, col: number): TableOp | null => insertColOp(m, col)
const insertColRightOp = (m: TableModel, col: number): TableOp | null => insertColOp(m, col + 1)
const deleteColOpSafe = (m: TableModel, col: number): TableOp | null => deleteColOp(m, col)
const moveRowUpOp = (m: TableModel, row: number, col: number): TableOp | null => moveRowOp(m, row, col, -1)
const moveRowDownOp = (m: TableModel, row: number, col: number): TableOp | null => moveRowOp(m, row, col, 1)
const moveColLeftOp = (m: TableModel, row: number, col: number): TableOp | null => moveColOp(m, row, col, -1)
const moveColRightOp = (m: TableModel, row: number, col: number): TableOp | null => moveColOp(m, row, col, 1)
const setAlignLeftOp = (m: TableModel, col: number): TableOp | null => setAlignOp(m, col, 'left')
const setAlignCenterOp = (m: TableModel, col: number): TableOp | null => setAlignOp(m, col, 'center')
const setAlignRightOp = (m: TableModel, col: number): TableOp | null => setAlignOp(m, col, 'right')

/**
 * table-cell delta — single source for the P10 migration ops + the three doc
 * level table actions. Both the widget path (td contextmenu → buildContextMenu
 * with a table-cell hit) and the editor-surface path (detect → same) land here:
 * (7A adds ids `moveRowUp`/`moveRowDown`/`moveColLeft`/`moveColRight` — same
 * contract regime, add-only.)
 * ops re-parse the model at click time (stale-instance discipline) and dispatch
 * whole-table replaces. Labels are i18n; ids are the cdp-p10/p27 contract.
 */
registerContextMenuOps('table-cell', (view, hit, rt) => {
  const span = hit.table
  if (!span) return []
  const runOp = (opFn: (m: TableModel) => TableOp | null, userEvent: string): boolean => {
    const model = tableModelOf(view, span.from, span.to)
    if (!model) return false
    const op = opFn(model)
    if (!op) return false
    // UX-P28 B3: unify with widget runTableOp semantics — set active cell
    // at op.nextActive (stays in edit mode, no raw-source explosion).
    // Remove the old selection:{anchor:op.from} that triggered enterTable's
    // escape hatch (blockTouched + !isActive → widget suppressed).
    // op.from = model.tableFrom (whole-table rewrite) → post-change table
    // starts at op.from → tableFrom correct.
    const tableFrom = getTableEdit(view.state).active?.tableFrom ?? span.from
    view.dispatch({
      changes: { from: op.from, to: op.to, insert: op.insert },
      effects: setActiveCell.of({
        tableFrom,
        row: op.nextActive.row,
        col: op.nextActive.col,
        caret: 0
      }),
      userEvent
    })
    return true
  }
  return tableDeltaItems(
    {
      view,
      tableFrom: span.from,
      row: span.row,
      col: span.col,
      runOp,
      cellClipboard: (mode) => {
        if (mode === 'paste') {
          void window.api.clipboardRead().then((text) => {
            if (!text) return
            runOp((m) => pasteCellOp(m, span.row, span.col, text), 'input.table.pasteCell')
          })
          return
        }
        const model = tableModelOf(view, span.from, span.to)
        const cell = model?.cells[span.row]?.[span.col]
        const text = cell ? unescapeCell(cell.text) : ''
        void window.api.clipboardWrite(text).then(() => {
          if (mode === 'cut') runOp((m) => writeCellOp(m, span.row, span.col, ''), 'input.table.cutCell')
        })
      },
      modelSpan: () => {
        const fresh = tableModelOf(view, span.from, span.to)
        return fresh ? { from: fresh.tableFrom, to: fresh.tableTo } : { from: span.from, to: span.to }
      }
    },
    rt
  )
})
