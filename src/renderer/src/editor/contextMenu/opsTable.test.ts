/**
 * opsTable — 五组分组 / 禁用规则 / 回显派生 / toast 回执键纯逻辑断言（FE-04）。
 *
 * 覆盖任务阶段 1 单测判据：opsTable 分组/禁用/回显派生用例。
 * 纯数据/纯函数零 DOM 依赖 —— tableDeltaItems 的 run 闭包接线不在此测
 *（单测不渲染 widget 宪法约束）。
 */
import { describe, expect, it, vi } from 'vitest'
import type { EditorView } from '@codemirror/view'
import { TABLE_OP_TOAST_KEYS } from '../table/contract'
import { TABLE_MENU_GROUPS, isTableOpDisabled, tableDeltaItems } from './opsTable'
import { STRUCT_KEYS, cmKeyToDisplay, type StructCmd } from '../table/keymap'
import type { CtxRuntime } from './types'

// ---- 五组分组呈现层（menu-tree §4 五组为 UI 真值） ---------------------------

describe('TABLE_MENU_GROUPS — 五组结构', () => {
  it('按行操作/列操作/对齐/单元格/结构删除五组呈现', () => {
    expect(TABLE_MENU_GROUPS.map((g) => g.groupId)).toEqual([
      'rowOps',
      'colOps',
      'align',
      'cell',
      'structDelete'
    ])
  })

  it('每组的项数为 5/5/3/3/3，合计 19 项', () => {
    const counts = TABLE_MENU_GROUPS.map((g) => g.items.length)
    expect(counts).toEqual([5, 5, 3, 3, 3])
    expect(counts.reduce((a, b) => a + b, 0)).toBe(19)
  })

  it('五组合计的 op id 与 TABLE_MENU_OP_IDS 冻结面一致（id 不变，仅重排）', () => {
    const ids = TABLE_MENU_GROUPS.flatMap((g) => g.items.map((i) => i.id))
    const expected = [
      'insertRowAbove',
      'insertRowBelow',
      'moveRowUp',
      'moveRowDown',
      'deleteRow',
      'insertColLeft',
      'insertColRight',
      'moveColLeft',
      'moveColRight',
      'deleteCol',
      'alignLeft',
      'alignCenter',
      'alignRight',
      'cutCell',
      'copyCell',
      'pasteCell',
      'copyTable',
      'formatTableSource',
      'deleteTable'
    ]
    expect(ids).toEqual(expected)
  })

  it('对齐组三项均标记 check 态（当前对齐项打勾 ✓）', () => {
    const align = TABLE_MENU_GROUPS.find((g) => g.groupId === 'align')
    expect(align?.items.every((i) => i.checked)).toBe(true)
  })

  it('结构删除组标记 danger（组标签带危险组徽标；deleteTable 项 danger 红字）', () => {
    const doc = TABLE_MENU_GROUPS.find((g) => g.groupId === 'structDelete')
    expect(doc?.danger).toBe(true)
    const del = doc?.items.find((i) => i.id === 'deleteTable')
    expect(del?.danger).toBe(true)
  })

  it('danger 红字仅属「删除表格」（FE-01#6/CHANGE-13）：删除行/列为普通前景', () => {
    const items = TABLE_MENU_GROUPS.flatMap((g) => g.items)
    expect(items.find((i) => i.id === 'deleteRow')?.danger).toBeUndefined()
    expect(items.find((i) => i.id === 'deleteCol')?.danger).toBeUndefined()
    expect(items.filter((i) => i.danger).map((i) => i.id)).toEqual(['deleteTable'])
  })
})

// ---- 快捷键回显单源派生（AC-RULE-11） ---------------------------------------

