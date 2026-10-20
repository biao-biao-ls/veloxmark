
export const TABLE_HANDLE_CONTRACT = ['col-grip'] as const
export type TableHandleContract = (typeof TABLE_HANDLE_CONTRACT)[number]

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

export const TOOLBAR_DATA_OP = {
  grid: 'resizeTable',
  alignLeft: 'alignLeft',
  alignCenter: 'alignCenter',
  alignRight: 'alignRight',
  more: 'TBL-MOR-OPN',
  deleteTable: 'deleteTable'
} as const
export type ToolbarDataOpKey = keyof typeof TOOLBAR_DATA_OP

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
