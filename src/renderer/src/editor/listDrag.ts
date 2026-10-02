/**
 * ren-list:drag-handle — list reorder write-back (IT-03 FE-06).
 *
 * Pure planning layer over the source lines: pick up an item *block* (marker
 * line + continuations + nested children), drop it into another slot among its
 * same-level siblings, keep every indent prefix byte-identical (contract:
 * `fromIndex`/`toIndex`/`indentLevel` unchanged). Out-of-group drop targets
 * (a nested child of another parent, another list, plain prose) clamp back to
 * the nearest slot of the dragged item's own sibling group — "跨父级边界钳制
 * 回同层级".
 *
 * Reordering moves whole blocks; blank gap lines between sibling blocks stay
 * where they are (loose-list looseness survives the move; only item lines
 * reorder). One plan → one `renderMovedRegion` text → one CM6 transaction →
 * one Ctrl+Z step (AC-OP-16).
 *
 * Everything here is synchronous and DOM-free so listDrag.test.ts can cover
 * the grammar edge cases; the CM6 apply gate lives below the pure layer and
 * reuses readOnlyGuard (AC-ERR-08).
 */

export type ListPlacement = 'before' | 'after'

/** Inclusive 0-based line span. */
export interface ListBlockSpan {
  start: number
  end: number
}

export interface ListItemInfo {
  /** Marker line index (0-based). */
  line: number
  /** Whole block: marker + continuation + nested children. */
  span: ListBlockSpan
  /** Leading-whitespace width of the marker line (contract `indentLevel`). */
  indent: number
}

export interface ListMovePlan {
  /** Sibling-group region: first block start .. last block end. */
  region: ListBlockSpan
  /** Sibling blocks in source order (the dragged one at `fromIndex`). */
  blocks: ListBlockSpan[]
  fromIndex: number
  /** Final slot of the dragged block (0..n-1); equal to `fromIndex` = no-op. */
  toIndex: number
  /** Unchanged indent of the dragged marker line (contract param). */
  indentLevel: number
  /** Where the drop indicator goes, in the *current* document. */
  indicator: { mode: 'before' | 'after'; line: number }
}

/** `- x` / `* x` / `+ x` / `1.` / `1)` — marker must be followed by space. */
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

/** Lines that end a lazy continuation instead of riding along with the item. */
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
  // Closing fence: same char, at least as many ticks.
  return marker === open.marker && m[2].length >= 3 ? null : open
}

/** True when `line` is a list-item marker line outside any fenced code. */
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
      // Blank: belongs to the block only when deeper content follows it.
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
      // Lazy continuation rides along only while the paragraph is unbroken.
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
  // Innermost wins: a nested child's span sits inside its parent's span, so
  // the last hit is the most specific item covering the line.
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

/** Only blank lines between two blocks = same list (loose ok); prose = a break. */
function connected(prev: ListItemInfo, next: ListItemInfo, lines: readonly string[]): boolean {
  for (let j = prev.span.end + 1; j < next.span.start; j++) {
    if (!isBlank(lines[j])) return false
  }
  return true
}

export function canReorderListItem(lines: readonly string[], line: number): boolean {
  return planListMove(lines, line, line, 'before') !== null
}

/**
 * Maximal run of same-indent, same-parent, blank-connected items around
 * `index` — the reorder unit ("同层级"). Separate lists never merge.
 */
function siblingGroupOf(
  items: readonly ListItemInfo[],
  parent: readonly number[],
  index: number,
  lines: readonly string[]
): number[] {
  const members = [index]
  // Non-peer items are walked over without comment: descendants ride inside the
  // previous member's block span (empty gap), anything else leaves its marker
  // line in the gap and fails connected() — so a clean same-level run is
  // exactly "peers whose blocks sit in one unbroken list".
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

  // ---- resolve the drop slot, clamping out-of-group targets to this group --
  let rawSlot: number
  if (toLine < region.start) {
    rawSlot = 0
  } else if (toLine > region.end) {
    rawSlot = blocks.length
  } else {
    const toIdx = itemIndexAtLine(items, toLine)
    if (toIdx < 0) {
      // Gap inside the region — land before the next block.
      rawSlot = blocks.findIndex((b) => b.start > toLine)
      if (rawSlot < 0) rawSlot = blocks.length
    } else if (members.includes(toIdx)) {
      const slot = members.indexOf(toIdx)
      rawSlot = placement === 'after' ? slot + 1 : slot
    } else {
      // Nested under some group block (or under the dragged one): clamp to
      // that owner's slot at this level (跨父级边界钳制回同层级).
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

/** New full lines array for one plan. Gap lines between blocks never move. */
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

// ── pointer drag-session guard ─────────────────────────────────────────────

export type ListDragPointerKind = 'move' | 'up' | 'cancel' | 'blur'

export interface ListDragSessionStep {
  /** `track` = keep following the pointer; `finish` = tear the session down. */
  type: 'track' | 'finish'
  /** Only a genuine pointerup may write back (`dropListMove` / toast). */
  commit: boolean
}

/**
 * Pure drag-session state guard (FE-06 fix-cr: release outside the window).
 *
 * A `move` whose `buttons` is already 0 means the button was released outside
 * the window (pointerup never arrived) or capture was lost: the session must
 * abort — ghost / drop indicator / hover pin cleanup — and must NOT commit the
 * item to the stale drop target. `pointercancel` / window `blur` interrupt the
 * same way. Commit rights belong to `pointerup` alone.
 */
export function listDragSessionStep(
  event: ListDragPointerKind,
  buttons: number
): ListDragSessionStep {
  if (event === 'up') return { type: 'finish', commit: true }
  if (event === 'cancel' || event === 'blur') return { type: 'finish', commit: false }
  return buttons === 0 ? { type: 'finish', commit: false } : { type: 'track', commit: false }
}

// ── CM6 apply gate ─────────────────────────────────────────────────────────
import { EditorView } from '@codemirror/view'
import { t } from '../i18n'
import { getCtxRuntime } from './contextMenu/registry'
import { assertWritable } from './readOnlyGuard'

/**
 * Snapshot of the document's source lines (0-based array). Single 口径 for
 * the drag-session preview (cached at pointerdown) and the commit gate (live)
 * — ListDragHandle must not re-implement the copy loop (FE-06 review DRY).
 */
export function docLines(view: EditorView): string[] {
  const doc = view.state.doc
  const lines: string[] = []
  for (let i = 1; i <= doc.lines; i++) lines.push(doc.line(i).text)
  return lines
}

/**
 * Drop-commit: re-plan against the live doc (stale-instance discipline), then
 * one region replace = one undo step. Read-only refusal writes nothing
 * (AC-ERR-08); a no-op plan is silent (no toast).
 */
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

/**
 * DOM → line mapping for the drag session: the hovered `.cm-md-list` row is
 * the item's marker line.
 */
export function lineAtRow(view: EditorView, row: HTMLElement): number | null {
  try {
    const pos = view.posAtDOM(row)
    return view.state.doc.lineAt(pos).number - 1
  } catch {
    return null
  }
}
