/**
 * UX-P04 F7: e2e seam for the native save dialog.
 *
 * `window.api` arrives through contextBridge and is frozen — probes can never
 * patch `showSaveDialog`, and a real native modal wedges CDP. This module is
 * the product-side indirection (same pattern as Dialog.tsx's
 * `veloxE2eDialogAuto`): every renderer save-dialog call routes through
 * `showSaveDialog()` here. When the seam is off (default) the call is a
 * transparent pass-through to `window.api.showSaveDialog`.
 *
 * Seam state:
 *  - `window.__veloxP04.setSaveTarget(path | null)` — in-memory override
 *    (`null` = canned Cancel; string = canned target path).
 *  - `undefined` (or `setSaveTarget(undefined)`) clears the seam.
 *  - `localStorage['veloxE2eSaveDialog'] = JSON.stringify({ target })`
 *    provides SIGKILL-surviving pinning, mirroring the dialog seam key.
 *
 * Every canned call is recorded (`{ defaultPath, filters }`) so probes can
 * assert default-filename derivation; read + drain via
 * `window.__veloxP04.saveCalls()`.
 */

export interface SaveDialogCall {
  defaultPath: string
  filters?: { name: string; extensions: string[] }[] | undefined
}

const AUTO_KEY = 'veloxE2eSaveDialog'

interface SeamState {
  target: string | null
  calls: SaveDialogCall[]
}

let seam: SeamState | null = null

function readAutoTarget(): string | null | undefined {
  if (seam) return seam.target
  try {
    const raw = localStorage.getItem(AUTO_KEY)
    if (raw == null) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'target' in parsed) {
      return (parsed as { target: string | null }).target
    }
    return undefined
  } catch {
    return undefined
  }
}

/** `undefined` clears the seam; `null` cancels; a string is the canned path. */
export function setSaveDialogAuto(target: string | null | undefined): void {
  if (target === undefined) {
    seam = null
    try {
      localStorage.removeItem(AUTO_KEY)
    } catch {
      /* storage unavailable — memory clear is enough */
    }
    return
  }
  seam = { target, calls: [] }
  try {
    localStorage.setItem(AUTO_KEY, JSON.stringify({ target }))
  } catch {
    /* storage unavailable — memory override still works */
  }
}

export function takeSaveDialogCalls(): SaveDialogCall[] {
  return seam ? seam.calls.splice(0, seam.calls.length) : []
}

export async function showSaveDialog(
  defaultPath?: string,
  filters?: { name: string; extensions: string[] }[]
): Promise<string | null> {
  const auto = readAutoTarget()
  if (auto !== undefined) {
    seam?.calls.push({ defaultPath: defaultPath ?? '', filters })
    return auto
  }
  return window.api.showSaveDialog(defaultPath, filters)
}
