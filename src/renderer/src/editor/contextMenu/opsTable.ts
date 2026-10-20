import type { EditorView } from '@codemirror/view'
import { t } from '../../i18n'
import {
  canDeleteCol,
  canDeleteRow,
  deleteColOp,
  deleteRowOp,
  insertColLeftOp,
  insertColRightOp,
  insertRowAboveOp,
  insertRowBelowOp,
  moveColOp,
  moveRowOp,
  pasteCellOp,
  setAlignOp,
  writeCellOp,
  type TableOp
} from '../table/ops'
import { unescapeCell, effectiveAlign, parseTableModel, type TableModel } from '../table/parse'
import { cmKeyToDisplay, STRUCT_KEYS, type StructCmd } from '../table/keymap'
import { fmtShortcut } from '../../commands/shortcutDisplay'
import { undoAction } from '../../hooks/useToast'
import {
  deleteTableRange,
  formatTableSourceRange,
  tableMarkdown,
  tableModelOf
} from '../table/source'
import { colWidthRemapEffect, getTableEdit, setActiveCell, tableWrapClamp } from '../table/state'
import { resolveTableModel } from '../table/resolve'
import { deleteColWidths, insertColWidths, moveColWidths } from '../table/colWidth'
import { TABLE_OP_TOAST_KEYS, type TableMenuOpId } from '../table/contract'
import { withHandoffSuppressed } from '../table/nestedSession'
import { assertWritable } from '../readOnlyGuard'
import { registerContextMenuOps } from './deltaRegistry'
import { getCtxRuntime } from './ctxMenuStore'
import type { CtxMenuItem, CtxRuntime } from './types'

function whenWritable(apply: () => void): void {
  const path = getCtxRuntime()?.getActiveFilePath?.() ?? null
  if (path === null) {
    apply()
    return
  }
  void assertWritable().then((ok) => {
    if (ok) apply()
  })
}


export interface TableMenuItemSpec {
  id: TableMenuOpId
  labelKey: string
  shortcutCmd?: StructCmd
  danger?: boolean
  checked?: boolean
}

export interface TableMenuGroupSpec {
  groupId: 'rowOps' | 'colOps' | 'align' | 'cell' | 'structDelete'
  labelKey: string
  danger?: boolean
  items: readonly TableMenuItemSpec[]
}

export const TABLE_MENU_GROUPS: readonly TableMenuGroupSpec[] = [
  {
    groupId: 'rowOps',
    labelKey: 'menu.grp.rowOps',
    items: [
      { id: 'insertRowAbove', labelKey: 'ctx.insertRowAbove', shortcutCmd: 'insertRowAbove' },
      { id: 'insertRowBelow', labelKey: 'ctx.insertRowBelow', shortcutCmd: 'insertRowBelow' },
      { id: 'moveRowUp', labelKey: 'ctx.moveRowUp', shortcutCmd: 'moveRowUp' },
      { id: 'moveRowDown', labelKey: 'ctx.moveRowDown', shortcutCmd: 'moveRowDown' },
      { id: 'deleteRow', labelKey: 'ctx.deleteRow' }
    ]
  },
  {
    groupId: 'colOps',
    labelKey: 'menu.grp.colOps',
    items: [
      { id: 'insertColLeft', labelKey: 'ctx.insertColLeft', shortcutCmd: 'insertColLeft' },
      { id: 'insertColRight', labelKey: 'ctx.insertColRight', shortcutCmd: 'insertColRight' },
      { id: 'moveColLeft', labelKey: 'ctx.moveColLeft', shortcutCmd: 'moveColLeft' },
      { id: 'moveColRight', labelKey: 'ctx.moveColRight', shortcutCmd: 'moveColRight' },
      { id: 'deleteCol', labelKey: 'ctx.deleteCol' }
    ]
  },
  {
    groupId: 'align',
    labelKey: 'menu.grp.align',
    items: [
      { id: 'alignLeft', labelKey: 'ctx.alignLeft', checked: true },
      { id: 'alignCenter', labelKey: 'ctx.alignCenter', checked: true },
      { id: 'alignRight', labelKey: 'ctx.alignRight', checked: true }
    ]
  },
  {
    groupId: 'cell',
    labelKey: 'menu.grp.cell',
    items: [
      { id: 'cutCell', labelKey: 'ctx.cutCell' },
      { id: 'copyCell', labelKey: 'ctx.copyCell' },
      { id: 'pasteCell', labelKey: 'ctx.pasteCell' }
    ]
  },
  {
    groupId: 'structDelete',
    labelKey: 'menu.grp.structDelete',
    danger: true,
    items: [
      { id: 'copyTable', labelKey: 'ctx.copyTable' },
      { id: 'formatTableSource', labelKey: 'ctx.formatTableSource' },
      { id: 'deleteTable', labelKey: 'ctx.deleteTable', danger: true }
    ]
  }
]

