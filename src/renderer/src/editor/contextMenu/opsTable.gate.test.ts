/**
 * P1 表格结构操作只读闸门（AC-ERR-08 / AC-RULE-16）—— ⋮/右键各写入口收口。
 *
 * 覆盖入口（写前 dispatch 均须 assertWritable）：
 * - runOp 经 runStructOp（删行/插行等结构 op 回执二合一闭包）
 * - confirmDeleteTable（删表确认前拦截：只读时不出确认框）
 * - formatTableSource（formatTableSourceRange 写点）
 * - cutCell / pasteCell（cellClipboard 写路径；copyCell 为纯读，只读照常）
 *
 * 只读时：dispatch 零发生、文档/写点不动、无成功回执、回冻结 err.readonly。
 * 闸门本体是 IT-03/FE-04 readOnlyGuard（这里只消费，不重实现）。
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { GFM } from '@lezer/markdown'
import type { EditorView } from '@codemirror/view'
import { deleteTableRange, formatTableSourceRange } from '../table/source'
import { tableEditField } from '../table/state'
import { resolveTableModel } from '../table/resolve'
import { setLang, t } from '../../i18n'
import { setCtxRuntime } from './ctxMenuStore'
import type { TableDeltaDeps } from './opsTable'
import type { CtxRuntime } from './types'

vi.mock('../table/source', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../table/source')>()
  return {
    ...actual,
    deleteTableRange: vi.fn(),
    formatTableSourceRange: vi.fn()
  }
})

const { confirmDeleteTable, tableDeltaItems } = await import('./opsTable')

const mockDeleteTableRange = vi.mocked(deleteTableRange)
const mockFormatTableSourceRange = vi.mocked(formatTableSourceRange)

function stubView(): EditorView {
  return { state: { sliceDoc: () => '' } } as unknown as EditorView
}

function stubRt(toast = vi.fn(), confirm = vi.fn().mockResolvedValue(true)) {
  return {
    toast,
    confirm,
    clipboardWrite: vi.fn().mockResolvedValue(undefined),
    openLink: vi.fn()
  } as unknown as CtxRuntime & { toast: ReturnType<typeof vi.fn>; confirm: ReturnType<typeof vi.fn> }
}

function stubRuntime(toast: ReturnType<typeof vi.fn>, path: string | null): void {
  setCtxRuntime({
    runCommand: vi.fn(),
    toast: toast as never,
    clipboardWrite: vi.fn().mockResolvedValue(undefined),
    openLink: vi.fn(),
    confirm: vi.fn().mockResolvedValue(false),
    getActiveFilePath: () => path
  })
}

function stubWritable(ok: boolean): void {
  vi.stubGlobal('window', {
    api: { platform: 'win32', isWritable: vi.fn().mockResolvedValue(ok) }
  })
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

function buildItems(deps: {
  runOp?: Mock<TableDeltaDeps['runOp']>
  cellClipboard?: Mock<TableDeltaDeps['cellClipboard']>
}): {
  items: ReturnType<typeof tableDeltaItems>
  runOp: Mock<TableDeltaDeps['runOp']>
  cellClipboard: Mock<TableDeltaDeps['cellClipboard']>
  rt: ReturnType<typeof stubRt>
} {
  const runOp = deps.runOp ?? vi.fn<TableDeltaDeps['runOp']>().mockReturnValue(true)
  const cellClipboard = deps.cellClipboard ?? vi.fn<TableDeltaDeps['cellClipboard']>()
  const rt = stubRt()
  const items = tableDeltaItems(
    {
      view: stubView(),
      tableFrom: 0,
      row: 1,
      col: 1,
      runOp,
      cellClipboard,
      modelSpan: () => ({ from: 0, to: 40 })
    },
    rt
  )
  return { items, runOp, cellClipboard, rt }
}

function toastTexts(toast: ReturnType<typeof vi.fn>): string[] {
  return toast.mock.calls.map((c) => {
    const a = c[0]
    return typeof a === 'string' ? a : (a as { message?: string })?.message ?? ''
  })
}

beforeEach(() => {
  setLang('zh')
  setCtxRuntime(null)
  vi.clearAllMocks()
})

afterEach(() => {
  setCtxRuntime(null)
  vi.unstubAllGlobals()
})

// ---- runStructOp（结构 op 写点 + 回执同窗） ---------------------------------

describe('runStructOp 只读闸门', () => {
  it('只读：runOp 零调用、无成功回执、回冻结 err.readonly', async () => {
    const gateToast = vi.fn()
    stubRuntime(gateToast, 'C:/ro/doc.md')
    stubWritable(false)
    const { items, runOp } = buildItems({})
    items.find((i) => i.id === 'deleteRow')?.run?.()
    await flush()
    expect(runOp).not.toHaveBeenCalled()
    expect(toastTexts(gateToast)).toEqual([t('err.readonly')])
  })

  it('可写：runOp 落点 + 成功回执携撤销（同窗顺序：先写后收据）', async () => {
    stubRuntime(vi.fn(), 'C:/rw/doc.md')
    stubWritable(true)
    const { items, runOp, rt } = buildItems({})
    items.find((i) => i.id === 'deleteRow')?.run?.()
    await flush()
    expect(runOp).toHaveBeenCalledOnce()
    const receipt = rt.toast.mock.calls[0]?.[0] as {
      message: string
      action?: { label: string }
    }
    expect(receipt.message).toBe('已删除第 2 行（Ctrl+Z 可撤销）')
    expect(receipt.action?.label).toBe('撤销')
  })
})

// ---- confirmDeleteTable（删表确认前拦截 + FE-08 扩展-1 稳态重解析） -----------
//
// 扩展-1：confirm 是异步落点——resolve 时点击时解析的 span 可能已过期。
// 删前用 resolveTableModel 重解析最新跨度（锚 span.from）；解析失败（表格已
// 不在）→ 静默 no-op：不删、不报错、不发回执。以下用真实 headless stateView
//（stubView 无法跑 syntaxTree 重解析）。

const TBL_DOC = 'x\n\n| Name | Age |\n| --- | --- |\n| a | b |\n'
const TBL_FROM = TBL_DOC.indexOf('| Name')

function stateView(doc: string): EditorView {
  let state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM], addKeymap: false }), tableEditField]
  })
  ensureSyntaxTree(state, state.doc.length, 50000)
  return {
    get state() {
      return state
    },
    dispatch(spec: { [k: string]: unknown }) {
      state = state.update(spec as never).state
      ensureSyntaxTree(state, state.doc.length, 50000)
    }
  } as unknown as EditorView
}

/** 可控 confirm：resolve 时机由测试持有（模拟「确认期间文档已变」）。 */
function deferredConfirm(): { confirm: ReturnType<typeof vi.fn>; resolve: (ok: boolean) => void } {
  let resolve!: (ok: boolean) => void
  const confirm = vi.fn().mockReturnValue(
    new Promise<boolean>((r) => {
      resolve = r
    })
  )
  return { confirm, resolve: (ok: boolean) => resolve(ok) }
}

