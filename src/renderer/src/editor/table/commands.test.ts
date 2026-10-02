/**
 * runTableOp 单事务链回归（P0，AC-PEND-11/AC-OP-02/AC-ERR-01/AC-RULE-08）+
 * handleTsvPaste 1×1 TSV 粘贴 handoff 覆盖回归（P0，CHANGE-25 同族残余）+
 * 结构操作只读闸门（P1，AC-ERR-08/AC-RULE-16）。
 *
 * P0 判据（headless，CM6 state 级；不渲染 widget）：激活格 (0,0) 首行上插 →
 * 新表头首格为空（Q5 身份下移）+ destroy 端 handoff 不回写 + undo 一次后文档
 * 逐字节=操作前（含参差态）且 history 仅一条；同族覆盖 deleteRowOp 与
 * setAlignOp。destroy 端 capture 在抑制窗内由 captureHandoff 模拟（生产路径
 * 上 widget destroy 同步发生在 runTableOp 的 dispatch 内）。
 *
 * P1 判据：只读 stub（getActiveFilePath 有路径 + isWritable=false）下
 * tryStructCmd / runTableOp+toastTableOp（工具栏同形）均被拒——文档逐字节
 * 不变、无成功回执、回冻结 err.readonly。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { GFM } from '@lezer/markdown'
import { history, undo } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'
import { setLang, t } from '../../i18n'
import { setCtxRuntime } from '../contextMenu/registry'
import { getTableEdit, setActiveCell, tableEditField } from './state'
import { captureHandoff, getHandoff, handoffKey, withHandoffSuppressed } from './nestedSession'
import { handleTsvPaste, runTableOp, toastTableOp, tryStructCmd } from './commands'
import { deleteRowOp, insertRowAboveOp, insertRowBelowOp, setAlignOp } from './ops'
import { parseTableModel } from './parse'

// ---- headless view + history（editMode.test.ts stateView 模式 + undo 栈） -----

function stateView(doc: string): { view: EditorView; getDoc: () => string } {
  let state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM], addKeymap: false }), tableEditField, history()]
  })
  ensureSyntaxTree(state, state.doc.length, 50000)
  const view = {
    get state() {
      return state
    },
    dispatch(spec: { [k: string]: unknown }) {
      state = state.update(spec as never).state
      ensureSyntaxTree(state, state.doc.length, 50000)
    }
  } as unknown as EditorView
  return { view, getDoc: () => state.doc.toString() }
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

/** 参差态表（末行缺列，AC-ERR-01）：undo 逐字节还原须含参差。 */
const DOC = 'x\n\n| Name | Age |\n| --- | --- |\n| a | b |\n| c |\n'
const TABLE_FROM = DOC.indexOf('| Name')

function viewWithActive(row: number, col: number): { view: EditorView; getDoc: () => string } {
  const sv = stateView(DOC)
  sv.view.dispatch({
    effects: setActiveCell.of({ tableFrom: TABLE_FROM, row, col, caret: 0 })
  })
  return sv
}

function cells(doc: string): string[][] {
  const lines = doc.split('\n').filter((l) => l.trimStart().startsWith('|'))
  return parseTableModel(lines.join('\n'), 0).cells.map((r) => r.map((c) => c.text))
}

beforeEach(() => {
  setLang('zh')
  setCtxRuntime(null)
})

afterEach(() => {
  setCtxRuntime(null)
  vi.unstubAllGlobals()
})

// ---- P0：结构 op 单事务链（激活格第 0 列 handoff 误判回归） -------------------

