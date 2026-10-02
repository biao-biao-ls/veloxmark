/**
 * useHushLayer core — glb-hush:one-shot / glb-modal:stacking contract tests
 * (IT-01 FE-09).
 *
 * Covers the layered-consumption state machine only (pure logic, node env):
 *  - modal topmost: Esc/blank consumes ONLY the confirm layer (PEND-04)
 *  - one-shot: without a modal a single consume collapses ALL chrome layers
 *    (menu/popover/toolbar/chip) — never one-by-one (AC-FN-21)
 *  - math/code 双区编辑（blockEdit）也算 chrome 收拢面，close=退出编辑态
 *  - empty stack: zero side effects, body Esc must stay free (AC-FN-21 空态)
 *  - toast is never a collapse target (AC-FN-21 期望效果)
 *  - consumption order = topmost first (reverse registration)
 */
import { describe, expect, it } from 'vitest'
import { createHushLayerStore, type HushLayer } from './useHushLayer'
import { createToastStore } from './useToast'

interface DepsSeen {
  focusBody: number
  collapseChrome: number
  blockEditClose: number
}

function makeDeps(opts?: {
  modalOpen?: boolean
  chromeVisible?: () => boolean
  /** 默认无双区编辑态（旧行为面）；`true` = 常驻 math/code 编辑态。 */
  blockEditActive?: boolean
}) {
  const seen: DepsSeen = { focusBody: 0, collapseChrome: 0, blockEditClose: 0 }
  const store = createHushLayerStore({
    isModalOpen: () => opts?.modalOpen ?? false,
    hasChrome: opts?.chromeVisible ?? (() => false),
    collapseChrome: () => {
      seen.collapseChrome++
    },
    focusBody: () => {
      seen.focusBody++
    },
    blockEdit: () =>
      opts?.blockEditActive
        ? {
            close: () => {
              seen.blockEditClose++
            }
          }
        : null
  })
  return { store, seen }
}

function spyLayer(id: string, tier: HushLayer['tier'], closed: string[]): HushLayer {
  return {
    id,
    tier,
    close: () => {
      closed.push(id)
    }
  }
}

