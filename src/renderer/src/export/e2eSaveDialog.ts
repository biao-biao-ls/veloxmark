
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

export function setSaveDialogAuto(target: string | null | undefined): void {
  if (target === undefined) {
    seam = null
    try {
      localStorage.removeItem(AUTO_KEY)
    } catch {
    }
    return
  }
  seam = { target, calls: [] }
  try {
    localStorage.setItem(AUTO_KEY, JSON.stringify({ target }))
  } catch {
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
