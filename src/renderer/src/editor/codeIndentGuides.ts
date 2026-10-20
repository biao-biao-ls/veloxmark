import { syntaxTree, getIndentUnit } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'


const guideMark = Decoration.mark({ class: 'cm-md-indent-guide' })

function buildGuides(view: EditorView): DecorationSet {
  const { state } = view
  const unit = Math.max(1, getIndentUnit(state))
  const decos: Array<{ from: number; to: number; value: Decoration }> = []
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'FencedCode') return true
      const first = state.doc.lineAt(node.from)
      const last = state.doc.lineAt(node.to)
      for (let n = first.number + 1; n <= last.number; n++) {
        const line = state.doc.line(n)
        pushLineGuides(line.text, line.from, unit, decos)
      }
      return false
    }
  })
  return Decoration.set(decos, true)
}

function pushLineGuides(
  text: string,
  lineFrom: number,
  unit: number,
  out: Array<{ from: number; to: number; value: Decoration }>
): void {
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch !== ' ' && ch !== '\t') break
    if (ch === '\t') {
      out.push({ from: lineFrom + i, to: lineFrom + i + 1, value: guideMark })
      i += 1
      continue
    }
    if (i % unit === 0) {
      out.push({ from: lineFrom + i, to: lineFrom + i + 1, value: guideMark })
    }
    i += 1
  }
}

export function indentGuides(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = buildGuides(view)
      }
      update(u: ViewUpdate): void {
        if (u.docChanged || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) {
          this.decorations = buildGuides(u.view)
        }
      }
    },
    { decorations: (v) => v.decorations }
  )
}

