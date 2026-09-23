/**
 * Cross-platform path display helpers (task 3.2) — single source for the
 * basename/dirname string ops that were previously hand-inlined in App.tsx,
 * hooks/useFileOps.ts and hooks/useExport.ts.
 *
 * These are display/baseDir helpers for the renderer only (no Node `path`):
 * both separators are honored so Windows paths behave like POSIX ones.
 * Note App's getBaseDir keeps a trailing-separator variant on purpose —
 * see App.tsx `getBaseDir` (not equivalent to `baseDirOf`, kept separate).
 */

/** Directory of `path` (no trailing separator). */
export function baseDirOf(path: string): string {
  return path.replace(/[\\/][^\\/]*$/, '')
}

/** Final path segment of `path`. */
export function baseNameOf(path: string): string {
  return path.replace(/^.*[\\/]/, '')
}
