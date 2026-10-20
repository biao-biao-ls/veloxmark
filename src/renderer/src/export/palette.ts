
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
  | 'tableHeaderBg'
  | 'tableStripeBg'

export type Palette = Record<PaletteToken, string>

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
  tableHeaderBg: '--table-header-bg',
  tableStripeBg: '--table-stripe-bg'
}

export const LIGHT_PALETTE: Palette = {
  bg: '#ffffff',
  bgAlt: '#fafafa',
  fg: '#333333',
  fgDim: '#6b6b6b',
  border: '#e5e5e5',
  accent: '#0969da',
  quoteBorder: '#d0d7de',
  codeBg: 'rgba(175, 184, 193, 0.2)',
  hrColor: '#d8dee4',
  highlightBg: '#fff8c5',
  tableHeaderBg: '#f0f0f0',
  tableStripeBg: '#f6f6f6'
}

export const DARK_PALETTE: Palette = {
  bg: '#1e1e1e',
  bgAlt: '#252526',
  fg: '#d4d4d4',
  fgDim: '#9a9a9a',
  border: '#333333',
  accent: '#58a6ff',
  quoteBorder: '#444444',
  codeBg: 'rgba(110, 118, 129, 0.25)',
  hrColor: '#444444',
  highlightBg: '#654a15',
  tableHeaderBg: '#2d2d2e',
  tableStripeBg: '#252526'
}

export function paletteFor(theme: 'light' | 'dark'): Palette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE
}


export type CalloutType =
  | 'note'
  | 'tip'
  | 'important'
  | 'warning'
  | 'caution'
  | 'info'
  | 'success'
  | 'danger'

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
