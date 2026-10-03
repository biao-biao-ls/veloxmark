import { describe, expect, it } from 'vitest'
import {
  applyListMovePlan,
  canReorderListItem,
  listDragSessionStep,
  parseListItems,
  planListMove
} from './listDrag'

const L = (...lines: string[]) => lines

describe('parseListItems (ren-list:drag-handle)', () => {
  it('finds unordered / ordered / task marker lines with indent', () => {
    const lines = L('- a', '  * b', '10. c', '- [x] done', 'plain')
    const items = parseListItems(lines)
    expect(items.map((i) => i.line)).toEqual([0, 1, 2, 3])
    expect(items[0].indent).toBe(0)
    expect(items[1].indent).toBe(2)
    expect(items[3].indent).toBe(0)
  })

  it('ignores pseudo-list lines inside fenced code', () => {
    const lines = L('```', '- fake', '```', '- real')
    const items = parseListItems(lines)
    expect(items.map((i) => i.line)).toEqual([3])
  })

  it('does not treat marker-without-space as a list item', () => {
    expect(parseListItems(L('-no-space', '1)x')).map((i) => i.line)).toEqual([])
  })
})

describe('canReorderListItem (single-line list gray-handle rule)', () => {
  it('is false for a one-item list', () => {
    expect(canReorderListItem(L('- only'), 0)).toBe(false)
    expect(planListMove(L('- only'), 0, 0, 'before')).toBeNull()
  })

  it('is false when the item has no same-level sibling (nested singleton)', () => {
    const lines = L('- a', '  - a1')
    expect(canReorderListItem(lines, 0)).toBe(false)
    expect(canReorderListItem(lines, 1)).toBe(false)
  })

  it('is true with ≥2 same-level siblings', () => {
    const lines = L('- a', '- b')
    expect(canReorderListItem(lines, 0)).toBe(true)
    expect(canReorderListItem(lines, 1)).toBe(true)
  })

  it('is false for a non-list line / fence pseudo item', () => {
    expect(canReorderListItem(L('text', '- a', '- b'), 0)).toBe(false)
    expect(canReorderListItem(L('```', '- fake', '```', '- a', '- b'), 1)).toBe(false)
  })
})

describe('planListMove / applyListMovePlan — 同层级移动', () => {
  const lines = L('- alpha', '- beta', '- gamma')

  it('moves a block to the drop slot, indent prefixes byte-identical', () => {
    const plan = planListMove(lines, 0, 2, 'after')
    expect(plan).not.toBeNull()
    expect(plan!.fromIndex).toBe(0)
    expect(plan!.toIndex).toBe(2)
    expect(plan!.indentLevel).toBe(0)
    expect(applyListMovePlan(lines, plan!)).toEqual(L('- beta', '- gamma', '- alpha'))
  })

  it('moves backward before the first item', () => {
    const plan = planListMove(lines, 2, 0, 'before')
    expect(plan!.toIndex).toBe(0)
    expect(applyListMovePlan(lines, plan!)).toEqual(L('- gamma', '- alpha', '- beta'))
  })

  it('reports a no-op plan when the drop slot equals the current slot', () => {
    const stay = planListMove(lines, 0, 1, 'before')
    expect(stay!.toIndex).toBe(stay!.fromIndex)
    expect(applyListMovePlan(lines, stay!)).toEqual(lines)
  })
})

describe('applyListMovePlan — 缩进保持 / 子树整体移动', () => {
  it('moves the item block with its nested children, indent untouched', () => {
    const lines = L('- a', '  - a1', '  - a2', '- b')
    const plan = planListMove(lines, 0, 3, 'after')
    expect(plan!.indentLevel).toBe(0)
    expect(applyListMovePlan(lines, plan!)).toEqual(L('- b', '- a', '  - a1', '  - a2'))
  })

  it('reorders nested siblings inside their parent only', () => {
    const lines = L('- a', '  - a1', '  - a2', '- b')
    const plan = planListMove(lines, 1, 2, 'after')
    expect(plan!.indentLevel).toBe(2)
    expect(applyListMovePlan(lines, plan!)).toEqual(L('- a', '  - a2', '  - a1', '- b'))
  })

  it('keeps loose-list blank gaps fixed while blocks reorder', () => {
    const lines = L('- a', '', '- b', '', '- c')
    const plan = planListMove(lines, 0, 2, 'after')
    expect(applyListMovePlan(lines, plan!)).toEqual(L('- b', '', '- a', '', '- c'))
  })
})

