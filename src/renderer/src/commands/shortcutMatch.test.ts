/**
 * matchGlobalShortcut 单测（2.8 顺手补）——chord 匹配 / Shift 精确 / Bare-F 键 /
 * macOS Option 字符 e.code 兜底。
 */
import { describe, expect, it } from 'vitest'
import { matchGlobalShortcut } from './shortcutMatch'
import type { Command } from './types'

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
