
export interface NavItemShape {
  label?: string
  disabled?: boolean
  separator?: boolean
  groupTitle?: string
  submenu?: readonly NavItemShape[]
}

export type MenuLevel = 'root' | 'menu' | 'submenu'

export interface MenuNavState {
  level: MenuLevel
  rootIndex: number
  activeIndex: number
  parentIndex?: number
}

export type MenuKeyEffect = 'none' | 'run' | 'close'

export interface MenuNavResult {
  state: MenuNavState
  effect: MenuKeyEffect
}

export interface MenuNavContext {
  focusInMenu: boolean
  rootItems: readonly (readonly NavItemShape[])[]
}

export function isNavLandable(item: NavItemShape | undefined): boolean {
  return item != null && !item.separator && item.groupTitle === undefined && !item.disabled
}

export function firstNavIndex(items: readonly NavItemShape[]): number {
  for (let i = 0; i < items.length; i++) {
    if (isNavLandable(items[i])) return i
  }
  return -1
}

export function openActiveIndex(
  via: 'pointer' | 'keyboard',
  items: readonly NavItemShape[]
): number {
  return via === 'keyboard' ? firstNavIndex(items) : -1
}

export function cycleNavIndex(
  items: readonly NavItemShape[],
  current: number,
  dir: 1 | -1
): number {
  const n = items.length
  if (n === 0) return -1
  const base = current >= 0 && current < n ? current : dir === 1 ? -1 : n
  for (let step = 1; step <= n; step++) {
    const idx = (((base + dir * step) % n) + n) % n
    if (isNavLandable(items[idx])) return idx
  }
  return -1
}

export function hasNavSubmenu(item: NavItemShape | undefined): boolean {
  return item != null && item.submenu != null && item.submenu.length > 0
}

function isSubmenuParent(item: NavItemShape | undefined): boolean {
  return item != null && item.submenu != null
}

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
  if (children.length === 0) return { state, effect: 'none' }
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

export function applyMenuKey(
  state: MenuNavState,
  key: string,
  ctx: MenuNavContext
): MenuNavResult {
  if (key === 'Escape') {
    return { state: toRoot(state), effect: 'close' }
  }

  if (!ctx.focusInMenu) return { state, effect: 'none' }

  const items = levelItems(state, ctx.rootItems)
  const item = items[state.activeIndex]

  if (state.level === 'root') {
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
        return hasNavSubmenu(item) ? openSub(state, items) : switchRoot(state, ctx, 1)
      case 'ArrowLeft':
        return switchRoot(state, ctx, -1)
      case 'Enter':
      case ' ':
        if (hasNavSubmenu(item)) return openSub(state, items)
        if (isSubmenuParent(item)) return { state, effect: 'none' }
        return isNavLandable(item) ? { state, effect: 'run' } : { state, effect: 'none' }
      default:
        return { state, effect: 'none' }
    }
  }

  switch (key) {
    case 'ArrowDown':
      return move(items, state, 1)
    case 'ArrowUp':
      return move(items, state, -1)
    case 'ArrowLeft':
      return {
        state: { level: 'menu', rootIndex: state.rootIndex, activeIndex: state.parentIndex ?? 0 },
        effect: 'none'
      }
    case 'ArrowRight':
      return { state, effect: 'none' }
    case 'Enter':
    case ' ':
      if (isSubmenuParent(item)) return { state, effect: 'none' }
      return isNavLandable(item) ? { state, effect: 'run' } : { state, effect: 'none' }
    default:
      return { state, effect: 'none' }
  }
}
