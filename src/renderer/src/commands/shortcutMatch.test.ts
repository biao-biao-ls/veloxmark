/**
 * matchGlobalShortcut 单测（2.8 顺手补）——chord 匹配 / Shift 精确 / Bare-F 键 /
 * macOS Option 字符 e.code 兜底。
 *
 * FE-02 追加（AC-NF-06 / AC-FN-07 口径）：回显文本与实际触发键位一致——
 * 回显由 fmtShortcut 从同一 `Command.shortcut` 单源派生，合成键位事件按
 * 注册表键位触发；buildMenus 全量菜单回显 100% 派生、无键留空。
 */
import { describe, expect, it } from 'vitest'
import { stubCommandOps } from '../test-stubs/commandOps'
import { buildCommands } from './build'
import { buildMenus } from './menuLayout'
import { fmtShortcut } from './shortcutDisplay'
import { matchGlobalShortcut } from './shortcutMatch'
import type { Command } from './types'
import type { MenuItem } from '../components/MenuBar'

function cmd(id: string, shortcut: string, bindGlobal = true): Command {
  return { id, label: id, shortcut, bindGlobal, run: () => {} }
}

function key(init: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    code: '',
    ...init
  } as KeyboardEvent
}

const CMDS = [
  cmd('openFolder', 'Ctrl+Shift+O'),
  cmd('saveFile', 'Ctrl+S'),
  cmd('toggleFocusMode', 'F8'),
  cmd('formatDocument', 'Shift+Alt+F'),
  cmd('foldSection', 'Ctrl+Alt+['),
  cmd('boldLike', 'Ctrl+B', false) // not bindGlobal — never matches
]

describe('matchGlobalShortcut', () => {
  it('matches chorded Ctrl+Shift+O', () => {
    expect(matchGlobalShortcut(key({ key: 'O', ctrlKey: true, shiftKey: true }), CMDS)?.id).toBe(
      'openFolder'
    )
  })

  it('treats metaKey (Cmd) as Ctrl', () => {
    expect(matchGlobalShortcut(key({ key: 's', metaKey: true }), CMDS)?.id).toBe('saveFile')
  })

  it('requires Shift to match exactly', () => {
    // needShift=true but shift not held → skip openFolder; 'o' is no bare-F key.
    expect(matchGlobalShortcut(key({ key: 'o', ctrlKey: true }), CMDS)).toBeNull()
    // needShift=false but shift held → saveFile rejects.
    expect(matchGlobalShortcut(key({ key: 's', ctrlKey: true, shiftKey: true }), CMDS)).toBeNull()
  })

  it('matches bare function keys only with no modifiers', () => {
    expect(matchGlobalShortcut(key({ key: 'F8' }), CMDS)?.id).toBe('toggleFocusMode')
    expect(matchGlobalShortcut(key({ key: 'F8', ctrlKey: true }), CMDS)).toBeNull()
    expect(matchGlobalShortcut(key({ key: 'F8', shiftKey: true }), CMDS)).toBeNull()
    // Bare non-function keys are not shortcuts.
    expect(matchGlobalShortcut(key({ key: 'x' }), CMDS)).toBeNull()
  })

  it('macOS Option characters fall back to the physical code', () => {
    // Option+F yields 'ƒ'; Option+[ yields a curly quote — match on e.code.
    expect(
      matchGlobalShortcut(key({ key: 'ƒ', code: 'KeyF', ctrlKey: true }), [
        cmd('bold', 'Ctrl+B'), // 'b' ≠ 'ƒ' and codeKey 'f' ≠ 'b' — no match
        cmd('findish', 'Ctrl+F')
      ])?.id
    ).toBe('findish')
    expect(
      matchGlobalShortcut(
        key({ key: '‘', code: 'BracketLeft', ctrlKey: true, altKey: true }),
        CMDS
      )?.id
    ).toBe('foldSection')
    // Shift+Alt+F with the mangled Option+Shift+F character.
    expect(
      matchGlobalShortcut(
        key({ key: 'Ï', code: 'KeyF', altKey: true, shiftKey: true }),
        CMDS
      )?.id
    ).toBe('formatDocument')
  })

  it('Ctrl+Alt chords require Alt held', () => {
    expect(matchGlobalShortcut(key({ key: '[', ctrlKey: true }), CMDS)).toBeNull()
    expect(matchGlobalShortcut(key({ key: '[', ctrlKey: true, altKey: true }), CMDS)?.id).toBe(
      'foldSection'
    )
  })

  it('Shift+Alt chords reject Ctrl/Cmd and require Shift exactly', () => {
    expect(
      matchGlobalShortcut(key({ key: 'F', altKey: true, shiftKey: true }), CMDS)?.id
    ).toBe('formatDocument')
    expect(matchGlobalShortcut(key({ key: 'F', altKey: true }), CMDS)).toBeNull()
    expect(
      matchGlobalShortcut(key({ key: 'F', altKey: true, shiftKey: true, ctrlKey: true }), CMDS)
    ).toBeNull()
  })

  it('skips commands without bindGlobal', () => {
    expect(matchGlobalShortcut(key({ key: 'b', ctrlKey: true }), CMDS)).toBeNull()
  })
})

