/**
 * assists 键位装配纯逻辑守护（fix-biz IT-02/PATH-01）——格式三键（Mod-b/i/e）
 * 不属于「输入辅助」打字辅助行为面：`typingAssistsEnabled` 关断后键位表仍须
 * 恒挂格式三键（菜单回显 Ctrl+B/I/E 的唯一键位通道），其余 typing-assist
 * 键位（Enter/Tab/Shift-Tab/#）保持 `config.enabled` 门控语义不变。
 *
 * 收口批加固（keymap 恒挂断言）：数组形状之外补
 * 1) extension 级断言——EditorState.create + 真实 keymap facet，关断态
 *    state.facet(keymap) 必须含格式三键（恒挂经 CM6 装配落地，非只看数组）；
 * 2) run 闭包 stub-view dispatch 断言——run 不是空壳，会向 view 真实 dispatch。
 */
import { describe, expect, it } from 'vitest'
import { EditorSelection, EditorState } from '@codemirror/state'
import { keymap, type EditorView } from '@codemirror/view'
import { DEFAULT_EDITING_ASSISTS_CONFIG } from './config'
import { exitEmptyListItem, insertHorizontalRule } from './enter'
import { upgradeHeading } from './heading'
import {
  FORMAT_CHORDS,
  assembleAssistsKeymap,
  formatKeyBindings,
  typingAssistKeyBindings
} from './keymap'

const FORMAT_KEYS = ['Mod-b', 'Mod-i', 'Mod-e']
const TYPING_KEYS = ['Enter', 'Enter', 'Tab', 'Shift-Tab', '#']

function keysOf(config: { enabled: boolean }): string[] {
  return assembleAssistsKeymap({ ...DEFAULT_EDITING_ASSISTS_CONFIG, ...config }).map(
    (b) => b.key ?? ''
  )
}

describe('assembleAssistsKeymap', () => {
  it('enabled: mounts format chords plus typing-assist keys (order preserved)', () => {
    expect(keysOf({ enabled: true })).toEqual([...FORMAT_KEYS, ...TYPING_KEYS])
  })

  it('disabled: format chords stay mounted (恒挂) — menu echo keeps its keyboard channel', () => {
    expect(keysOf({ enabled: false })).toEqual(FORMAT_KEYS)
  })

  it('disabled: typing-assist keys are unloaded (门控语义不变)', () => {
    const keys = keysOf({ enabled: false })
    expect(keys).not.toContain('Enter')
    expect(keys).not.toContain('Tab')
    expect(keys).not.toContain('Shift-Tab')
    expect(keys).not.toContain('#')
  })
})

describe('formatKeyBindings', () => {
  it('binds each chord to its wrap mark and prevents default', () => {
    expect(FORMAT_CHORDS.map((c) => c.key)).toEqual(FORMAT_KEYS)
    expect(FORMAT_CHORDS.map((c) => c.mark)).toEqual(['**', '*', '`'])
    for (const binding of formatKeyBindings()) {
      expect(typeof binding.run).toBe('function')
      expect(binding.preventDefault).toBe(true)
    }
    expect(formatKeyBindings().map((b) => b.key)).toEqual(FORMAT_KEYS)
  })
})

describe('typingAssistKeyBindings', () => {
  it('keeps the original typing-assist handlers (双门控语义不变)', () => {
    const bindings = typingAssistKeyBindings()
    expect(bindings.map((b) => b.key)).toEqual(TYPING_KEYS)
    // Enter: empty-item exit must outrank hr + list-continue (UX-P01 F2).
    expect(bindings[0].run).toBe(exitEmptyListItem)
    expect(bindings[1].run).toBe(insertHorizontalRule)
    expect(bindings[2].run).toBeTypeOf('function') // indentListItem(+1) closure
    expect(bindings[3].run).toBeTypeOf('function') // indentListItem(-1) closure
    expect(bindings[4].run).toBe(upgradeHeading)
  })
})

// ---- 收口批加固：extension 级恒挂 + run 闭包真实 dispatch ---------------------

/** Headless view（同 table/editMode.test 模式）：state getter + dispatch 落账。 */
function stubView(doc: string, sel?: { anchor: number; head?: number }): {
  view: EditorView
  getDoc: () => string
  dispatchCount: () => number
} {
  let state = EditorState.create({
    doc,
    ...(sel ? { selection: EditorSelection.range(sel.anchor, sel.head ?? sel.anchor) } : {})
  })
  let dispatches = 0
  const view = {
    get state() {
      return state
    },
    dispatch(...specs: unknown[]) {
      dispatches += 1
      state = state.update(...(specs as never[])).state
    }
  } as unknown as EditorView
  return { view, getDoc: () => state.doc.toString(), dispatchCount: () => dispatches }
}

describe('keymap.of extension 级恒挂（收口批：state.facet(keymap) 断言）', () => {
  it('关断态 EditorState 的 keymap facet 仍含格式三键（恒挂经 CM6 装配落地）', () => {
    const state = EditorState.create({
      extensions: [
        keymap.of(assembleAssistsKeymap({ ...DEFAULT_EDITING_ASSISTS_CONFIG, enabled: false }))
      ]
    })
    const keys = state.facet(keymap).flat().map((b) => b.key ?? '')
    for (const k of FORMAT_KEYS) expect(keys).toContain(k)
  })

  it('关断态 keymap facet 无 typing-assist 键；开断态五键全在', () => {
    const off = EditorState.create({
      extensions: [
        keymap.of(assembleAssistsKeymap({ ...DEFAULT_EDITING_ASSISTS_CONFIG, enabled: false }))
      ]
    })
    const offKeys = off.facet(keymap).flat().map((b) => b.key ?? '')
    for (const k of ['Enter', 'Tab', 'Shift-Tab', '#']) expect(offKeys).not.toContain(k)

    const on = EditorState.create({
      extensions: [
        keymap.of(assembleAssistsKeymap({ ...DEFAULT_EDITING_ASSISTS_CONFIG, enabled: true }))
      ]
    })
    const onKeys = on.facet(keymap).flat().map((b) => b.key ?? '')
    for (const k of [...FORMAT_KEYS, ...TYPING_KEYS]) expect(onKeys).toContain(k)
  })
})

describe('format run 闭包 stub-view dispatch（收口批：run 非空壳）', () => {
  it('Mod-b run 经 stub-view 真实 dispatch 并包裹选区（**…**）', () => {
    const { view, getDoc, dispatchCount } = stubView('boldme', { anchor: 0, head: 6 })
    const binding = formatKeyBindings()[0]
    expect(binding.run?.(view)).toBe(true)
    expect(dispatchCount()).toBe(1)
    expect(getDoc()).toBe('**boldme**')
  })

  it('Mod-i/Mod-e run 各自 dispatch 自己的 mark（*…* / `…`）', () => {
    const italic = stubView('em', { anchor: 0, head: 2 })
    expect(formatKeyBindings()[1].run?.(italic.view)).toBe(true)
    expect(italic.getDoc()).toBe('*em*')

    const code = stubView('co', { anchor: 0, head: 2 })
    expect(formatKeyBindings()[2].run?.(code.view)).toBe(true)
    expect(code.getDoc()).toBe('`co`')
  })
})
