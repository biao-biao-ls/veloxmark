/**
 * Table-cell delta（2C 自 registry.ts 平移）—— P10 migration ops + 三个文档级
 * 表格动作，在统一 item 平面上重建。ids are the cdp-p10/cdp-p27 contract；
 * labels 走 i18n。
 *
 * FE-04 五组分组呈现层（menu-tree §4 五组为 UI 真值）：行操作/列操作/对齐/
 * 单元格/结构删除，组名 groupTitle 非交互。四面同源：toast 回执键映射收口
 * contract.ts TABLE_OP_TOAST_KEYS；禁用规则与 FE-01 canDeleteRow/canDeleteCol
 * 同源；回显由 STRUCT_KEYS 单源派生（AC-RULE-11）。
 *
 * 文件末 `registerContextMenuOps('table-cell', …)` 是**模块级自举副作用**：经
 * registry.ts barrel 的 re-export 链在 registry 首次 import 时注册，与拆分前
 * 时序等价。UX-P28 B3 的 setActiveCell 语义注释随 factory 迁移。
 */
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

/**
 * P1 (AC-ERR-08/AC-RULE-16) — read-only gate consumer for the table-cell
 * write closures (runStructOp / cutCell / pasteCell / formatTableSource /
 * confirmDeleteTable). Thin wrapper over the IT-03/FE-04 guard:
 * - no active path (Untitled / no runtime) = assertWritable's own early
 *   answer (writable), taken synchronously so the existing sync dispatch +
 *   receipt shape is unchanged there;
 * - a real file path defers to the IPC probe — one probe per entry (the
 *   write and its receipt share the gate block), so a refused entry yields
 *   exactly one `err.readonly` toast and zero success toasts. Not cached
 *   across entries (chmod / 另存为 must be picked up).
 */
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

// ---- 五组分组呈现层（纯数据，单测断言） -------------------------------------

export interface TableMenuItemSpec {
  id: TableMenuOpId
  labelKey: string
  /** 有键项声明；无键项留空（右侧 kbd 留白）。回显由 STRUCT_KEYS 派生。 */
  shortcutCmd?: StructCmd
  danger?: boolean
  /** 对齐组 check 态项（当前对齐项打勾 ✓）。 */
  checked?: boolean
}

export interface TableMenuGroupSpec {
  /** 分组标识（非 data-op id，不进契约面扫描）。 */
  groupId: 'rowOps' | 'colOps' | 'align' | 'cell' | 'structDelete'
  labelKey: string
  /** 结构删除组：组标签带危险组徽标。 */
  danger?: boolean
  items: readonly TableMenuItemSpec[]
}

