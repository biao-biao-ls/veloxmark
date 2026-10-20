
export type ListPlacement = 'before' | 'after'

export interface ListBlockSpan {
  start: number
  end: number
}

export interface ListItemInfo {
  line: number
  span: ListBlockSpan
  indent: number
}

export interface ListMovePlan {
  region: ListBlockSpan
  blocks: ListBlockSpan[]
  fromIndex: number
  toIndex: number
  indentLevel: number
  indicator: { mode: 'before' | 'after'; line: number }
}

const ITEM_RE = /^([ \t]*)([-*+]|\d+[.)])[ \t]+/
const FENCE_RE = /^([ \t]*)(`{3,}|~{3,})/
const ATX_RE = /^[ \t]{0,3}#{1,6}([ \t]|$)/
const HR_RE = /^[ \t]{0,3}([-*_])[ \t]*(\1[ \t]*){2,}$/
const QUOTE_RE = /^[ \t]{0,3}>/

function isBlank(line: string): boolean {
  return line.trim() === ''
}

function indentOf(line: string): number {
  const m = /^([ \t]*)/.exec(line)
  return m ? m[1].length : 0
}

function itemMatch(line: string): RegExpExecArray | null {
  return ITEM_RE.exec(line)
}

function isBlockInterrupter(line: string): boolean {
  return ATX_RE.test(line) || HR_RE.test(line) || QUOTE_RE.test(line) || itemMatch(line) !== null
}

interface FenceState {
  marker: string
}

function fenceTick(line: string, open: FenceState | null): FenceState | null {
  const m = FENCE_RE.exec(line)
  if (!m) return open
  const marker = m[2][0]
  if (!open) return { marker }
  return marker === open.marker && m[2].length >= 3 ? null : open
}

function isItemLine(line: string, fence: FenceState | null): boolean {
  return fence === null && itemMatch(line) !== null
}

function blockEndAt(
  lines: readonly string[],
  start: number,
  indent: number,
  fenceAt: readonly (FenceState | null)[]
): number {
  let end = start
  let j = start + 1
  while (j < lines.length) {
    const line = lines[j]
    if (isBlank(line)) {
      let k = j
      while (k < lines.length && isBlank(lines[k])) k++
      if (k >= lines.length) break
      const deeper = indentOf(lines[k]) > indent
      if (deeper && (isItemLine(lines[k], fenceAt[k]) || !isBlockInterrupter(lines[k]))) {
        end = k
        j = k + 1
        continue
      }
      break
    }
    if (isItemLine(lines[j], fenceAt[j]) && indentOf(lines[j]) <= indent) break
    if (!isItemLine(lines[j], fenceAt[j]) && indentOf(lines[j]) <= indent) {
      if (isBlockInterrupter(lines[j])) break
      end = j
      j++
      continue
    }
    end = j
    j++
  }
  return end
}

export function parseListItems(lines: readonly string[]): ListItemInfo[] {
  const fenceAt: (FenceState | null)[] = []
  let fence: FenceState | null = null
  for (const line of lines) {
    fence = fenceTick(line, fence)
    fenceAt.push(fence)
  }
  const items: ListItemInfo[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!isItemLine(lines[i], fenceAt[i])) continue
    const indent = indentOf(lines[i])
    items.push({ line: i, span: { start: i, end: blockEndAt(lines, i, indent, fenceAt) }, indent })
  }
  return items
}

function itemIndexAtLine(items: readonly ListItemInfo[], line: number): number {
  let found = -1
  for (let i = 0; i < items.length; i++) {
    if (line >= items[i].span.start && line <= items[i].span.end) found = i
  }
  return found
}

function parentIndices(items: readonly ListItemInfo[]): number[] {
  const parent: number[] = []
  const stack: number[] = []
  for (let k = 0; k < items.length; k++) {
    while (stack.length && items[stack[stack.length - 1]].indent >= items[k].indent) stack.pop()
    parent.push(stack.length ? stack[stack.length - 1] : -1)
    stack.push(k)
  }
  return parent
}

function connected(prev: ListItemInfo, next: ListItemInfo, lines: readonly string[]): boolean {
  for (let j = prev.span.end + 1; j < next.span.start; j++) {
    if (!isBlank(lines[j])) return false
  }
  return true
}

export function canReorderListItem(lines: readonly string[], line: number): boolean {
  return planListMove(lines, line, line, 'before') !== null
}

function siblingGroupOf(
  items: readonly ListItemInfo[],
  parent: readonly number[],
  index: number,
  lines: readonly string[]
): number[] {
  const members = [index]
  for (let i = index - 1; i >= 0; i--) {
    if (items[i].indent !== items[index].indent || parent[i] !== parent[index]) continue
    if (!connected(items[i], items[members[0]], lines)) break
    members.unshift(i)
  }
  for (let i = index + 1; i < items.length; i++) {
    if (items[i].indent !== items[index].indent || parent[i] !== parent[index]) continue
    if (!connected(items[members[members.length - 1]], items[i], lines)) break
    members.push(i)
  }
  return members
}

export function planListMove(
  lines: readonly string[],
  fromLine: number,
  toLine: number,
  placement: ListPlacement
): ListMovePlan | null {
  const items = parseListItems(lines)
  const fromIdx = itemIndexAtLine(items, fromLine)
  if (fromIdx < 0) return null
  const parent = parentIndices(items)
  const members = siblingGroupOf(items, parent, fromIdx, lines)
  if (members.length < 2) return null

  const blocks = members.map((m) => items[m].span)
  const fromIndex = members.indexOf(fromIdx)
  const region: ListBlockSpan = {
    start: blocks[0].start,
    end: blocks[blocks.length - 1].end
  }

  let rawSlot: number
  if (toLine < region.start) {
    rawSlot = 0
  } else if (toLine > region.end) {
    rawSlot = blocks.length
  } else {
    const toIdx = itemIndexAtLine(items, toLine)
    if (toIdx < 0) {
      rawSlot = blocks.findIndex((b) => b.start > toLine)
      if (rawSlot < 0) rawSlot = blocks.length
    } else if (members.includes(toIdx)) {
      const slot = members.indexOf(toIdx)
      rawSlot = placement === 'after' ? slot + 1 : slot
    } else {
      const owner = members.findIndex((m) => {
        const s = items[m].span
        return items[toIdx].line >= s.start && items[toIdx].line <= s.end
      })
      rawSlot = owner < 0 ? blocks.length : placement === 'after' ? owner + 1 : owner
    }
  }

  const toIndex = Math.min(rawSlot > fromIndex ? rawSlot - 1 : rawSlot, blocks.length - 1)
  const n = blocks.length
  const indicator =
    rawSlot >= n
      ? ({ mode: 'after', line: blocks[n - 1].end } as const)
      : ({ mode: 'before', line: blocks[rawSlot].start } as const)

  return {
    region,
    blocks,
    fromIndex,
    toIndex,
    indentLevel: items[fromIdx].indent,
    indicator
  }
}

export function applyListMovePlan(lines: readonly string[], plan: ListMovePlan): string[] {
  const { region, blocks, fromIndex, toIndex } = plan
  const n = blocks.length
  const blockLines = blocks.map((b) => lines.slice(b.start, b.end + 1))
  const gaps: string[][] = []
  for (let i = 0; i < n - 1; i++) {
    gaps.push(lines.slice(blocks[i].end + 1, blocks[i + 1].start))
  }
  const moved = blockLines[fromIndex]
  const rest = blockLines.filter((_, i) => i !== fromIndex)
  const order = [...rest.slice(0, toIndex), moved, ...rest.slice(toIndex)]
  const regionLines: string[] = []
  for (let i = 0; i < n; i++) {
    regionLines.push(...order[i])
    if (i < n - 1) regionLines.push(...gaps[i])
  }
  return [...lines.slice(0, region.start), ...regionLines, ...lines.slice(region.end + 1)]
}


export type ListDragPointerKind = 'move' | 'up' | 'cancel' | 'blur'

export interface ListDragSessionStep {
  type: 'track' | 'finish'
  commit: boolean
}

export function listDragSessionStep(
  event: ListDragPointerKind,
  buttons: number
): ListDragSessionStep {
  if (event === 'up') return { type: 'finish', commit: true }
  if (event === 'cancel' || event === 'blur') return { type: 'finish', commit: false }
  return buttons === 0 ? { type: 'finish', commit: false } : { type: 'track', commit: false }
}

import { EditorView } from '@codemirror/view'
import { t } from '../i18n'
import { getCtxRuntime } from './contextMenu/registry'
import { assertWritable } from './readOnlyGuard'

export function docLines(view: EditorView): string[] {
  const doc = view.state.doc
  const lines: string[] = []
  for (let i = 1; i <= doc.lines; i++) lines.push(doc.line(i).text)
  return lines
}

export async function dropListMove(
  view: EditorView,
  fromLine: number,
  toLine: number,
  placement: ListPlacement
): Promise<boolean> {
  try {
    if (!(await assertWritable())) return false
    const doc = view.state.doc
    const lines = docLines(view)
    const plan = planListMove(lines, fromLine, toLine, placement)
    if (!plan || plan.toIndex === plan.fromIndex) return false
    const next = applyListMovePlan(lines, plan)
    const regionText = next.slice(plan.region.start, plan.region.end + 1).join('\n')
    view.dispatch({
      changes: {
        from: doc.line(plan.region.start + 1).from,
        to: doc.line(plan.region.end + 1).to,
        insert: regionText
      },
      userEvent: 'move.list.reorder'
    })
    getCtxRuntime()?.toast(t('render.toast.listMoved'))
    return true
  } catch {
    return false
  }
}

export function lineAtRow(view: EditorView, row: HTMLElement): number | null {
  try {
    const pos = view.posAtDOM(row)
    return view.state.doc.lineAt(pos).number - 1
  } catch {
    return null
  }
}