describe('P0 runTableOp 单事务链 — 激活格 (0,0) 结构 op 后 handoff 不污染', () => {
  it('首行上插：新表头首格为空 + capture 抑制 + 一次 undo 逐字节还原且 history 仅一条', async () => {
    const { view, getDoc } = viewWithActive(0, 0)
    const before = getDoc()
    // 生产路径上 widget destroy 同步发生在 runTableOp 的 dispatch 内——同窗
    // 模拟 destroy 端 capture（旧激活格 (0,0) 的 pending 文本 = 旧表头 'Name'）。
    withHandoffSuppressed(() => {
      expect(
        runTableOp(view, TABLE_FROM, (m) => insertRowAboveOp(m, 0), 'input.table.insertRow')
      ).toBe(true)
      captureHandoff(view, { row: 0, col: 0 }, TABLE_FROM, 'Name')
    })
    await flush()
    const grid = cells(getDoc())
    expect(grid[0][0]).toBe('') // Q5：新空行升表头，首格为空（无 'Name' 污染）
    expect(grid[1][0]).toBe('Name') // 旧表头降级 body 首行（pending 文本随单事务折叠）
    expect(grid.length).toBe(4) // 2 body + 新头 + 旧头
    // undo 一次逐字节=操作前（含参差态）
    expect(undo(view)).toBe(true)
    expect(getDoc()).toBe(before)
    // history 仅一条：第二次 undo 无事可做
    expect(undo(view)).toBe(false)
    expect(getDoc()).toBe(before)
  })

  it('负对照（stash+文档双向量）：无抑制窗 insertRowAbove 同坐标 capture → 播种 + 文档污染 + 双历史', async () => {
    // 改钉理由（收口批 #2）：空白格 trimmedCell 倒置区间已修（parse.ts 规范化
    // 为 raw 全跨），commitHandoff 对新空白表头的文档级写回重新可达——本例原以
    // 「写回不可达」为前提降级为 stash 向量钉子，现如实恢复为原设计的文档级
    // 「污染+双历史」向量，并保留 stash 断言（挂载侧播种污染依旧在，P0 抑制窗
    // 同时挡两者）；缺陷向量不掩盖。摘 parse.ts 规范化 → 本例必红（RangeError
    // 被吞、文档不动）。
    const { view, getDoc } = viewWithActive(0, 0)
    const before = getDoc()
    expect(
      runTableOp(view, TABLE_FROM, (m) => insertRowAboveOp(m, 0), 'input.table.insertRow')
    ).toBe(true)
    // widget destroy 已出窗——旧坐标 capture 不再被抑制 = 缺陷路径
    captureHandoff(view, { row: 0, col: 0 }, TABLE_FROM, 'Name')
    await flush()
    // stash 级污染：mount 端 getHandoff 将以 'Name' 播种新空表头 (0,0)
    expect(getHandoff(handoffKey(TABLE_FROM, 0, 0))).toBe('Name')
    // 文档级污染：commitHandoff 把 'Name' 写进新空白表头（倒置区间修复后可达）
    expect(cells(getDoc())[0][0]).toBe('Name')
    // 双历史：一次 undo 只撤 commitHandoff 微事务（input.table.cell 独立历史）
    expect(undo(view)).toBe(true)
    expect(getDoc()).not.toBe(before)
    expect(undo(view)).toBe(true)
    expect(getDoc()).toBe(before)
  })

  it('负对照（文档向量）：无抑制窗 deleteRowOp 同坐标 capture → 文档污染 + 双历史', async () => {
    const { view, getDoc } = viewWithActive(0, 0)
    const before = getDoc()
    expect(runTableOp(view, TABLE_FROM, (m) => deleteRowOp(m, 0), 'input.table.deleteRow')).toBe(
      true
    )
    // 缺陷路径（无抑制窗）：nextActive {row:0,col:0} 与旧 widget own 同坐标，
    // isRetarget=false → handoff 落盘
    captureHandoff(view, { row: 0, col: 0 }, TABLE_FROM, 'Name')
    await flush()
    expect(cells(getDoc())[0][0]).toBe('Name') // 旧表头文本污染升格表头（原 'a'）
    expect(getHandoff(handoffKey(TABLE_FROM, 0, 0))).toBe('Name') // 同时打脏 stash（清掉防泄漏）
    // 双历史：一次 undo 只撤掉 commitHandoff 微事务（input.table.cell 非
    // joinable userEvent，恒独立 history 事件），文档仍非操作前
    expect(undo(view)).toBe(true)
    expect(getDoc()).not.toBe(before)
    expect(undo(view)).toBe(true)
    expect(getDoc()).toBe(before)
  })

  it('同族 deleteRowOp（nextActive col 恒 0）：表头身份下移且 handoff 不污染新表头', async () => {
    const { view, getDoc } = viewWithActive(0, 0)
    const before = getDoc()
    withHandoffSuppressed(() => {
      expect(runTableOp(view, TABLE_FROM, (m) => deleteRowOp(m, 0), 'input.table.deleteRow')).toBe(
        true
      )
      captureHandoff(view, { row: 0, col: 0 }, TABLE_FROM, 'Name')
    })
    await flush()
    const grid = cells(getDoc())
    expect(grid[0]).toEqual(['a', 'b']) // 身份下移：原 body 首行升表头，非 'Name'
    expect(undo(view)).toBe(true)
    expect(getDoc()).toBe(before)
    expect(undo(view)).toBe(false)
  })

  it('同族 setAlignOp（nextActive 恒 {row:0,col}）：对齐单事务，handoff 不二次写回', async () => {
    const { view, getDoc } = viewWithActive(0, 0)
    const before = getDoc()
    withHandoffSuppressed(() => {
      expect(runTableOp(view, TABLE_FROM, (m) => setAlignOp(m, 0, 'center'), 'input.table.align')).toBe(
        true
      )
      captureHandoff(view, { row: 0, col: 0 }, TABLE_FROM, 'Name!')
    })
    await flush()
    expect(cells(getDoc())[0][0]).toBe('Name') // (0,0) 未被 handoff 改写
    expect(getDoc()).toContain(':---:') // 对齐已写进冒号行
    expect(undo(view)).toBe(true)
    expect(getDoc()).toBe(before)
    expect(undo(view)).toBe(false)
  })
})

