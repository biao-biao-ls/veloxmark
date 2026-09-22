export {
  alignmentOf,
  escapeCell,
  formatTable,
  isSentinelCell,
  parseTableModel,
  renderInlineCell,
  splitRowWithOffsets,
  unescapeCell,
  type CellInfo,
  type TableModel
} from './parse'
export {
  getTableEdit,
  setActiveCell,
  setColWidth,
  tableEditField,
  type ActiveCell,
  type TableEditState
} from './state'
export {
  appendRowOp,
  deleteColOp,
  deleteRowOp,
  gridWithCellText,
  insertColOp,
  insertRowOp,
  modelToGrid,
  parseTsv,
  pasteCellOp,
  pasteTsvOp,
  setAlignOp,
  writeCellOp,
  type TableOp
} from './ops'
// P27: legacy table menu module removed — table context menu now lives in
// editor/contextMenu/registry.ts (tableDeltaItems + registerContextMenuOps).
export { TableWidget, type TableWidgetActive, type TableWidgetSpec } from './widget'
