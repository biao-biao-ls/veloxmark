/**
 * Shortcut display conversion — 回显派生唯一入口（FE-02 固化）。
 *
 * 菜单提示文本一律经本模块派生（AC-RULE-11 单源，menu:echo-single-source）：
 * 派生源 = 快捷键总表（`Command.shortcut` + 表格 `STRUCT_KEYS`），菜单侧
 * 禁止硬编码键位文案。规则（单测 shortcutDisplay.test.ts 钉住）：
 *
 * - Windows/Linux：注册表 `Ctrl+N` 拼写即显示形态，原样透传；
 * - macOS：`Ctrl+`→`⌘`、`Shift+`→`⇧`、`Alt+`→`⌥`，其余 `+` 为分隔符去除，
 *   键名段不动（`Ctrl+N`→`⌘N`，`F12` 两平台同形）。
 */

/** Modifier segment → macOS display glyph. Lookup miss = pass-through segment. */
const MAC_MOD_GLYPHS: Record<string, string> = {
  Ctrl: '⌘',
  Shift: '⇧',
  Alt: '⌥'
}

/** Format a 'Ctrl+Shift+O' shortcut for display (⌘/⇧ glyphs on macOS). */
export function fmtShortcut(s: string, isMac: boolean): string {
  if (!isMac) return s
  return s
    .split('+')
    .map((seg) => MAC_MOD_GLYPHS[seg] ?? seg)
    .join('')
}