describe('planListMove — 跨父级边界钳制回同层级', () => {
  const lines = L('- a', '- b', '  - b1', '  - b2', '- c')

  it('drop onto a nested child clamps to that child’s parent slot', () => {
    // drag c onto b1 (deeper, under b) 'before' → lands before b at the same level
    const plan = planListMove(lines, 4, 2, 'before')
    expect(plan!.fromIndex).toBe(2)
    expect(plan!.toIndex).toBe(1)
    expect(applyListMovePlan(lines, plan!)).toEqual(
      L('- a', '- c', '- b', '  - b1', '  - b2')
    )
  })

  it('drop onto own descendant is a no-op', () => {
    const plan = planListMove(lines, 1, 2, 'after')
    expect(plan!.toIndex).toBe(plan!.fromIndex)
    expect(applyListMovePlan(lines, plan!)).toEqual(lines)
  })

  it('drop past the group end clamps to the last slot', () => {
    const far = L('- a', '- b', '', 'text', '', '- x', '- y')
    const plan = planListMove(far, 0, 5, 'after')
    expect(plan!.toIndex).toBe(1)
    expect(applyListMovePlan(far, plan!)).toEqual(L('- b', '- a', '', 'text', '', '- x', '- y'))
  })

  it('drop before the group start clamps to the first slot', () => {
    const far = L('intro', '', '- a', '- b')
    const plan = planListMove(far, 3, 0, 'before')
    expect(plan!.toIndex).toBe(0)
    expect(applyListMovePlan(far, plan!)).toEqual(L('intro', '', '- b', '- a'))
  })
})

describe('applyListMovePlan — undo 一步还原', () => {
  it('applying the inverse plan restores the exact source lines', () => {
    const lines = L('- a', '  - a1', '- b', '- c')
    const plan = planListMove(lines, 0, 3, 'after')
    const moved = applyListMovePlan(lines, plan!)
    // moved block lands at the end; plan the way back and apply — one inverse
    // pure step, mirroring the single CM6 transaction / single Ctrl+Z.
    const back = planListMove(moved, moved.length - 2, 0, 'before')
    expect(back).not.toBeNull()
    expect(applyListMovePlan(moved, back!)).toEqual(lines)
  })
})

describe('planListMove — task items (ren-task:check source lines are list lines)', () => {
  it('reorders task checkbox lines like plain items', () => {
    const lines = L('- [ ] write docs', '- [x] review')
    const plan = planListMove(lines, 0, 1, 'after')
    expect(applyListMovePlan(lines, plan!)).toEqual(L('- [x] review', '- [ ] write docs'))
  })
})

// ---- FE-06 fix-cr: release outside the window must not mis-commit -----------
// Contract: `commit: true` appears on pointerup alone — it is the only step
// whose wiring calls dropListMove (document write). Every interrupt path
// (buttons already 0 on a move, pointercancel, window blur) is
// `{ type: 'finish', commit: false }` = cleanup only (ghost / drop indicator /
// hover pin restored, nothing written back to a stale drop target).
describe('listDragSessionStep — 窗外释放中止不误提交', () => {
  it('buttons===0 的 move → 会话清理且不产生 dropListMove/写回调用', () => {
    expect(listDragSessionStep('move', 0)).toEqual({ type: 'finish', commit: false })
  })

  it('拖动中的 move（buttons 按下）→ track，不写回', () => {
    expect(listDragSessionStep('move', 1)).toEqual({ type: 'track', commit: false })
  })

  it('pointerup 是唯一允许写回的收尾（commit: true）', () => {
    expect(listDragSessionStep('up', 0)).toEqual({ type: 'finish', commit: true })
    expect(listDragSessionStep('up', 1)).toEqual({ type: 'finish', commit: true })
  })

  it('pointercancel / 窗失焦中断 → 清理不写回', () => {
    expect(listDragSessionStep('cancel', 0)).toEqual({ type: 'finish', commit: false })
    expect(listDragSessionStep('cancel', 1)).toEqual({ type: 'finish', commit: false })
    expect(listDragSessionStep('blur', 1)).toEqual({ type: 'finish', commit: false })
    expect(listDragSessionStep('blur', 0)).toEqual({ type: 'finish', commit: false })
  })
})
