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

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-_]/gu, '')
    .replace(/\s/g, '-')
}

export function findHeadingBySlug(items: OutlineItem[], rawSlug: string): OutlineItem | null {
  const target = rawSlug.replace(/^#/, '').toLowerCase()
  if (!target) return null
  const seen = new Map<string, number>()
  for (const item of items) {
    const base = slugify(item.text)
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    const key = n === 0 ? base : `${base}-${n}`
    if (key === target) return item
  }
  return null
}
