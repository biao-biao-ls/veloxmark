/**
 * fmtShortcut 平台转换规则固化（FE-02 / menu:echo-single-source）。
 *
 * 回显派生唯一入口：菜单提示文本 = fmtShortcut(快捷键总表条目)。
 * Windows/Linux：注册表 `Ctrl+N` 拼写即显示形态，原样透传（AC-FN-07「逐键一致」）。
 * macOS：修饰键转 ⌘/⇧/⌥ 字形，其余 `+` 为分隔符去除，键名段不动。
 */
import { describe, expect, it } from 'vitest'
import { fmtShortcut } from './shortcutDisplay'

describe('fmtShortcut — Windows/Linux 显示形态', () => {
  it('非 mac 原样透传：注册表拼写即触发键位拼写（AC-NF-06 逐字符一致）', () => {
    for (const s of ['Ctrl+S', 'Ctrl+Shift+O', 'Ctrl+Alt+[', 'Shift+Alt+F', 'F8', 'Ctrl+=', '']) {
      expect(fmtShortcut(s, false)).toBe(s)
    }
  })
})

describe('fmtShortcut — macOS 显示形态', () => {
  it('Ctrl+N → ⌘N（单修饰键）', () => {
    expect(fmtShortcut('Ctrl+N', true)).toBe('⌘N')
    expect(fmtShortcut('Ctrl+S', true)).toBe('⌘S')
    expect(fmtShortcut('Ctrl+/', true)).toBe('⌘/')
    expect(fmtShortcut('Ctrl+,', true)).toBe('⌘,')
    expect(fmtShortcut('Ctrl+0', true)).toBe('⌘0')
    expect(fmtShortcut('Ctrl+-', true)).toBe('⌘-')
    expect(fmtShortcut('Ctrl+=', true)).toBe('⌘=')
    expect(fmtShortcut('Ctrl+Enter', true)).toBe('⌘Enter')
    expect(fmtShortcut('Ctrl+Tab', true)).toBe('⌘Tab')
  })

  it('组合修饰键按 Ctrl/Shift/Alt 顺序转字形并去除分隔符', () => {
    expect(fmtShortcut('Ctrl+Shift+O', true)).toBe('⌘⇧O')
    expect(fmtShortcut('Ctrl+Shift+C', true)).toBe('⌘⇧C')
    expect(fmtShortcut('Ctrl+Shift+T', true)).toBe('⌘⇧T')
    expect(fmtShortcut('Ctrl+Alt+[', true)).toBe('⌘⌥[')
    expect(fmtShortcut('Ctrl+Alt+]', true)).toBe('⌘⌥]')
    expect(fmtShortcut('Shift+Alt+F', true)).toBe('⇧⌥F')
    expect(fmtShortcut('Shift+Alt+X', true)).toBe('⇧⌥X')
  })

  it('无修饰键键位（F 键/箭头字形）两平台同形', () => {
    for (const s of ['F8', 'F9', 'F12', 'Alt+↑', 'Alt+↓', 'Alt+←', 'Alt+→']) {
      expect(fmtShortcut(s, true)).toBe(s.replace('Alt+', '⌥').replaceAll('+', ''))
    }
    expect(fmtShortcut('F8', true)).toBe('F8')
    expect(fmtShortcut('Alt+↑', true)).toBe('⌥↑')
    expect(fmtShortcut('Alt+→', true)).toBe('⌥→')
  })

  it('空串与无修饰键短键安全（外部输入防空）', () => {
    expect(fmtShortcut('', true)).toBe('')
    expect(fmtShortcut('', false)).toBe('')
    expect(fmtShortcut('F12', true)).toBe('F12')
    expect(fmtShortcut('F12', false)).toBe('F12')
  })
})
