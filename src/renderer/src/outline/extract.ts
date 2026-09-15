import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'

export interface OutlineItem {
  level: number
  text: string
  pos: number
}

export function extractOutline(state: EditorState): OutlineItem[] {
  const items: OutlineItem[] = []
  const tree = syntaxTree(state)
  tree.iterate({
    enter: (node) => {
      const atx = /^ATXHeading([1-6])$/.exec(node.node.name)
      if (atx) {
        // Plain text inside headings is anonymous in the tree, so slice the
        // whole heading and strip the leading/trailing '#' markers.
        const raw = state.sliceDoc(node.from, node.to)
        const text = raw
          .replace(/^#{1,6}[ \t]+/, '')
          .replace(/[ \t]+#+[ \t]*$/, '')
          .trim()
        items.push({
          level: Number(atx[1]),
          text,
          pos: node.from
        })
        return false
      }
      const setext = /^SetextHeading([12])$/.exec(node.node.name)
      if (setext) {
        const firstLine = state.doc.lineAt(node.from)
        items.push({
          level: Number(setext[1]),
          text: firstLine.text.trim(),
          pos: node.from
        })
        return false
      }
      return true
    }
  })
  return items
}
