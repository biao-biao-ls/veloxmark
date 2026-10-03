import type { EditorView } from '@codemirror/view'

/**
 * 8B/P28 code edit-session exit (mathEdit 同构，FE-09 P1) — the focused
 * fence panel is pure decoration (blockTouched), so "exit" just moves the
 * cursor outside the fence span; the next decoration rebuild returns the
 * pure rendered widget (CodeBlockWidget / MermaidWidget).
 *
 * Unlike math there is NO Escape keymap on this side (in-editor Esc keeps
 * its existing fall-through) — the only caller is the hush collapse face
 * (`useHushLayer` blockEdit.close): when a float (MenuBar/⋮/⊞…) collapses
 * while the caret is parked inside a fence, the panel/chip must not linger.
 *
 * Fence shapes live in pure functions below (unit-tested) so this module
 * stays DOM-free importable — same split as mathScan → mathEdit.
 */

/** A fenced-code block span: opening-line `from` → closing-line `to` (or EOF). */
export interface FenceBlock {
  start: number
  end: number
  /** false when no valid closing fence was found (block runs to EOF). */
  closed: boolean
}

const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/

/**
 * Locate the fenced-code block containing `pos` (fence marks inclusive —
 * the P28 blockTouched span). Inline code is never a block. Closing fence =
 * same marker char, length ≥ opening, no info string (CommonMark).
 */
export function findFenceBlockAt(text: string, pos: number): FenceBlock | null {
  let from = 0
  while (from <= text.length) {
    let to = text.indexOf('\n', from)
    if (to === -1) to = text.length
    const open = FENCE_OPEN_RE.exec(text.slice(from, to))
    if (!open) {
      if (to === text.length) break
      from = to + 1
      continue
    }
    const marker = open[1][0]
    const len = open[1].length
    const blockStart = from
    let blockEnd = text.length
    let closed = false
    // Scan for the closing fence; unclosed blocks extend to EOF.
    let scan = to === text.length ? -1 : to + 1
    while (scan !== -1) {
      let lineTo = text.indexOf('\n', scan)
      if (lineTo === -1) lineTo = text.length
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(text.slice(scan, lineTo))
      if (close && close[1][0] === marker && close[1].length >= len) {
        blockEnd = lineTo
        closed = true
        from = lineTo === text.length ? text.length + 1 : lineTo + 1
        break
      }
      if (lineTo === text.length) {
        from = text.length + 1
        break
      }
      scan = lineTo + 1
    }
    if (pos < blockStart) return null // 左到右扫描：此前无块，之后只会更右
    if (pos <= blockEnd) return { start: blockStart, end: blockEnd, closed }
    if (!closed) return null // 未闭合块已覆盖到文末
    // pos 在闭合块之后 —— 继续找下一块
  }
  return null
}

/**
 * Exit anchor (exitMathEdit 同构): past the closing-fence line's newline =
 * fully outside blockTouched's span; at doc end step back before the opening
 * fence instead (exitTableEdit precedent).
 */
export function fenceExitAnchor(text: string, block: FenceBlock): number {
  const docLen = text.length
  if (block.end < docLen) {
    const nl = text.indexOf('\n', block.end)
    return nl === -1 ? docLen : nl + 1
  }
  return Math.max(0, block.start - 1)
}

/** Probe: is the caret sitting inside a focused fence panel (P28 source view)? */
export function isCodeEditActive(view: EditorView): boolean {
  const text = view.state.sliceDoc(0, view.state.doc.length)
  return findFenceBlockAt(text, view.state.selection.main.from) != null
}

export function exitCodeEdit(view: EditorView): void {
  const sel = view.state.selection.main
  const text = view.state.sliceDoc(0, view.state.doc.length)
  const b = findFenceBlockAt(text, sel.from) ?? findFenceBlockAt(text, sel.to)
  if (!b) return
  const docLen = view.state.doc.length
  view.dispatch({
    selection: { anchor: Math.min(fenceExitAnchor(text, b), docLen) },
    scrollIntoView: true,
    userEvent: 'select.code.exit'
  })
}
