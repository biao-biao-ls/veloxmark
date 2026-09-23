/**
 * Block-delta view helpers (task 4.3 = 2.17: extracted from opsBlocks.ts —
 * registrations stay there, helpers live here). Read helpers re-resolve the
 * doc/DOM at call time (stale-instance discipline); dispatch helpers follow
 * the transforms.ts single-undo-step convention (applyLineChanges).
 */
import { syntaxTree } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'
import { t } from '../../i18n'
import { applyLineChanges } from './transforms'
import type { CtxRuntime } from './types'

/** First enclosing syntax node matching `names` around `pos`. */
export function enclosingNode(
  view: EditorView,
  pos: number,
  names: string[]
): { from: number; to: number; name: string } | null {
  const tree = syntaxTree(view.state)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = tree.resolveInner(pos, 1)
  for (; cur; cur = cur.parent) {
    if (names.includes(cur.name)) return { from: cur.from, to: cur.to, name: cur.name }
  }
  return null
}

/** $$…$$ body range when the hit sits inside display math (DOM-detected). */
export function mathRange(view: EditorView, pos: number): { from: number; to: number } | null {
  const state = view.state
  let line = state.doc.lineAt(pos)
  const isOpen = (text: string): boolean => /^\s*\$\$/.test(text)
  const isClose = (text: string): boolean => /\$\$\s*$/.test(text) && !isOpen(text)
  let fromLine = line
  while (fromLine.number > 1 && !isOpen(fromLine.text)) fromLine = state.doc.lineAt(fromLine.from - 1)
  if (!isOpen(fromLine.text) && !/\$\$/.test(fromLine.text)) return null
  let toLine = line
  const last = state.doc.lines
  while (toLine.number < last && !(toLine.number > fromLine.number && isClose(toLine.text))) {
    toLine = state.doc.lineAt(toLine.to + 1)
  }
  return { from: fromLine.from, to: toLine.to }
}

/** Body text of a fenced code block (skips the ```lang opener + closer). */
export function fenceBody(view: EditorView, range: { from: number; to: number }): string {
  const state = view.state
  const first = state.doc.lineAt(range.from)
  const last = state.doc.lineAt(range.to)
  const bodyFrom = first.to < last.from ? first.to + 1 : first.to
  const bodyTo = last.from > first.to ? last.from - 1 : last.to
  return state.sliceDoc(Math.min(bodyFrom, range.to), Math.max(bodyFrom, bodyTo))
}

/** Rendered <svg> for the mermaid block whose fence contains `pos`. */
export function mermaidSvgAt(view: EditorView, pos: number): SVGSVGElement | null {
  try {
    const domInfo = view.domAtPos(pos)
    let el: HTMLElement | null =
      (domInfo.node instanceof HTMLElement ? domInfo.node : domInfo.node.parentElement)
    el = el?.closest('.cm-md-mermaid') ?? null
    return el?.querySelector('svg') ?? null
  } catch {
    return null
  }
}

export function deleteRange(view: EditorView, range: { from: number; to: number }, userEvent: string): void {
  const state = view.state
  const last = state.doc.lines
  const endLine = state.doc.lineAt(range.to)
  const to = endLine.number < last ? endLine.to + 1 : range.to
  view.dispatch({
    changes: { from: range.from, to: Math.min(to, state.doc.length), insert: '' },
    selection: { anchor: range.from },
    userEvent
  })
}

export async function confirmDanger(rt: CtxRuntime, message: string): Promise<boolean> {
  return rt.confirm({ title: t('ctx.deleteBlock'), message, danger: true })
}

/** UX-P24 F1: indent every non-fence, non-empty line in [from..to] by two
 *  spaces (task 4.3 merge of indentFenceBody/indentSelectedLines — identical
 *  loop bodies; change shape stays an insert at line start). */
export function indentLines(view: EditorView, from: number, to: number, userEvent: string): void {
  applyLineChanges(view, view.state.doc.lineAt(from).number, view.state.doc.lineAt(to).number, (line) => {
    if (/^\s*```/.test(line.text)) return null
    if (!line.text.length) return null
    return { from: line.from, to: line.from, insert: '  ' }
  }, userEvent)
}

/** UX-P24 F1: indent every body line of the enclosing fence by two spaces. */
export function indentFenceBody(view: EditorView, range: { from: number; to: number }): void {
  indentLines(view, range.from, range.to, 'indent.code')
}

/** UX-P24 F1: indent the lines the user selected (falls back to fence body). */
export function indentSelectedLines(view: EditorView, range: { from: number; to: number }): void {
  const sel = view.state.selection.main
  const from = sel.empty ? range.from : sel.from
  const to = sel.empty ? range.to : sel.to
  indentLines(view, from, to, 'indent.selection')
}
