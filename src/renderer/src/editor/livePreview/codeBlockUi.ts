import type { EditorState } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'

/**
 * P24 code-block display UI state (session-only).
 *
 * Expand memory is keyed by *content hash* — rebuilds, theme switches and
 * decoration re-evaluations keep a block expanded as long as its code is
 * unchanged; editing the code re-keys it and the collapse default reapplies.
 * Never persisted: restart always starts collapsed (per P24 spec).
 */
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

/** Expanded-block key set; safe when the field is absent (snapshot tests). */
export function getCodeBlockExpanded(state: EditorState): Set<string> {
  return state.field(codeBlockUiField, false) ?? new Set<string>()
}

/** FNV-1a content hash — cheap, stable, collision risk irrelevant at session scope. */
export function codeBlockKey(code: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}
