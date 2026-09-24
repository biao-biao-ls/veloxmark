import type { EditorView, KeyBinding } from '@codemirror/view'
import { findMathBlockAt } from './livePreview/mathScan'

/**
 * 8B math edit-session exit (「公式 ✓」chip click / Escape) — the edit state is
 * pure decoration (blockTouched), so "exit" just moves the cursor past the
 * block; the next decoration rebuild returns the pure rendered widget.
 * Escape returns false outside a math block so it falls through to the rest
 * of the keymap (search panel close etc. stay ahead of us in setup order).
 */
export function exitMathEdit(view: EditorView): void {
  const sel = view.state.selection.main
  const text = view.state.sliceDoc(0, view.state.doc.length)
  const m = findMathBlockAt(text, sel.from) ?? findMathBlockAt(text, sel.to)
  if (!m) return
  const doc = view.state.doc
  const docLen = doc.length
  // Past the closing-$$ line's newline = fully outside blockTouched's span;
  // at doc end step back before the block instead (exitTableEdit precedent).
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
