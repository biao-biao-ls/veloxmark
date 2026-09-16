import { useCallback, useEffect, useState } from 'react'
import { livePreviewConfig } from '../editor/livePreview'
import type { ThemeName } from '../editor/theme'
import { clearMermaidCache } from '../editor/widgets'

function readStoredTheme(): ThemeName {
  const stored = localStorage.getItem('theme')
  return stored === 'dark' ? 'dark' : 'light'
}

/**
 * Theme state + persistence. Editor reconfiguration on change is handled by
 * useDocument (it owns the EditorView); this hook only stores the choice and
 * updates the side-channel config widgets read at decoration-build time.
 */
export function useTheme(): {
  theme: ThemeName
  applyTheme: (next: ThemeName) => void
  toggleTheme: () => void
} {
  const [theme, setTheme] = useState<ThemeName>(readStoredTheme)

  const applyTheme = useCallback((next: ThemeName) => {
    setTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    // Compute outside the updater: side effects inside setState updaters can
    // run twice under StrictMode.
    setTheme((cur) => (cur === 'dark' ? 'light' : 'dark'))
  }, [])

  // Persistence + side-channel config follow the state value, not the toggle,
  // so both applyTheme and toggleTheme share one path.
  useEffect(() => {
    localStorage.setItem('theme', theme)
    livePreviewConfig.theme = theme
    clearMermaidCache()
  }, [theme])

  return { theme, applyTheme, toggleTheme }
}
