/**
 * nav-keyboard:outline — pure key → action mapping for the outline panel
 * (FE-08). No DOM, no React: the component feeds the flat heading-node view
 * (toOutlineNodes output) and this module answers what a key press means.
 * Roving tabindex, DOM focus and fold writes stay in Outline.tsx.
 *
 * Contract (NAV-sidebar.md 3.2):
 *   ↑/↓   move focus between outline nodes (never jumps the body)
 *   Enter activate = the row click path (nav-outline:jump, FE-07)
 *   ←     collapse the focused section (fold write — non-foldable/collapsed: no-op)
 *   →     expand the focused section (unfold write — non-foldable/expanded: no-op)
 * Disabled rules: non-foldable rows ignore ←/→; an empty outline is a total
 * no-op (the caller also must not bind keys when there are no rows). Fold keys
 * are level:text (editor/livePreview/fold.ts foldKey) — Q10 reuses them.
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
  /**
   * Foldable = the section hides body lines when folded (collectFoldSections
   * keys). Empty sections (heading with no body lines before the next heading —
   * collectFoldSections skips them) render the leaf "·" placeholder instead;
   * toggling them would be a no-op. This is the SAME 口径 as the render-area
   * caret (UX 折叠三点 #2): body-only H2s fold from the outline too — sub-
   * headings are not required.
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
      // Non-foldable empty section / already-collapsed: nothing to collapse —
      // silent no-op (FE-08 异常场景). The foldable gate matches the triangle
      // click gate exactly so ← never writes a ghost fold key; body-only
      // leaves fold like any other foldable section (UX 折叠三点 #2).
      if (!node.foldable || !node.expanded) return NONE(focusIndex)
      return { action: 'collapse', nextIndex: at }
    }
    case 'ArrowRight': {
      if (at < 0) return NONE(focusIndex)
      const node = nodes[at]
      // Non-foldable empty section / already-expanded: nothing to expand —
      // silent no-op (FE-08 异常场景). Same foldable gate as ←.
      if (!node.foldable || node.expanded) return NONE(focusIndex)
      return { action: 'expand', nextIndex: at }
    }
    default:
      return NONE(focusIndex)
  }
}

/**
 * Map extracted outline items into the keyboard-node shape. `expanded` comes
 * from the headingFolds set. `foldableKeys` (collectFoldSections keys) marks
 * empty sections non-foldable; omitted = every node foldable (compat with
 * older callers).
 */
export function toOutlineNodes(
  items: readonly OutlineItem[],
  foldedKeys: ReadonlySet<string>,
  foldableKeys?: ReadonlySet<string>
): OutlineNode[] {
  return items.map((item) => {
    const id = foldKey(item.level, item.text)
    return {
      id,
      level: item.level,
      text: item.text,
      expanded: !foldedKeys.has(id),
      foldable: foldableKeys?.has(id) ?? true
    }
  })
}

/**
 * Triangle rule (UX 折叠三点 #2): interactive fold chevron on every foldable
 * section — body lines to hide, the same 口径 as the render-area caret,
 * sub-headings not required — and the "·" placeholder on empty sections.
 * Direction (the chevron's is-open rotation) is the caller's foldedKeys
 * concern, not visibility.
 */
export function showsFoldTriangle(node: OutlineNode): boolean {
  return node.foldable
}
