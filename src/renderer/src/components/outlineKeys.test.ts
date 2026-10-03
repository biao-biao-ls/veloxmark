import { describe, expect, it } from 'vitest'
import {
  resolveKey,
  showsFoldTriangle,
  toOutlineNodes,
  type OutlineKeyState,
  type OutlineNode
} from './outlineKeys'
import type { OutlineItem } from '../outline/extract'

/**
 * Fixture outline (nodes are the keyboard view — flat, all headings listed;
 * subtree hiding is a body-fold concern, not a nav-row concern):
 *
 *   0 H1 项目周报        expanded, hasChildren
 *   1   H2 本周进展      expanded, hasChildren
 *   2     H3 技术风险    leaf
 *   3   H2 下周计划      leaf
 *
 * foldKey ids: '1:项目周报' '2:本周进展' '3:技术风险' '2:下周计划'
 */
const node = (
  id: string,
  level: number,
  text: string,
  expanded = true,
  hasChildren = false,
  foldable = true
): OutlineNode => ({ id, level, text, expanded, hasChildren, foldable })

const NODES: OutlineNode[] = [
  node('1:项目周报', 1, '项目周报', true, true),
  node('2:本周进展', 2, '本周进展', true, true),
  node('3:技术风险', 3, '技术风险'),
  node('2:下周计划', 2, '下周计划')
]

const state = (focusIndex: number, nodes: OutlineNode[] = NODES): OutlineKeyState => ({
  nodes,
  focusIndex
})

describe('resolveKey — 焦点移动（↑/↓，不跳转正文）', () => {
  it('ArrowDown moves focus to the next node', () => {
    expect(resolveKey(state(0), 'ArrowDown')).toEqual({ action: 'move', nextIndex: 1 })
    expect(resolveKey(state(1), 'ArrowDown')).toEqual({ action: 'move', nextIndex: 2 })
  })

  it('ArrowUp moves focus to the previous node', () => {
    expect(resolveKey(state(2), 'ArrowUp')).toEqual({ action: 'move', nextIndex: 1 })
    expect(resolveKey(state(1), 'ArrowUp')).toEqual({ action: 'move', nextIndex: 0 })
  })

  it('ArrowDown on the last node is a no-op (focus stays)', () => {
    expect(resolveKey(state(3), 'ArrowDown')).toEqual({ action: 'none', nextIndex: 3 })
  })

  it('ArrowUp on the first node is a no-op (focus stays)', () => {
    expect(resolveKey(state(0), 'ArrowUp')).toEqual({ action: 'none', nextIndex: 0 })
  })

  it('ArrowDown with no prior focus lands on the first node', () => {
    expect(resolveKey(state(-1), 'ArrowDown')).toEqual({ action: 'move', nextIndex: 0 })
  })

  it('ArrowUp with no prior focus lands on the last node', () => {
    expect(resolveKey(state(-1), 'ArrowUp')).toEqual({ action: 'move', nextIndex: 3 })
  })

  it('movement never emits jump/collapse/expand (focus moves do not touch the body)', () => {
    for (const key of ['ArrowDown', 'ArrowUp']) {
      for (let i = 0; i < NODES.length; i++) {
        expect(resolveKey(state(i), key).action).not.toBe('jump')
        expect(resolveKey(state(i), key).action).not.toBe('collapse')
        expect(resolveKey(state(i), key).action).not.toBe('expand')
      }
    }
  })
})

describe('resolveKey — Enter 激活（→ jump 映射）', () => {
  it('Enter on a focused node maps to jump at that index', () => {
    expect(resolveKey(state(2), 'Enter')).toEqual({ action: 'jump', nextIndex: 2 })
    expect(resolveKey(state(0), 'Enter')).toEqual({ action: 'jump', nextIndex: 0 })
  })

  it('Enter with no prior focus is a no-op', () => {
    expect(resolveKey(state(-1), 'Enter')).toEqual({ action: 'none', nextIndex: -1 })
  })

  it('Enter never collapses or expands', () => {
    expect(resolveKey(state(1), 'Enter').action).toBe('jump')
  })
})

