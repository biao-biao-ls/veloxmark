/**
 * Global shortcut matching（2B 自 commands.ts 平移；单测见 shortcutMatch.test.ts）。
 */
import type { Command } from './types'

/**
 * Find the command whose global shortcut matches this key event.
 * Parity with the previous hand-written handler for chorded shortcuts:
 * Cmd/Ctrl required, Shift must match exactly, Alt is ignored. P08 adds
 * bare function keys (e.g. F8 for Focus Mode) — those match with no
 * modifiers at all.
 */
export function matchGlobalShortcut(e: KeyboardEvent, commands: Command[]): Command | null {
  const k = e.key.toLowerCase()
  const hasChordMod = e.ctrlKey || e.metaKey || e.altKey
  // P23: Option+F on macOS yields 'ƒ' — also match the physical KeyF code.
  // UX-P18 F3: Option+[ likewise yields curly quotes — map bracket codes too.
  const codeKey =
    e.code && /^Key[A-Z]$/.test(e.code)
      ? e.code.slice(3).toLowerCase()
      : e.code === 'BracketLeft'
        ? '['
        : e.code === 'BracketRight'
          ? ']'
          : null
  for (const cmd of commands) {
    if (!cmd.bindGlobal || !cmd.shortcut) continue
    const parts = cmd.shortcut.split('+')
    const key = parts[parts.length - 1].toLowerCase()
    const needShift = parts.includes('Shift')
    const needCtrl = parts.includes('Ctrl')
    const needAlt = parts.includes('Alt')
    if (needCtrl) {
      if (!(e.ctrlKey || e.metaKey) || needShift !== e.shiftKey) continue
      // Ctrl/Cmd+Alt chord (e.g. ⌘⌥[ fold section): Alt must be held too.
      if (needAlt && !e.altKey) continue
    } else if (needAlt) {
      // P23 Shift+Alt+F — no Ctrl/Cmd, Alt required, Shift exact.
      if (!e.altKey || e.ctrlKey || e.metaKey || needShift !== e.shiftKey) continue
    } else {
      // Bare shortcuts are function keys only — reject any modifier.
      if (hasChordMod || e.shiftKey || !/^f\d{1,2}$/.test(key)) continue
    }
    if (key === k || (codeKey && key === codeKey)) return cmd
  }
  return null
}