// ---- P0：handleTsvPaste 单事务链（1×1 TSV 粘贴 handoff 覆盖回归，CHANGE-25） --

/**
 * 生产时序模拟：widget destroy 同步发生在 view.dispatch 内 → dispatch 内触发
 * destroy 端 captureHandoff（仅对 pasteTsv 整表 rewrite 事务触发，对应旧 widget
 * 销毁）。own 取粘贴前激活格（= pasteTsvOp 1×1 时的 nextActive，任意列可碰撞）。
 */
function viewWithDestroyOnPaste(
  row: number,
  col: number,
  pendingText: string
): { view: EditorView; getDoc: () => string } {
  let state = EditorState.create({
    doc: DOC,
    extensions: [markdown({ extensions: [GFM], addKeymap: false }), tableEditField, history()]
  })
  ensureSyntaxTree(state, state.doc.length, 50000)
  state = state.update({
    effects: setActiveCell.of({ tableFrom: TABLE_FROM, row, col, caret: 0 })
  }).state
  const view = {
    get state() {
      return state
    },
    dispatch(spec: { [k: string]: unknown }) {
      state = state.update(spec as never).state
      ensureSyntaxTree(state, state.doc.length, 50000)
      if ((spec as { userEvent?: string }).userEvent === 'input.table.pasteTsv') {
        captureHandoff(view, { row, col }, TABLE_FROM, pendingText)
      }
    }
  } as unknown as EditorView
  return { view, getDoc: () => state.doc.toString() }
}

/** 源码级列数（每条表行的单元格数）——参差补齐判据用。 */
function sourceColCounts(doc: string): number[] {
  return doc
    .split('\n')
    .filter((l) => l.trimStart().startsWith('|'))
    .map((l) => l.split('|').length - 2)
}