function rtWith(confirm: ReturnType<typeof vi.fn>, toast = vi.fn()) {
  return {
    toast,
    confirm,
    clipboardWrite: vi.fn().mockResolvedValue(undefined),
    openLink: vi.fn()
  } as unknown as CtxRuntime & { toast: ReturnType<typeof vi.fn>; confirm: ReturnType<typeof vi.fn> }
}

describe('confirmDeleteTable 只读闸门 + 扩展-1 稳态重解析', () => {
  it('只读：确认框不出、deleteTableRange 不落、回冻结 err.readonly', async () => {
    const gateToast = vi.fn()
    stubRuntime(gateToast, 'C:/ro/doc.md')
    stubWritable(false)
    const rt = stubRt()
    confirmDeleteTable(stubView(), { from: 10, to: 40 }, rt)
    await flush()
    expect(rt.confirm).not.toHaveBeenCalled()
    expect(mockDeleteTableRange).not.toHaveBeenCalled()
    expect(rt.toast).not.toHaveBeenCalled()
    expect(toastTexts(gateToast)).toEqual([t('err.readonly')])
  })

  it('可写正常路径：确认框 → 重解析最新跨度删表 + 回执（旧 to 不生效）', async () => {
    stubRuntime(vi.fn(), null) // Untitled 同步放行，confirm 即刻挂起可控
    const { confirm, resolve } = deferredConfirm()
    const rt = rtWith(confirm)
    const view = stateView(TBL_DOC)
    // 故意传入过期的 to（截断跨度）——删表必须用重解析出的完整最新跨度
    confirmDeleteTable(view, { from: TBL_FROM, to: TBL_FROM + 5 }, rt)
    expect(confirm).toHaveBeenCalledOnce()
    resolve(true)
    await vi.waitFor(() => expect(mockDeleteTableRange).toHaveBeenCalledOnce())
    const [, from, to] = mockDeleteTableRange.mock.calls[0]
    const fresh = resolveTableModel(view, TBL_FROM)
    expect(fresh).not.toBeNull()
    expect(from).toBe(fresh!.model.tableFrom)
    expect(to).toBe(fresh!.model.tableTo)
    expect(to).toBeGreaterThan(TBL_FROM + 5) // 旧 to 未被采用
    expect(rt.toast).toHaveBeenCalledOnce()
  })

  it('扩展-1：confirm 期间表格被删 → 静默 no-op（不删、不报错、不发回执）', async () => {
    stubRuntime(vi.fn(), null)
    const { confirm, resolve } = deferredConfirm()
    const rt = rtWith(confirm)
    const view = stateView(TBL_DOC)
    confirmDeleteTable(view, { from: TBL_FROM, to: TBL_FROM + 40 }, rt)
    expect(confirm).toHaveBeenCalledOnce()
    // 确认框挂起期间整表被删（表格消失）
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'gone' } })
    resolve(true)
    await flush()
    expect(mockDeleteTableRange).not.toHaveBeenCalled()
    expect(rt.toast).not.toHaveBeenCalled()
    expect(view.state.doc.toString()).toBe('gone') // 文档逐字节未被误删
  })

  it('扩展-1：confirm 期间文档变更（表格被改写成散段）→ 静默 no-op，绝不按旧区间误删', async () => {
    stubRuntime(vi.fn(), null)
    const { confirm, resolve } = deferredConfirm()
    const rt = rtWith(confirm)
    const view = stateView(TBL_DOC)
    confirmDeleteTable(view, { from: TBL_FROM, to: TBL_FROM + 40 }, rt)
    expect(confirm).toHaveBeenCalledOnce()
    // 确认框挂起期间文档变更：表格被改写成散段——旧 from/to 覆盖的已是散文，
    // 按旧区间删 = 误删；识别失败必须静默 no-op（不删、不报错、不发回执）。
    view.dispatch({ changes: { from: TBL_FROM, to: view.state.doc.length, insert: 'plain prose\n' } })
    resolve(true)
    await flush()
    expect(mockDeleteTableRange).not.toHaveBeenCalled()
    expect(rt.toast).not.toHaveBeenCalled()
    expect(view.state.doc.toString()).toBe('x\n\nplain prose\n') // 文档逐字节未被误删
  })

  it('扩展-1：confirm 期间表内加行（同锚跨度变）→ 用重解析的最新 to（旧 to 不生效）', async () => {
    stubRuntime(vi.fn(), null)
    const { confirm, resolve } = deferredConfirm()
    const rt = rtWith(confirm)
    const view = stateView(TBL_DOC)
    // 故意传入过期的截断 to——表变长后按旧 to 删会留下表尾残段（错误区间）
    confirmDeleteTable(view, { from: TBL_FROM, to: TBL_FROM + 5 }, rt)
    view.dispatch({ changes: { from: view.state.doc.length - 1, insert: '| d | e |\n' } })
    resolve(true)
    await vi.waitFor(() => expect(mockDeleteTableRange).toHaveBeenCalledOnce())
    const [, from, to] = mockDeleteTableRange.mock.calls[0]
    const fresh = resolveTableModel(view, TBL_FROM)
    expect(fresh).not.toBeNull()
    expect(from).toBe(fresh!.model.tableFrom)
    expect(to).toBe(fresh!.model.tableTo)
    expect(to).toBeGreaterThan(TBL_FROM + 5) // 旧 to 未被采用
    expect(rt.toast).toHaveBeenCalledOnce()
  })
})

