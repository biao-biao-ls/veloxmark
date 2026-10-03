/**
 * useHushLayer — glb-hush:one-shot / glb-modal:stacking / glb-hush:boundary
 * (IT-01 FE-09).
 *
 * Singleton module-level bus (Dialog / ctxMenu / useToast pattern): floats
 * register into a layered stack on open and unregister on close; Esc and
 * body-blank clicks route through ONE consumer with the ruled priority:
 *
 *   确认框（modal, topmost）→ Esc/空白只关它（PEND-04，零副作用）
 *   菜单 / popover（⋮/右键/⊞/MenuBar）
 *   表格工具栏 / 双区编辑 / chip（chrome）
 *   → 无浮层时焦点回正文（静息零 chrome）
 *
 * Consumption ruling (task 裁决): with a modal present only the topmost
 * confirm closes; without one a SINGLE trigger collapses ALL remaining
 * chrome (never one-by-one). Toast is never a collapse target. Empty stack
 * = zero side effects — body Esc keeps flowing to existing handlers.
 *
 * boundary (glb-hush:boundary): clicks inside the table widget region are
 * owned by the table click router (graded step-back lives there) — hush must
 * not treat them as body-blank. Hover floats collapse via the shared
 * hoverDiscipline base (hideAllNow), not via registered layers.
 *
 * FE-09 P1 (math/code 双区): the focused source panel (blockTouched) is a
 * collapse target too — probed via `deps.blockEdit` (selection-in-block,
 * close=exitMathEdit/exitCodeEdit) rather than DOM registration, because the
 * panel is pure decoration with no mount seam outside the chip widgets. An
 * in-editor Esc that the CM keymap already consumed (mathEditExitBindings /
 * table lifecycle — `event.defaultPrevented`) is NEVER re-consumed here
 * (语义保护: no steal / no double-trigger).
 */
import { useEffect } from 'react'
import { EditorView } from '@codemirror/view'
import { focusEditorBody } from '../editor/contextMenu/popup'
import { exitCodeEdit, isCodeEditActive } from '../editor/codeEdit'
import { exitMathEdit, isMathEditActive } from '../editor/mathEdit'
import { chromeState } from '../editor/table/chromeState'
import { hoverDiscipline } from './useHoverDiscipline'

/** Layer tiers, topmost first — modal always outranks menu/chrome. */
export type HushTier = 'modal' | 'menu' | 'chrome'

export interface HushLayer {
  id: string
  tier: HushTier
  /** Close this float (idempotent). Called at most once per registration. */
  close(): void
  /** Hit-test: true when the event target belongs to this float (not body). */
  owns?(target: unknown): boolean
  /** Optional liveness probe — false prunes the layer (widget DOM teardown). */
  isAlive?(): boolean
}

/** math/code 双区编辑态的收拢把手（FE-09 P1）——close 退出编辑会话。 */
export interface BlockEditHandle {
  close(): void
}

export interface HushDeps {
  /** FE-08 skip-guard hook point — modal presence yields the whole stack. */
  isModalOpen(): boolean
  /** External chrome visible (hover floats) — collapses without registration. */
  hasChrome?(): boolean
  collapseChrome?(): void
  /**
   * FE-09 P1: math/code 双区编辑态（聚焦源码面板 + chip）。非 null 即算一层
   * chrome 收拢面（无注册浮层也触发收拢）；close=exitMathEdit/exitCodeEdit。
   */
  blockEdit?(): BlockEditHandle | null
  /** Focus return after a full collapse that actually closed layers/edit state. */
  focusBody(): void
}

export type HushConsume = 'modal' | 'collapse' | 'none'

export interface HushLayerStore {
  /** Register (same id replaces) — returns the unregister function. */
  register(layer: HushLayer): () => void
  /** Esc / body-blank entry: modal → topmost modal only; else one-shot all. */
  consumeTop(): HushConsume
  /** One-shot collapse of every non-modal layer + external chrome. */
  collapseAll(): void
  /** Live layer ids, registration order (diagnostics / tests). */
  layerIds(): string[]
  /** Blank-click boundary: true when the target belongs to a registered float. */
  isLayerTarget(target: unknown): boolean
}

