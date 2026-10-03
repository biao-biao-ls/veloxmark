/**
 * FE-03 契约面单源（ADR e2e-contract-delta.md Q2）。
 *
 * - `data-table-handle` 删4留1：契约集仅 col-grip（列宽拖拽抓手）。
 * - `data-op`：⋮ 菜单 19 项字面量冻结（cdp-p10/cdp-p27）；工具栏 6 键同源挂载——
 *   op 类四键取自 TABLE_MENU_OP_IDS，⊞/⋮ 入口锚点见 TOOLBAR_DATA_OP 注释
 *   （change-log CHANGE-3 登记了 ⊞ 与 ui_03 原型的字面量取舍）。
 *
 * 消费方（toolbar 挂载 / 契约测试 / INFRA-01 探针登记）一律引用本模块，
 * 禁止在消费方重新声明字面量。
 */

/** DOM `data-table-handle` 契约集：删4留1 后仅 col-grip。 */
export const TABLE_HANDLE_CONTRACT = ['col-grip'] as const
export type TableHandleContract = (typeof TABLE_HANDLE_CONTRACT)[number]

/** opsTable.ts 19 个 data-op id（16 单元格级 + 3 文档级）——冻结面，字面量不变。 */
export const TABLE_MENU_OP_IDS = [
  'insertRowAbove',
  'insertRowBelow',
  'deleteRow',
  'insertColLeft',
  'insertColRight',
  'deleteCol',
  'moveRowUp',
  'moveRowDown',
  'moveColLeft',
  'moveColRight',
  'alignLeft',
  'alignCenter',
  'alignRight',
  'cutCell',
  'copyCell',
  'pasteCell',
  'copyTable',
  'formatTableSource',
  'deleteTable'
] as const
export type TableMenuOpId = (typeof TABLE_MENU_OP_IDS)[number]

/**
 * 表格工具栏 6 键的 data-op：
 * - 对齐三键 / 🗑 与 TABLE_MENU_OP_IDS 同源（四面同源语义键）；
 * - ⊞ = `resizeTable`（FE-05「resizeTable op id 复用」+ task-list PATH-05 机器
 *   验收路径字面量）；
 * - ⋮ = `TBL-MOR-OPN`（ui_03 原型 / menu-tree §4 菜单展开源锚点，字面量不变）。
 */
export const TOOLBAR_DATA_OP = {
  grid: 'resizeTable',
  alignLeft: 'alignLeft',
  alignCenter: 'alignCenter',
  alignRight: 'alignRight',
  more: 'TBL-MOR-OPN',
  deleteTable: 'deleteTable'
} as const
export type ToolbarDataOpKey = keyof typeof TOOLBAR_DATA_OP

/**
 * FE-04 四面同源 toast 回执键映射（AC-RULE-09）：op id → i18n key。
 * 13 个结构操作各有冻结回执；剪贴板族 3 项静默（PEND-15）不入表；
 * 文档级 copyTable/formatTableSource/deleteTable 各有独立文案不入表。
 * `{i}`/`{j}` 占位符由调用方以 1 起坐标传入。
 */
export const TABLE_OP_TOAST_KEYS: Partial<Record<TableMenuOpId, string>> = {
  insertRowAbove: 'toast.rowInsertedAbove',
  insertRowBelow: 'toast.rowInsertedBelow',
  deleteRow: 'toast.rowDeleted',
  insertColLeft: 'toast.colInsertedLeft',
  insertColRight: 'toast.colInsertedRight',
  deleteCol: 'toast.colDeleted',
  moveRowUp: 'toast.rowMovedUp',
  moveRowDown: 'toast.rowMovedDown',
  moveColLeft: 'toast.colMovedLeft',
  moveColRight: 'toast.colMovedRight',
  alignLeft: 'toast.colAlignLeft',
  alignCenter: 'toast.colAlignCenter',
  alignRight: 'toast.colAlignRight'
}
