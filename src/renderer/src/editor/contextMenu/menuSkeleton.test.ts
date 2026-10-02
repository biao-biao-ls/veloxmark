/**
 * FE-01 r2 — 表上下文菜单契约裁剪（U3）：两面分离断言。
 *
 * 表上下文菜单（⋮ TBL-MOR-OPN / 单元格右键 / Shift+F10 同源，hit.kind
 * 'table-cell'）= 严格 5 组 19 项（ui_03_table_menu.html 矩阵），不混入通用
 * 编辑项（剪切/复制/粘贴 + 复制为/段落/格式/插入子菜单）；编辑器通用右键面
 * （非表上下文）保留共享骨架，不受裁剪影响。
 *
 * 零 DOM 依赖（宪法：单测不渲染 widget）：view/rt 为 stub，window.api 走
 * stubGlobal；菜单面为纯装配产物（items 数组）断言。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorView } from '@codemirror/view'
import { setLang } from '../../i18n'
import type { CtxRuntime } from './types'
import type { BlockHit } from './types'

// registry barrel 首载触发 opsTable 模块级注册（与运行时同链路）。
const { buildContextMenu, setCtxRuntime } = await import('./registry')

/** ui_03 冻结矩阵：19 项 id 序 + 逐字文案 + kbd 提示（11 项右侧留白）。 */
const UI03_IDS = [
  'insertRowAbove', 'insertRowBelow', 'moveRowUp', 'moveRowDown', 'deleteRow',
  'insertColLeft', 'insertColRight', 'moveColLeft', 'moveColRight', 'deleteCol',
  'alignLeft', 'alignCenter', 'alignRight',
  'cutCell', 'copyCell', 'pasteCell',
  'copyTable', 'formatTableSource', 'deleteTable'
] as const

/** kbd 提示逐字（ui_03 .kbd 列；结构键由 STRUCT_KEYS 单源派生）。 */
const UI03_KBD: Record<string, string | undefined> = {
  insertRowAbove: 'Ctrl+Shift+Enter',
  insertRowBelow: 'Ctrl+Enter',
  moveRowUp: 'Alt+↑',
  moveRowDown: 'Alt+↓',
  deleteRow: undefined,
  insertColLeft: 'Ctrl+Shift+←',
  insertColRight: 'Ctrl+Shift+→',
  moveColLeft: 'Alt+←',
  moveColRight: 'Alt+→',
  deleteCol: undefined,
  alignLeft: undefined,
  alignCenter: undefined,
  alignRight: undefined,
  cutCell: undefined,
  copyCell: undefined,
  pasteCell: undefined,
  copyTable: undefined,
  formatTableSource: undefined,
  deleteTable: undefined
}

/** ui_03 .label 列逐字文案（zh）。 */
const UI03_LABELS: Record<string, string> = {
  insertRowAbove: '在上方插入行',
  insertRowBelow: '在下方插入行',
  moveRowUp: '上移该行',
  moveRowDown: '下移该行',
  deleteRow: '删除行',
  insertColLeft: '在左侧插入列',
  insertColRight: '在右侧插入列',
  moveColLeft: '左移该列',
  moveColRight: '右移该列',
  deleteCol: '删除列',
  alignLeft: '左对齐',
  alignCenter: '居中对齐',
  alignRight: '右对齐',
  cutCell: '剪切单元格',
  copyCell: '拷贝单元格',
  pasteCell: '粘贴单元格',
  copyTable: '拷贝表格',
  formatTableSource: '格式化表格源码',
  deleteTable: '删除表格'
}

const UI03_GROUP_TITLES = ['行操作', '列操作', '对齐', '单元格', '结构删除']

/** 通用编辑骨架 id（裁剪对象：不得出现在表上下文菜单面）。 */
const GENERIC_SKELETON_IDS = ['cut', 'copy', 'paste', 'copyAs', 'paragraph', 'format', 'insert']

const TABLE_2X2 = ['| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n')
const TABLE_HEADER_ONLY = ['| A | B |', '| --- | --- |'].join('\n')

function stubView(doc: string): EditorView {
  return {
    state: {
      sliceDoc: (from: number, to: number) => doc.slice(from, to),
      selection: { main: { from: 0, to: 0 } }
    }
  } as unknown as EditorView
}

function stubRt(): CtxRuntime {
  return {
    toast: vi.fn(),
    confirm: vi.fn(),
    clipboardWrite: vi.fn().mockResolvedValue(undefined),
    openLink: vi.fn(),
    runCommand: vi.fn()
  } as unknown as CtxRuntime
}

function tableHit(row: number, col: number): BlockHit {
  return {
    kind: 'table-cell',
    pos: 0,
    lineFrom: 0,
    lineTo: TABLE_2X2.length,
    table: { from: 0, to: TABLE_2X2.length, row, col }
  }
}

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('window', { api: { platform: 'win32' } })
  setLang('zh')
  setCtxRuntime(stubRt())
})

