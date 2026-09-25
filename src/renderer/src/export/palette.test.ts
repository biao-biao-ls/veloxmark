/**
 * Theme-color sync guard (task 1C, docs/specs/1C-theme-palette).
 *
 * palette.ts is the single source of truth for theme color VALUES. Runtime
 * CSS (`../styles/themes.css`, `../styles/markdown.css`) cannot consume TS at
 * runtime, so it is hand-synced — these assertions read the actual CSS files
 * and fail on any drift, naming each mismatching line so the fix is a lookup,
 * not a hunt. Change flow: edit palette.ts → run this test → sync the flagged
 * CSS lines.
 *
 * Also pins the generated export surfaces (EXPORT_DOC_CSS / classStyles) to
 * the palette values byte-for-byte per rule line — the refactor-equivalence
 * check that literal hexes never crept back into the generators.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DARK_CALLOUTS,
  DARK_PALETTE,
  LIGHT_CALLOUTS,
  LIGHT_PALETTE,
  RUNTIME_CSS_VAR,
  type CalloutColors,
  type Palette,
  type PaletteToken
} from './palette'
import { EXPORT_DOC_CSS } from './exportCss'
import { classStyles, tagStyles } from './inlineStyles'

function styleSource(name: 'themes' | 'markdown'): string {
  return readFileSync(
    fileURLToPath(new URL(`../styles/${name}.css`, import.meta.url)),
    'utf8'
  )
}

/** Body of `selector { … }` — first top-level block only. */
function blockBody(css: string, selector: string): string {
  const m = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([\\s\\S]*?)\\n\\}`))
  if (!m) throw new Error(`no ${selector} block found in CSS`)
  return m[1]
}

function declValue(body: string, customProp: string): string {
  const m = body.match(new RegExp(`${customProp}:\\s*([^;]+);`))
  if (!m) throw new Error(`no ${customProp} declaration found`)
  return m[1].trim()
}

const CALLOUT_TYPES = Object.keys(LIGHT_CALLOUTS) as (keyof CalloutColors)[]

describe('palette ↔ runtime CSS (hand-synced, test-guarded)', () => {
  const themes = styleSource('themes')

  it.each([
    ['light', LIGHT_PALETTE, 'theme-light'],
    ['dark', DARK_PALETTE, 'theme-dark']
  ] as const)('%s theme block declares every palette token value', (_theme, p, selector) => {
    const body = blockBody(themes, `.${selector}`)
    for (const key of Object.keys(RUNTIME_CSS_VAR) as PaletteToken[]) {
      expect(declValue(body, RUNTIME_CSS_VAR[key]), `${selector} ${RUNTIME_CSS_VAR[key]}`).toBe(p[key])
    }
  })

  it('RUNTIME_CSS_VAR maps every PaletteToken exactly once', () => {
    expect(Object.keys(RUNTIME_CSS_VAR).sort()).toEqual(Object.keys(LIGHT_PALETTE).sort())
  })

  const markdown = styleSource('markdown')

  it.each([
    ['light', LIGHT_CALLOUTS, 'theme-light'],
    ['dark', DARK_CALLOUTS, 'theme-dark']
  ] as const)('%s callout rules match palette callouts', (_theme, co, selector) => {
    const re = new RegExp(
      `\\.${selector} \\.cm-md-callout-(\\w+) \\{ --co-bar: ([^;]+); --co-bg: ([^;]+); \\}`,
      'g'
    )
    const found = [...markdown.matchAll(re)]
    const names = found.map((m) => m[1]).sort()
    expect(names).toEqual([...CALLOUT_TYPES].sort())
    for (const [, name, bar, bg] of found) {
      expect(bar, `${selector} ${name} bar`).toBe(co[name as keyof CalloutColors][0])
      expect(bg, `${selector} ${name} bg`).toBe(co[name as keyof CalloutColors][1])
    }
  })
})

describe('generated export surfaces pin to palette (byte-level rule lines)', () => {
  it('EXPORT_DOC_CSS callout rules are palette-generated', () => {
    for (const [prefix, co] of [
      ['.export-doc', LIGHT_CALLOUTS],
      ['.export-theme-dark', DARK_CALLOUTS]
    ] as const) {
      for (const name of CALLOUT_TYPES) {
        expect(EXPORT_DOC_CSS).toContain(
          `${prefix} .export-callout-${name} { --co-bar: ${co[name][0]}; --co-bg: ${co[name][1]}; }`
        )
      }
    }
  })

  it('classStyles callout styles carry the palette tuple values', () => {
    for (const [p, co] of [
      [LIGHT_PALETTE, LIGHT_CALLOUTS],
      [DARK_PALETTE, DARK_CALLOUTS]
    ] as const) {
      const cls = classStyles(p)
      for (const name of CALLOUT_TYPES) {
        expect(cls[`export-callout-${name}`], `${name} bar`).toContain(co[name][0])
        expect(cls[`export-callout-${name}`], `${name} bg`).toContain(co[name][1])
      }
    }
  })

  // 7H: table surfaces consume the palette table tokens — th/zebra no longer
  // borrow --bg-alt (which left export th and zebra indistinguishable).
  it('EXPORT_DOC_CSS table rules consume the table tokens', () => {
    expect(EXPORT_DOC_CSS).toContain('background: var(--table-header-bg);')
    expect(EXPORT_DOC_CSS).toContain('background: var(--table-stripe-bg);')
  })

  it('tagStyles th carries the table header token value', () => {
    for (const p of [LIGHT_PALETTE, DARK_PALETTE] as const) {
      expect(tagStyles(p).th, 'th bg').toContain(p.tableHeaderBg)
    }
  })
})
