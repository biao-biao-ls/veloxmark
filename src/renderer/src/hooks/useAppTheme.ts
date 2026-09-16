import { useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import { reconfigureTheme } from '../editor/setup'
import type { ThemeName } from '../editor/theme'
import { clearMermaidCache } from '../editor/widgets'
import {
  getPreferences,
  setPreferences,
  subscribePreferences,
  type ThemeMode
} from '../preferences/store'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** 'system' resolves to the OS setting; light/dark resolve to themselves. */
export function resolveThemeMode(mode: ThemeMode): ThemeName {
  if (mode !== 'system') return mode
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

/**
 * Theme state, persistence (P03 preferences store) and the decoration/editor
 * reconfigure chain.
 *
 * The store is the single source of truth: this hook subscribes to it, so a
 * change made anywhere (toggle command, Preferences panel, migration) is
 * picked up and pushed into the editor. `theme` is the resolved light/dark
 * actually rendered; `themeMode` is the user setting, which may be 'system'.
 */
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

  // Subscribe to the store so setPreferences({ theme }) — from the toggle
  // command, the Preferences panel or a migration — re-renders us, then push
  // the newly resolved theme into the editor.
  const storedMode = useSyncExternalStore(subscribePreferences, () => getPreferences().theme)

  useEffect(() => {
    applyResolved(resolveThemeMode(storedMode))
  }, [storedMode, applyResolved])

  // 'system' follows OS changes live while it is the active mode.
  useEffect(() => {
    if (storedMode !== 'system') return
    const mql = window.matchMedia(DARK_QUERY)
    const onChange = (): void => applyResolved(mql.matches ? 'dark' : 'light')
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [storedMode, applyResolved])

  /** Set any mode including 'system'. */
  const setThemeModePref = useCallback((mode: ThemeMode) => {
    setPreferences({ theme: mode })
  }, [])

  /** Toggle between the two explicit modes (skips 'system'). */
  const toggleTheme = useCallback(() => {
    const next = resolveThemeMode(getPreferences().theme) === 'dark' ? 'light' : 'dark'
    setPreferences({ theme: next })
  }, [])

  return { theme, themeMode: storedMode, setThemeMode: setThemeModePref, toggleTheme }
}
