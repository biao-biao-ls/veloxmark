import type { EditorState } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'

export const toggleCodeBlockFold = StateEffect.define<{ key: string; expanded: boolean }>()

export const codeBlockUiField = StateField.define<Set<string>>({
  create: () => new Set<string>(),
  update(value, tr) {
    let cur = value
    for (const e of tr.effects) {
      if (e.is(toggleCodeBlockFold)) {
        const next = new Set(cur)
        if (e.value.expanded) next.add(e.value.key)
        else next.delete(e.value.key)
        cur = next
      }
    }
    return cur
  }
})

export function getCodeBlockExpanded(state: EditorState): Set<string> {
  return state.field(codeBlockUiField, false) ?? new Set<string>()
}

export function codeBlockKey(code: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}