describe('快捷键回显 — structShortcut 单源派生', () => {
  it('有键项 8 项均声明 shortcutCmd，无键项 11 项留空', () => {
    const withCmd = TABLE_MENU_GROUPS.flatMap((g) => g.items).filter((i) => i.shortcutCmd)
    const withoutCmd = TABLE_MENU_GROUPS.flatMap((g) => g.items).filter((i) => !i.shortcutCmd)
    expect(withCmd).toHaveLength(8)
    expect(withoutCmd).toHaveLength(11)
  })

  it('8 个 shortcutCmd 恰好覆盖 STRUCT_KEYS 全部 8 键', () => {
    const cmds = TABLE_MENU_GROUPS.flatMap((g) => g.items)
      .map((i) => i.shortcutCmd)
      .filter(Boolean)
      .sort()
    const structCmds = STRUCT_KEYS.map((k) => k.cmd).sort()
    expect(cmds).toEqual(structCmds)
  })

  it('每一 shortcutCmd 均可从 STRUCT_KEYS 派生回显串（AC-RULE-11 零例外）', () => {
    for (const g of TABLE_MENU_GROUPS) {
      for (const item of g.items) {
        if (!item.shortcutCmd) continue
        const hit = STRUCT_KEYS.find((k) => k.cmd === item.shortcutCmd)
        expect(hit, `${item.id} 的 shortcutCmd 应命中 STRUCT_KEYS`).toBeDefined()
        expect(cmKeyToDisplay(hit!.key)).toBeTruthy()
      }
    }
  })

  it('无键项（删除行/列、对齐三键、剪贴板族、结构删除族）不声明 shortcutCmd', () => {
    const silent = ['deleteRow', 'deleteCol', 'alignLeft', 'alignCenter', 'alignRight',
      'cutCell', 'copyCell', 'pasteCell', 'copyTable', 'formatTableSource', 'deleteTable']
    for (const id of silent) {
      const item = TABLE_MENU_GROUPS.flatMap((g) => g.items).find((i) => i.id === id)
      expect(item, `${id} 应存在于菜单面`).toBeDefined()
      expect(item!.shortcutCmd, `${id} 应无 shortcutCmd（右侧留空）`).toBeUndefined()
    }
  })
})

// ---- 禁用规则（FE-01 判定同源） ---------------------------------------------

describe('isTableOpDisabled — 表头保护 + 最小结构', () => {
  const full = { row: 1, col: 1, rows: 3, cols: 3, canDelRow: true, canDelCol: true }

  it('首行「上移该行」禁用（AC-ERR-05 / AC-FN-24）', () => {
    expect(isTableOpDisabled('moveRowUp', { ...full, row: 0 })).toBe(true)
    expect(isTableOpDisabled('moveRowUp', full)).toBe(false)
  })

  it('首列「左移该列」禁用（AC-ERR-06）', () => {
    expect(isTableOpDisabled('moveColLeft', { ...full, col: 0 })).toBe(true)
    expect(isTableOpDisabled('moveColLeft', full)).toBe(false)
  })

  it('末行「下移该行」/末列「右移该列」可点击——AC-RULE-07 仅限两项（CHANGE-19 回退）', () => {
    // ui_03 mock 语义钉：仅 上移该行/左移该列 带 is-disabled（设计注释「表头
    // 保护灰显即语义」同口径）；边界位 下移/右移 无灰显——点击走 op 边界
    // no-op（moveRowOp/moveColOp 返回 null）静默无 toast，键盘路径不动。
    expect(isTableOpDisabled('moveRowDown', { ...full, row: 2 })).toBe(false)
    expect(isTableOpDisabled('moveRowDown', full)).toBe(false)
    expect(isTableOpDisabled('moveColRight', { ...full, col: 2 })).toBe(false)
    expect(isTableOpDisabled('moveColRight', full)).toBe(false)
  })

  it('行数=1 / 表头为末行时「删除行」禁用（FE-01 canDeleteRow 同源）', () => {
    expect(isTableOpDisabled('deleteRow', { ...full, canDelRow: false })).toBe(true)
    expect(isTableOpDisabled('deleteRow', full)).toBe(false)
  })

  it('列数=1 时「删除列」禁用（FE-01 canDeleteCol 同源）', () => {
    expect(isTableOpDisabled('deleteCol', { ...full, canDelCol: false })).toBe(true)
    expect(isTableOpDisabled('deleteCol', full)).toBe(false)
  })

  it('「上插行」「左插列」等非禁用项保持可点（AC-FN-24）', () => {
    const edge = { row: 0, col: 0, rows: 1, cols: 1, canDelRow: false, canDelCol: false }
    expect(isTableOpDisabled('insertRowAbove', edge)).toBe(false)
    expect(isTableOpDisabled('insertRowBelow', edge)).toBe(false)
    expect(isTableOpDisabled('insertColLeft', edge)).toBe(false)
    expect(isTableOpDisabled('insertColRight', edge)).toBe(false)
  })

  it('对齐 / 剪贴板 / 文档级项永不禁用', () => {
    const edge = { row: 0, col: 0, rows: 1, cols: 1, canDelRow: false, canDelCol: false }
    for (const id of ['alignLeft', 'alignCenter', 'alignRight',
      'cutCell', 'copyCell', 'pasteCell', 'copyTable', 'formatTableSource', 'deleteTable'] as const) {
      expect(isTableOpDisabled(id, edge), `${id} 不应禁用`).toBe(false)
    }
  })
})

