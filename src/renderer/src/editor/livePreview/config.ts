import { Compartment, Facet, type EditorState } from '@codemirror/state'
import type { ThemeName } from '../theme'

/**
 * Live-preview configuration, injected via a Facet + Compartment.
 *
 * Replaces the old module-level mutable `livePreviewConfig` object: the App
 * updates theme/baseDir through Compartment reconfigure, and the decoration
 * StateField rebuilds when it sees the facet value change — no manual
 * global mutation + forceRefresh dance.
 */
export interface LivePreviewConfig {
  theme: ThemeName
  baseDir: string
}

export const DEFAULT_LIVE_PREVIEW_CONFIG: LivePreviewConfig = {
  theme: 'light',
  baseDir: ''
}

export const livePreviewConfigFacet = Facet.define<LivePreviewConfig, LivePreviewConfig>({
  combine: (values) => values[0] ?? DEFAULT_LIVE_PREVIEW_CONFIG
})

export const livePreviewConfigCompartment = new Compartment()

/** Initial extension — placed inside the config compartment at editor creation. */
export function livePreviewConfigExtension(config: LivePreviewConfig) {
  return livePreviewConfigCompartment.of(livePreviewConfigFacet.of(config))
}

/** Current config as seen by an editor state. */
export function getLivePreviewConfig(state: EditorState): LivePreviewConfig {
  return state.facet(livePreviewConfigFacet)
}
