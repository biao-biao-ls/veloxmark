import { describe, expect, it } from 'vitest'
import {
  DARK_PALETTE,
  LIGHT_PALETTE,
  paletteFor,
  paletteToCssVars
} from './palette'
import { classStyles, tagStyles } from './inlineStyles'

describe('export palette (P20)', () => {
  it('exposes distinct light/dark tokens', () => {
    expect(paletteFor('light')).toBe(LIGHT_PALETTE)
    expect(paletteFor('dark')).toBe(DARK_PALETTE)
    expect(LIGHT_PALETTE.bg).toBe('#ffffff')
    expect(DARK_PALETTE.bg).toBe('#1e1e1e')
    expect(LIGHT_PALETTE.accent).not.toBe(DARK_PALETTE.accent)
  })

  it('renders kebab-case CSS variables matching exportCss names', () => {
    const css = paletteToCssVars(LIGHT_PALETTE)
    expect(css).toContain('--bg: #ffffff;')
    expect(css).toContain('--bg-alt: #fafafa;')
    // wave⑥-5 P20-F2: palette stays synced to styles.css `.theme-light` tokens.
    expect(css).toContain('--fg-dim: #6b6b6b;')
    expect(css).toContain('--quote-border: #d0d7de;')
    expect(css).toContain('--code-bg: rgba(175, 184, 193, 0.2);')
    expect(css).toContain('--highlight-bg: #fff8c5;')
  })

  it('wave⑥-5: dark palette synced to styles.css .theme-dark (F04/P11-F3)', () => {
    const css = paletteToCssVars(DARK_PALETTE)
    expect(css).toContain('--fg-dim: #9a9a9a;')
    expect(css).toContain('--highlight-bg: #654a15;')
  })
})

describe('inline style maps (P20)', () => {
  it('covers the acceptance-critical tags with palette colors', () => {
    const light = tagStyles(LIGHT_PALETTE)
    for (const tag of ['h1', 'h2', 'p', 'strong', 'code', 'blockquote', 'table', 'th', 'td', 'a', 'pre']) {
      expect(light[tag], tag).toBeTruthy()
    }
    expect(light.strong).toContain('font-weight:700')
    expect(light.blockquote).toContain(LIGHT_PALETTE.quoteBorder)
    expect(light.th).toContain(LIGHT_PALETTE.border)
    expect(light.code).toContain(LIGHT_PALETTE.codeBg)
    expect(light.a).toContain(LIGHT_PALETTE.accent)
  })

  it('dark theme map carries dark token values', () => {
    const dark = tagStyles(DARK_PALETTE)
    expect(dark.blockquote).toContain(DARK_PALETTE.quoteBorder)
    expect(dark.a).toContain(DARK_PALETTE.accent)
    expect(dark.pre).toContain(DARK_PALETTE.bgAlt)
  })

  it('class styles cover renderDoc helper classes', () => {
    const cls = classStyles(LIGHT_PALETTE)
    for (const name of ['export-code-lang', 'export-mermaid-error', 'export-mark', 'export-footnotes']) {
      expect(cls[name], name).toBeTruthy()
    }
  })
})
