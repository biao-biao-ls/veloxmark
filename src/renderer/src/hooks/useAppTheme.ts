import { useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import { reconfigureTheme } from '../editor/setup'
import type { ThemeName } from '../editor/theme'
import { clearMermaidCache } from '../editor/mermaid'
import {
  getPreferences,
  setPreferences,
  subscribePreferences,
  type ThemeMode
} from '../preferences/store'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function resolveThemeMode(mode: ThemeMode): ThemeName {
  if (mode !== 'system') return mode
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

export function useAppTheme(viewRef: RefObject<EditorView | null>) {
  const [theme, setTheme] = useState<ThemeName>(() => resolveThemeMode(getPreferences().theme))

  const applyResolved = useCallback(
    (resolved: ThemeName) => {
      setTheme(resolved)
      clearMermaidCache()
      const view = viewRef.current
      if (view) reconfigureTheme(view, resolved)
    },
    [viewRef]
  )

  const storedMode = useSyncExternalStore(subscribePreferences, () => getPreferences().theme)

  useEffect(() => {
    applyResolved(resolveThemeMode(storedMode))
  }, [storedMode, applyResolved])

  useEffect(() => {
    if (storedMode !== 'system') return
    const mql = window.matchMedia(DARK_QUERY)
    const onChange = (): void => applyResolved(mql.matches ? 'dark' : 'light')
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [storedMode, applyResolved])

  const setThemeModePref = useCallback((mode: ThemeMode) => {
    setPreferences({ theme: mode })
  }, [])

  const toggleTheme = useCallback(() => {
    const next = resolveThemeMode(getPreferences().theme) === 'dark' ? 'light' : 'dark'
    setPreferences({ theme: next })
  }, [])

  return { theme, themeMode: storedMode, setThemeMode: setThemeModePref, toggleTheme }
}