export interface TableOpDisableCtx {
  row: number
  col: number
  rows: number
  cols: number
  canDelRow: boolean
  canDelCol: boolean
}

export function isTableOpDisabled(id: TableMenuOpId, ctx: TableOpDisableCtx): boolean {
  switch (id) {
    case 'moveRowUp':
      return ctx.row <= 0
    case 'moveColLeft':
      return ctx.col <= 0
    case 'deleteRow':
      return !ctx.canDelRow
    case 'deleteCol':
      return !ctx.canDelCol
    default:
      return false
  }
}


export interface TableDeltaDeps {
  view: EditorView
  tableFrom: number
  row: number
  col: number
  runOp: (
    opFn: (m: TableModel) => TableOp | null,
    userEvent: string,
    widthsRemap?: (prev: readonly number[]) => readonly number[]
  ) => boolean
  cellClipboard: (mode: 'cut' | 'copy' | 'paste') => void
  modelSpan: () => { from: number; to: number }
}

export function tableDeltaItems(deps: TableDeltaDeps, rt: CtxRuntime): CtxMenuItem[] {
  const { view, row, col } = deps
  const isMac = window.api.platform === 'darwin'
  const structShortcut = (cmd: StructCmd): string | undefined => {
    const hit = STRUCT_KEYS.find((k) => k.cmd === cmd)
    return hit ? fmtShortcut(cmKeyToDisplay(hit.key), isMac) : undefined
  }
  const model = (() => {
    const s = deps.modelSpan()
    return tableModelOf(view, s.from, s.to)
  })()
  const disableCtx: TableOpDisableCtx = {
    row,
    col,
    rows: model?.cells.length ?? 0,
    cols: model?.colCount ?? 0,
    canDelRow: model ? canDeleteRow(model) : false,
    canDelCol: model ? canDeleteCol(model) : false
  }
  const currentAlign = effectiveAlign(model?.aligns[col] ?? '')

  const toastReceipt = (id: TableMenuOpId): void => {
    const key = TABLE_OP_TOAST_KEYS[id]
    if (key)
      rt.toast({
        message: t(key, { i: row + 1, j: col + 1 }),
        action: undoAction(view)
      })
  }
  const runStructOp = (
    id: TableMenuOpId,
    opFn: (m: TableModel) => TableOp | null,
    userEvent: string,
    widthsRemap?: (prev: readonly number[]) => readonly number[]
  ): void => {
    whenWritable(() => {
      if (deps.runOp(opFn, userEvent, widthsRemap)) toastReceipt(id)
    })
  }

  const runFor = (id: TableMenuOpId): (() => void) | undefined => {
    switch (id) {
      case 'insertRowAbove':
        return () => runStructOp(id, (m) => insertRowAboveOp(m, row), 'input.table.insertRow')
      case 'insertRowBelow':
        return () => runStructOp(id, (m) => insertRowBelowOp(m, row), 'input.table.insertRow')
      case 'deleteRow':
        return () => runStructOp(id, (m) => deleteRowOp(m, row), 'input.table.deleteRow')
      case 'insertColLeft':
        return () =>
          runStructOp(
            id,
            (m) => insertColLeftOp(m, col),
            'input.table.insertCol',
            (w) => insertColWidths(w, col)
          )
      case 'insertColRight':
        return () =>
          runStructOp(
            id,
            (m) => insertColRightOp(m, col),
            'input.table.insertCol',
            (w) => insertColWidths(w, col + 1)
          )
      case 'deleteCol':
        return () =>
          runStructOp(
            id,
            (m) => deleteColOp(m, col),
            'input.table.deleteCol',
            (w) => deleteColWidths(w, col)
          )
      case 'moveRowUp':
        return () => runStructOp(id, (m) => moveRowOp(m, row, col, -1), 'input.table.moveRow')
      case 'moveRowDown':
        return () => runStructOp(id, (m) => moveRowOp(m, row, col, 1), 'input.table.moveRow')
      case 'moveColLeft':
        return () =>
          runStructOp(
            id,
            (m) => moveColOp(m, row, col, -1),
            'input.table.moveCol',
            (w) => moveColWidths(w, col, col - 1)
          )
      case 'moveColRight':
        return () =>
          runStructOp(
            id,
            (m) => moveColOp(m, row, col, 1),
            'input.table.moveCol',
            (w) => moveColWidths(w, col, col + 1)
          )
      case 'alignLeft':
        return () => runStructOp(id, (m) => setAlignOp(m, col, 'left'), 'input.table.align')
      case 'alignCenter':
        return () => runStructOp(id, (m) => setAlignOp(m, col, 'center'), 'input.table.align')
      case 'alignRight':
        return () => runStructOp(id, (m) => setAlignOp(m, col, 'right'), 'input.table.align')
      case 'cutCell':
        return () => whenWritable(() => deps.cellClipboard('cut'))
      case 'copyCell':
        return () => deps.cellClipboard('copy')
      case 'pasteCell':
        return () => whenWritable(() => deps.cellClipboard('paste'))
      case 'copyTable':
        return () => {
          const span = deps.modelSpan()
          const md = tableMarkdown(view, span.from, span.to)
          if (!md) return
          void rt.clipboardWrite(md).then(() => rt.toast(t('toast.copiedTable')))
        }
      case 'formatTableSource':
        return () => {
          whenWritable(() => {
            const span = deps.modelSpan()
            const changed = formatTableSourceRange(view, span.from, span.to)
            rt.toast(t(changed ? 'toast.tableFormatted' : 'toast.tableUnchanged'))
          })
        }
      case 'deleteTable':
        return () => confirmDeleteTable(view, deps.modelSpan(), rt)
      default:
        return undefined
    }
  }

  const items: CtxMenuItem[] = []
  TABLE_MENU_GROUPS.forEach((group, gi) => {
    if (gi > 0) items.push({ id: `sep-${group.groupId}`, label: '', separator: true })
    items.push({
      id: `group-${group.groupId}`,
      label: t(group.labelKey),
      groupTitle: t(group.labelKey),
      danger: group.danger
    })
    for (const spec of group.items) {
      items.push({
        id: spec.id,
        label: t(spec.labelKey),
        shortcut: spec.shortcutCmd ? structShortcut(spec.shortcutCmd) : undefined,
        disabled: isTableOpDisabled(spec.id, disableCtx),
        checked: spec.checked
          ? currentAlign === spec.id.replace('align', '').toLowerCase()
          : undefined,
        danger: spec.danger,
        run: runFor(spec.id)
      })
    }
  })
  return items
}

