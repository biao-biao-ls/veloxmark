
export function computeSig(keys: Iterable<string>): string {
  return [...keys].sort().join('\n')
}

export function shouldApplySync(sig: string, lastSig: string, forced: boolean): boolean {
  return forced || sig !== lastSig
}

export interface SigGate {
  consume: (sig: string) => boolean
  forceNext: () => void
}

export function createSigGate(): SigGate {
  let lastSig = ''
  let forced = false
  return {
    consume(sig: string): boolean {
      if (!shouldApplySync(sig, lastSig, forced)) return false
      forced = false
      lastSig = sig
      return true
    },
    forceNext(): void {
      forced = true
    }
  }
}
