import { EditorView } from '@codemirror/view'


export type HitTarget = 'text' | 'table' | 'math' | 'code' | 'image' | 'mermaid'

export type ClickVerdict =
  | { kind: 'edit'; form: HitTarget }
  | { kind: 'select' }

export interface ClickDecisionInput {
  hitTarget: HitTarget
  selectionEmpty: boolean
}

export function judgeClickSemantics(input: ClickDecisionInput): ClickVerdict {
  if (!input.selectionEmpty) return { kind: 'select' }
  return { kind: 'edit', form: input.hitTarget }
}

export function chromeAllowed(selectionEmpty: boolean): boolean {
  return selectionEmpty
}

export interface PendingShowGuardInput {
  buttons: number
  selectionEmpty: boolean
}

export function shouldCancelPendingShow(input: PendingShowGuardInput): boolean {
  return input.buttons !== 0 || !chromeAllowed(input.selectionEmpty)
}

interface ElementLike {
  closest(selector: string): unknown
}

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

export function syncPureSelectionChrome(view: EditorView): void {
  view.dom.classList.toggle('cm-md-selecting', !view.state.selection.main.empty)
}
