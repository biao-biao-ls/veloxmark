/**
 * e2e seam wiring (task 1A split, docs/specs/1A-split-app).
 *
 * Module side effect: every probe handle starts null so external drivers can
 * tell "not installed yet" from a stale handle (moved verbatim from App.tsx
 * module scope — still runs at import, before first render).
 *
 * `useE2eSeams` is App's single assembly entry for the pure P13–P29 seams.
 * Two handles stay wired elsewhere on purpose:
 *  - `__veloxP12` installs from the close-query effect in App.tsx (that
 *    effect mixes the handle with the product's `onQueryClose` subscription)
 *  - `__veloxEditor` is assigned by the create-editor effect (editor
 *    lifecycle, not a seam)
 *
 * Hook call order mirrors the original App.tsx effect order; each usePXXSeam
 * keeps its original dep array verbatim, so handle rebuild timing is
 * unchanged. Contract: e2e/handles.d.ts.
 */
import { useP13Seam, type P13Deps } from './p13'
import { useP14Seam, type P14Deps } from './p14'
import { useP15Seam } from './p15'
import { useP16Seam, type P16Deps } from './p16'
import { useP17Seam, type P17Deps } from './p17'
import { useP18Seam, type P18Deps } from './p18'
import { useP19Seam, type P19Deps } from './p19'
import { useP20Seam, type P20Deps } from './p20'
import { useP21Seam, type P21Deps } from './p21'
import { useP22Seam, type P22Deps } from './p22'
import { useP23Seam, type P23Deps } from './p23'
import { useP24P29Seam, type P24P29Deps } from './p24-p29'
import { useP25Seam, type P25Deps } from './p25'
import { useP26Seam, type P26Deps } from './p26'

window.__veloxEditor = null
window.__veloxP12 = null
window.__veloxP13 = null
window.__veloxP14 = null
window.__veloxP15 = null
window.__veloxP16 = null
window.__veloxP17 = null
window.__veloxP18 = null
window.__veloxP19 = null
window.__veloxP20 = null
window.__veloxP21 = null
window.__veloxP22 = null
window.__veloxP23 = null
window.__veloxP24 = null
window.__veloxP25 = null
window.__veloxP26 = null
window.__veloxP28 = null
window.__veloxP29 = null

export interface E2eSeamDeps
  extends P13Deps,
    P14Deps,
    P16Deps,
    P17Deps,
    P18Deps,
    P19Deps,
    P20Deps,
    P21Deps,
    P22Deps,
    P23Deps,
    P24P29Deps,
    P25Deps,
    P26Deps {}

/** Install the P13–P29 probe handles (see file header for P12/P15 notes). */
export function useE2eSeams(deps: E2eSeamDeps): void {
  useP14Seam(deps)
  useP15Seam()
  useP13Seam(deps)
  useP16Seam(deps)
  useP21Seam(deps)
  useP22Seam(deps)
  useP23Seam(deps)
  useP24P29Seam(deps)
  useP25Seam(deps)
  useP26Seam(deps)
  useP17Seam(deps)
  useP18Seam(deps)
  useP19Seam(deps)
  useP20Seam(deps)
}
