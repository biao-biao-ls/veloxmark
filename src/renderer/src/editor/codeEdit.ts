import type { EditorView, KeyBinding } from '@codemirror/view'


export interface FenceBlock {
  start: number
  end: number
  closed: boolean
}

const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/

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
    if (pos < blockStart) return null
    if (pos <= blockEnd) return { start: blockStart, end: blockEnd, closed }
    if (!closed) return null
  }
  return null
}

export function fenceExitAnchor(text: string, block: FenceBlock): number {
  const docLen = text.length
  if (block.end < docLen) {
    const nl = text.indexOf('\n', block.end)
    return nl === -1 ? docLen : nl + 1
  }
  return Math.max(0, block.start - 1)
}

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

export const codeEditExitBindings: KeyBinding[] = [
  {
    key: 'Escape',
    run: (v) => {
      const text = v.state.sliceDoc(0, v.state.doc.length)
      if (!findFenceBlockAt(text, v.state.selection.main.from)) return false
      exitCodeEdit(v)
      return true
    }
  }
]
