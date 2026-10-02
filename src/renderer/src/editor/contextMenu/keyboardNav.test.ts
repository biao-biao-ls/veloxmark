/**
 * keyboardNav — 菜单键盘遍历纯模型断言（FE-05 焦点模型）。
 *
 * 覆盖任务阶段 1 单测判据：↑/↓ 循环、禁用跳过、子菜单进出、
 * 键盘事件作用域（正文焦点不触发）、Enter 执行/禁用 no-op、
 * Esc/← 收拢与关闭语义（AC-RULE-02 / AC-FN-10 / UI-ELEM-04）。
 */
import { describe, expect, it } from 'vitest'
import type { MenuItem } from '../../components/MenuBar'
import {
  applyMenuKey,
  cycleNavIndex,
  firstNavIndex,
  hasNavSubmenu,
  isNavLandable,
  levelItems,
  openActiveIndex,
  type MenuNavState,
  type NavItemShape
} from './keyboardNav'
import type { CtxMenuItem } from './types'

// 场景菜单：分组标题 + 分隔线 + 禁用项 + 子菜单父行 + 普通叶项（对齐 FE-05 页面元素表）。
const items: NavItemShape[] = [
  { groupTitle: '历史' }, // 0 非交互
  { label: 'undo' }, // 1
  { label: 'redo', disabled: true }, // 2 禁用
  { separator: true }, // 3
  { label: 'recent', submenu: [{ label: 'a.md' }, { label: 'b.md', disabled: true }, { label: 'c.md' }] }, // 4
  { label: 'save' }, // 5
  { label: 'emptySub', submenu: [] } // 6 空子菜单
]
const ctx = { focusInMenu: true, rootItems: [items, [{ label: 'other' }]] }

const at = (partial: Partial<MenuNavState>): MenuNavState => ({
  level: 'menu',
  rootIndex: 0,
  activeIndex: -1,
  ...partial
})

describe('isNavLandable / firstNavIndex', () => {
  it('separator/groupTitle/disabled 均不可落点', () => {
    expect(isNavLandable(items[0])).toBe(false)
    expect(isNavLandable(items[1])).toBe(true)
    expect(isNavLandable(items[2])).toBe(false)
    expect(isNavLandable(items[3])).toBe(false)
  })
  it('firstNavIndex 跳过非可落点项', () => {
    expect(firstNavIndex(items)).toBe(1)
    expect(firstNavIndex([])).toBe(-1)
    expect(firstNavIndex([{ disabled: true }])).toBe(-1)
  })
})

describe('openActiveIndex（打开即预选统一口径：静息无预选）', () => {
  it('指针打开（右键/⋮/菜单栏点击）→ 无激活项（静息全白）', () => {
    expect(openActiveIndex('pointer', items)).toBe(-1)
    expect(openActiveIndex('pointer', [])).toBe(-1)
  })
  it('键盘打开（Shift+F10/Menu、MenuBar ↑/↓/Enter）→ 首项默认激活', () => {
    expect(openActiveIndex('keyboard', items)).toBe(1) // 首个可落点
    expect(openActiveIndex('keyboard', [])).toBe(-1)
    expect(openActiveIndex('keyboard', [{ disabled: true }, { label: 'ok' }])).toBe(1)
    expect(openActiveIndex('keyboard', [{ disabled: true }])).toBe(-1)
  })
})

describe('cycleNavIndex（↑/↓ 循环 + 禁用跳过）', () => {
  it('↓ 循环跳过禁用/分隔线/分组标题并绕回', () => {
    expect(cycleNavIndex(items, 1, 1)).toBe(4) // undo → recent（跳过 redo/sep）
    expect(cycleNavIndex(items, 4, 1)).toBe(5)
    expect(cycleNavIndex(items, 5, 1)).toBe(6)
    expect(cycleNavIndex(items, 6, 1)).toBe(1) // 绕回首个可落点
  })
  it('↑ 循环反向同样跳过', () => {
    expect(cycleNavIndex(items, 1, -1)).toBe(6)
    expect(cycleNavIndex(items, 4, -1)).toBe(1)
    expect(cycleNavIndex(items, 5, -1)).toBe(4)
  })
  it('current 不可落点时朝 dir 就近落到下一个可落点', () => {
    expect(cycleNavIndex(items, 2, 1)).toBe(4) // redo(disabled) → 往下到 recent
    expect(cycleNavIndex(items, 2, -1)).toBe(1) // redo(disabled) → 往上到 undo
    expect(cycleNavIndex(items, -1, 1)).toBe(1) // 越界正向 → 首个可落点
    expect(cycleNavIndex(items, -1, -1)).toBe(6) // 越界反向 → 末个可落点
    expect(cycleNavIndex([], 0, 1)).toBe(-1)
  })
  it('连续 ↑/↓ 不越界且跟手（单调序列稳定）', () => {
    let i = firstNavIndex(items)
    const seq: number[] = []
    for (let k = 0; k < items.length; k++) {
      i = cycleNavIndex(items, i, 1)
      seq.push(i)
    }
    expect(seq).toEqual([4, 5, 6, 1, 4, 5, 6]) // 无越界/无 NaN/循环闭合
    seq.length = 0
    for (let k = 0; k < 3; k++) {
      i = cycleNavIndex(items, i, -1)
      seq.push(i)
    }
    expect(seq).toEqual([5, 4, 1]) // 6→5→4→1（跳过 sep/groupTitle，反向循环闭合）
  })
})

