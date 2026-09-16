import { Compartment, Facet, type EditorState } from '@codemirror/state'

/**
 * Editing-assists configuration, injected via a Facet + Compartment.
 *
 * Mirrors the livePreview config pattern (P00-R3). When `enabled` is false
 * the whole assists extension (keymaps, paste handler) is reconfigured out
 * and markdown() drops `addKeymap`/`pasteURLAsLink`, restoring plain CM6
 * behavior. P03 will expose this through the preferences UI.
 */
export interface EditingAssistsConfig {
  enabled: boolean
  /** Wrap a bare pasted URL as `<url>` (otherwise paste it as-is). */
  wrapBareUrlOnPaste: boolean
}

export const DEFAULT_EDITING_ASSISTS_CONFIG: EditingAssistsConfig = {
  enabled: true,
  wrapBareUrlOnPaste: true
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

/** Restore persisted config (localStorage, keys match the field names). */
export function readEditingAssistsConfig(): EditingAssistsConfig {
  const read = (key: keyof EditingAssistsConfig): boolean => {
    const stored = localStorage.getItem(key)
    return stored == null ? DEFAULT_EDITING_ASSISTS_CONFIG[key] : stored !== 'false'
  }
  return { enabled: read('enabled'), wrapBareUrlOnPaste: read('wrapBareUrlOnPaste') }
}

export function persistEditingAssistsConfig(patch: Partial<EditingAssistsConfig>): void {
  for (const [key, value] of Object.entries(patch)) {
    localStorage.setItem(key, String(value))
  }
}
