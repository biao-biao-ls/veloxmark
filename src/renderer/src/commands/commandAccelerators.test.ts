/**
 * accel:single-source contract (BE-01, Q6/Q7 rulings).
 *
 * Pins DARWIN_COMMAND_ACCELERATORS against the MENU-menubar §3.3/§3.4 key
 * table and guards that electron/menu/darwin.ts carries no handwritten
 * accelerator literals — every native-menu chord derives from the single
 * source map (AC-RULE-11).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DARWIN_COMMAND_ACCELERATORS } from '../../../../electron/shared/commandAccelerators'

describe('DARWIN_COMMAND_ACCELERATORS single-source contract (Q6/Q7)', () => {
  it('Q6: toggleTheme has no native accelerator (chord owned by reopenClosedTab)', () => {
    expect(DARWIN_COMMAND_ACCELERATORS.toggleTheme).toBeUndefined()
  })

  it('Q7: zoom/devtools chords match the MENU-menubar key table', () => {
    expect(DARWIN_COMMAND_ACCELERATORS.zoomIn).toBe('Cmd+Plus')
    expect(DARWIN_COMMAND_ACCELERATORS.zoomOut).toBe('Cmd+-')
    expect(DARWIN_COMMAND_ACCELERATORS.zoomReset).toBe('Cmd+0')
    expect(DARWIN_COMMAND_ACCELERATORS.toggleDevTools).toBe('Cmd+Alt+I')
  })

  it('darwin.ts has no handwritten accelerator literals (all chords single-source)', () => {
    const src = readFileSync(
      new URL('../../../../electron/menu/darwin.ts', import.meta.url),
      'utf8'
    )
    expect(src).not.toMatch(/accelerator:\s*['"`]/)
  })
})
