/**
 * Shortcut display conversion（2B 自 commands.ts 平移）。
 */

/** Format a 'Ctrl+Shift+O' shortcut for display (⌘/⇧ glyphs on macOS). */
export function fmtShortcut(s: string, isMac: boolean): string {
  return isMac
    ? s.replace('Ctrl+', '⌘').replace('Shift+', '⇧').replace('Alt+', '⌥').replaceAll('+', '')
    : s
}