export function createHushLayerStore(deps: HushDeps): HushLayerStore {
  // Insertion-ordered map: registration order is the layering order baseline.
  const layers = new Map<string, HushLayer>()

  function prune(): void {
    for (const [id, layer] of [...layers]) {
      if (layer.isAlive && !layer.isAlive()) layers.delete(id)
    }
  }

  function topmostModal(): HushLayer | null {
    let top: HushLayer | null = null
    for (const layer of layers.values()) if (layer.tier === 'modal') top = layer
    return top
  }

  function register(layer: HushLayer): () => void {
    layers.set(layer.id, layer)
    return () => {
      // Only clear if this exact registration is still the live one.
      if (layers.get(layer.id) === layer) layers.delete(layer.id)
    }
  }

  function collapseAll(): void {
    prune()
    const open = [...layers.values()]
    layers.clear()
    // Topmost first (reverse registration) so stacked floats unwind in order.
    for (let i = open.length - 1; i >= 0; i--) {
      try {
        open[i].close()
      } catch {
        // A dying float's close must not block the rest of the collapse.
      }
    }
    // FE-09 P1: math/code 双区编辑在注册层之下（层序表 chrome 深处）——最后收。
    const be = deps.blockEdit?.() ?? null
    if (be) {
      try {
        be.close()
      } catch {
        /* zero-side-effect contract: close failures must not cascade */
      }
    }
    // Focus only when registered chrome or the dual-zone edit actually went
    // away — hover-only hides must not yank caret out of the editor / a
    // nested cell session.
    if (open.length > 0 || be) deps.focusBody()
    deps.collapseChrome?.()
  }

  function consumeTop(): HushConsume {
    prune()
    // PEND-04: modal is ALWAYS topmost. isModalOpen() covers the un-registered
    // modal case (FE-08 hook point) — hush yields entirely in that case.
    const modal = topmostModal()
    if (modal) {
      layers.delete(modal.id)
      try {
        modal.close()
      } catch {
        /* zero-side-effect contract: close failures must not cascade */
      }
      return 'modal'
    }
    if (deps.isModalOpen()) return 'modal'
    if (layers.size > 0 || deps.hasChrome?.() || deps.blockEdit?.() != null) {
      collapseAll()
      return 'collapse'
    }
    return 'none'
  }

  return {
    register,
    consumeTop,
    collapseAll,
    layerIds: () => {
      prune()
      return [...layers.keys()]
    },
    isLayerTarget(target: unknown) {
      prune()
      for (const layer of layers.values()) {
        if (layer.owns && layer.owns(target)) return true
      }
      return false
    }
  }
}

// ---- module singleton (Dialog / ctxMenu / useToast bus shape) --------------

/**
 * FE-08 skip-guard hook point. Wired by the Dialog module (one-way import:
 * Dialog → useHushLayer keeps the madge cycle count at zero) so that a modal
 * which is open but somehow unregistered still yields the hush stack.
 */
let modalProbe: () => boolean = () => false

export function setModalProbe(probe: () => boolean): void {
  modalProbe = probe
}

/**
 * FE-09 P1 singleton probe: the live CM6 view is found via its DOM root
 * (EditorView.findFromDOM) — no new App wiring. Math takes precedence (a
 * formula fence can never also be a code fence); either side's close moves
 * the caret out of the block, which ends the edit session on rebuild.
 */
function currentBlockEdit(): BlockEditHandle | null {
  if (typeof document === 'undefined') return null
  const root = document.querySelector('.cm-editor')
  const view = root ? EditorView.findFromDOM(root as HTMLElement) : null
  if (!view) return null
  if (isMathEditActive(view)) return { close: () => exitMathEdit(view) }
  if (isCodeEditActive(view)) return { close: () => exitCodeEdit(view) }
  return null
}

export const hushLayers = createHushLayerStore({
  isModalOpen: () => modalProbe(),
  // Hover floats AND the table chromeState micro reveal count as visible
  // chrome — Esc must collapse both (FE-10 静息零 chrome 断言面).
  hasChrome: () =>
    hoverDiscipline.getSnapshot().active !== null || chromeState.getSnapshot().microVisible,
  collapseChrome: () => {
    hoverDiscipline.hideAllNow()
    // FE-10: 回安静后 chrome 状态机复位到静息 (four-state machine reset).
    chromeState.hush()
  },
  // FE-09 P1: math/code 双区编辑探针（选择入块即活；块 = 层序表 chrome 面）。
  blockEdit: currentBlockEdit,
  focusBody: () => {
    if (typeof document !== 'undefined') focusEditorBody()
  }
})

