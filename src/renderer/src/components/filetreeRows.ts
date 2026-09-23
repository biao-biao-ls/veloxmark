/**
 * 6C tree flatten (tasks 6.5/6.6) — visible-row computation, pure.
 *
 * Expansion model (D1/D2):
 * - default is COLLAPSED (user `expanded` overrides only — no size heuristic);
 * - `revealDirs` (strict ancestors of the active file) are default-open so the
 *   active row is reachable, but this is *derived* visibility — it never
 *   writes the user's `expanded` state (AC3: manual expand/collapse is never
 *   reverted by reveal);
 * - `renameDirs` (strict ancestors of an inline-rename target) force open even
 *   over a user collapse — the rename entry must be reachable (UX-P07-F4).
 */
import type { DirNode } from '../../../../electron/shared/api'
import { baseDirOf } from '../pathUtil'

export interface FlatRow {
  node: DirNode
  depth: number
  /** Dir rows: effective open state (rename force > user override > reveal). */
  open: boolean
}

export interface VisibleRowsOpts {
  /** User expansion overrides; an absent key means "untouched". */
  expanded: Record<string, boolean>
  /** 6C D2: strict-ancestor dirs of the reveal target (active file). */
  revealDirs?: ReadonlySet<string>
  /** UX-P07-F4: strict-ancestor dirs of an inline-rename target. */
  renameDirs?: ReadonlySet<string>
}

/**
 * Strict-ancestor directory paths of `path` (never includes `path` itself) —
 * the reveal chain of an active file, or the force-open chain of a rename
 * target. Extra prefixes outside the current tree are harmless (no node
 * matches them).
 */
export function ancestorDirPaths(path: string | null): Set<string> {
  const out = new Set<string>()
  if (!path) return out
  let dir = baseDirOf(path)
  // `dir !== path` guards separator-less inputs (baseDirOf is a no-op there).
  while (dir && dir !== path && !out.has(dir)) {
    out.add(dir)
    const parent = baseDirOf(dir)
    if (parent === dir) break
    dir = parent
  }
  return out
}

/** Effective open state for one dir node (see module header for precedence). */
export function isDirOpen(path: string, opts: VisibleRowsOpts): boolean {
  if (opts.renameDirs?.has(path)) return true
  const user = opts.expanded[path]
  if (user !== undefined) return user
  return opts.revealDirs?.has(path) ?? false
}

/**
 * Depth-first flattening of the tree into the rows the nav renders.
 * Only open dirs contribute children (root level is always fully listed).
 */
export function visibleRows(nodes: DirNode[], opts: VisibleRowsOpts): FlatRow[] {
  const out: FlatRow[] = []
  const walk = (list: DirNode[], depth: number): void => {
    for (const node of list) {
      const open = node.isDir && isDirOpen(node.path, opts)
      out.push({ node, depth, open })
      if (open && node.children) walk(node.children, depth + 1)
    }
  }
  walk(nodes, 0)
  return out
}
