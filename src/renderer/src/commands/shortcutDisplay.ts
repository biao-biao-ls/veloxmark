
const MAC_MOD_GLYPHS: Record<string, string> = {
  Ctrl: '⌘',
  Shift: '⇧',
  Alt: '⌥'
}

export function fmtShortcut(s: string, isMac: boolean): string {
  if (!isMac) return s
  return s
    .split('+')
    .map((seg) => MAC_MOD_GLYPHS[seg] ?? seg)
    .join('')
}
