import type { Command } from './types'

export function matchGlobalShortcut(e: KeyboardEvent, commands: Command[]): Command | null {
  const k = e.key.toLowerCase()
  const hasChordMod = e.ctrlKey || e.metaKey || e.altKey
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
      if (needAlt && !e.altKey) continue
    } else if (needAlt) {
      if (!e.altKey || e.ctrlKey || e.metaKey || needShift !== e.shiftKey) continue
    } else {
      if (hasChordMod || e.shiftKey || !/^f\d{1,2}$/.test(key)) continue
    }
    if (key === k || (codeKey && key === codeKey)) return cmd
  }
  return null
}