export function confirmDeleteTable(
  view: EditorView,
  span: { from: number; to: number },
  rt: CtxRuntime
): void {
  whenWritable(() => {
    void rt
      .confirm({
        titleKey: 'ctx.deleteTable',
        messageKey: 'ctx.deleteTableConfirm',
        confirmLabelKey: 'ctx.deleteTableConfirmOk',
        cancelLabelKey: 'dialog.cancel',
        danger: true
      })
      .then((ok) => {
        if (!ok) return
        let fresh: { from: number; to: number } | null = null
        try {
          const r = resolveTableModel(view, span.from)
          if (r) fresh = { from: r.model.tableFrom, to: r.model.tableTo }
        } catch {
          fresh = null
        }
        if (!fresh) return
        const del = fresh
        withHandoffSuppressed(() => {
          deleteTableRange(view, del.from, del.to)
        })
        rt.toast({ message: t('toast.tableDeleted'), action: undoAction(view) })
      })
  })
}


registerContextMenuOps('table-cell', (view, hit, rt) => {
  const span = hit.table
  if (!span) return []
  const runOp = (
    opFn: (m: TableModel) => TableOp | null,
    userEvent: string,
    widthsRemap?: (prev: readonly number[]) => readonly number[]
  ): boolean => {
    const model = tableModelOf(view, span.from, span.to)
    if (!model) return false
    const op = opFn(model)
    if (!op) return false
    const tableFrom = getTableEdit(view.state).active?.tableFrom ?? span.from
    const widthEffect = widthsRemap
      ? colWidthRemapEffect(
          view.state,
          tableFrom,
          parseTableModel(op.insert, 0).colCount,
          widthsRemap,
          tableWrapClamp(view, tableFrom)
        )
      : null
    withHandoffSuppressed(() => {
      view.dispatch({
        changes: { from: op.from, to: op.to, insert: op.insert },
        effects: [
          setActiveCell.of({
            tableFrom,
            row: op.nextActive.row,
            col: op.nextActive.col,
            caret: 0
          }),
          ...(widthEffect ? [widthEffect] : [])
        ],
        userEvent
      })
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
