import { Compartment, Facet, type EditorState } from '@codemirror/state'
import type { ThemeName } from '../theme'

export interface LivePreviewConfig {
  theme: ThemeName
  baseDir: string
  imageEpoch: number
  linkEpoch: number
  i18nEpoch?: number
  mode: 'live' | 'source'
  focusMode: boolean
  typewriterMode: boolean
  codeBlockCollapseLines?: number
  codeBlockShowLineNumbers?: boolean
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

export function livePreviewConfigExtension(config: LivePreviewConfig) {
  return livePreviewConfigCompartment.of(livePreviewConfigFacet.of(config))
}

export function getLivePreviewConfig(state: EditorState): LivePreviewConfig {
  return state.facet(livePreviewConfigFacet)
}
