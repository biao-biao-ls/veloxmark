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
  /**
   * P05: bumped by invalidateImageCache() so the decoration StateField
   * rebuilds and ImageWidgets re-resolve their srcs (mtime check / reload).
   */
  imageEpoch: number
  /**
   * P17: bumped after link-existence revalidation (仿 imageEpoch) so the
   * decoration StateField rebuilds and links pick up cm-md-link-broken.
   */
  linkEpoch: number
  /** P08: 'source' disables all live-preview decorations (raw Markdown view). */
  mode: 'live' | 'source'
  /** P08: dim every top-level block the cursor is not in. */
  focusMode: boolean
  /** P08: keep the cursor line vertically centered while editing. */
  typewriterMode: boolean
  /** P24: collapse code blocks longer than N lines (0 = never). Optional —
   *  partial facet literals (nested cell editor) omit these; consumers fall
   *  back to the documented defaults via `??`. */
  codeBlockCollapseLines?: number
  /** P24: show a line-number column inside rendered code blocks. */
  codeBlockShowLineNumbers?: boolean
  /** P24: soft-wrap long lines inside code blocks. */
  codeBlockWrap?: boolean
}

export const DEFAULT_LIVE_PREVIEW_CONFIG: LivePreviewConfig = {
  theme: 'light',
  baseDir: '',
  imageEpoch: 0,
  linkEpoch: 0,
  mode: 'live',
  focusMode: false,
  typewriterMode: false,
  codeBlockCollapseLines: 20,
  codeBlockShowLineNumbers: false,
  codeBlockWrap: true
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