describe('P0 handleTsvPaste 单事务链 — 1×1 TSV 粘贴后 handoff 不覆盖粘贴值', () => {
  it('1×1 TSV 于激活格 (0,0)：粘贴值存活 + 无 stash/微任务回写 + 一次 undo 逐字节还原', async () => {
    // parseTsv("hello\n") → [["hello"]]（Excel 单格复制典型形态）；nextActive 恒
    // 等于激活格 (0,0) → isRetarget=false，缺陷向量成立面。
    const { view, getDoc } = viewWithDestroyOnPaste(0, 0, 'Name!')
    const before = getDoc()
    handleTsvPaste(view, 'hello\n')
    await flush()
    expect(cells(getDoc())[0][0]).toBe('hello') // 粘贴值存活，不被旧嵌套文本 'Name!' 覆盖
    expect(getHandoff(handoffKey(TABLE_FROM, 0, 0))).toBe(null) // 无 pendingHandoff 残留
    expect(undo(view)).toBe(true)
    expect(getDoc()).toBe(before) // 一次 undo 逐字节还原（无 input.table.cell 第二条历史）
    expect(undo(view)).toBe(false)
    expect(getDoc()).toBe(before)
  })

  it('1×1 TSV 于激活格 (0,1)（任意列碰撞面，不限第 0 列）：同族不覆盖 + 单历史', async () => {
    const { view, getDoc } = viewWithDestroyOnPaste(0, 1, 'Age!')
    const before = getDoc()
    handleTsvPaste(view, 'hello\n')
    await flush()
    expect(cells(getDoc())[0][1]).toBe('hello')
    expect(cells(getDoc())[0][0]).toBe('Name') // 邻格不受害
    expect(getHandoff(handoffKey(TABLE_FROM, 0, 1))).toBe(null)
    expect(undo(view)).toBe(true)
    expect(getDoc()).toBe(before)
    expect(undo(view)).toBe(false)
  })

  it('负对照（文档向量）：无抑制窗同坐标 capture → 粘贴值被旧文本覆盖 + 双历史', async () => {
    const { view, getDoc } = viewWithActive(0, 0)
    const before = getDoc()
    handleTsvPaste(view, 'hello\n')
    // 缺陷路径（destroy 已出窗）：nextActive (0,0) 与旧 widget own 同坐标，
    // isRetarget=false → handoff 落盘
    captureHandoff(view, { row: 0, col: 0 }, TABLE_FROM, 'Name!')
    await flush()
    expect(cells(getDoc())[0][0]).toBe('Name!') // 旧嵌套文本覆盖刚粘贴的 'hello'
    expect(getHandoff(handoffKey(TABLE_FROM, 0, 0))).toBe('Name!')
    // 双历史：一次 undo 只撤掉 commitHandoff 微事务（input.table.cell 独立历史）
    expect(undo(view)).toBe(true)
    expect(getDoc()).not.toBe(before)
    expect(undo(view)).toBe(true)
    expect(getDoc()).toBe(before)
  })

  it('正向面：多格 TSV 粘贴内容落位 + nextActive 落右下 + 单历史', async () => {
    const { view, getDoc } = viewWithDestroyOnPaste(0, 0, 'Name!')
    const before = getDoc()
    handleTsvPaste(view, 'p\tq\nr\ts\n') // 2×2
    await flush()
    const grid = cells(getDoc())
    expect(grid[0]).toEqual(['p', 'q'])
    expect(grid[1]).toEqual(['r', 's'])
    const active = getTableEdit(view.state).active
    expect(active).toMatchObject({ row: 1, col: 1 }) // 激活格落位粘贴矩形右下
    expect(undo(view)).toBe(true)
    expect(getDoc()).toBe(before)
    expect(undo(view)).toBe(false)
  })

  it('正向面：参差表 TSV 粘贴单事务补齐矩形，范围外内容不丢且 undo 还原参差态', async () => {
    const { view, getDoc } = viewWithDestroyOnPaste(1, 0, 'a!')
    const before = getDoc()
    expect(new Set(sourceColCounts(before)).size).toBeGreaterThan(1) // 前置：源码参差
    handleTsvPaste(view, 'x\ty\tz\n') // 1×3 扩列，触发整表补齐
    await flush()
    const counts = sourceColCounts(getDoc())
    expect(new Set(counts).size).toBe(1) // 补齐为矩形
    const grid = cells(getDoc())
    expect(grid[1]).toEqual(['x', 'y', 'z']) // 粘贴落位
    expect(grid[2][0]).toBe('c') // 参差短行范围外内容不丢（空位补齐）
    expect(grid[0][0]).toBe('Name') // 表头不受害
    expect(undo(view)).toBe(true)
    expect(getDoc()).toBe(before) // 一次 undo 一并还原参差态（逐字节）
    expect(undo(view)).toBe(false)
  })
})

// ---- P1：只读闸门（AC-ERR-08 / AC-RULE-16） ---------------------------------

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

function toastTexts(toast: ReturnType<typeof vi.fn>): string[] {
  return toast.mock.calls.map((c) => {
    const a = c[0]
    return typeof a === 'string' ? a : (a as { message?: string })?.message ?? ''
  })
}

