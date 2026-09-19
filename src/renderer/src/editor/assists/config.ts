import { Compartment, Facet, type EditorState } from '@codemirror/state'
import {
  getPreferences,
  setPreferences,
  type Preferences
} from '../../preferences/store'

/**
 * Editing-assists configuration, injected via a Facet + Compartment.
 *
 * Mirrors the livePreview config pattern (P00-R3). When `enabled` is false
 * the whole assists extension (keymaps, paste handler) is reconfigured out
 * and markdown() drops `addKeymap`/`pasteURLAsLink`, restoring plain CM6
 * behavior. Persisted through the P03 preferences store; the Preferences
 * panel toggles the same fields.
 */
export interface EditingAssistsConfig {
  enabled: boolean
  /** Wrap a bare pasted URL as `<url>` (otherwise paste it as-is). */
  wrapBareUrlOnPaste: boolean
  /** P19: convert text/html clipboard payloads to Markdown on paste. */
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

/** Current config as seen by an editor state. */
export function getEditingAssists(state: EditorState): EditingAssistsConfig {
  return state.facet(editingAssistsConfigFacet)
}

/** Restore persisted config (backed by the P03 preferences store). */
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
