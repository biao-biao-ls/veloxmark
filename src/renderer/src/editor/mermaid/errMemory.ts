import type { ChangeDesc, EditorState } from '@codemirror/state'
import { StateField } from '@codemirror/state'
import type { ThemeName } from '../theme'

// ---- P16 mermaid error-state memory -----------------------------------------
// Live preview recreates the widget whenever the fence text changes, so an
// in-DOM "old SVG" would be lost exactly when it is needed (user breaks the
// syntax). Remember the last good render per fence start; on failure the new
// widget shows that SVG dimmed instead of wiping the diagram.
// (2.3: moved verbatim from editor/widgets.ts. Module state mermaidLastGood
// lives HERE and only here — the widget reads it through getMermaidLastGood.)
//
// Entries live under a per-document namespace (MermaidDocId) and are keyed by
// fence-start doc positions inside that document. One extensions array serves
// every DocTab (App.tsx P26), so without the namespace a DocTab B ChangeDesc
// would mapPos DocTab A's keys — drift → getMermaidLastGood misses → failed
// placeholder instead of the dimmed old diagram (AC-ERR-11 判据 1), and equal
// sourceFrom across tabs could surface the wrong tab's SVG. mermaidLastGoodRemap
// (below) mints the identity per EditorState chain and remaps ONLY its own
// namespace. Positions drift when anything BEFORE the fence is edited —
// remapMermaidLastGood maps one namespace's keys through that document's
// changes.

export interface MermaidGoodRender {
  svg: string
  code: string
  theme: ThemeName
}

/**
 * Opaque per-document identity (one token per EditorState chain = per DocTab).
 * Callers MUST capture it when the render is requested — rememberMermaidGood
 * runs in the async renderMermaid callback, where the shared EditorView may
 * already show another tab (view.setState), so re-reading "current" state there
 * would write the entry into the wrong document's namespace.
 */
export type MermaidDocId = object

// Namespaced store. WeakMap on purpose: a closed DocTab's state chain becomes
// garbage and its namespace (SVG strings) is released with it — no explicit
// teardown hook in the tab lifecycle.
let mermaidLastGood = new WeakMap<MermaidDocId, Map<number, MermaidGoodRender>>()

/** Namespace for states without mermaidLastGoodRemap (nested table-cell editors). */
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
  // Bounded per document: drop oldest entries when one document churns a lot.
  if (map.size > 64) {
    const first = map.keys().next().value
    if (first !== undefined) map.delete(first)
  }
}

/** Test isolation / teardown seam (module store has no other resetter). */
export function clearMermaidLastGood(): void {
  // WeakMap has no clear() — swap in a fresh store. Seam only; production never calls this.
  mermaidLastGood = new WeakMap()
}

/**
 * Remap ONE document's position keys through that document's change
 * (AC-ERR-11 判据 1). Without this, any edit before a fence shifts its
 * `sourceFrom` and the next widget mount misses its own last-good → failed
 * placeholder instead of the dimmed old diagram (AC-ERR-11 violation).
 *
 * Anti-crosstalk (two mermaid fences must never swap diagrams):
 * - entries whose key was deleted/replaced away (`fromA <= pos < toA`) are
 *   dropped — the fence start is gone, so its SVG must not be re-homed;
 * - `mapPos` is order-preserving, so two surviving keys can only collapse
 *   onto one new key if text between them was deleted (already excluded by
 *   the drop above). The `next.has` guard is belt-and-braces only.
 * - Cross-document: only `doc`'s namespace is touched — another DocTab's
 *   ChangeDesc can never drift or surface these keys.
 *
 * assoc = 1 (repo convention, cf. calloutFold.ts / table/state.ts): an
 * insertion exactly at the fence start (Enter on the ```mermaid line) moves
 * the fence down, so the key follows it.
 */
export function remapMermaidLastGood(doc: MermaidDocId, changes: ChangeDesc): void {
  const current = namespaceOf(doc)
  if (!current || current.size === 0 || changes.empty) return
  const dead: Array<[number, number]> = []
  // individual=true: never merge adjacent replacements into one span — a
  // surviving key between them must not be treated as deleted.
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
      // position unmappable (stale key past the old doc) — drop the entry
    }
  }
  current.clear()
  for (const [k, v] of next) current.set(k, v)
}

/**
 * Remap hook + document identity mint — StateField on purpose, not
 * `EditorView.updateListener`: updateListener runs AFTER `docView.update` /
 * widget `toDOM` (@codemirror/view update order), so the rebuilt widget's
 * `getMermaidLastGood(newSourceFrom)` in the same transaction would still
 * miss. `StateField.update` runs inside the state update, before the redraw.
 *
 * The field value IS the document identity: minted once in `create()` (one
 * EditorState chain per DocTab — useTabStore makeState shares one extensions
 * array across tabs, cf. App.tsx P26), stable across `update()` so the remap
 * here and an async rememberMermaidGood target the same namespace.
 *
 * The store itself stays module state (file header) so `rememberMermaidGood`
 * can write it from the async renderMermaid callback. Register ONLY in
 * setup.ts `createExtensions` (main editor) — nested table-cell editors build
 * their own extension list and must not remap the main document's keys with
 * cell-doc changes.
 */
export const mermaidLastGoodRemap = StateField.define<MermaidDocId>({
  create: () => ({}),
  update(doc, tr) {
    if (tr.docChanged) remapMermaidLastGood(doc, tr.changes)
    return doc
  }
})

/** Document identity for `state` (unkeyed fallback when the field is absent). */
export function mermaidDocIdOf(state: EditorState): MermaidDocId {
  return state.field(mermaidLastGoodRemap, false) ?? unkeyedMermaidDoc
}
