/**
 * FE-03 契约面断言（ADR e2e-contract-delta.md Q2：data-table-handle 删4留1；
 * 工具栏/⋮ data-op 与 opsTable 19 项同源，id 字面量不变）。
 *
 * 单测不渲染 widget（宪法），故契约面用两类断言钉住：
 *   1) contract.ts 纯常量集合同步冻结字面量；
 *   2) 源文件扫描（widget.ts 写入点 / opsTable.ts id 面 / toolbar.ts 挂载点 /
 *      markdown.css 把手带布局）确保实现与登记一致。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  TABLE_HANDLE_CONTRACT,
  TABLE_MENU_OP_IDS,
  TOOLBAR_DATA_OP
} from './contract'

const readSrc = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

/** ADR Q2 删除的 4 个把手契约值——任何写入点回归都视为契约破坏。 */
const DELETED_HANDLES = ['row-insert', 'row-delete', 'col-insert-left', 'col-delete'] as const

/** menu-tree §9 / TBL-table-ops.md §3.1 冻结的 19 个 data-op id。 */
const FROZEN_MENU_OP_IDS = [
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

describe('data-table-handle 契约（删4留1）', () => {
  it('契约集登记值 = {col-grip}', () => {
    expect([...TABLE_HANDLE_CONTRACT]).toEqual(['col-grip'])
  })

  it('widget.ts 只写入 col-grip，4 个已删把手契约字面量零残留', () => {
    const src = readSrc('./widget.ts')
    for (const gone of DELETED_HANDLES) {
      expect(src, `widget.ts 不应再出现 "${gone}"`).not.toContain(gone)
    }
    expect(src).toContain(`dataset.tableHandle = 'col-grip'`)
    const writes = [...src.matchAll(/dataset\.tableHandle\s*=\s*'([^']+)'/g)].map((m) => m[1])
    expect(writes).toEqual(['col-grip'])
  })
})

describe('data-op 契约（opsTable 19 项同源）', () => {
  it('TABLE_MENU_OP_IDS 与 19 项冻结字面量逐项一致', () => {
    expect([...TABLE_MENU_OP_IDS]).toEqual([...FROZEN_MENU_OP_IDS])
  })

  it('opsTable.ts 的 id 面 = 19 项冻结集合（字面量不变）', () => {
    const src = readSrc('../contextMenu/opsTable.ts')
    const ids = [...src.matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1])
    expect(ids).toHaveLength(19)
    expect(new Set(ids)).toEqual(new Set(FROZEN_MENU_OP_IDS))
  })

  it('工具栏 op 类 data-op（对齐三键/🗑）取自 opsTable 同源 id', () => {
    const menuIds: readonly string[] = TABLE_MENU_OP_IDS
    for (const id of [
      TOOLBAR_DATA_OP.alignLeft,
      TOOLBAR_DATA_OP.alignCenter,
      TOOLBAR_DATA_OP.alignRight,
      TOOLBAR_DATA_OP.deleteTable
    ]) {
      expect(menuIds, `工具栏 ${id} 必须是 opsTable 19 项之一`).toContain(id)
    }
  })

  it('工具栏 ⊞/⋮ 入口锚点字面量不变（resizeTable / TBL-MOR-OPN，CHANGE-3）', () => {
    expect(TOOLBAR_DATA_OP.grid).toBe('resizeTable')
    expect(TOOLBAR_DATA_OP.more).toBe('TBL-MOR-OPN')
  })

  it('toolbar.ts 为 6 个工具栏按钮逐一挂 TOOLBAR_DATA_OP', () => {
    const src = readSrc('./toolbar.ts')
    // 工厂统一写 dataset.op = TOOLBAR_DATA_OP[op]，六个键逐一传入。
    expect(src, '工具栏按钮必须经 TOOLBAR_DATA_OP 写 dataset.op').toMatch(
      /dataset\.op\s*=\s*TOOLBAR_DATA_OP\[op\]/
    )
    for (const key of ['grid', 'alignLeft', 'alignCenter', 'alignRight', 'more', 'deleteTable'] as const) {
      expect(src, `toolbar.ts 缺少 ${key} 键挂载`).toMatch(new RegExp(`['"]${key}['"]`))
    }
  })
})

describe('28px 把手带/左侧留白清零', () => {
  it('markdown.css 无把手带布局与增删把手按钮残留', () => {
    const css = readSrc('../../styles/markdown.css')
    expect(css).not.toContain('--table-handle-gutter')
    expect(css).not.toContain('--table-col-handle-gutter')
    expect(css).not.toContain('.cm-md-table-btn-row-insert')
    expect(css).not.toContain('.cm-md-table-btn-row-delete')
    expect(css).not.toContain('.cm-md-table-btn-col-insert')
    expect(css).not.toContain('.cm-md-table-btn-col-delete')
    // 列宽抓手样式必须延续（契约 col-grip 的承载 UI）
    expect(css).toContain('.cm-md-col-grip')
  })
})
