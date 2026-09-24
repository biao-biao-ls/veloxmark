/**
 * 6B tree-root follow (tasks 6.3/6.4; contract revised by 6.4a) — root
 * resolution + explicit-root pin.
 *
 * The tree root model is `resolveTreeRoot` (D1, as revised 2026-09-24):
 * explicit pin → active document's directory → **empty**. An unfiled document
 * (untitled draft, welcome, no tabs) has no directory context, so the files
 * tab shows the empty-state card instead of pretending a workspace (the old
 * "fall back to the recent root" clause is void — see spec revision record).
 *
 * D1 pin rule: `setExplicitRoot` (openFolder dialog / ops panel / recents /
 * `__veloxP13.openFolder`) pins and applies immediately — never re-evaluated
 * retroactively, so an explicit open always shows its folder (seam AC7). The
 * pin dies only when a *newly activated* document lands outside it
 * (`explicitRootAfterActivate`, run on activation transitions). An unfiled
 * activation keeps the pin (it lands "nowhere", not outside).
 *
 * Boot note: there is no mount-time auto-apply. The initial root is
 * established by the explicit channels or by the first activation transition
 * (session restore reopens documents; their activation rebuilds the root).
 * (6F: the old `lastFolderPath` recent-root slot is retired — roots now feed
 * the preferences `recentFolders` list via applyTreeRoot's MRU upsert.)
 */
import { useCallback, useEffect, useRef } from 'react'
import { baseDirOf } from '../pathUtil'

export interface ResolveTreeRootInput {
  /** D1 priority 1: pinned root (explicit open channels). */
  explicitRoot: string | null
  /** D1 priority 2: active document full path (null = untitled/welcome). */
  activePath: string | null
}

/** D1 root priority (6.4a): explicit pin → active document's directory → empty. */
export function resolveTreeRoot(input: ResolveTreeRootInput): string | null {
  if (input.explicitRoot) return input.explicitRoot
  if (input.activePath) return baseDirOf(input.activePath)
  return null
}

/** True when `path` is `root` itself or lives underneath it (boundary-safe). */
export function isPathInside(root: string, path: string): boolean {
  const r = root.replace(/[\\/]+$/, '')
  return path === r || path.startsWith(`${r}\\`) || path.startsWith(`${r}/`)
}

/**
 * D1 pin invalidation — evaluated on activation *changes* only (never at pin
 * time): the pin survives while activations stay inside it and dies when one
 * lands outside. `activePath == null` (untitled/welcome) keeps the pin.
 */
export function explicitRootAfterActivate(
  explicitRoot: string | null,
  activePath: string | null
): string | null {
  if (!explicitRoot) return null
  if (!activePath) return explicitRoot
  return isPathInside(explicitRoot, activePath) ? explicitRoot : null
}

export interface UseTreeRootOpts {
  /** Reactive active-document path (null = untitled/welcome tab). */
  activePath: string | null
  /** Apply a computed root (retarget watcher + session write; mode-neutral). */
  onRootChange: (root: string | null) => void | Promise<void>
}

/**
 * Root-follow controller (composed inside useWorkspaceTree). Owns the explicit
 * pin and emits root transitions to `onRootChange`; the receiving side applies
 * them (single funnel — see useWorkspaceTree.applyTreeRoot).
 */
export function useTreeRoot(opts: UseTreeRootOpts): {
  setExplicitRoot: (root: string) => Promise<void>
} {
  const { activePath } = opts
  const onRootChangeRef = useRef(opts.onRootChange)
  onRootChangeRef.current = opts.onRootChange
  const explicitRootRef = useRef<string | null>(null)
  /** Last root emitted — dedupes follow transitions (explicit pins always emit). */
  const lastEmittedRef = useRef<string | null>(null)
  /** undefined = boot run (no previous activation to transition from). */
  const prevActivePathRef = useRef<string | null | undefined>(undefined)

  /** Explicit channel: pin the root and apply it immediately (awaitable). */
  const setExplicitRoot = useCallback((root: string): Promise<void> => {
    explicitRootRef.current = root
    lastEmittedRef.current = root
    return Promise.resolve(onRootChangeRef.current(root))
  }, [])

  useEffect(() => {
    const prev = prevActivePathRef.current
    prevActivePathRef.current = activePath
    // Boot (and strict-mode effect re-runs): no transition to process — the
    // initial root comes from the explicit channels or the first activation.
    if (prev === undefined || prev === activePath) return
    // D1: pin dies only when a newly-activated document lands outside it.
    explicitRootRef.current = explicitRootAfterActivate(explicitRootRef.current, activePath)
    const root = resolveTreeRoot({
      explicitRoot: explicitRootRef.current,
      activePath
    })
    if (root === lastEmittedRef.current) return
    lastEmittedRef.current = root
    void onRootChangeRef.current(root)
  }, [activePath])

  return { setExplicitRoot }
}
