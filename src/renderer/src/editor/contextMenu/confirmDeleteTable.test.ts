/**
 * FE-08 仅删表确认流 — 确认流分支 / 冻结文案 / 无确认直执行 纯逻辑断言。
 *
 * 覆盖任务阶段 1 单测判据（AC-RULE-15 / AC-OP-09 / AC-OP-10 / AC-ERR-07）：
 * - deleteTable 唯一确认入口：冻结文案 + 「确认删除」danger 主按钮 + 「取消」
 * - 取消分支零副作用（不删表、不回执、无 undo 栈条目）
 * - 确认分支：deleteTableRange 单事务 + toast「已删除表格（Ctrl+Z 可撤销）」+ 撤销按钮
 * - deleteRow/deleteCol 无确认直执行（Q3），回执携撤销按钮（FE-07 复用）
 *
 * 零 DOM 依赖（宪法：单测不渲染 widget）：view/rt 为 stub，deleteTableRange
 * 走 mock（node 环境无 CM6 事务栈）；Esc/空白关框语义由 CDP 冒烟覆盖。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorView } from '@codemirror/view'
import { deleteTableRange } from '../table/source'
import { resolveTableModel } from '../table/resolve'
import type { CtxRuntime } from './types'
import { setLang, t } from '../../i18n'

vi.mock('../table/source', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../table/source')>()
  return { ...actual, deleteTableRange: vi.fn() }
})

// FE-08 扩展-1：confirm 成功后按 resolveTableModel 重解析最新跨度再删。本文件
// 维持 stub 零依赖设计（真实语法树路径由 opsTable.gate.test.ts 钉），resolve
// 在此 mock 以便钉「用重解析 from/to」的接线契约。
vi.mock('../table/resolve', () => ({
  resolveTableModel: vi.fn()
}))

const { confirmDeleteTable, tableDeltaItems } = await import('./opsTable')

const mockDeleteTableRange = vi.mocked(deleteTableRange)

/** tableModelOf 容错路径：空串 → null model，禁用判定走兜底。 */
function stubView(): EditorView {
  return { state: { sliceDoc: () => '' } } as unknown as EditorView
}

function stubRt(confirmResult: boolean | 'auto' = 'auto'): CtxRuntime & {
  confirm: ReturnType<typeof vi.fn>
  toast: ReturnType<typeof vi.fn>
} {
  return {
    toast: vi.fn(),
    confirm:
      confirmResult === 'auto'
        ? vi.fn()
        : vi.fn().mockResolvedValue(confirmResult),
    clipboardWrite: vi.fn().mockResolvedValue(undefined),
    openLink: vi.fn()
  } as unknown as CtxRuntime & {
    confirm: ReturnType<typeof vi.fn>
    toast: ReturnType<typeof vi.fn>
  }
}

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  setLang('zh')
})

// ---- 确认框参数契约（AC-RULE-15 / UI-IXD-05） --------------------------------

describe('confirmDeleteTable — 确认框参数契约', () => {
  it('弹出 key-based 确认框：titleKey/messageKey/confirmLabelKey/cancelLabelKey + danger（无预烘焙文案串）', async () => {
    const rt = stubRt(false)
    confirmDeleteTable(stubView(), { from: 10, to: 40 }, rt)
    await Promise.resolve()
    expect(rt.confirm).toHaveBeenCalledTimes(1)
    const opts = rt.confirm.mock.calls[0][0]
    // FE-11 P2-2 live-relabel：只传 key 不传预烘焙串——Dialog 渲染侧 t() 即时
    // 求值，语言切换时打开中的确认框即时换字（冻结文案走 key 派生不改字面）。
    expect(opts.titleKey).toBe('ctx.deleteTable')
    expect(opts.messageKey).toBe('ctx.deleteTableConfirm')
    expect(opts.confirmLabelKey).toBe('ctx.deleteTableConfirmOk')
    expect(opts.cancelLabelKey).toBe('dialog.cancel')
    expect(opts.title).toBeUndefined()
    expect(opts.message).toBeUndefined()
    expect(opts.confirmLabel).toBeUndefined()
    expect(opts.cancelLabel).toBeUndefined()
    expect(opts.danger).toBe(true)
  })

  it('按钮 key 与冻结字典同源（ctx.deleteTableConfirm / ctx.deleteTableConfirmOk / dialog.cancel）', () => {
    expect(t('ctx.deleteTableConfirm')).toBe('删除后可用一步撤销还原，确认删除该表格')
    expect(t('ctx.deleteTableConfirmOk')).toBe('确认删除')
    expect(t('dialog.cancel')).toBe('取消')
    expect(t('toast.tableDeleted')).toBe('已删除表格（Ctrl+Z 可撤销）')
  })

  it('key 派生随语言即时换字（live-relabel 源：Dialog 渲染侧按 key 求 t()）', () => {
    // 同一 key 面 zh→en 双语求值——确认框打开中切语言即得此效果（渲染侧重求 t()）。
    setLang('zh')
    expect(t('ctx.deleteTableConfirm')).toBe('删除后可用一步撤销还原，确认删除该表格')
    expect(t('ctx.deleteTableConfirmOk')).toBe('确认删除')
    setLang('en')
    expect(t('ctx.deleteTableConfirm')).toBe(
      'Deleting can be undone in one step. Confirm deleting this table?'
    )
    expect(t('ctx.deleteTableConfirmOk')).toBe('Confirm Delete')
    setLang('zh')
    expect(t('ctx.deleteTableConfirm')).toBe('删除后可用一步撤销还原，确认删除该表格')
    expect(t('ctx.deleteTableConfirmOk')).toBe('确认删除')
  })
})

