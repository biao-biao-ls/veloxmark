/**
 * P0 handoff 抑制闸门（AC-PEND-11 / AC-OP-02 / AC-ERR-01 / AC-RULE-08）——
 * destroy 端 capture 判定纯逻辑 + 状态级判据（headless，CM6 state 级；不渲染 widget）。
 *
 * 缺陷机制：ops.ts 的 nextActive 在结构 op 后与旧 widget `spec.active` 坐标
 * 可撞（insertRowOp/deleteRowOp 恒 col 0、setAlignOp 恒 row 0）——仅靠坐标
 * isRetarget 分不清「同格重建」与「结构 op」，destroy 端 handoff 微任务会把
 * 旧格 pending 文本写进新空表头（Q5 身份下移场景），且是第二条 undo 历史
 *（AC-RULE-08 一 op 一历史被破坏）。修复：结构 dispatch 外罩
 * withHandoffSuppressed（widget destroy 同步发生在 view.dispatch 内），
 * captureHandoff 见抑制即跳过 stash + 微任务。
 */
import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { GFM } from '@lezer/markdown'
import type { EditorView } from '@codemirror/view'
import { setActiveCell, tableEditField } from './state'
import {
  captureHandoff,
  commitHandoff,
  getHandoff,
  handoffKey,
  shouldHandoff,
  withHandoffSuppressed
} from './nestedSession'
import { parseTableModel } from './parse'

// ---- headless view（editMode.test.ts stateView 模式） ------------------------

function stateView(doc: string): { view: EditorView; getDoc: () => string } {
  let state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM], addKeymap: false }), tableEditField]
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

/** flush 同步微任务（commitHandoff 的 queueMicrotask 写回）。 */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

const DOC = '| Name | Age |\n| --- | --- |\n| a | b |\n'
const TABLE_FROM = 0

function viewWithActive(row: number, col: number): EditorView {
  const sv = stateView(DOC)
  sv.view.dispatch({
    effects: setActiveCell.of({ tableFrom: TABLE_FROM, row, col, caret: 0 })
  })
  return sv.view
}

/** 表格行首行的单元格文本（模型化读取，免受 padding 影响）。 */
function cells(doc: string): string[][] {
  const lines = doc.split('\n').filter((l) => l.trimStart().startsWith('|'))
  return parseTableModel(lines.join('\n'), 0).cells.map((r) => r.map((c) => c.text))
}

// ---- shouldHandoff 判定矩阵 -------------------------------------------------

describe('shouldHandoff — destroy 端保全判定', () => {
  it('抑制窗内一律跳过（结构 op 单事务已折叠 pending 文本）', () => {
    expect(shouldHandoff({ row: 0, col: 0 }, { row: 0, col: 0 }, true)).toBe(false)
    expect(shouldHandoff(null, { row: 0, col: 0 }, true)).toBe(false)
    expect(shouldHandoff({ row: 1, col: 1 }, { row: 0, col: 0 }, true)).toBe(false)
  })

  it('同坐标（含坐标撞车的结构 op 场景）→ 保全：这是 P0 缺陷的触发条件', () => {
    expect(shouldHandoff({ row: 0, col: 0 }, { row: 0, col: 0 }, false)).toBe(true)
    // state.active 已清（产品退场）时按同格重建处理（commitHandoff 自身再守）
    expect(shouldHandoff(null, { row: 2, col: 1 }, false)).toBe(true)
  })

  it('hop/retarget（坐标不同）→ 跳过：新挂载点接管会话', () => {
    expect(shouldHandoff({ row: 1, col: 0 }, { row: 0, col: 0 }, false)).toBe(false)
    expect(shouldHandoff({ row: 0, col: 1 }, { row: 0, col: 0 }, false)).toBe(false)
  })

  it('无 own 格 → 跳过', () => {
    expect(shouldHandoff({ row: 0, col: 0 }, null, false)).toBe(false)
    expect(shouldHandoff(null, null, false)).toBe(false)
  })
})

// ---- withHandoffSuppressed / captureHandoff ---------------------------------

describe('withHandoffSuppressed — 结构 dispatch 抑制窗', () => {
  it('嵌套深度计数：内层结束不弹出外层窗（capture 仍被抑制）', async () => {
    const v = viewWithActive(0, 0)
    const before = v.state.doc.toString()
    withHandoffSuppressed(() => {
      withHandoffSuppressed(() => {
        // 内层窗口结束
      })
      // 外层窗仍在：capture 仍被抑制
      captureHandoff(v, { row: 0, col: 0 }, TABLE_FROM, 'Nope')
    })
    await flush()
    expect(v.state.doc.toString()).toBe(before)
    expect(getHandoff(handoffKey(TABLE_FROM, 0, 0))).toBeNull()
  })

  it('窗内 capture：不 stash、不微任务回写（P0 修复行为）', async () => {
    const v = viewWithActive(0, 0)
    const before = v.state.doc.toString()
    withHandoffSuppressed(() => {
      captureHandoff(v, { row: 0, col: 0 }, TABLE_FROM, 'Name!')
    })
    await flush()
    expect(v.state.doc.toString()).toBe(before)
    expect(getHandoff(handoffKey(TABLE_FROM, 0, 0))).toBeNull()
  })

  it('窗外同坐标 capture：stash + 微任务把 pending 文本写回活跃格（缺陷场景成立）', async () => {
    const v = viewWithActive(0, 0)
    captureHandoff(v, { row: 0, col: 0 }, TABLE_FROM, 'Name!')
    expect(getHandoff(handoffKey(TABLE_FROM, 0, 0))).toBe('Name!') // one-shot 消费
    expect(getHandoff(handoffKey(TABLE_FROM, 0, 0))).toBeNull()
    await flush()
    expect(cells(v.state.doc.toString())[0][0]).toBe('Name!')
  })

  it('retarget（坐标不同）capture：跳过 stash 与回写', async () => {
    const v = viewWithActive(1, 0) // active 已移至 (1,0)
    const before = v.state.doc.toString()
    captureHandoff(v, { row: 0, col: 0 }, TABLE_FROM, 'Name!')
    await flush()
    expect(v.state.doc.toString()).toBe(before)
    expect(getHandoff(handoffKey(TABLE_FROM, 0, 0))).toBeNull()
  })
})

// ---- commitHandoff 自身守卫 -------------------------------------------------

describe('commitHandoff — 微任务写回守卫', () => {
  it('活跃格已清 → 不写回（产品退场路径）', async () => {
    const v = viewWithActive(0, 0)
    v.dispatch({ effects: setActiveCell.of(null) })
    const before = v.state.doc.toString()
    commitHandoff(v, 0, 0, 'Name!')
    await flush()
    expect(v.state.doc.toString()).toBe(before)
  })

  it('活跃格坐标已移 → 不写回', async () => {
    const v = viewWithActive(1, 1)
    const before = v.state.doc.toString()
    commitHandoff(v, 0, 0, 'Name!')
    await flush()
    expect(v.state.doc.toString()).toBe(before)
  })

  it('文本相同 → 不产生空事务（零历史）', async () => {
    const v = viewWithActive(0, 0)
    const before = v.state.doc.toString()
    commitHandoff(v, 0, 0, 'Name')
    await flush()
    expect(v.state.doc.toString()).toBe(before)
  })
})
