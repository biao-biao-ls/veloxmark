/**
 * Shared export palette tokens (P20) — the single source of truth for theme
 * color VALUES (task 1C).
 *
 * Consumers:
 * - `exportCss.ts` (class-based export stylesheet) and `inlineStyles.ts`
 *   (rich-text clipboard style attributes) generate from here — never
 *   hand-write these hex values in those files.
 * - Runtime CSS (`styles/themes.css`, `styles/markdown.css`) is hand-synced
 *   and guarded by `palette.test.ts`, which reads both files and fails when
 *   any value drifts from this module. Flow for a color change: edit here →
 *   run `palette.test.ts` → sync the flagged CSS lines.
 *
 * Theme class correspondence: export root `.export-theme-light` /
 * `.export-theme-dark` pair with the app's `.theme-light` / `.theme-dark`.
 *
 * hljs token colors are NOT here: they come from upstream
 * `highlight.js/styles/github[-dark].css`, scoped under the theme class by
 * `editor/widgets.ts` (editor) and `export/buildDocument.ts` (export) — see
 * `editor/livePreview/hljsTokens.ts` for the class-vocabulary contract.
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
  // 7H: table content surfaces (F02 hierarchy — header deeper than zebra).
  | 'tableHeaderBg'
  | 'tableStripeBg'

export type Palette = Record<PaletteToken, string>

/**
 * Palette key → the custom property name used in runtime CSS
 * (`styles/themes.css`). Export CSS derives its own kebab name from the key
 * (`paletteToCssVars`), which collides for `bgAlt`: export says `--bg-alt`,
 * runtime says `--bg-sidebar` (same value, different name). This table is
 * the documented mapping — `palette.test.ts` consumes it.
 */
export const RUNTIME_CSS_VAR: Record<PaletteToken, string> = {
  bg: '--bg',
  bgAlt: '--bg-sidebar',
  fg: '--fg',
  fgDim: '--fg-dim',
  border: '--border',
  accent: '--accent',
  quoteBorder: '--quote-border',
  codeBg: '--code-bg',
  hrColor: '--hr-color',
  highlightBg: '--highlight-bg',
  // 7H: kebab names match paletteToCssVars derivation — no collision here.
  tableHeaderBg: '--table-header-bg',
  tableStripeBg: '--table-stripe-bg'
}

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
  highlightBg: '#fff8c5',
  // 7H: header band lightened to the Typora baseline (#f0f0f0, was #e8e8e8) —
  // still clearly deeper than the zebra stripe (F02 hierarchy).
  tableHeaderBg: '#f0f0f0',
  tableStripeBg: '#f6f6f6'
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
  highlightBg: '#654a15',
  // 7H: values moved from themes.css unchanged (no dark baseline — untuned).
  tableHeaderBg: '#2d2d2e',
  tableStripeBg: '#252526'
}

export function paletteFor(theme: 'light' | 'dark'): Palette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE
}

// ---- P21 callout colors (shared by live preview markdown.css, exportCss.ts
// and inlineStyles.ts — markdown.css is hand-synced + test-guarded). ----------

export type CalloutType =
  | 'note'
  | 'tip'
  | 'important'
  | 'warning'
  | 'caution'
  | 'info'
  | 'success'
  | 'danger'

/** `[bar, bg]` — bar doubles as the head icon color (`color: var(--co-bar)`). */
export type CalloutColors = Record<CalloutType, readonly [bar: string, bg: string]>

export const LIGHT_CALLOUTS: CalloutColors = {
  note: ['#0969da', '#f0f6fc'],
  tip: ['#1a7f37', '#eef8f2'],
  important: ['#8250df', '#f5e9f7'],
  warning: ['#9a6700', '#fff6e0'],
  caution: ['#cf222e', '#fff0ee'],
  info: ['#0a7ea4', '#e7f3ff'],
  success: ['#1a7f37', '#e6f6ec'],
  danger: ['#cf222e', '#ffebe9']
}

export const DARK_CALLOUTS: CalloutColors = {
  note: ['#4493f8', '#1c2b3a'],
  tip: ['#3fb950', '#1c2e1e'],
  important: ['#a371f7', '#2a2140'],
  warning: ['#d29922', '#3a2e12'],
  caution: ['#f85149', '#3d1c20'],
  info: ['#58a6ff', '#1c2b3a'],
  success: ['#3fb950', '#1c2e1e'],
  danger: ['#f85149', '#3d1418']
}

export function calloutsFor(theme: 'light' | 'dark'): CalloutColors {
  return theme === 'dark' ? DARK_CALLOUTS : LIGHT_CALLOUTS
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
