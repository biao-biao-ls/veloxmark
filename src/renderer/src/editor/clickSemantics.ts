import { EditorView } from '@codemirror/view'

// ---- AC-RULE-13 click semantics (ren-click:semantics) -----------------------
//
// The single decision table every render-zone click path consults (FE-09):
//
//   点击元素内容 → 进入该元素对应编辑形态（写作者路径优先）
//   纯选中/复制（拖选松开）→ 安全动作：不进入编辑、不弹任何工具浮层/把手/chip
//   图/表/代码相邻处 → 语义一致，同一次点击只产生一种语义
//
// Two documented supplies of the contract input `selection.isEmpty`:
//
//   • Edit routing (widget press-release: image / table cell / block gap) —
//     rendered widget content cannot host a text selection (their mousedown
//     preventDefaults; CM's DOMObserver would map an in-widget caret back into
//     the doc and collapse the block), so the gesture is a click by
//     construction and `selectionEmpty` is supplied as `true`. A stale
//     selection from an earlier drag-select is that earlier gesture's business
//     — writer path first (AC-RULE-13), or edit entry would lock out until the
//     selection is collapsed somewhere else.
//
//   • Chrome policy (hover surfacing, post-release recovery, CSS hover chips)
//     — keyed on the live selection state (`state.selection.main.empty`): as
//     long as a text selection exists the release is a pure-selection action
//     (AC-FN-18: no tool floats / handles / chips, no edit routing).

/** Decoration hit-area kinds — the `hitTarget` face of ren-click:semantics. */
export type HitTarget = 'text' | 'table' | 'math' | 'code' | 'image' | 'mermaid'

/** Route response: enter the target's edit form, or safe-select (no-op). */
export type ClickVerdict =
  | { kind: 'edit'; form: HitTarget }
  | { kind: 'select' }

export interface ClickDecisionInput {
  hitTarget: HitTarget
  /** Contract `selection.isEmpty` at decision time (see module header). */
  selectionEmpty: boolean
}

/**
 * AC-RULE-13 route table. Non-empty selection always wins (pure selection is
 * a safe action — never edit, never chrome); empty selection routes to the
 * hit target's edit form.
 */
export function judgeClickSemantics(input: ClickDecisionInput): ClickVerdict {
  if (!input.selectionEmpty) return { kind: 'select' }
  return { kind: 'edit', form: input.hitTarget }
}

/** Tool-chrome policy: floats/handles/chips only outside pure selection. */
export function chromeAllowed(selectionEmpty: boolean): boolean {
  return selectionEmpty
}

export interface PendingShowGuardInput {
  /** MouseEvent.buttons at guard time (non-zero while any button is down). */
  buttons: number
  /** Contract `selection.isEmpty` at guard time (see module header). */
  selectionEmpty: boolean
}

/**
 * Pending-show cancel guard (AC-FN-18 残窗): while a press gesture is in
 * flight or a text selection exists, a debounce-scheduled hover show must die
 * — pressing inside the same hit zone never fires mouseout, so without this
 * sweep the 150ms dwell would pop chrome mid-drag-select. Pure policy; the
 * sweep mechanism (show-pending-only, pin/retain respected) lives in the
 * hoverDiscipline bus.
 */
export function shouldCancelPendingShow(input: PendingShowGuardInput): boolean {
  return input.buttons !== 0 || !chromeAllowed(input.selectionEmpty)
}

/** Minimal Element face — keeps the classify unit-testable without a DOM. */
interface ElementLike {
  closest(selector: string): unknown
}

/**
 * Classify the decoration hit area under a pointer event target. Innermost
 * specific widget wins (image > mermaid > math > code > table > text);
 * anything on the editor prose surface is `text`; anything else is null.
 */
export function hitTargetFromTarget(target: EventTarget | null): HitTarget | null {
  const el = target as ElementLike | null
  if (!el || typeof el.closest !== 'function') return null
  if (el.closest('.cm-md-image-wrap')) return 'image'
  if (el.closest('.cm-md-mermaid')) return 'mermaid'
  if (el.closest('.cm-md-math-block') || el.closest('.cm-md-math-inline')) return 'math'
  if (el.closest('.cm-md-code-block')) return 'code'
  if (el.closest('.cm-md-table-wrap') || el.closest('.cm-md-table')) return 'table'
  if (el.closest('.cm-content')) return 'text'
  return null
}

/**
 * Pure-selection CSS hook (AC-FN-18 判据 3): while a text selection exists the
 * CSS hover-reveal chrome (block toolbars / idle chips) stays down — a drag
 * across a decorated block must not pop its toolbar mid-selection. Toggled
 * from App's selection seam; the class is read by styles/markdown.css +
 * styles/code-chrome.css (`.cm-md-selecting` guards).
 */
export function syncPureSelectionChrome(view: EditorView): void {
  view.dom.classList.toggle('cm-md-selecting', !view.state.selection.main.empty)
}
