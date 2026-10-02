/**
 * keyboardNav — 菜单键盘遍历纯模型（Q8 菜单键盘化兜底通道）。
 *
 * 语义与 CtxMenuItem 键盘模型对齐（tech-design 5 领域模型：方向键/Enter/Escape）：
 *   ↑/↓    在可落点项间循环（跳过 separator / groupTitle / disabled）
 *   →/Enter 含子菜单项展开子菜单并移入首项；Enter 在叶项上执行
 *   ←      从子菜单收拢回一级（菜单不关闭，激活态还给父行）
 *   Enter   叶项执行 → 菜单关闭（AC-FN-10 终态）；禁用项 no-op 不报错（UI-ELEM-04）
 *   Escape  一键到底：任意层级直接整体关闭并焦点回正文（glb-hush:one-shot /
 *           AC-FN-10 / AC-RULE-02 无悬空态；分级收拢只走 ←）
 *
 * 纯函数零 DOM 依赖 → keyboardNav.test.ts 全量断言；消费方（MenuBar /
 * EditorContextMenu）只做接线与动作执行。作用域契约：焦点在正文时
 * `focusInMenu=false` → 方向键/Enter 一律 no-op（正文输入不被劫持）。
 */

/** 键盘可遍历项的最小形状 —— MenuBar.MenuItem 与 CtxMenuItem 均结构兼容。 */
export interface NavItemShape {
  /** 文案标签（真实项恒有）——同时避免 TS weak-type 对全可选形状的误伤。 */
  label?: string
  disabled?: boolean
  separator?: boolean
  /** FE-01 语义分组标题行（非交互，键盘跳过）。 */
  groupTitle?: string
  submenu?: readonly NavItemShape[]
}

export type MenuLevel = 'root' | 'menu' | 'submenu'

/** 焦点模型（任务期望数据）：level + activeIndex，items 由 rootItems 按 level 解析。 */
export interface MenuNavState {
  level: MenuLevel
  /** 当前根菜单下标（level==='root' 时即根按钮下标）。 */
  rootIndex: number
  /** 当前层可遍历列表中的激活项下标；无可落点项时为 -1。 */
  activeIndex: number
  /** level==='submenu' 时父行在一级 items 中的下标。 */
  parentIndex?: number
}

export type MenuKeyEffect = 'none' | 'run' | 'close'

export interface MenuNavResult {
  state: MenuNavState
  effect: MenuKeyEffect
}

export interface MenuNavContext {
  /** 键盘事件作用域：焦点在正文/菜单外时 false → 方向键/Enter 一律 no-op。 */
  focusInMenu: boolean
  /** 各根菜单的一级项列表（与 MenuBar 的 menus[].items 同序）。 */
  rootItems: readonly (readonly NavItemShape[])[]
}

/** 键盘可落点：非分隔线、非分组标题、非禁用（UI-ELEM-04 键盘跳过禁用项）。 */
export function isNavLandable(item: NavItemShape | undefined): boolean {
  return item != null && !item.separator && item.groupTitle === undefined && !item.disabled
}

/** 首个可落点下标；无可落点项返回 -1。 */
export function firstNavIndex(items: readonly NavItemShape[]): number {
  for (let i = 0; i < items.length; i++) {
    if (isNavLandable(items[i])) return i
  }
  return -1
}

/**
 * 打开菜单时的初始激活项 —— 统一「静息无预选」口径（FE-04 r2 定性批，两处同改）：
 *   指针打开（右键/⋮ 点击/菜单栏点击）→ -1 无激活项，设计样张静息全白；
 *     高亮只来自真实 hover 或键盘导航（↓/↑ 从 -1 就近落首/末项）。
 *   键盘打开（Shift+F10/Menu，或 MenuBar ↑/↓/Enter/Space）→ 首项默认激活，
 *     与 IT-02/FE-05 菜单键盘通道「首项默认激活」契约一致（勿双标准）。
 */
export function openActiveIndex(
  via: 'pointer' | 'keyboard',
  items: readonly NavItemShape[]
): number {
  return via === 'keyboard' ? firstNavIndex(items) : -1
}

/**
 * ↑/↓ 循环移动：跳过 separator/groupTitle/disabled，绕回（「↑/↓ 循环」）。
 * current 不可落点时朝 dir 就近落到下一个可落点（不跳回首项）；
 * current 越界/-1 时 dir=1 从头找、dir=-1 从尾找；无任何可落点项返回 -1。
 */
export function cycleNavIndex(
  items: readonly NavItemShape[],
  current: number,
  dir: 1 | -1
): number {
  const n = items.length
  if (n === 0) return -1
  // 越界/-1 时虚拟基点：正向置于列表前，反向置于列表后。
  const base = current >= 0 && current < n ? current : dir === 1 ? -1 : n
  for (let step = 1; step <= n; step++) {
    const idx = (((base + dir * step) % n) + n) % n
    if (isNavLandable(items[idx])) return idx
  }
  return -1
}

/** 含子菜单才可展开（空子菜单理论态不展开，保持一级）。 */
export function hasNavSubmenu(item: NavItemShape | undefined): boolean {
  return item != null && item.submenu != null && item.submenu.length > 0
}