// ---- 确认流两分支（AC-OP-09 / AC-ERR-07） -------------------------------------

describe('confirmDeleteTable — 确认流分支', () => {
  it('取消分支零副作用：不删表、不回执（无事务即无 undo 栈条目）', async () => {
    const rt = stubRt(false)
    confirmDeleteTable(stubView(), { from: 10, to: 40 }, rt)
    await vi.waitFor(() => expect(rt.confirm).toHaveBeenCalled())
    await Promise.resolve()
    expect(mockDeleteTableRange).not.toHaveBeenCalled()
    expect(rt.toast).not.toHaveBeenCalled()
  })

  it('确认分支：单事务删表 + 回执「已删除表格（Ctrl+Z 可撤销）」+ 撤销按钮（按重解析最新跨度）', async () => {
    // 改钉理由（交接报告同步）：原断言 `toHaveBeenCalledWith(view, 10, 40)` 钉的
    // 是「点击时 span 原样透传」——正是 FE-08 扩展-1（confirm 异步 gap 后 stale
    // span 误删）要修的行为。新契约：confirm 成功路径删前 resolveTableModel 重
    // 解析，用最新 from/to；解析失败静默 no-op（真实分支见 opsTable.gate.test）。
    vi.mocked(resolveTableModel).mockReturnValue({
      model: { tableFrom: 12, tableTo: 33 },
      lineFrom: 12
    } as never)
    const view = stubView()
    const rt = stubRt(true)
    confirmDeleteTable(view, { from: 10, to: 40 }, rt)
    await vi.waitFor(() => expect(rt.toast).toHaveBeenCalled())
    expect(mockDeleteTableRange).toHaveBeenCalledOnce()
    expect(mockDeleteTableRange).toHaveBeenCalledWith(view, 12, 33) // 重解析跨度，非点击时 10..40
    const receipt = rt.toast.mock.calls[0][0]
    expect(receipt.message).toBe('已删除表格（Ctrl+Z 可撤销）')
    expect(receipt.action?.label).toBe('撤销')
    expect(typeof receipt.action?.run).toBe('function')
  })
})

// ---- 删行/列无确认直执行（Q3 / AC-OP-10 / AC-RULE-15） ------------------------

describe('tableDeltaItems — 删行/列无确认直执行', () => {
  function buildDeps(rt: CtxRuntime) {
    const runOp = vi.fn().mockReturnValue(true)
    const deps = {
      view: stubView(),
      tableFrom: 0,
      row: 1,
      col: 1,
      runOp,
      cellClipboard: vi.fn(),
      modelSpan: () => ({ from: 0, to: 40 })
    }
    const items = tableDeltaItems(deps, rt)
    return { deps, items }
  }

  function stubWindowApi(): void {
    vi.stubGlobal('window', { api: { platform: 'win32' } })
  }

  it('deleteRow 直执行：不弹确认框，回执携撤销按钮', () => {
    stubWindowApi()
    const rt = stubRt()
    const { deps, items } = buildDeps(rt)
    const item = items.find((i) => i.id === 'deleteRow')
    item?.run?.()
    expect(rt.confirm).not.toHaveBeenCalled()
    expect(deps.runOp).toHaveBeenCalledOnce()
    const receipt = rt.toast.mock.calls[0]?.[0]
    expect(receipt.message).toBe('已删除第 2 行（Ctrl+Z 可撤销）')
    expect(receipt.action?.label).toBe('撤销')
  })

  it('deleteCol 直执行：不弹确认框，回执携撤销按钮', () => {
    stubWindowApi()
    const rt = stubRt()
    const { deps, items } = buildDeps(rt)
    const item = items.find((i) => i.id === 'deleteCol')
    item?.run?.()
    expect(rt.confirm).not.toHaveBeenCalled()
    expect(deps.runOp).toHaveBeenCalledOnce()
    const receipt = rt.toast.mock.calls[0]?.[0]
    expect(receipt.message).toBe('已删除第 2 列（Ctrl+Z 可撤销）')
    expect(receipt.action?.label).toBe('撤销')
  })

  it('deleteTable 是唯一确认入口（菜单路径 → confirmDeleteTable）', () => {
    stubWindowApi()
    const rt = stubRt(false)
    const { items } = buildDeps(rt)
    const item = items.find((i) => i.id === 'deleteTable')
    item?.run?.()
    expect(rt.confirm).toHaveBeenCalledTimes(1)
  })
})