describe('hasNavSubmenu（空子菜单不展开）', () => {
  it('非空子菜单可展开，空数组/缺失不可展开', () => {
    expect(hasNavSubmenu(items[4])).toBe(true)
    expect(hasNavSubmenu(items[6])).toBe(false)
    expect(hasNavSubmenu(items[1])).toBe(false)
    expect(hasNavSubmenu(undefined)).toBe(false)
  })
})

describe('applyMenuKey — 根/一级开合（menu:state-machine 键盘侧）', () => {
  it('根层 ↑/↓/Enter 开合当前根菜单，首项默认激活', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', ' ']) {
      const r = applyMenuKey(at({ level: 'root', rootIndex: 0, activeIndex: 0 }), key, ctx)
      expect(r.state).toEqual(at({ level: 'menu', activeIndex: 1 }))
      expect(r.effect).toBe('none')
    }
  })
  it('根层 ←/→ 切换根菜单并打开一级（开合语义）', () => {
    const right = applyMenuKey(at({ level: 'root', rootIndex: 0, activeIndex: 0 }), 'ArrowRight', ctx)
    expect(right.state).toEqual(at({ level: 'menu', rootIndex: 1, activeIndex: 0 }))
    const left = applyMenuKey(at({ level: 'root', rootIndex: 0, activeIndex: 0 }), 'ArrowLeft', ctx)
    expect(left.state).toEqual(at({ level: 'menu', rootIndex: 1, activeIndex: 0 })) // 两根菜单绕回
  })
  it('一级 ↑/↓ 在可见项间移动激活态', () => {
    const down = applyMenuKey(at({ activeIndex: 1 }), 'ArrowDown', ctx)
    expect(down.state.activeIndex).toBe(4)
    const up = applyMenuKey(at({ activeIndex: 1 }), 'ArrowUp', ctx)
    expect(up.state.activeIndex).toBe(6)
  })
  it('→/Enter 在子菜单父行展开子菜单并移入首个可落点子项', () => {
    for (const key of ['ArrowRight', 'Enter', ' ']) {
      const r = applyMenuKey(at({ activeIndex: 4 }), key, ctx)
      expect(r.state.level).toBe('submenu')
      expect(r.state.parentIndex).toBe(4)
      expect(r.state.activeIndex).toBe(0) // 跳过 b.md(disabled)
      expect(r.effect).toBe('none')
    }
  })
  it('空子菜单项 →/Enter/Space 不展开、不执行，保持一级（effect/rootIndex 钉住）', () => {
    // 异常表口径「不展开，保持一级」：Enter/Space 不得落到叶项语义 run
    // （run 会走 runItem 关菜单）——状态整只不动（含 rootIndex/activeIndex）、
    // effect 必须 no-op。
    for (const key of ['Enter', ' ']) {
      const r = applyMenuKey(at({ activeIndex: 6 }), key, ctx)
      expect(r.state).toEqual(at({ activeIndex: 6 }))
      expect(r.effect).toBe('none')
    }
    // →：空子菜单不可展开（不进子层），走非展开项同款切根——保持一级开合。
    const right = applyMenuKey(at({ activeIndex: 6 }), 'ArrowRight', ctx)
    expect(right.state.level).toBe('menu')
    expect(right.state.rootIndex).toBe(1)
    expect(right.effect).toBe('none')
  })
  it('→ 在叶项切换根菜单并保持一级展开（AC-RULE-02 不关菜单）', () => {
    const r = applyMenuKey(at({ activeIndex: 5 }), 'ArrowRight', ctx)
    expect(r.state).toEqual(at({ level: 'menu', rootIndex: 1, activeIndex: 0 }))
    const l = applyMenuKey(at({ activeIndex: 5 }), 'ArrowLeft', ctx)
    expect(l.state.rootIndex).toBe(1)
  })
})