// ---- DOM subscription (App one-line assembly) ------------------------------

/**
 * Table widget region — its clicks are the graded step-back / cell activation
 * domain (glb-hush:boundary). Hover floats and float overlays live outside
 * `.cm-editor`, so the body-click gate below never reaches them.
 */
const TABLE_REGION_SEL = '.cm-md-table-outer, .cm-md-table-toolbar'
const BODY_REGION_SEL = '.cm-editor'
/**
 * FE-09 P1: dual-zone edit surfaces own their clicks (glb-hush:boundary 同款
 * reasoning) — idle render widgets (click-to-enter), in-edit source/preview
 * panels and chips (click-to-stay = 就地编辑). closest() climbs to these
 * containers from any inner span. Out-of-block clicks exit naturally via the
 * caret moving out → blockEdit() returns null on the next probe. Plain text /
 * inline code / headings are NOT listed: clicking them must keep collapsing
 * open floats.
 */
const BLOCK_EDIT_SEL = [
  '.cm-md-math-block', // idle math render（点击进入编辑态）
  '[class*="cm-md-math-src"]', // 聚焦源码面板行（first/body/last）
  '.cm-md-math-preview',
  '.cm-md-math-edit-chip',
  '.cm-md-code-block', // idle code render
  '[class*="cm-md-code-src"]', // 聚焦源码面板行 + .cm-md-code-src-chip
  '.cm-md-mermaid',
  '.cm-md-mermaid-preview'
].join(', ')

function isBodyBlankTarget(target: unknown, store: HushLayerStore): boolean {
  if (!(target instanceof Element)) return false
  // Registered floats own their clicks (menu items, toolbar buttons, modal).
  if (store.isLayerTarget(target)) return false
  // Table region: cell activation / graded step-back — never a hush trigger.
  if (target.closest(TABLE_REGION_SEL)) return false
  // Dual-zone edit panel: in-panel clicks keep the edit session (caret moves).
  if (target.closest(BLOCK_EDIT_SEL)) return false
  // 正文 = the editor surface (content + block gaps). Everything else
  // (sidebar, menubar, statusbar, fixed floats) keeps its own outside-click.
  return target.closest(BODY_REGION_SEL) != null
}

/**
 * Install the global Esc + body-blank subscriptions. Returns the uninstaller.
 * Kept out of the store so node-env unit tests stay DOM-free.
 */
export function attachHushDomListeners(store: HushLayerStore): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    // FE-09 P1 语义保护: an in-editor Esc the CM keymap already consumed
    // (mathEditExitBindings / table lifecycle Escape) must not be re-consumed
    // here — no steal, no double-trigger on the same gesture.
    if (event.defaultPrevented) return
    if (store.consumeTop() === 'none') return
    // Unified consumer: we acted on this Esc — inner Esc handlers must not
    // double-trigger on the same gesture (task 涉及文件 contract). Same-node
    // document listeners (MenuBar Esc backstop, interim RenderFloat listener)
    // need stopImmediatePropagation — stopPropagation alone would let them run.
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  const onMouseDown = (event: MouseEvent): void => {
    // Right-click opens context menus — never a hush trigger.
    if (event.button !== 0) return
    if (!isBodyBlankTarget(event.target, store)) return
    store.consumeTop()
    // No stopPropagation: the click still places the caret / enters edit.
  }
  // Bubble phase: surfaces that already consume Esc/blank (Dialog overlay,
  // in-cell keymap) run first and stop the event themselves; the bus is the
  // router for whatever reaches the document.
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('mousedown', onMouseDown)
  return () => {
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('mousedown', onMouseDown)
  }
}

/**
 * One-line App assembly (tech-design §8.3: zero new logic in App.tsx).
 * Attaches the singleton bus to Esc / body-blank for the component lifetime.
 */
export function useHushLayer(): void {
  useEffect(() => attachHushDomListeners(hushLayers), [])
}