describe('hush layer store (glb-hush:*)', () => {
  it('modal topmost: first consume closes only the confirm layer, menu stays open', () => {
    const closed: string[] = []
    const { store, seen } = makeDeps()
    store.register(spyLayer('dialog-confirm', 'modal', closed))
    store.register(spyLayer('ctx-menu', 'menu', closed))

    expect(store.consumeTop()).toBe('modal')
    expect(closed).toEqual(['dialog-confirm'])
    expect(store.layerIds()).toEqual(['ctx-menu'])
    // One-shot has NOT run yet — body focus untouched until full collapse.
    expect(seen.focusBody).toBe(0)
  })

  it('second consume (modal gone) one-shot collapses the menu and focuses body', () => {
    const closed: string[] = []
    const { store, seen } = makeDeps()
    store.register(spyLayer('dialog-confirm', 'modal', closed))
    store.register(spyLayer('ctx-menu', 'menu', closed))
    store.consumeTop()

    expect(store.consumeTop()).toBe('collapse')
    expect(closed).toEqual(['dialog-confirm', 'ctx-menu'])
    expect(store.layerIds()).toEqual([])
    expect(seen.focusBody).toBe(1)
  })

  it('without a modal one consume collapses ALL layers together (non-graded)', () => {
    const closed: string[] = []
    const { store, seen } = makeDeps()
    store.register(spyLayer('ctx-menu', 'menu', closed))
    store.register(spyLayer('grid-picker', 'menu', closed))
    store.register(spyLayer('table-toolbar', 'chrome', closed))

    expect(store.consumeTop()).toBe('collapse')
    // One trigger, every layer gone — not one-by-one (AC-FN-21 branch 1).
    expect(closed).toEqual(['table-toolbar', 'grid-picker', 'ctx-menu'])
    expect(store.layerIds()).toEqual([])
    expect(seen.focusBody).toBe(1)
  })

  it('modal present: chrome and menu layers survive the first consume (PEND-04)', () => {
    const closed: string[] = []
    const { store } = makeDeps()
    store.register(spyLayer('ctx-menu', 'menu', closed))
    store.register(spyLayer('table-toolbar', 'chrome', closed))
    store.register(spyLayer('dialog-confirm', 'modal', closed))

    expect(store.consumeTop()).toBe('modal')
    expect(closed).toEqual(['dialog-confirm'])
    expect(store.layerIds()).toEqual(['ctx-menu', 'table-toolbar'])
  })

  it('empty stack: consume is a pure no-op (body Esc stays free)', () => {
    const closed: string[] = []
    const { store, seen } = makeDeps()

    expect(store.consumeTop()).toBe('none')
    expect(closed).toEqual([])
    expect(seen.focusBody).toBe(0)
    expect(seen.collapseChrome).toBe(0)
  })

  it('modal skip-guard: isModalOpen() alone yields without collapsing layers', () => {
    // FE-08 hook point — the dialog self-handles Esc/overlay; hush must yield
    // even when the confirm layer itself forgot to register.
    const closed: string[] = []
    const { store, seen } = makeDeps({ modalOpen: true })
    store.register(spyLayer('ctx-menu', 'menu', closed))

    expect(store.consumeTop()).toBe('modal')
    expect(closed).toEqual([])
    expect(store.layerIds()).toEqual(['ctx-menu'])
    expect(seen.focusBody).toBe(0)
  })

  it('collapseAll closes layers topmost-first and never touches the toast face', () => {
    const closed: string[] = []
    // 外部 toast 面：真实 toast store（非注册层、非 deps 面）——收拢不可达它。
    const toast = createToastStore()
    toast.show('saved')
    // 收拢路径的全部外部触达 = 注册层 close() + 注入 deps —— 用调用集精确枚举，
    // 证明 collapse 从未触碰 toast 面（toast 不在 deps/注册表任一侧）。
    const depCalls: string[] = []
    const store = createHushLayerStore({
      isModalOpen: () => false,
      hasChrome: () => false,
      collapseChrome: () => depCalls.push('collapseChrome'),
      focusBody: () => depCalls.push('focusBody')
    })
    store.register(spyLayer('menubar', 'menu', closed))
    store.register(spyLayer('table-toolbar', 'chrome', closed))

    // 永不注册真实面：栈内从无 toast 类 id。
    expect(store.layerIds().some((id) => /toast/i.test(id))).toBe(false)

    store.collapseAll()

    // 永不收拢真实面：close() 精确等于注册集合（topmost-first），栈清空。
    expect(closed).toEqual(['table-toolbar', 'menubar'])
    expect(store.layerIds()).toEqual([])
    // deps 外沿精确等于 {focusBody, collapseChrome}——收拢触达面无 toast。
    expect(depCalls).toEqual(['focusBody', 'collapseChrome'])
    expect(toast.getMessage()).toBe('saved')
    toast.dispose()
  })

  it('menu + hover chrome collapse together in one consume', () => {
    const closed: string[] = []
    const { store, seen } = makeDeps({ chromeVisible: () => true })
    store.register(spyLayer('ctx-menu', 'menu', closed))

    // Menu + hover chrome both collapse in one shot…
    expect(store.consumeTop()).toBe('collapse')
    expect(closed).toEqual(['ctx-menu'])
    expect(seen.collapseChrome).toBe(1)
    expect(seen.focusBody).toBe(1)
  })

  it('math/code 双区编辑（blockEdit）: one consume exits the edit session and focuses body', () => {
    const { store, seen } = makeDeps({ blockEditActive: true })

    expect(store.consumeTop()).toBe('collapse')
    expect(seen.blockEditClose).toBe(1) // close=exitMathEdit/exitCodeEdit 语义面
    expect(seen.focusBody).toBe(1) // AC-FN-29 全收拢后焦点回正文
    expect(seen.collapseChrome).toBe(1)
  })

  it('blockEdit + menu layers collapse together in one consume (non-graded)', () => {
    const closed: string[] = []
    const { store, seen } = makeDeps({ blockEditActive: true })
    store.register(spyLayer('menubar-menu', 'menu', closed))
    store.register(spyLayer('grid-picker', 'menu', closed))

    expect(store.consumeTop()).toBe('collapse')
    expect(closed).toEqual(['grid-picker', 'menubar-menu'])
    expect(seen.blockEditClose).toBe(1) // 双区层同拍收拢，非逐个（AC-FN-21）
    expect(seen.focusBody).toBe(1)
  })

  it('modal present: blockEdit survives the first consume (PEND-04)', () => {
    const closed: string[] = []
    const { store, seen } = makeDeps({ modalOpen: true, blockEditActive: true })
    store.register(spyLayer('dialog-confirm', 'modal', closed))

    expect(store.consumeTop()).toBe('modal')
    expect(closed).toEqual(['dialog-confirm'])
    expect(seen.blockEditClose).toBe(0) // 确认框最上层——双区编辑态保持
    expect(seen.focusBody).toBe(0)
  })

  it('hover-only (no layers): consume collapses floats without stealing focus', () => {
    const closed: string[] = []
    const { store, seen } = makeDeps({ chromeVisible: () => true })

    expect(store.consumeTop()).toBe('collapse')
    expect(closed).toEqual([])
    expect(seen.collapseChrome).toBe(1)
    // Typing context must not be yanked to <body> just because a hover float hid.
    expect(seen.focusBody).toBe(0)
  })

  it('dead layers (isAlive false) self-prune so empty-stack Esc stays free', () => {
    const closed: string[] = []
    const { store, seen } = makeDeps()
    let alive = true
    store.register({
      id: 'table-toolbar',
      tier: 'chrome',
      close: () => {
        closed.push('table-toolbar')
      },
      isAlive: () => alive
    })
    alive = false // widget DOM torn down outside of hush

    expect(store.consumeTop()).toBe('none')
    expect(closed).toEqual([])
    expect(store.layerIds()).toEqual([])
    expect(seen.focusBody).toBe(0)
  })

  it('isLayerTarget honours per-layer owns() hit tests (blank-click boundary)', () => {
    const closed: string[] = []
    const { store } = makeDeps()
    const menuEl = { id: 'menu-root' }
    store.register({
      id: 'ctx-menu',
      tier: 'menu',
      close: () => {
        closed.push('ctx-menu')
      },
      owns: (t) => t === menuEl
    })

    expect(store.isLayerTarget(menuEl)).toBe(true)
    expect(store.isLayerTarget({ id: 'body-paragraph' })).toBe(false)
  })

  it('re-registering an id replaces the previous layer (idempotent mounts)', () => {
    const closed: string[] = []
    const { store } = makeDeps()
    store.register(spyLayer('table-toolbar', 'chrome', closed))
    store.register(spyLayer('table-toolbar', 'chrome', closed))

    expect(store.layerIds()).toEqual(['table-toolbar'])
    store.collapseAll()
    expect(closed).toEqual(['table-toolbar'])
  })

  it('unregister drops the layer so later consumes see the true stack', () => {
    const closed: string[] = []
    const { store } = makeDeps()
    const off = store.register(spyLayer('grid-picker', 'menu', closed))
    off()

    expect(store.layerIds()).toEqual([])
    expect(store.consumeTop()).toBe('none')
  })
})
