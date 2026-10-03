/**
 * nav-keyboard:outline — pure key → action mapping for the outline panel
 * (FE-08). No DOM, no React: the component feeds the flat heading-node view
 * (toOutlineNodes output) and this module answers what a key press means.
 * Roving tabindex, DOM focus and fold writes stay in Outline.tsx.
 *
 * Contract (NAV-sidebar.md 3.2):
 *   ↑/↓   move focus between outline nodes (never jumps the body)
 *   Enter activate = the row click path (nav-outline:jump, FE-07)
 *   ←     collapse the focused section (fold write — leaf/collapsed: no-op)
 *   →     expand the focused section (unfold write — leaf/expanded: no-op)
 * Disabled rules: leaf nodes ignore ←/→; an empty outline is a total no-op
 * (the caller also must not bind keys when there are no rows). Fold keys are
 * level:text (editor/livePreview/fold.ts foldKey) — Q10 reuses them.
 */
import type { OutlineItem } from '../outline/extract'
import { foldKey } from '../editor/livePreview/fold'

/** Keyboard focus model node (NAV-sidebar.md 3.2 期望数据). */
export interface OutlineNode {
  /** foldKey(level, text) — identity shared with the fold domain. */
  id: string
  level: number
  text: string
  /** Effective expansion (inverse of the headingFolds membership). */
  expanded: boolean
  /** True when the next heading is deeper — leaves ignore ←/→. */
  hasChildren: boolean
  /**
   * FE-08#4 + FE-09#2: fold triangle shows only on rows with children AND
   * foldable body lines. Empty sections (heading with no body lines before the
   * next heading — collectFoldSections skips them) render the leaf "·"
   * placeholder instead; toggling them would be a no-op.
   */
  foldable: boolean
}

export interface OutlineKeyState {
  nodes: readonly OutlineNode[]
  /** Index into `nodes` of the focused node; -1 = no focus yet. */
  focusIndex: number
}

export type OutlineKeyAction =
  | { action: 'move'; nextIndex: number }
  | { action: 'jump'; nextIndex: number }
  | { action: 'collapse'; nextIndex: number }
  | { action: 'expand'; nextIndex: number }
  | { action: 'none'; nextIndex: number }

const NONE = (nextIndex: number): OutlineKeyAction => ({ action: 'none', nextIndex })

/**
 * Resolve a key press against the outline-node view. Returns the action to
 * perform plus the resulting focus index (unchanged for non-focus actions).
 * Unknown keys and disabled contexts yield `none` so the caller can leave the
 * event alone (body editor input must stay free).
 */
export function resolveKey(state: OutlineKeyState, key: string): OutlineKeyAction {
  const { nodes, focusIndex } = state
  if (nodes.length === 0) return NONE(focusIndex)

  const inRange = focusIndex >= 0 && focusIndex < nodes.length
  const at = inRange ? focusIndex : -1

  switch (key) {
    case 'ArrowDown': {
      const next = at < 0 ? 0 : at + 1
      return next >= nodes.length ? NONE(focusIndex) : { action: 'move', nextIndex: next }
    }
    case 'ArrowUp': {
      const prev = at < 0 ? nodes.length - 1 : at - 1
      return prev < 0 ? NONE(focusIndex) : { action: 'move', nextIndex: prev }
    }
    case 'Enter': {
      return at < 0 ? NONE(focusIndex) : { action: 'jump', nextIndex: at }
    }
    case 'ArrowLeft': {
      if (at < 0) return NONE(focusIndex)
      const node = nodes[at]
      // Leaf / non-foldable empty section / already-collapsed: nothing to
      // collapse — silent no-op (FE-08 异常场景). Non-foldable rows (empty
      // section, "·" placeholder) must match the triangle click gate so ←
      // never writes a ghost fold key.
      if (!node.hasChildren || !node.foldable || !node.expanded) return NONE(focusIndex)
      return { action: 'collapse', nextIndex: at }
    }
    case 'ArrowRight': {
      if (at < 0) return NONE(focusIndex)
      const node = nodes[at]
      // Leaf / non-foldable empty section / already-expanded: nothing to
      // expand — silent no-op (FE-08 异常场景). Same foldable gate as ←.
      if (!node.hasChildren || !node.foldable || node.expanded) return NONE(focusIndex)
      return { action: 'expand', nextIndex: at }
    }
    default:
      return NONE(focusIndex)
  }
}

/**
 * Map extracted outline items into the keyboard-node shape. `expanded` comes
 * from the headingFolds set; `hasChildren` from the next heading's level, so a
 * trailing leaf (or a leaf before a same/shallower heading) stays a leaf.
 * `foldableKeys` (collectFoldSections keys) marks empty sections non-foldable;
 * omitted = every node foldable (compat with older callers).
 */
export function toOutlineNodes(
  items: readonly OutlineItem[],
  foldedKeys: ReadonlySet<string>,
  foldableKeys?: ReadonlySet<string>
): OutlineNode[] {
  return items.map((item, i) => {
    const id = foldKey(item.level, item.text)
    const next = items[i + 1]
    return {
      id,
      level: item.level,
      text: item.text,
      expanded: !foldedKeys.has(id),
      hasChildren: next !== undefined && next.level > item.level,
      foldable: foldableKeys?.has(id) ?? true
    }
  })
}

/**
 * FE-08#4 + FE-09#2 triangle rule: interactive ▾/▸ only on rows with children
 * that fold real body lines; leaves and empty sections get the "·" placeholder.
 * Direction (▾/▸) is the caller's foldedKeys concern, not visibility.
 */
export function showsFoldTriangle(node: OutlineNode): boolean {
  return node.hasChildren && node.foldable
}
