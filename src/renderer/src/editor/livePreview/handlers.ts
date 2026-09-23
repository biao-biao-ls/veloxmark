/**
 * Per-syntax decoration handlers — re-export barrel (task 1D split).
 *
 * The original 907-line handlers.ts is split by concern:
 * - `handlers-ctx.ts`       shared contract (BuildCtx/PendingDeco, Decoration
 *                           singletons, tree utils)
 * - `handlers-tree.ts`      tree-pass enter* handlers (headings/inline/lists/…)
 * - `handlers-code.ts`      tables + fenced code/mermaid (edit-session aware)
 * - `handlers-math.ts`      math regex pass (runs AFTER the tree pass)
 * - `handlers-extended.ts`  extended-syntax regex pass (P11; after tree pass)
 *
 * `build.ts` keeps importing from here — the split is an implementation
 * detail of this barrel. See docs/specs/1D-split-handlers/spec.md.
 */
export * from './handlers-ctx'
export * from './handlers-tree'
export * from './handlers-code'
export * from './handlers-math'
export * from './handlers-extended'