/** menu-tree §4 五组：行操作/列操作/对齐/单元格/结构删除（19 项 id 冻结）。 */
export const TABLE_MENU_GROUPS: readonly TableMenuGroupSpec[] = [
  {
    groupId: 'rowOps',
    labelKey: 'menu.grp.rowOps',
    items: [
      { id: 'insertRowAbove', labelKey: 'ctx.insertRowAbove', shortcutCmd: 'insertRowAbove' },
      { id: 'insertRowBelow', labelKey: 'ctx.insertRowBelow', shortcutCmd: 'insertRowBelow' },
      { id: 'moveRowUp', labelKey: 'ctx.moveRowUp', shortcutCmd: 'moveRowUp' },
      { id: 'moveRowDown', labelKey: 'ctx.moveRowDown', shortcutCmd: 'moveRowDown' },
      // danger 红仅属「删除表格」（CHANGE-13 / FE-01#6）：删行/列为普通前景。
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
      // danger 红仅属「删除表格」（CHANGE-13 / FE-01#6）：删行/列为普通前景。
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

/** 禁用判定上下文（菜单构建时从 model 提取）。 */
export interface TableOpDisableCtx {
  row: number
  col: number
  rows: number
  cols: number
  canDelRow: boolean
  canDelCol: boolean
}

/**
 * 禁用规则（AC-ERR-05/06、AC-FN-24、AC-ERR-02）：首行上移/首列左移灰显、
 * 最小结构禁删（FE-01 canDeleteRow/canDeleteCol 同源）。AC-RULE-07「禁用范围
 * 仅限『首行上移』与『首列左移』两项」（+ PEND-12 末行禁删唯一例外）——末行
 * 「下移该行」/末列「右移该列」**不灰显**（ui_03 mock 无此灰显、设计注释
 * 「表头保护灰显即语义」仅列两项）：边界点击走 op 边界 no-op（moveRowOp/
 * moveColOp 返回 null）静默无 toast，键盘路径同语义（CHANGE-19）。
 * 禁用即语义：不可点、不弹 toast 报错（UI-ELEM-04）。
 */
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

// ---- table delta (P10 migration: one unified menu) ---------------------------

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

/**
 * Table-cell delta ops — the P10 context menu's product functions, rebuilt on
 * the unified item surface. Ids are the cdp-p10/cdp-p27 contract; labels go
 * through i18n (the old menu hard-coded English).
 *
 * FE-04: five-group presentation (TABLE_MENU_GROUPS), shortcut echo derived
 * from STRUCT_KEYS, disable rules via isTableOpDisabled + FE-01 predicates,
 * toast receipts via TABLE_OP_TOAST_KEYS (four-face same source).
 */
export function tableDeltaItems(deps: TableDeltaDeps, rt: CtxRuntime): CtxMenuItem[] {
  const { view, row, col } = deps
  // 7D: shortcut hints — derived from the STRUCT_KEYS single source (7B file
  // header contract: key literals live in keymap.ts ONCE). Display-ready via
  // fmtShortcut (mac ⌘ pass), same convention as commands/menuLayout.ts.
  const isMac = window.api.platform === 'darwin'
  const structShortcut = (cmd: StructCmd): string | undefined => {
    const hit = STRUCT_KEYS.find((k) => k.cmd === cmd)
    return hit ? fmtShortcut(cmKeyToDisplay(hit.key), isMac) : undefined
  }
  // 7A boundary disable + FE-01 min-structure disable: fresh dims at menu-build
  // time via modelSpan re-parse.
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
  // UI-IXD-04 / CHANGE-14: GFM `---`（无冒号）渲染即左对齐——回显经
  // effectiveAlign 归一，与工具栏 is-pressed 同源。
  const currentAlign = effectiveAlign(model?.aligns[col] ?? '')

  // toast 回执（AC-OP-01~08 冻结文案）：成功后统一经 CtxRuntime.toast。
  // {i}/{j} 为 1 起（AC 冻结文案「第 i 行」）。FE-07: 结构回执携「撤销」按钮
  //（glb-toast:action，一次 undo 等效 Ctrl+Z）。
  const toastReceipt = (id: TableMenuOpId): void => {
    const key = TABLE_OP_TOAST_KEYS[id]
    if (key)
      rt.toast({
        message: t(key, { i: row + 1, j: col + 1 }),
        action: undoAction(view)
      })
  }
  /** runOp + toast 二合一：结构操作 op 的标准 run 闭包（P1 闸门在此收口）。 */
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

  // run 闭包接线：op id → 操作语义（op 参数映射走 ops.ts 单源适配器）。
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
        // P1: cut clears the cell (write) — gated; copy is a pure read and
        // must keep working on read-only files (AC-ERR-08 拦截的是写入).
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
          // P1 (AC-ERR-08): format rewrites the table source — write gate.
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

  // 五组渲染：groupTitle + 组间分隔线 + items（menu-tree §4 顺序）。
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

/**
 * 7C: shared delete-table flow (menu item + toolbar 🗑) — same confirm shape,
 * same `deleteTableRange`, same `toast.tableDeleted`. The span must be
 * re-resolved at event time (stale-instance discipline).
 *
 * FE-08 仅删表确认（AC-RULE-15 / Q3）：这是全仓唯一破坏性确认入口——删行/列
 * 无确认直执行。冻结文案/按钮 key 全取既有冻结面（frozenCopy.test 守护）；
 * Esc/点空白走 dialog 零副作用 cancel（PEND-04，不落事务即无 undo 栈条目）；
 * 确认后单事务删表 + 回执携「撤销」按钮（FE-07 undoAction，一步还原整表）。
 */
export function confirmDeleteTable(
  view: EditorView,
  span: { from: number; to: number },
  rt: CtxRuntime
): void {
  // P1 (AC-ERR-08/AC-RULE-16): gate BEFORE the confirm dialog — a read-only
  // file must not offer a destructive confirm that cannot land. The guard
  // fires the frozen `err.readonly` toast; doc stays byte-identical, no dirty.
  whenWritable(() => {
    void rt
      .confirm({
        // FE-11 P2-2 live-relabel：只传 key 不传预烘焙串——Dialog 渲染侧 t()
        // 即时求值，打开中的确认框随语言切换换字（冻结文案走 key 派生，字面
        // 由 frozenCopy.test 钉住不改）。
        titleKey: 'ctx.deleteTable',
        messageKey: 'ctx.deleteTableConfirm',
        confirmLabelKey: 'ctx.deleteTableConfirmOk',
        cancelLabelKey: 'dialog.cancel',
        danger: true
      })
      .then((ok) => {
        if (!ok) return
        // FE-08 扩展-1（稳态）：confirm 是异步落点——点击时解析的 span 到
        // resolve 时可能已过期（whenWritable 探针 + 确认框期间文档可变）。
        // 删前按 stale-instance 纪律重解析表格最新跨度（锚 span.from，
        // modelSpan()/resolveTableModel 同语义）；解析失败（表格已不存在/
        // 锚点已不在表内）→ 静默 no-op：不删、不报错、不发回执，绝不按旧
        // 区间误删。
        let fresh: { from: number; to: number } | null = null
        try {
          const r = resolveTableModel(view, span.from)
          if (r) fresh = { from: r.model.tableFrom, to: r.model.tableTo }
        } catch {
          fresh = null
        }
        if (!fresh) return
        const del = fresh
        // P0: the whole-table delete destroys the cell widget — suppress the
        // destroy-side handoff (no remount will consume a stash; a leftover
        // pendingHandoff would pollute a later mount at the same key).
        withHandoffSuppressed(() => {
          deleteTableRange(view, del.from, del.to)
        })
        rt.toast({ message: t('toast.tableDeleted'), action: undoAction(view) })
      })
  })
}

// Op adapters for delete (the "Safe" alias names kept for run-closure clarity).
// Insert adapters now come from ops.ts (FE-01 single source — the old local
// duplicates insertRowAboveOp/insertRowBelowOp/insertColLeftOp/insertColRightOp
// were removed in FE-04 per the FE-02 handoff ③).

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
  // P1 (AC-ERR-08/AC-RULE-16): the read-only gate收口在 tableDeltaItems 的写
  // 闭包（runStructOp / cutCell / pasteCell / formatTableSource /
  // confirmDeleteTable）——本函数只做 dispatch，保持 runOp 同步 boolean 契约
  //（toolbar/菜单回执依赖）。P0 (AC-PEND-11/AC-RULE-08): dispatch 在
  // withHandoffSuppressed 内执行——pending 文本已随单事务折叠（菜单路径先
  // commitActiveOnly），destroy 端 handoff 不得再写第二条历史。
  const runOp = (
    opFn: (m: TableModel) => TableOp | null,
    userEvent: string,
    widthsRemap?: (prev: readonly number[]) => readonly number[]
  ): boolean => {
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
    // FE-06/AC-ERR-03: col-structure ops remap the stored widths in the same
    // transaction — one Ctrl+Z reverts structure AND widths together. Clamp
    // from the wrap (drag parity) so over-max widths reset to default.
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
