import type { EditorView, KeyBinding } from '@codemirror/view'
import { findMathBlockAt } from './livePreview/mathScan'

export function isMathEditActive(view: EditorView): boolean {
  const text = view.state.sliceDoc(0, view.state.doc.length)
  return findMathBlockAt(text, view.state.selection.main.from) != null
}

export function exitMathEdit(view: EditorView): void {
  const sel = view.state.selection.main
  const text = view.state.sliceDoc(0, view.state.doc.length)
  const m = findMathBlockAt(text, sel.from) ?? findMathBlockAt(text, sel.to)
  if (!m) return
  const doc = view.state.doc
  const docLen = doc.length
  const anchor = m.end < docLen ? doc.lineAt(m.end).to + 1 : Math.max(0, doc.lineAt(m.start).from - 1)
  view.dispatch({
    selection: { anchor: Math.min(anchor, docLen) },
    scrollIntoView: true,
    userEvent: 'select.math.exit'
  })
}

export const mathEditExitBindings: KeyBinding[] = [
  {
    key: 'Escape',
    run: (v) => {
      const text = v.state.sliceDoc(0, v.state.doc.length)
      if (!findMathBlockAt(text, v.state.selection.main.from)) return false
      exitMathEdit(v)
      return true
    }
  }
]
