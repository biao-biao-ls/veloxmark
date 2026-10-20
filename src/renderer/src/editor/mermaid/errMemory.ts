import type { ChangeDesc, EditorState } from '@codemirror/state'
import { StateField } from '@codemirror/state'
import type { ThemeName } from '../theme'


export interface MermaidGoodRender {
  svg: string
  code: string
  theme: ThemeName
}

export type MermaidDocId = object

let mermaidLastGood = new WeakMap<MermaidDocId, Map<number, MermaidGoodRender>>()

const unkeyedMermaidDoc: MermaidDocId = {}

function namespaceOf(doc: MermaidDocId): Map<number, MermaidGoodRender> | undefined {
  return mermaidLastGood.get(doc)
}

function namespaceFor(doc: MermaidDocId): Map<number, MermaidGoodRender> {
  let map = mermaidLastGood.get(doc)
  if (!map) {
    map = new Map()
    mermaidLastGood.set(doc, map)
  }
  return map
}

export function getMermaidLastGood(doc: MermaidDocId, pos: number): MermaidGoodRender | undefined {
  return namespaceOf(doc)?.get(pos)
}

export function rememberMermaidGood(doc: MermaidDocId, pos: number, entry: MermaidGoodRender): void {
  const map = namespaceFor(doc)
  map.set(pos, entry)
  if (map.size > 64) {
    const first = map.keys().next().value
    if (first !== undefined) map.delete(first)
  }
}

export function clearMermaidLastGood(): void {
  mermaidLastGood = new WeakMap()
}

export function remapMermaidLastGood(doc: MermaidDocId, changes: ChangeDesc): void {
  const current = namespaceOf(doc)
  if (!current || current.size === 0 || changes.empty) return
  const dead: Array<[number, number]> = []
  changes.iterChangedRanges(
    (fromA, toA) => {
      if (toA > fromA) dead.push([fromA, toA])
    },
    true
  )
  const next = new Map<number, MermaidGoodRender>()
  for (const [pos, entry] of current) {
    if (dead.some(([fromA, toA]) => fromA <= pos && pos < toA)) continue
    try {
      const mapped = changes.mapPos(pos, 1)
      if (!next.has(mapped)) next.set(mapped, entry)
    } catch {
    }
  }
  current.clear()
  for (const [k, v] of next) current.set(k, v)
}

export const mermaidLastGoodRemap = StateField.define<MermaidDocId>({
  create: () => ({}),
  update(doc, tr) {
    if (tr.docChanged) remapMermaidLastGood(doc, tr.changes)
    return doc
  }
})

export function mermaidDocIdOf(state: EditorState): MermaidDocId {
  return state.field(mermaidLastGoodRemap, false) ?? unkeyedMermaidDoc
}