describe('resolveKey — 折叠/展开（←/→，AC-FN-30）', () => {
  it('ArrowLeft on an expanded node with children collapses it (focus stays)', () => {
    expect(resolveKey(state(0), 'ArrowLeft')).toEqual({ action: 'collapse', nextIndex: 0 })
    expect(resolveKey(state(1), 'ArrowLeft')).toEqual({ action: 'collapse', nextIndex: 1 })
  })

  it('ArrowRight on a collapsed node with children expands it (focus stays)', () => {
    const nodes = NODES.map((n, i) => (i === 0 ? { ...n, expanded: false } : n))
    expect(resolveKey(state(0, nodes), 'ArrowRight')).toEqual({ action: 'expand', nextIndex: 0 })
  })

  it('ArrowLeft on an already-collapsed node is a no-op', () => {
    const nodes = NODES.map((n, i) => (i === 0 ? { ...n, expanded: false } : n))
    expect(resolveKey(state(0, nodes), 'ArrowLeft')).toEqual({ action: 'none', nextIndex: 0 })
  })

  it('ArrowRight on an already-expanded node is a no-op', () => {
    expect(resolveKey(state(0), 'ArrowRight')).toEqual({ action: 'none', nextIndex: 0 })
  })

  it('leaf nodes ignore ←/→ entirely (no action, no error)', () => {
    // node 2 (技术风险) and node 3 (下周计划) are leaves
    expect(resolveKey(state(2), 'ArrowLeft')).toEqual({ action: 'none', nextIndex: 2 })
    expect(resolveKey(state(2), 'ArrowRight')).toEqual({ action: 'none', nextIndex: 2 })
    expect(resolveKey(state(3), 'ArrowLeft')).toEqual({ action: 'none', nextIndex: 3 })
    expect(resolveKey(state(3), 'ArrowRight')).toEqual({ action: 'none', nextIndex: 3 })
  })

  it('non-foldable nodes with children ignore ←/→ (no ghost fold writes)', () => {
    // 空章节（有子节但 foldable=false，三角渲染「·」占位）与三角点击同门：
    // ←/→ 均不得发 collapse/expand，避免幽灵 key 入 foldField
    const expandedEmpty = [node('1:a', 1, 'a', true, true, false)]
    expect(resolveKey(state(0, expandedEmpty), 'ArrowLeft')).toEqual({ action: 'none', nextIndex: 0 })
    expect(resolveKey(state(0, expandedEmpty), 'ArrowRight')).toEqual({ action: 'none', nextIndex: 0 })
    // 幽灵 key 场景：foldField 里遗留了该 key（视觉折叠态）但 foldable=false
    const ghostFolded = [node('1:a', 1, 'a', false, true, false)]
    expect(resolveKey(state(0, ghostFolded), 'ArrowLeft')).toEqual({ action: 'none', nextIndex: 0 })
    expect(resolveKey(state(0, ghostFolded), 'ArrowRight')).toEqual({ action: 'none', nextIndex: 0 })
  })

  it('leaf nodes in collapsed form still ignore ←/→', () => {
    const nodes = NODES.map((n, i) => (i === 2 ? { ...n, expanded: false } : n))
    expect(resolveKey(state(2, nodes), 'ArrowLeft')).toEqual({ action: 'none', nextIndex: 2 })
    expect(resolveKey(state(2, nodes), 'ArrowRight')).toEqual({ action: 'none', nextIndex: 2 })
  })

  it('←/→ with no prior focus is a no-op', () => {
    expect(resolveKey(state(-1), 'ArrowLeft')).toEqual({ action: 'none', nextIndex: -1 })
    expect(resolveKey(state(-1), 'ArrowRight')).toEqual({ action: 'none', nextIndex: -1 })
  })

  it('fold actions never move focus and never jump', () => {
    for (const key of ['ArrowLeft', 'ArrowRight']) {
      const r = resolveKey(state(0), key)
      expect(r.action === 'jump' || r.action === 'move').toBe(false)
    }
  })
})