describe('applyMenuKey — 子菜单进出（AC-RULE-02）', () => {
  it('← 从子菜单收拢回一级，菜单不关闭，激活态还给父行', () => {
    const r = applyMenuKey(at({ level: 'submenu', activeIndex: 0, parentIndex: 4 }), 'ArrowLeft', ctx)
    expect(r.state).toEqual(at({ level: 'menu', activeIndex: 4 }))
    expect(r.effect).toBe('none')
  })
  it('Esc 一键到底（glb-hush:one-shot）：任意层级直接 close，分级收拢只走 ←', () => {
    const sub = applyMenuKey(at({ level: 'submenu', activeIndex: 2, parentIndex: 4 }), 'Escape', ctx)
    expect(sub.effect).toBe('close')
    expect(sub.state.level).toBe('root')
    const top = applyMenuKey(at({ activeIndex: 4 }), 'Escape', ctx)
    expect(top.effect).toBe('close')
    expect(top.state.level).toBe('root')
  })
  it('子菜单内 ↑/↓ 循环且跳过禁用项', () => {
    const st = at({ level: 'submenu', activeIndex: 0, parentIndex: 4 })
    const down1 = applyMenuKey(st, 'ArrowDown', ctx)
    expect(down1.state.activeIndex).toBe(2) // 跳过 b.md(disabled)
    const down2 = applyMenuKey(down1.state, 'ArrowDown', ctx)
    expect(down2.state.activeIndex).toBe(0) // 绕回
    const up = applyMenuKey(st, 'ArrowUp', ctx)
    expect(up.state.activeIndex).toBe(2)
  })
})

describe('applyMenuKey — Enter 执行与禁用语义（UI-ELEM-04 / AC-RULE-09 同源）', () => {
  it('叶项 Enter/Space → effect=run（调用方走命令注册表同一 action）', () => {
    for (const key of ['Enter', ' ']) {
      expect(applyMenuKey(at({ activeIndex: 5 }), key, ctx).effect).toBe('run')
    }
    const sub = applyMenuKey(at({ level: 'submenu', activeIndex: 2, parentIndex: 4 }), 'Enter', ctx)
    expect(sub.effect).toBe('run')
    expect(sub.state.activeIndex).toBe(2)
  })
  it('禁用项 Enter 不执行不报错', () => {
    const r = applyMenuKey(at({ activeIndex: 2 }), 'Enter', ctx) // redo disabled
    expect(r.effect).toBe('none')
    const sub = applyMenuKey(at({ level: 'submenu', activeIndex: 1, parentIndex: 4 }), 'Enter', ctx)
    expect(sub.effect).toBe('none')
  })
  it('子层空子菜单父行 Enter/Space 同样 no-op（不 run 不关菜单）', () => {
    // 场景：子层某项带 submenu: []——不是叶项，run 语义禁止（与一级同口径）。
    const subCtx = {
      focusInMenu: true,
      rootItems: [[{ label: 'parent', submenu: [{ label: 'emptySub', submenu: [] }] }]]
    }
    const st: MenuNavState = { level: 'submenu', rootIndex: 0, activeIndex: 0, parentIndex: 0 }
    for (const key of ['Enter', ' ']) {
      const r = applyMenuKey(st, key, subCtx)
      expect(r.effect).toBe('none')
      expect(r.state).toEqual(st)
    }
  })
})

describe('applyMenuKey — 键盘事件作用域（正文焦点不被劫持）', () => {
  it('focusInMenu=false 时方向键/Enter/Space 全部 no-op', () => {
    const bodyCtx = { ...ctx, focusInMenu: false }
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ']) {
      const st = at({ activeIndex: 4 })
      const r = applyMenuKey(st, key, bodyCtx)
      expect(r.state).toBe(st) // 原状态不动
      expect(r.effect).toBe('none')
    }
  })
  it('focusInMenu=false 时 Esc 仍走关闭路径（AC-FN-10）', () => {
    const r = applyMenuKey(at({ activeIndex: 4 }), 'Escape', { ...ctx, focusInMenu: false })
    expect(r.effect).toBe('close')
  })
  it('未消费键（Tab）返回原状态且 effect=none（调用方不 preventDefault）', () => {
    const st = at({ activeIndex: 1 })
    const r = applyMenuKey(st, 'Tab', ctx)
    expect(r.state).toBe(st)
    expect(r.effect).toBe('none')
  })
})

describe('levelItems', () => {
  it('root/menu 解析一级项，submenu 解析父行子项', () => {
    expect(levelItems(at({ activeIndex: 1 }), ctx.rootItems)).toBe(items)
    expect(levelItems(at({ level: 'root', activeIndex: 0 }), ctx.rootItems)).toBe(items)
    const sub = levelItems(at({ level: 'submenu', activeIndex: 0, parentIndex: 4 }), ctx.rootItems)
    expect(sub).toHaveLength(3)
  })
})

describe('键盘模型与两类菜单项形状对齐（Q8 CtxMenuItem 对齐契约）', () => {
  it('CtxMenuItem / MenuBar.MenuItem 均结构兼容 NavItemShape', () => {
    // 编译期断言（strict 下不可赋值即报错）+ 运行期占位，钉死对齐契约。
    const ctxShape: NavItemShape = null as unknown as CtxMenuItem
    const mbShape: NavItemShape = null as unknown as MenuItem
    expect(ctxShape).toBe(null)
    expect(mbShape).toBe(null)
  })
})
