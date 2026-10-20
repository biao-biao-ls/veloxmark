import type { OutlineItem } from '../outline/extract'
import { foldKey } from '../editor/livePreview/fold'

export interface OutlineNode {
  id: string
  level: number
  text: string
  expanded: boolean
  foldable: boolean
}

export interface OutlineKeyState {
  nodes: readonly OutlineNode[]
  focusIndex: number
}

export type OutlineKeyAction =
  | { action: 'move'; nextIndex: number }
  | { action: 'jump'; nextIndex: number }
  | { action: 'collapse'; nextIndex: number }
  | { action: 'expand'; nextIndex: number }
  | { action: 'none'; nextIndex: number }

const NONE = (nextIndex: number): OutlineKeyAction => ({ action: 'none', nextIndex })

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
      if (!node.foldable || !node.expanded) return NONE(focusIndex)
      return { action: 'collapse', nextIndex: at }
    }
    case 'ArrowRight': {
      if (at < 0) return NONE(focusIndex)
      const node = nodes[at]
      if (!node.foldable || node.expanded) return NONE(focusIndex)
      return { action: 'expand', nextIndex: at }
    }
    default:
      return NONE(focusIndex)
  }
}

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

export function showsFoldTriangle(node: OutlineNode): boolean {
  return node.foldable
}