describe('resolveKey — 空树与未知键', () => {
  it('empty outline: every key is a total no-op (no hijack)', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter']) {
      expect(resolveKey(state(-1, []), key)).toEqual({ action: 'none', nextIndex: -1 })
    }
  })

  it('unknown keys pass through untouched', () => {
    expect(resolveKey(state(1), 'a')).toEqual({ action: 'none', nextIndex: 1 })
    expect(resolveKey(state(1), 'Escape')).toEqual({ action: 'none', nextIndex: 1 })
    expect(resolveKey(state(1), 'Tab')).toEqual({ action: 'none', nextIndex: 1 })
    expect(resolveKey(state(1), ' ')).toEqual({ action: 'none', nextIndex: 1 })
  })
})

describe('toOutlineNodes — 焦点模型构建', () => {
  const items: OutlineItem[] = [
    { level: 1, text: '项目周报', pos: 0 },
    { level: 2, text: '本周进展', pos: 10 },
    { level: 3, text: '技术风险', pos: 20 },
    { level: 2, text: '下周计划', pos: 30 }
  ]

  it('derives hasChildren from the next heading level', () => {
    const nodes = toOutlineNodes(items, new Set())
    expect(nodes.map((n) => n.hasChildren)).toEqual([true, true, false, false])
  })

  it('derives expanded from foldedKeys (folded key ⇒ collapsed node)', () => {
    const folded = new Set(['2:本周进展'])
    const nodes = toOutlineNodes(items, folded)
    expect(nodes.map((n) => n.expanded)).toEqual([true, false, true, true])
    expect(nodes[1].id).toBe('2:本周进展')
  })

  it('leaf headings at end of document stay leaves', () => {
    const nodes = toOutlineNodes(items, new Set())
    expect(nodes[3]).toEqual({
      id: '2:下周计划',
      level: 2,
      text: '下周计划',
      expanded: true,
      hasChildren: false,
      foldable: true
    })
  })

  it('empty items yield empty node list', () => {
    expect(toOutlineNodes([], new Set())).toEqual([])
  })

  it('skipped-level headings still count as children (H1 → H3 run)', () => {
    const deep: OutlineItem[] = [
      { level: 1, text: 'a', pos: 0 },
      { level: 3, text: 'b', pos: 5 }
    ]
    const nodes = toOutlineNodes(deep, new Set())
    expect(nodes[0].hasChildren).toBe(true)
    expect(nodes[1].hasChildren).toBe(false)
  })

  it('missing foldableKeys defaults every node to foldable (兼容旧调用)', () => {
    const nodes = toOutlineNodes(items, new Set())
    expect(nodes.map((n) => n.foldable)).toEqual([true, true, true, true])
  })

  it('foldableKeys marks empty sections non-foldable (FE-09#2 空章节=叶行口径)', () => {
    // 空章节 id = '2:下周计划'（无正文、无子节 → collectFoldSections 跳过）
    const foldableKeys = new Set(['1:项目周报', '2:本周进展', '3:技术风险'])
    const nodes = toOutlineNodes(items, new Set(), foldableKeys)
    expect(nodes.map((n) => n.foldable)).toEqual([true, true, true, false])
    expect(nodes[3].id).toBe('2:下周计划')
  })
})

describe('showsFoldTriangle — 三角/「·」占位判据（FE-08#4 + FE-09#2）', () => {
  it('有子节且可折叠 → 三角', () => {
    expect(showsFoldTriangle(node('1:项目周报', 1, '项目周报', true, true, true))).toBe(true)
  })

  it('叶行 → 「·」占位（无三角）', () => {
    expect(showsFoldTriangle(node('2:下周计划', 2, '下周计划', true, false, true))).toBe(false)
  })

  it('空章节（有子节但不可折叠）→ 「·」占位', () => {
    expect(showsFoldTriangle(node('1:项目周报', 1, '项目周报', true, true, false))).toBe(false)
  })

  it('折叠态的有子节行仍显示三角（方向由 foldedKeys 决定，不影响可见性）', () => {
    expect(showsFoldTriangle(node('1:项目周报', 1, '项目周报', false, true, true))).toBe(true)
  })
})