describe('buildContextMenu 表上下文面 — 严格 5 组 19 项（U3 裁剪）', () => {
  it('table-cell 命中：可点项恰为 ui_03 冻结 19 项 id 序', () => {
    const items = buildContextMenu(stubView(TABLE_2X2), tableHit(1, 0))
    const actionIds = items.filter((i) => !i.separator && i.groupTitle === undefined).map((i) => i.id)
    expect(actionIds).toEqual([...UI03_IDS])
  })

  it('table-cell 命中：零通用编辑项混入（剪切/复制/粘贴/复制为/段落/格式/插入）', () => {
    const items = buildContextMenu(stubView(TABLE_2X2), tableHit(1, 0))
    const allIds = items.map((i) => i.id)
    for (const id of GENERIC_SKELETON_IDS) {
      expect(allIds, `${id} 不应出现在表上下文菜单`).not.toContain(id)
    }
    // 子菜单整体不进表上下文面（19 项均为叶项）。
    expect(items.filter((i) => i.submenu?.length)).toEqual([])
  })

  it('五组标题逐字与顺序冻结（行操作/列操作/对齐/单元格/结构删除）', () => {
    const items = buildContextMenu(stubView(TABLE_2X2), tableHit(1, 0))
    const groups = items.filter((i) => i.groupTitle !== undefined)
    expect(groups.map((g) => g.groupTitle)).toEqual(UI03_GROUP_TITLES)
    expect(groups.filter((g) => g.danger).map((g) => g.groupTitle)).toEqual(['结构删除'])
  })

  it('19 项文案逐字对齐 ui_03 .label 列', () => {
    const items = buildContextMenu(stubView(TABLE_2X2), tableHit(1, 0))
    for (const item of items) {
      if (item.separator || item.groupTitle !== undefined) continue
      expect(item.label, `${item.id} 文案`).toBe(UI03_LABELS[item.id])
    }
  })

  it('kbd 提示逐字对齐 ui_03 .kbd 列（8 键项派生、11 项留白）', () => {
    const items = buildContextMenu(stubView(TABLE_2X2), tableHit(1, 0))
    for (const item of items) {
      if (item.separator || item.groupTitle !== undefined) continue
      expect(item.shortcut, `${item.id} kbd`).toBe(UI03_KBD[item.id])
    }
  })

  it('danger 红仅「删除表格」项 + 结构删除组徽标（CHANGE-13 不回退）', () => {
    const items = buildContextMenu(stubView(TABLE_2X2), tableHit(1, 0))
    const dangerItems = items.filter((i) => i.danger && i.groupTitle === undefined)
    expect(dangerItems.map((i) => i.id)).toEqual(['deleteTable'])
  })
})

describe('buildContextMenu 表上下文面 — 禁用语义不回退', () => {
  it('首行/首列命中：上移该行、左移该列灰显；删除行/列仍可点', () => {
    const items = buildContextMenu(stubView(TABLE_2X2), tableHit(0, 0))
    const byId = new Map(items.map((i) => [i.id, i]))
    expect(byId.get('moveRowUp')?.disabled).toBe(true)
    expect(byId.get('moveColLeft')?.disabled).toBe(true)
    expect(byId.get('deleteRow')?.disabled).toBe(false)
    expect(byId.get('deleteCol')?.disabled).toBe(false)
  })

  it('表头为末行（无 body 行）：删除行禁用、删除列可点（最小结构禁用不回退）', () => {
    const hit: BlockHit = {
      kind: 'table-cell',
      pos: 0,
      lineFrom: 0,
      lineTo: TABLE_HEADER_ONLY.length,
      table: { from: 0, to: TABLE_HEADER_ONLY.length, row: 0, col: 0 }
    }
    const items = buildContextMenu(stubView(TABLE_HEADER_ONLY), hit)
    const byId = new Map(items.map((i) => [i.id, i]))
    expect(byId.get('deleteRow')?.disabled).toBe(true)
    expect(byId.get('deleteCol')?.disabled).toBe(false)
    expect(byId.get('moveRowUp')?.disabled).toBe(true)
    expect(byId.get('moveColLeft')?.disabled).toBe(true)
    expect(byId.get('moveColRight')?.disabled).toBe(false)
  })
})

describe('buildContextMenu 编辑器通用右键面 — 骨架保留（另面不裁）', () => {
  it('paragraph 命中：剪切/复制/粘贴 + 复制为/段落/格式/插入子菜单仍在', () => {
    const hit: BlockHit = { kind: 'paragraph', pos: 0, lineFrom: 0, lineTo: 3 }
    const items = buildContextMenu(stubView('abc'), hit)
    const allIds = items.map((i) => i.id)
    for (const id of ['cut', 'copy', 'paste', 'copyAs', 'paragraph', 'format', 'insert']) {
      expect(allIds, `通用面应保留 ${id}`).toContain(id)
    }
    // 19 项表操作不得泄漏进通用面。
    for (const id of UI03_IDS) {
      expect(allIds, `${id} 不应出现在通用右键面`).not.toContain(id)
    }
  })
})
