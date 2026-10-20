import { Compartment, Facet, type EditorState } from '@codemirror/state'
import {
  getPreferences,
  setPreferences,
  type Preferences
} from '../../preferences/store'

export interface EditingAssistsConfig {
  enabled: boolean
  wrapBareUrlOnPaste: boolean
  pasteHtmlToMd: boolean
}

export const DEFAULT_EDITING_ASSISTS_CONFIG: EditingAssistsConfig = {
  enabled: true,
  wrapBareUrlOnPaste: true,
  pasteHtmlToMd: true
}

export const editingAssistsConfigFacet = Facet.define<EditingAssistsConfig, EditingAssistsConfig>(
  {
    combine: (values) => values[0] ?? DEFAULT_EDITING_ASSISTS_CONFIG
  }
)

export const editingAssistsCompartment = new Compartment()

export function getEditingAssists(state: EditorState): EditingAssistsConfig {
  return state.facet(editingAssistsConfigFacet)
}

export function readEditingAssistsConfig(): EditingAssistsConfig {
  const prefs = getPreferences()
  return {
    enabled: prefs.typingAssistsEnabled,
    wrapBareUrlOnPaste: prefs.wrapBareUrlOnPaste,
    pasteHtmlToMd: prefs.pasteHtmlToMd
  }
}

export function persistEditingAssistsConfig(patch: Partial<EditingAssistsConfig>): void {
  const next: Partial<Preferences> = {}
  if (patch.enabled != null) next.typingAssistsEnabled = patch.enabled
  if (patch.wrapBareUrlOnPaste != null) next.wrapBareUrlOnPaste = patch.wrapBareUrlOnPaste
  if (patch.pasteHtmlToMd != null) next.pasteHtmlToMd = patch.pasteHtmlToMd
  setPreferences(next)
}