/**
 * submenu 键存在（即便空数组）即子菜单父行，不是可 run 的叶项：
 * 空子菜单项 Enter/Space 须 no-op（任务异常表「不展开，保持一级」），
 * 落到叶项语义 effect:'run' 会走 runItem 关菜单——理论态也不允许。
 */
function isSubmenuParent(item: NavItemShape | undefined): boolean {
  return item != null && item.submenu != null
}

/** 当前层的项列表：root → 该根一级项；submenu → 父行的子项。 */
export function levelItems(
  state: MenuNavState,
  rootItems: readonly (readonly NavItemShape[])[]
): readonly NavItemShape[] {
  const root = rootItems[state.rootIndex] ?? []
  if (state.level !== 'submenu') return root
  const parent = root[state.parentIndex ?? -1]
  return parent?.submenu ?? []
}

function toRoot(state: MenuNavState): MenuNavState {
  return { level: 'root', rootIndex: state.rootIndex, activeIndex: state.rootIndex }
}

function move(
  items: readonly NavItemShape[],
  state: MenuNavState,
  dir: 1 | -1
): MenuNavResult {
  return { state: { ...state, activeIndex: cycleNavIndex(items, state.activeIndex, dir) }, effect: 'none' }
}

function openSub(state: MenuNavState, items: readonly NavItemShape[]): MenuNavResult {
  const parentIndex = state.activeIndex
  const children = items[parentIndex]?.submenu ?? []
  if (children.length === 0) return { state, effect: 'none' } // 空子菜单不展开
  return {
    state: {
      level: 'submenu',
      rootIndex: state.rootIndex,
      activeIndex: firstNavIndex(children),
      parentIndex
    },
    effect: 'none'
  }
}

function switchRoot(
  state: MenuNavState,
  ctx: MenuNavContext,
  step: 1 | -1
): MenuNavResult {
  const n = ctx.rootItems.length
  if (n === 0) return { state, effect: 'none' }
  const rootIndex = (((state.rootIndex + step) % n) + n) % n
  return {
    state: {
      level: 'menu',
      rootIndex,
      activeIndex: firstNavIndex(ctx.rootItems[rootIndex] ?? [])
    },
    effect: 'none'
  }
}

/**
 * 键盘事件 → 焦点状态迁移 + 终态效果。
 * 不消费的键（Tab 等）返回原状态 + 'none'，调用方不得 preventDefault。
 */
export function applyMenuKey(
  state: MenuNavState,
  key: string,
  ctx: MenuNavContext
): MenuNavResult {
  // Escape 在作用域内外均生效（AC-FN-10 / glb-hush:one-shot）：任意层级一键
  // 到底直接整体关闭（焦点回正文由调用方 closeAll 落实）；分级收拢只走 ←。
  if (key === 'Escape') {
    return { state: toRoot(state), effect: 'close' }
  }

  // 正文输入不被劫持：方向键/Enter/Space 仅菜单聚焦时生效。
  if (!ctx.focusInMenu) return { state, effect: 'none' }

  const items = levelItems(state, ctx.rootItems)
  const item = items[state.activeIndex]

  if (state.level === 'root') {
    // 菜单栏聚焦后：←/→ 切换根菜单并打开一级（「←/→ 开合根菜单」）；
    // ↑/↓/Enter/Space 打开当前根菜单，首项默认激活。
    if (key === 'ArrowRight') return switchRoot(state, ctx, 1)
    if (key === 'ArrowLeft') return switchRoot(state, ctx, -1)
    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
      return {
        state: { level: 'menu', rootIndex: state.rootIndex, activeIndex: firstNavIndex(items) },
        effect: 'none'
      }
    }
    return { state, effect: 'none' }
  }

  if (state.level === 'menu') {
    switch (key) {
      case 'ArrowDown':
        return move(items, state, 1)
      case 'ArrowUp':
        return move(items, state, -1)
      case 'ArrowRight':
        // 含子菜单项 → 展开并移入首项；否则切换根菜单并保持一级展开。
        return hasNavSubmenu(item) ? openSub(state, items) : switchRoot(state, ctx, 1)
      case 'ArrowLeft':
        return switchRoot(state, ctx, -1)
      case 'Enter':
      case ' ':
        if (hasNavSubmenu(item)) return openSub(state, items)
        // 空子菜单项：不可展开也不可 run（保持一级）。
        if (isSubmenuParent(item)) return { state, effect: 'none' }
        return isNavLandable(item) ? { state, effect: 'run' } : { state, effect: 'none' }
      default:
        return { state, effect: 'none' }
    }
  }

  // level === 'submenu'
  switch (key) {
    case 'ArrowDown':
      return move(items, state, 1)
    case 'ArrowUp':
      return move(items, state, -1)
    case 'ArrowLeft':
      // ← 从子菜单收拢回一级（菜单不关闭），激活态还给父行。
      return {
        state: { level: 'menu', rootIndex: state.rootIndex, activeIndex: state.parentIndex ?? 0 },
        effect: 'none'
      }
    case 'ArrowRight':
      return { state, effect: 'none' } // 两级菜单无更深层
    case 'Enter':
    case ' ':
      // 含 submenu 键即父行：深层子菜单不展开、空子菜单同样 no-op，均不 run。
      if (isSubmenuParent(item)) return { state, effect: 'none' }
      return isNavLandable(item) ? { state, effect: 'run' } : { state, effect: 'none' }
    default:
      return { state, effect: 'none' }
  }
}
