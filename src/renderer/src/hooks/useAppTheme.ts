import { useCallback, useState, type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import { livePreviewConfig } from '../editor/livePreview'
import { reconfigureTheme } from '../editor/setup'
import type { ThemeName } from '../editor/theme'
import { clearMermaidCache } from '../editor/widgets'

function readStoredTheme(): ThemeName {
  const stored = localStorage.getItem('theme')
  return stored === 'dark' ? 'dark' : 'light'
}

/** Theme state, persistence and the decoration/editor reconfigure chain. */
export function useAppTheme(viewRef: RefObject<EditorView | null>) {
  const [theme, setTheme] = useState<ThemeName>(readStoredTheme)

  const applyTheme = useCallback(
    (next: ThemeName) => {
      setTheme(next)
      localStorage.setItem('theme', next)
      livePreviewConfig.theme = next
      clearMermaidCache()
      const view = viewRef.current
      if (view) reconfigureTheme(view, next)
    },
    [viewRef]
  )

  return { theme, applyTheme }
}
