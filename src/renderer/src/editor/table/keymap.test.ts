import { describe, expect, it } from 'vitest'
import { cmKeyToDisplay, STRUCT_KEYS } from './keymap'

describe('cmKeyToDisplay (7D shortcut hints)', () => {
  it('converts the real 7B bindings to display style', () => {
    expect(cmKeyToDisplay('Ctrl-Enter')).toBe('Ctrl+Enter')
    expect(cmKeyToDisplay('Alt-ArrowUp')).toBe('Alt+↑')
    expect(cmKeyToDisplay('Alt-ArrowDown')).toBe('Alt+↓')
    expect(cmKeyToDisplay('Alt-ArrowLeft')).toBe('Alt+←')
    expect(cmKeyToDisplay('Alt-ArrowRight')).toBe('Alt+→')
  })

  it('keeps multi-modifier segments and plain keys', () => {
    expect(cmKeyToDisplay('Ctrl-Shift-Tab')).toBe('Ctrl+Shift+Tab')
    expect(cmKeyToDisplay('Shift-Enter')).toBe('Shift+Enter')
    expect(cmKeyToDisplay('a')).toBe('a')
  })
})

describe('STRUCT_KEYS display table (single-source guard)', () => {
  it('every binding maps to the expected hint (win style)', () => {
    const hints = Object.fromEntries(STRUCT_KEYS.map(({ key, cmd }) => [cmd, cmKeyToDisplay(key)]))
    expect(hints).toEqual({
      insertRowBelow: 'Ctrl+Enter',
      moveRowUp: 'Alt+↑',
      moveRowDown: 'Alt+↓',
      moveColLeft: 'Alt+←',
      moveColRight: 'Alt+→'
    })
  })
})