describe('P1 runTableOp 只读闸门 — 快捷键/工具栏同形入口', () => {
  it('只读：tryStructCmd 被拒——文档逐字节不变、无成功回执、回冻结 err.readonly', async () => {
    const toast = vi.fn()
    stubRuntime(toast, 'C:/ro/doc.md')
    stubWritable(false)
    const { view, getDoc } = viewWithActive(0, 0)
    const before = getDoc()
    expect(tryStructCmd(view, 'insertRowBelow')).toBe(true) // 键已消费（表内上下文）
    await flush()
    expect(getDoc()).toBe(before) // 零 dispatch、零 dirty
    const texts = toastTexts(toast)
    expect(texts).toContain(t('err.readonly'))
    expect(texts).not.toContain(t('toast.rowInsertedBelow'))
  })

  it('只读：工具栏同形（runTableOp 同步收据 + toastTableOp）写与收据双拦', async () => {
    const toast = vi.fn()
    stubRuntime(toast, 'C:/ro/doc.md')
    stubWritable(false)
    const { view, getDoc } = viewWithActive(0, 0)
    const before = getDoc()
    // toolbar.ts 对齐键的收据形状：if (runTableOp(...)) toastTableOp(...)
    if (runTableOp(view, TABLE_FROM, (m) => setAlignOp(m, 0, 'center'), 'input.table.align')) {
      toastTableOp(view, 'alignCenter', { row: 0, col: 0 })
    }
    await flush()
    expect(getDoc()).toBe(before)
    const texts = toastTexts(toast)
    expect(texts).toEqual([t('err.readonly')]) // 仅冻结只读 toast，无成功回执
  })

  it('可写：op 落盘 + 成功回执携「撤销」+ 一次 undo 还原', async () => {
    const toast = vi.fn()
    stubRuntime(toast, 'C:/rw/doc.md')
    stubWritable(true)
    const { view, getDoc } = viewWithActive(0, 0)
    const before = getDoc()
    expect(tryStructCmd(view, 'insertRowBelow')).toBe(true)
    await flush()
    expect(getDoc()).not.toBe(before)
    expect(cells(getDoc()).length).toBe(4) // +1 空行
    const receipt = toast.mock.calls
      .map((c) => c[0])
      .find((a) => typeof a === 'object' && a !== null && 'message' in a) as
      | { message: string; action?: { label: string } }
      | undefined
    expect(receipt?.message).toBe(t('toast.rowInsertedBelow'))
    expect(receipt?.action?.label).toBe('撤销')
    expect(undo(view)).toBe(true)
    expect(getDoc()).toBe(before)
  })

  it('Untitled（无路径）：与 assertWritable 同语义视为可写，同步落盘', () => {
    const toast = vi.fn()
    stubRuntime(toast, null)
    stubWritable(true)
    const { view, getDoc } = viewWithActive(0, 0)
    const before = getDoc()
    expect(tryStructCmd(view, 'insertRowBelow')).toBe(true)
    expect(getDoc()).not.toBe(before) // 同步：无 probe 微任务延迟
    expect(toastTexts(toast)).not.toContain(t('err.readonly'))
  })

  it('probe 断裂（isWritable 抛错）fail-open：照常落盘（闸门不得锁死编辑）', async () => {
    const toast = vi.fn()
    stubRuntime(toast, 'C:/rw/doc.md')
    vi.stubGlobal('window', {
      api: {
        platform: 'win32',
        isWritable: vi.fn().mockRejectedValue(new Error('ipc down'))
      }
    })
    const { view, getDoc } = viewWithActive(0, 0)
    const before = getDoc()
    expect(tryStructCmd(view, 'insertRowBelow')).toBe(true)
    await flush()
    expect(getDoc()).not.toBe(before)
  })
})

// ---- P1：handleTsvPaste 只读闸门（PATH-04-r3 观察②，整表结构替换入口） ----

describe('P1 handleTsvPaste 只读闸门 — 与 runTableOp/opsTable.runOp 同口径', () => {
  it('只读：粘贴 TSV 零写入 + 恰一条冻结 err.readonly（无成功回执）', async () => {
    const toast = vi.fn()
    stubRuntime(toast, 'C:/ro/doc.md')
    stubWritable(false)
    const { view, getDoc } = viewWithActive(0, 0)
    const before = getDoc()
    handleTsvPaste(view, 'hello\n')
    await flush()
    expect(getDoc()).toBe(before) // 零 dispatch、零 dirty
    const texts = toastTexts(toast)
    expect(texts).toEqual([t('err.readonly')]) // 恰一条，且无成功回执泄漏
  })

  it('可写（有路径）：探针放行后照常落盘，无 err.readonly', async () => {
    const toast = vi.fn()
    stubRuntime(toast, 'C:/rw/doc.md')
    stubWritable(true)
    const { view, getDoc } = viewWithActive(0, 0)
    const before = getDoc()
    handleTsvPaste(view, 'hello\n')
    await flush()
    expect(getDoc()).not.toBe(before)
    expect(cells(getDoc())[0][0]).toBe('hello')
    expect(toastTexts(toast)).not.toContain(t('err.readonly'))
    expect(undo(view)).toBe(true) // 单事务可一步撤销
    expect(getDoc()).toBe(before)
  })

  it('Untitled（无路径）：同 assertWritable 语义同步放行（既有粘贴面行为不变）', () => {
    const toast = vi.fn()
    stubRuntime(toast, null)
    stubWritable(true)
    const { view, getDoc } = viewWithActive(0, 0)
    const before = getDoc()
    handleTsvPaste(view, 'hello\n')
    expect(getDoc()).not.toBe(before) // 同步：无 probe 微任务延迟
    expect(toastTexts(toast)).not.toContain(t('err.readonly'))
  })
})