// ---- 边界位点击 no-op 无 toast（CHANGE-19 回退的另一半判据） ------------------

describe('边界位 下移/右移 — 可点击且点击 no-op 无 toast', () => {
  it('末行点「下移该行」：项可点（disabled:false）、runOp no-op、零回执', () => {
    vi.stubGlobal('window', { api: { platform: 'win32' } })
    const toast = vi.fn()
    const runOp = vi.fn().mockReturnValue(false) // moveRowOp 边界 null → no-op
    const deps = {
      view: { state: { sliceDoc: () => '' } } as unknown as EditorView,
      tableFrom: 0,
      row: 2,
      col: 0,
      runOp,
      cellClipboard: vi.fn(),
      modelSpan: () => ({ from: 0, to: 40 })
    }
    const items = tableDeltaItems(deps, {
      toast,
      confirm: vi.fn(),
      clipboardWrite: vi.fn(),
      openLink: vi.fn()
    } as unknown as CtxRuntime)
    const item = items.find((i) => i.id === 'moveRowDown')
    expect(item?.disabled).toBe(false)
    item?.run?.()
    expect(runOp).toHaveBeenCalledOnce()
    expect(toast).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

// ---- toast 回执键（冻结文案映射，四面同源） --------------------------------

describe('TABLE_OP_TOAST_KEYS — 冻结回执映射', () => {
  it('13 个结构操作 op 均有 toast 键', () => {
    const structural = [
      'insertRowAbove', 'insertRowBelow', 'deleteRow',
      'insertColLeft', 'insertColRight', 'deleteCol',
      'moveRowUp', 'moveRowDown', 'moveColLeft', 'moveColRight',
      'alignLeft', 'alignCenter', 'alignRight'
    ]
    for (const id of structural) {
      expect(TABLE_OP_TOAST_KEYS[id as keyof typeof TABLE_OP_TOAST_KEYS], `${id} 应有 toast 键`).toBeTruthy()
    }
  })

  it('剪贴板族 3 项无 toast 键（PEND-15 静默口径）', () => {
    for (const id of ['cutCell', 'copyCell', 'pasteCell'] as const) {
      expect(TABLE_OP_TOAST_KEYS[id]).toBeUndefined()
    }
  })

  it('行/列删除键带 {i}/{j} 占位符（1 起传参）', () => {
    expect(TABLE_OP_TOAST_KEYS.deleteRow).toBe('toast.rowDeleted')
    expect(TABLE_OP_TOAST_KEYS.deleteCol).toBe('toast.colDeleted')
  })

  it('移行/移列/对齐键与 AC-OP-05/06/08 冻结文案对应', () => {
    expect(TABLE_OP_TOAST_KEYS.moveRowUp).toBe('toast.rowMovedUp')
    expect(TABLE_OP_TOAST_KEYS.moveRowDown).toBe('toast.rowMovedDown')
    expect(TABLE_OP_TOAST_KEYS.moveColLeft).toBe('toast.colMovedLeft')
    expect(TABLE_OP_TOAST_KEYS.moveColRight).toBe('toast.colMovedRight')
    expect(TABLE_OP_TOAST_KEYS.alignLeft).toBe('toast.colAlignLeft')
    expect(TABLE_OP_TOAST_KEYS.alignCenter).toBe('toast.colAlignCenter')
    expect(TABLE_OP_TOAST_KEYS.alignRight).toBe('toast.colAlignRight')
  })

  it('插入族键与 AC-OP-01~04 冻结文案对应', () => {
    expect(TABLE_OP_TOAST_KEYS.insertRowAbove).toBe('toast.rowInsertedAbove')
    expect(TABLE_OP_TOAST_KEYS.insertRowBelow).toBe('toast.rowInsertedBelow')
    expect(TABLE_OP_TOAST_KEYS.insertColLeft).toBe('toast.colInsertedLeft')
    expect(TABLE_OP_TOAST_KEYS.insertColRight).toBe('toast.colInsertedRight')
  })
})