// ---- formatTableSource（formatTableSourceRange 写点） -----------------------

describe('formatTableSource 只读闸门', () => {
  it('只读：formatTableSourceRange 零调用、无格式化回执、回冻结 err.readonly', async () => {
    const gateToast = vi.fn()
    stubRuntime(gateToast, 'C:/ro/doc.md')
    stubWritable(false)
    const { items } = buildItems({})
    items.find((i) => i.id === 'formatTableSource')?.run?.()
    await flush()
    expect(mockFormatTableSourceRange).not.toHaveBeenCalled()
    expect(toastTexts(gateToast)).toEqual([t('err.readonly')])
  })
})

// ---- cutCell / pasteCell（cellClipboard 写路径）；copyCell 纯读放行 ----------

describe('剪贴板族只读闸门 — cut/paste 拦截、copy 放行', () => {
  it('只读：cutCell 不进 cellClipboard（单入口单条 err.readonly）', async () => {
    const gateToast = vi.fn()
    stubRuntime(gateToast, 'C:/ro/doc.md')
    stubWritable(false)
    const { items, cellClipboard } = buildItems({})
    items.find((i) => i.id === 'cutCell')?.run?.()
    await flush()
    expect(cellClipboard).not.toHaveBeenCalled()
    expect(toastTexts(gateToast)).toEqual([t('err.readonly')])
  })

  it('只读：copyCell 照常（纯读不设闸，只读文件可复制）', async () => {
    const gateToast = vi.fn()
    stubRuntime(gateToast, 'C:/ro/doc.md')
    stubWritable(false)
    const { items, cellClipboard } = buildItems({})
    items.find((i) => i.id === 'copyCell')?.run?.()
    await flush()
    expect(cellClipboard).toHaveBeenCalledWith('copy')
    expect(toastTexts(gateToast)).toEqual([])
  })

  it('只读：pasteCell 被拦', async () => {
    const gateToast = vi.fn()
    stubRuntime(gateToast, 'C:/ro/doc.md')
    stubWritable(false)
    const { items, cellClipboard } = buildItems({})
    items.find((i) => i.id === 'pasteCell')?.run?.()
    await flush()
    expect(cellClipboard).not.toHaveBeenCalled()
    expect(toastTexts(gateToast)).toEqual([t('err.readonly')])
  })

  it('可写：cut/paste 均进 cellClipboard', async () => {
    stubRuntime(vi.fn(), 'C:/rw/doc.md')
    stubWritable(true)
    const { items, cellClipboard } = buildItems({})
    items.find((i) => i.id === 'cutCell')?.run?.()
    items.find((i) => i.id === 'pasteCell')?.run?.()
    await flush()
    expect(cellClipboard.mock.calls.map((c) => c[0])).toEqual(['cut', 'paste'])
  })
})