// ---- FE-02: 回显文本 ↔ 实际触发键位（AC-NF-06 / AC-FN-07） --------------------

/** Registry `Ctrl+Shift+O` spelling → synthetic key event（触发侧解析）。 */
function keyEventFromShortcut(shortcut: string): Partial<KeyboardEvent> & { key: string } {
  const parts = shortcut.split('+')
  return {
    key: parts[parts.length - 1],
    ctrlKey: parts.includes('Ctrl'),
    metaKey: false,
    altKey: parts.includes('Alt'),
    shiftKey: parts.includes('Shift'),
    code: ''
  }
}

function walkMenuItems(items: MenuItem[], out: MenuItem[] = []): MenuItem[] {
  for (const item of items) {
    out.push(item)
    if (item.submenu) walkMenuItems(item.submenu, out)
  }
  return out
}

describe('AC-NF-06 — 回显文本与实际触发键位一致（单源派生口径）', () => {
  it('Windows 回显 = 注册表触发拼写，逐字符一致', () => {
    for (const c of CMDS) {
      if (!c.shortcut) continue
      expect(fmtShortcut(c.shortcut, false), `echo for "${c.id}"`).toBe(c.shortcut)
    }
  })

  it('合成键位事件按注册表键位触发同一命令（回显↔触发逐键一致）', () => {
    for (const c of CMDS) {
      if (!c.bindGlobal || !c.shortcut) continue
      expect(matchGlobalShortcut(key(keyEventFromShortcut(c.shortcut)), CMDS)?.id, `trigger for "${c.id}"`).toBe(
        c.id
      )
    }
  })

  it('mac 回显仅转换修饰键字形，键名段与触发键位一致', () => {
    for (const c of CMDS) {
      if (!c.shortcut) continue
      const keySeg = c.shortcut.split('+').pop() ?? ''
      const macEcho = fmtShortcut(c.shortcut, true)
      expect(macEcho.endsWith(keySeg), `mac echo "${macEcho}" keeps key "${keySeg}"`).toBe(true)
      expect(macEcho.includes('+'), `mac echo "${macEcho}" has no leftover separators`).toBe(false)
    }
    expect(fmtShortcut('Ctrl+N', true)).toBe('⌘N')
    expect(fmtShortcut('Ctrl+Shift+O', true)).toBe('⌘⇧O')
  })
})

describe('AC-FN-07 / AC-NF-06 — buildMenus 全量菜单回显派生', () => {
  const commands = buildCommands(stubCommandOps())
  const byId = new Map(commands.map((c) => [c.id, c]))

  for (const isMac of [false, true]) {
    it(`有键 100% 回显且文本 = fmtShortcut(键位)；无键留空（isMac=${isMac}）`, () => {
      const items = walkMenuItems(buildMenus(commands, isMac).flatMap((m) => m.items))
      const menuIds = [...new Set(items.map((i) => i.id).filter((id): id is string => !!id))]
      const echoedIds: string[] = []
      for (const item of items) {
        if (!item.id) continue
        const cmd = byId.get(item.id)
        expect(cmd, `menu item "${item.id}" not in registry`).toBeDefined()
        if (!cmd) continue
        if (cmd.shortcut) {
          expect(item.shortcut, `echo for "${cmd.id}" must derive`).toBe(
            fmtShortcut(cmd.shortcut, isMac)
          )
          echoedIds.push(cmd.id)
        } else {
          // 无键留空：不显示占位符（menu:echo-empty）
          expect(item.shortcut, `echo for "${cmd.id}" must stay empty`).toBeUndefined()
        }
      }
      // 菜单面（AC-FN-07 范围）有键命令 100% 回显；注册表非菜单命令（如
      // foldSection 系）不在菜单面，不参与回显率分母。
      const expectedEchoIds = menuIds.filter((id) => byId.get(id)?.shortcut)
      expect(echoedIds.slice().sort()).toEqual(expectedEchoIds.slice().sort())
    })
  }

  it('真实注册表：每个键位合成事件触发同键位命令（chord 与回显一致）', () => {
    const byShortcut = new Map<string, string[]>()
    for (const c of commands) {
      if (!c.bindGlobal || !c.shortcut) continue
      byShortcut.set(c.shortcut, [...(byShortcut.get(c.shortcut) ?? []), c.id])
    }
    for (const [shortcut, ids] of byShortcut) {
      const fired = matchGlobalShortcut(key(keyEventFromShortcut(shortcut)), commands)
      expect(fired, `chord "${shortcut}" must fire`).not.toBeNull()
      // 触发命令的回显即所按键位（AC-NF-06）；重键归属（Q6）不由本条裁决。
      expect(fired?.shortcut).toBe(shortcut)
      if (ids.length === 1) expect(fired?.id).toBe(ids[0])
    }
  })
})
