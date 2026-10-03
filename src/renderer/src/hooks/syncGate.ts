/**
 * Signature gate shared by the session-persist sync hooks
 * (useFoldSync / useQuoteFold / useTableWidthSync — STORE §3.2 single
 * write-back funnel, no parallel key/flag families).
 *
 * Why a `forced` flag instead of the old `sigRef.current = ''` force sentinel
 * (IT-02 FE-09 fix): `''` is a *legal* signature — the sorted-join of an empty
 * fold/quote key set. Reusing it as "force the next sync" collided when the
 * restore target had no folds: the gate early-returned and the React mirror
 * (foldedKeys) kept the previous document's folds (ghost Outline folds, ←/→
 * fold direction inverted). Force is therefore an explicit boolean that
 * bypasses the equality check; the equality check itself stays intact for
 * non-forced paths (same signature → early return, anti-write-jitter).
 */

/**
 * Signature of a key set: sorted keys joined by `'\n'`.
 * Empty set → `''` (legal signature — never a force signal).
 */
export function computeSig(keys: Iterable<string>): string {
  return [...keys].sort().join('\n')
}

/**
 * Whether a sync should apply its mirror/write-back:
 * forced re-syncs (restore path) always apply; otherwise only on signature
 * change. `sig === ''` is a normal value here — empty target sets are gated
 * purely by `forced` / change, never by sentinel identity.
 */
export function shouldApplySync(sig: string, lastSig: string, forced: boolean): boolean {
  return forced || sig !== lastSig
}

export interface SigGate {
  /** True → caller must apply (mirror / write-back) for `sig`; false → skip. */
  consume: (sig: string) => boolean
  /** Request the next consume to apply even if the signature is unchanged. */
  forceNext: () => void
}

/** Per-hook-instance gate state (held in a ref; no module-level mutation). */
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
