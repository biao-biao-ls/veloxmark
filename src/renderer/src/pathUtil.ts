
export function baseDirOf(path: string): string {
  return path.replace(/[\\/][^\\/]*$/, '')
}

export function baseNameOf(path: string): string {
  return path.replace(/^.*[\\/]/, '')
}

export function pathKey(path: string): string {
  return path.replace(/\\/g, '/')
}

export function pathsEqual(a: string, b: string): boolean {
  return pathKey(a) === pathKey(b)
}
