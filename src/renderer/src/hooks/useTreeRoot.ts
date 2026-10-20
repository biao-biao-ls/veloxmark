import { useCallback, useEffect, useRef } from 'react'
import { baseDirOf } from '../pathUtil'

export interface ResolveTreeRootInput {
  explicitRoot: string | null
  activePath: string | null
}

export function resolveTreeRoot(input: ResolveTreeRootInput): string | null {
  if (input.explicitRoot) return input.explicitRoot
  if (input.activePath) return baseDirOf(input.activePath)
  return null
}

export function isPathInside(root: string, path: string): boolean {
  const r = root.replace(/[\\/]+$/, '')
  return path === r || path.startsWith(`${r}\\`) || path.startsWith(`${r}/`)
}

export function explicitRootAfterActivate(
  explicitRoot: string | null,
  activePath: string | null
): string | null {
  if (!explicitRoot) return null
  if (!activePath) return explicitRoot
  return isPathInside(explicitRoot, activePath) ? explicitRoot : null
}

export interface UseTreeRootOpts {
  activePath: string | null
  onRootChange: (root: string | null) => void | Promise<void>
}

export function useTreeRoot(opts: UseTreeRootOpts): {
  setExplicitRoot: (root: string) => Promise<void>
} {
  const { activePath } = opts
  const onRootChangeRef = useRef(opts.onRootChange)
  onRootChangeRef.current = opts.onRootChange
  const explicitRootRef = useRef<string | null>(null)
  const lastEmittedRef = useRef<string | null>(null)
  const prevActivePathRef = useRef<string | null | undefined>(undefined)

  const setExplicitRoot = useCallback((root: string): Promise<void> => {
    explicitRootRef.current = root
    lastEmittedRef.current = root
    return Promise.resolve(onRootChangeRef.current(root))
  }, [])

  useEffect(() => {
    const prev = prevActivePathRef.current
    prevActivePathRef.current = activePath
    if (prev === undefined || prev === activePath) return
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
