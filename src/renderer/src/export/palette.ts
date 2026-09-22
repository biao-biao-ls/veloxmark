/**
 * Shared export palette tokens (P20).
 *
 * Single source for the visual values duplicated between `exportCss.ts`
 * (class-based export stylesheet) and `inlineStyles.ts` (rich-text clipboard
 * style attributes). Keep in sync with `.theme-light` / `.theme-dark` in
 * renderer styles.css — same rule exportCss always followed.
 */

export type PaletteToken =
  | 'bg'
  | 'bgAlt'
  | 'fg'
  | 'fgDim'
  | 'border'
  | 'accent'
  | 'quoteBorder'
  | 'codeBg'
  | 'hrColor'
  | 'highlightBg'

export type Palette = Record<PaletteToken, string>

export const LIGHT_PALETTE: Palette = {
  bg: '#ffffff',
  bgAlt: '#fafafa',
  fg: '#333333',
  // wave⑥-5 P20-F2: synced to styles.css `.theme-light --fg-dim` (F04 AA lift).
  fgDim: '#6b6b6b',
  border: '#e5e5e5',
  accent: '#0969da',
  quoteBorder: '#d0d7de',
  codeBg: 'rgba(175, 184, 193, 0.2)',
  hrColor: '#d8dee4',
  highlightBg: '#fff8c5'
}

export const DARK_PALETTE: Palette = {
  bg: '#1e1e1e',
  bgAlt: '#252526',
  fg: '#d4d4d4',
  // wave⑥-5 P20-F2: synced to styles.css `.theme-dark --fg-dim` (F04 AA lift).
  fgDim: '#9a9a9a',
  border: '#333333',
  accent: '#58a6ff',
  quoteBorder: '#444444',
  codeBg: 'rgba(110, 118, 129, 0.25)',
  hrColor: '#444444',
  // wave⑥-5 P20-F2: synced to styles.css `.theme-dark --highlight-bg`
  // (P11-F3 opaque solid — rgba form was ~2.3:1 vs fg in AA math).
  highlightBg: '#654a15'
}

export function paletteFor(theme: 'light' | 'dark'): Palette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE
}

/** `--token-name: value;` lines for a `.export-theme-*` rule body. */
export function paletteToCssVars(p: Palette): string {
  return (
    Object.entries(p) as [string, string][]
  )
    .map(([k, v]) => {
      const cssName = '--' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
      return `  ${cssName}: ${v};`
    })
    .join('\n')
}
