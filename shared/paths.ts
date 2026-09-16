/**
 * Path string helpers for the renderer (no node:path available there).
 * Pure string ops that treat both '/' and '\\' as separators where possible;
 * joining uses the platform separator.
 */

/** Directory part: strip the last segment. `dirnameOf('/a/b/c.md')` → '/a/b'. */
export function dirnameOf(filePath: string): string {
  return filePath.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]*$/, '')
}

/** Last segment. `basenameOf('/a/b/c.md')` → 'c.md'. */
export function basenameOf(filePath: string): string {
  return filePath.replace(/^.*[\\/]/, '')
}

/** Join a directory and a name with the platform separator. */
export function joinPath(dir: string, name: string, platform: string): string {
  const sep = platform === 'win32' ? '\\' : '/'
  return dir.replace(/[\\/]+$/, '') + sep + name
}

/** Swap the last segment for `newName`, preserving the original separator. */
export function replaceBasename(filePath: string, newName: string): string {
  const i = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return i >= 0 ? filePath.slice(0, i + 1) + newName : newName
}

/** True when `child` lies strictly inside the directory `parent`. */
export function isUnderPath(child: string, parent: string, platform: string): boolean {
  const sep = platform === 'win32' ? '\\' : '/'
  return child.startsWith(parent.replace(/[\\/]+$/, '') + sep)
}

/**
 * Re-root `child` from under `oldRoot` to under `newRoot` (used when a folder
 * containing the open file is renamed).
 */
export function rebaseUnder(child: string, oldRoot: string, newRoot: string): string {
  return newRoot + child.slice(oldRoot.length)
}
