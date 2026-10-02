/**
 * FE-02 键位改造契约面（TBL §3.2 冻结 5 组键位 / §3.3 Q4 上下文分流 /
 * §3.8 PEND-13 非回归 / AC-ERR-12 键族作用域）。
 *
 * 单测不渲染 widget（宪法），故分三层钉住：
 *   1) 纯表层：STRUCT_KEYS 字面量/回显派生 + keymap.ts 键字面量唯一声明（grep 唯一）；
 *   2) 绑定层：structKeyBindings Q4 分流（selection.empty 判定）+ cellKeymap
 *      非回归（Shift+Enter `<br>` / Tab 跳格 / Enter 下移 / 键族路由到 op id）；
 *   3) 路由层：tryStructCmd 在 headless EditorState 上的 op 落地 + toast 冻结
 *      文案回执（与 ⋮ 菜单同 op id 同 i18n key 单源）。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { history } from '@codemirror/commands'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { GFM } from '@lezer/markdown'
import type { EditorView, KeyBinding } from '@codemirror/view'
import {
  cellKeymap,
  cmKeyToDisplay,
  structCmdTakesKey,
  structKeyBindings,
  STRUCT_KEYS,
  type NestedNavFns,
  type StructCmd
} from './keymap'
import { tryStructCmd } from './commands'
import { setActiveCell, tableEditField } from './state'
import { setCtxRuntime } from '../contextMenu/ctxMenuStore'
import type { CtxRuntime } from '../contextMenu/types'
import { getLang, setLang, t } from '../../i18n'
import { parseTableModel } from './parse'

// ---- shared fakes -----------------------------------------------------------

type FakeView = {
  state: EditorState
  dispatch: (spec: unknown) => void
}

/** Minimal selection-bearing view — only what key binding `run` handlers read. */
function selView(selectionEmpty: boolean, from = 0, to = selectionEmpty ? 0 : 3): EditorView {
  return {
    state: { selection: { main: { empty: selectionEmpty, from, to } } }
  } as unknown as EditorView
}

/** Headless view with real state (markdown + tableEditField) and apply-on-dispatch. */
function stateView(doc: string): { view: EditorView; getDoc: () => string } {
  let state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM], addKeymap: false }), tableEditField]
  })
  ensureSyntaxTree(state, state.doc.length, 50000)
  const view = {
    get state() {
      return state
    },
    dispatch(spec: { [k: string]: unknown }) {
      state = state.update(spec as never).state
      ensureSyntaxTree(state, state.doc.length, 50000)
    }
  } as unknown as EditorView & FakeView
  return { view, getDoc: () => state.doc.toString() }
}

const TABLE_DOC = 'lead paragraph\n\n| h1 | h2 |\n| --- | --- |\n| a | b |\n| c | d |\n'

/** Activate cell (row/col, UI rows include header) on TABLE_DOC's table. */
function viewWithActiveCell(row: number, col: number) {
  const sv = stateView(TABLE_DOC)
  const tableFrom = TABLE_DOC.indexOf('| h1')
  sv.view.dispatch({
    effects: setActiveCell.of({ tableFrom, row, col, caret: 0 })
  })
  return sv
}

/** UI cell texts of the doc's table block (rows[0] = header). */
function gridOfDoc(doc: string): string[][] {
  const tableText = doc
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .join('\n')
  return parseTableModel(tableText, 0).cells.map((r) => r.map((c) => c.text))
}

/** Colon-row aligns of the doc's table block. */
function alignsOfDoc(doc: string): string[] {
  const tableText = doc
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .join('\n')
  return parseTableModel(tableText, 0).aligns
}

function navSpy(): { nav: NestedNavFns; moves: string[]; structs: StructCmd[]; menuCalls: number[] } {
  const moves: string[] = []
  const structs: StructCmd[] = []
  const menuCalls: number[] = []
  const nav: NestedNavFns = {
    move: (_n, _m, dir) => {
      moves.push(dir)
    },
    exit: () => {},
    tsv: () => {},
    struct: (_v, cmd) => {
      structs.push(cmd)
      return true
    },
    openMenu: () => {
      menuCalls.push(1)
      return true
    },
    undoMain: () => false
  }
  return { nav, moves, structs, menuCalls }
}

function runKey(bindings: KeyBinding[], key: string, v: EditorView): boolean | void {
  const hit = bindings.find((b) => b.key === key)
  expect(hit, `binding for ${key}`).toBeTruthy()
  return hit!.run?.(v)
}

// ---- 1) STRUCT_KEYS frozen table (TBL §3.2) ---------------------------------

describe('STRUCT_KEYS frozen key table (TBL §3.2, 5 groups)', () => {
  it('declares exactly the frozen chords per op (win-style CM literals)', () => {
    const byCmd = Object.fromEntries(STRUCT_KEYS.map(({ key, cmd }) => [cmd, key]))
    expect(byCmd).toEqual({
      // ① 基础档
      insertRowBelow: 'Ctrl-Enter',
      // ② Shift 升档
      insertRowAbove: 'Ctrl-Shift-Enter',
      // ③ Shift 升档（Q4 分流）
      insertColRight: 'Ctrl-Shift-ArrowRight',
      // ④ Shift 升档（Q4 分流）
      insertColLeft: 'Ctrl-Shift-ArrowLeft',
      // ⑤ 移动族
      moveRowUp: 'Alt-ArrowUp',
      moveRowDown: 'Alt-ArrowDown',
      moveColLeft: 'Alt-ArrowLeft',
      moveColRight: 'Alt-ArrowRight'
    })
    expect(STRUCT_KEYS).toHaveLength(8)
  })

  it('maps every binding to the expected hint (win style, single-source)', () => {
    const hints = Object.fromEntries(STRUCT_KEYS.map(({ key, cmd }) => [cmd, cmKeyToDisplay(key)]))
    expect(hints).toEqual({
      insertRowBelow: 'Ctrl+Enter',
      insertRowAbove: 'Ctrl+Shift+Enter',
      insertColRight: 'Ctrl+Shift+→',
      insertColLeft: 'Ctrl+Shift+←',
      moveRowUp: 'Alt+↑',
      moveRowDown: 'Alt+↓',
      moveColLeft: 'Alt+←',
      moveColRight: 'Alt+→'
    })
  })
})

describe('cmKeyToDisplay (7D shortcut hints)', () => {
  it('converts the real 7B bindings to display style', () => {
    expect(cmKeyToDisplay('Ctrl-Enter')).toBe('Ctrl+Enter')
    expect(cmKeyToDisplay('Alt-ArrowUp')).toBe('Alt+↑')
    expect(cmKeyToDisplay('Alt-ArrowDown')).toBe('Alt+↓')
    expect(cmKeyToDisplay('Alt-ArrowLeft')).toBe('Alt+←')
    expect(cmKeyToDisplay('Alt-ArrowRight')).toBe('Alt+→')
  })

  it('keeps multi-modifier segments and plain keys', () => {
    expect(cmKeyToDisplay('Ctrl-Shift-Enter')).toBe('Ctrl+Shift+Enter')
    expect(cmKeyToDisplay('Ctrl-Shift-ArrowLeft')).toBe('Ctrl+Shift+←')
    expect(cmKeyToDisplay('Ctrl-Shift-ArrowRight')).toBe('Ctrl+Shift+→')
    expect(cmKeyToDisplay('Ctrl-Shift-Tab')).toBe('Ctrl+Shift+Tab')
    expect(cmKeyToDisplay('Shift-Enter')).toBe('Shift+Enter')
    expect(cmKeyToDisplay('a')).toBe('a')
  })
})

// ---- key literal single source (AC-RULE-11 / AC stage-1) --------------------

describe('key literal single source (grep unique to keymap.ts)', () => {
  const FROZEN_LITERALS = [
    'Ctrl-Enter',
    'Ctrl-Shift-Enter',
    'Ctrl-Shift-ArrowRight',
    'Ctrl-Shift-ArrowLeft',
    'Alt-ArrowUp',
    'Alt-ArrowDown',
    'Alt-ArrowLeft',
    'Alt-ArrowRight'
  ]

  it('declares every frozen key literal in keymap.ts and nowhere else', () => {
    const srcRoot = fileURLToPath(new URL('../..', import.meta.url))
    const hits: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = `${dir}/${name}`
        if (statSync(p).isDirectory()) {
          walk(p)
          continue
        }
        if (!/\.tsx?$/.test(name) || name.endsWith('.test.ts') || name.endsWith('.test.tsx')) continue
        const text = readFileSync(p, 'utf8')
        for (const lit of FROZEN_LITERALS) {
          const quoted = new RegExp(`['"\`]${lit}['"\`]`)
          if (quoted.test(text)) hits.push(`${p}: ${lit}`)
        }
      }
    }
    walk(srcRoot)
    expect(hits).toEqual([
      expect.stringContaining('editor/table/keymap.ts: Ctrl-Enter'),
      expect.stringContaining('editor/table/keymap.ts: Ctrl-Shift-Enter'),
      expect.stringContaining('editor/table/keymap.ts: Ctrl-Shift-ArrowRight'),
      expect.stringContaining('editor/table/keymap.ts: Ctrl-Shift-ArrowLeft'),
      expect.stringContaining('editor/table/keymap.ts: Alt-ArrowUp'),
      expect.stringContaining('editor/table/keymap.ts: Alt-ArrowDown'),
      expect.stringContaining('editor/table/keymap.ts: Alt-ArrowLeft'),
      expect.stringContaining('editor/table/keymap.ts: Alt-ArrowRight')
    ])
  })
})

// ---- 2) Q4 context split (TBL §3.3) -----------------------------------------

describe('Q4 context split (Ctrl+Shift+←/→ vs word-selection extension)', () => {
  it('lets column inserts through only with an empty selection', () => {
    expect(structCmdTakesKey('insertColLeft', true)).toBe(true)
    expect(structCmdTakesKey('insertColRight', true)).toBe(true)
    expect(structCmdTakesKey('insertColLeft', false)).toBe(false)
    expect(structCmdTakesKey('insertColRight', false)).toBe(false)
  })

  it('never gates the row/move chords on selection state', () => {
    for (const cmd of [
      'insertRowBelow',
      'insertRowAbove',
      'moveRowUp',
      'moveRowDown',
      'moveColLeft',
      'moveColRight'
    ] as StructCmd[]) {
      expect(structCmdTakesKey(cmd, true)).toBe(true)
      expect(structCmdTakesKey(cmd, false)).toBe(true)
    }
  })

  it('declines the split bindings when a text selection is open (fall through)', () => {
    const runs: StructCmd[] = []
    const bindings = structKeyBindings((_v, cmd) => {
      runs.push(cmd)
      return true
    })
    for (const key of ['Ctrl-Shift-ArrowRight', 'Ctrl-Shift-ArrowLeft']) {
      expect(runKey(bindings, key, selView(false))).toBe(false)
    }
    expect(runs).toEqual([])
  })

  it('runs the split bindings when the selection is empty', () => {
    const runs: StructCmd[] = []
    const bindings = structKeyBindings((_v, cmd) => {
      runs.push(cmd)
      return true
    })
    expect(runKey(bindings, 'Ctrl-Shift-ArrowRight', selView(true))).toBe(true)
    expect(runKey(bindings, 'Ctrl-Shift-ArrowLeft', selView(true))).toBe(true)
    expect(runs).toEqual(['insertColRight', 'insertColLeft'])
  })

  it('keeps Ctrl+Enter / Ctrl+Shift+Enter independent of selection state', () => {
    const runs: StructCmd[] = []
    const bindings = structKeyBindings((_v, cmd) => {
      runs.push(cmd)
      return true
    })
    expect(runKey(bindings, 'Ctrl-Enter', selView(false))).toBe(true)
    expect(runKey(bindings, 'Ctrl-Shift-Enter', selView(false))).toBe(true)
    expect(runs).toEqual(['insertRowBelow', 'insertRowAbove'])
  })
})

// ---- 3) cellKeymap wiring + PEND-13 non-regression ---------------------------

describe('cellKeymap routing and non-regression (PEND-13)', () => {
  const main = {} as EditorView

  it('routes the structure chords to their op ids via nav.struct', () => {
    const { nav, structs } = navSpy()
    const bindings = cellKeymap(main, nav)
    runKey(bindings, 'Ctrl-Enter', selView(true))
    runKey(bindings, 'Ctrl-Shift-Enter', selView(true))
    runKey(bindings, 'Ctrl-Shift-ArrowRight', selView(true))
    runKey(bindings, 'Ctrl-Shift-ArrowLeft', selView(true))
    runKey(bindings, 'Alt-ArrowUp', selView(true))
    runKey(bindings, 'Alt-ArrowDown', selView(true))
    runKey(bindings, 'Alt-ArrowLeft', selView(true))
    runKey(bindings, 'Alt-ArrowRight', selView(true))
    expect(structs).toEqual([
      'insertRowBelow',
      'insertRowAbove',
      'insertColRight',
      'insertColLeft',
      'moveRowUp',
      'moveRowDown',
      'moveColLeft',
      'moveColRight'
    ])
  })

  it('does not trigger column inserts while a text selection is open (Q4)', () => {
    const { nav, structs } = navSpy()
    const bindings = cellKeymap(main, nav)
    expect(runKey(bindings, 'Ctrl-Shift-ArrowRight', selView(false))).toBe(false)
    expect(runKey(bindings, 'Ctrl-Shift-ArrowLeft', selView(false))).toBe(false)
    expect(structs).toEqual([])
  })

  it('Shift+Enter writes <br> at the selection (line-break semantics kept)', () => {
    const { nav } = navSpy()
    const bindings = cellKeymap(main, nav)
    const specs: unknown[] = []
    const v = {
      state: { selection: { main: { empty: true, from: 2, to: 2 } } },
      dispatch: (spec: unknown) => {
        specs.push(spec)
      }
    } as unknown as EditorView
    expect(runKey(bindings, 'Shift-Enter', v)).toBe(true)
    expect(specs).toEqual([
      {
        changes: { from: 2, to: 2, insert: '<br>' },
        selection: { anchor: 6 },
        userEvent: 'input.table.br'
      }
    ])
  })

  it('Tab / Shift+Tab hop cells and Enter commits downward (unchanged)', () => {
    const { nav, moves } = navSpy()
    const bindings = cellKeymap(main, nav)
    expect(runKey(bindings, 'Tab', selView(true))).toBe(true)
    expect(runKey(bindings, 'Shift-Tab', selView(true))).toBe(true)
    expect(runKey(bindings, 'Enter', selView(true))).toBe(true)
    expect(runKey(bindings, 'Escape', selView(true))).toBe(true)
    expect(moves).toEqual(['next', 'prev', 'down', 'out'])
  })
})

// ---- 4) AC-ERR-12: key family never hijacks plain-paragraph focus ------------

describe('tryStructCmd scope (AC-ERR-12: cell-active only)', () => {
  it('declines every cmd in a plain paragraph (no active cell, no doc change)', () => {
    const { view, getDoc } = stateView('plain paragraph text\n')
    const before = getDoc()
    for (const { key, cmd } of STRUCT_KEYS) {
      expect(tryStructCmd(view, cmd), `${key} must fall through`).toBe(false)
    }
    expect(getDoc()).toBe(before)
  })

  it('binding layer also falls through outside table edit (main-editor backstop)', () => {
    const { view, getDoc } = stateView('plain paragraph text\n')
    const before = getDoc()
    for (const { key } of STRUCT_KEYS) {
      const taken = runKey(structKeyBindings(tryStructCmd), key, view)
      expect(taken, `${key} must not hijack`).toBeFalsy()
    }
    expect(getDoc()).toBe(before)
  })
})

// ---- 5) tryStructCmd op routing + frozen toast receipts ----------------------

describe('tryStructCmd op routing and toast receipts (AC-OP-01/03/04)', () => {
  let toasts: string[]
  let prevLang: ReturnType<typeof getLang>

  beforeEach(() => {
    toasts = []
    prevLang = getLang()
    setLang('zh')
    const rt: CtxRuntime = {
      runCommand: () => {},
      // FE-07: receipts carry `{ message, action }` (glb-toast:action) — keep
      // asserting the frozen message copy; the action face is covered by
      // hooks/useToast.test.ts.
      toast: (m) => {
        toasts.push(typeof m === 'string' ? m : m.message)
      },
      clipboardWrite: () => Promise.resolve(),
      openLink: () => {},
      confirm: () => Promise.resolve(false)
    }
    setCtxRuntime(rt)
  })

  afterEach(() => {
    setCtxRuntime(null)
    setLang(prevLang)
  })

  it('Ctrl+Enter inserts a row below with the frozen receipt (AC-OP-01)', () => {
    const { view, getDoc } = viewWithActiveCell(1, 0) // body row 1 = 'a | b'
    expect(tryStructCmd(view, 'insertRowBelow')).toBe(true)
    expect(gridOfDoc(getDoc())).toEqual([
      ['h1', 'h2'],
      ['a', 'b'],
      ['', ''],
      ['c', 'd']
    ])
    expect(getDoc().startsWith('lead paragraph')).toBe(true)
    expect(toasts).toEqual(['已在下方插入行（Ctrl+Z 可撤销）'])
  })

  it('Ctrl+Shift+Enter inserts a row above with the frozen receipt', () => {
    const { view, getDoc } = viewWithActiveCell(2, 0) // body row 2 = 'c | d'
    expect(tryStructCmd(view, 'insertRowAbove')).toBe(true)
    expect(gridOfDoc(getDoc())).toEqual([
      ['h1', 'h2'],
      ['a', 'b'],
      ['', ''],
      ['c', 'd']
    ])
    expect(toasts).toEqual(['已在上方插入行（Ctrl+Z 可撤销）'])
  })

  it('insertRowAbove at the header migrates header identity (Q5, FE-01 op)', () => {
    const { view, getDoc } = viewWithActiveCell(0, 0) // header row
    expect(tryStructCmd(view, 'insertRowAbove')).toBe(true)
    expect(gridOfDoc(getDoc())).toEqual([
      ['', ''],
      ['h1', 'h2'],
      ['a', 'b'],
      ['c', 'd']
    ])
    expect(toasts).toEqual(['已在上方插入行（Ctrl+Z 可撤销）'])
  })

  it('Ctrl+Shift+→ inserts a column right of the anchor (AC-OP-03)', () => {
    const { view, getDoc } = viewWithActiveCell(1, 0)
    expect(tryStructCmd(view, 'insertColRight')).toBe(true)
    expect(gridOfDoc(getDoc())).toEqual([
      ['h1', '', 'h2'],
      ['a', '', 'b'],
      ['c', '', 'd']
    ])
    // 冒号行新增项为显式左对齐 `:---`（AC-OP-03/08 词表形态，与菜单写回同字面）。
    const rightAligns = alignsOfDoc(getDoc())
    expect(rightAligns).toHaveLength(3)
    expect(rightAligns[1]).toBe('left')
    expect(getDoc().split('\n').filter((l) => l.startsWith('|'))[1]).toContain(':---')
    expect(toasts).toEqual(['已在右侧插入列（Ctrl+Z 可撤销）'])
  })

  it('Ctrl+Shift+← inserts a column left of the anchor (AC-OP-04)', () => {
    const { view, getDoc } = viewWithActiveCell(1, 1)
    expect(tryStructCmd(view, 'insertColLeft')).toBe(true)
    expect(gridOfDoc(getDoc())).toEqual([
      ['h1', '', 'h2'],
      ['a', '', 'b'],
      ['c', '', 'd']
    ])
    const leftAligns = alignsOfDoc(getDoc())
    expect(leftAligns).toHaveLength(3)
    expect(leftAligns[1]).toBe('left')
    expect(getDoc().split('\n').filter((l) => l.startsWith('|'))[1]).toContain(':---')
    expect(toasts).toEqual(['已在左侧插入列（Ctrl+Z 可撤销）'])
  })

  it('receipts use the same frozen i18n keys the ⋮ menu items share (single source)', () => {
    // 冻结文案真源 = i18n 双字典；键盘路径与 ⋮ 菜单按 op id 引用同一 key。
    setLang('zh')
    expect(t('toast.rowInsertedBelow')).toBe('已在下方插入行（Ctrl+Z 可撤销）')
    expect(t('toast.rowInsertedAbove')).toBe('已在上方插入行（Ctrl+Z 可撤销）')
    expect(t('toast.colInsertedLeft')).toBe('已在左侧插入列（Ctrl+Z 可撤销）')
    expect(t('toast.colInsertedRight')).toBe('已在右侧插入列（Ctrl+Z 可撤销）')
  })
})

// ---- 6) FE-07 AC-OP-12: Mod-z in-cell undo fallback (three-entry) -----------

describe('Mod-z in-cell undo fallback (FE-07 AC-OP-12 three-entry)', () => {
  const main = {} as EditorView

  /** Headless nested cell view carrying a real history() stack. */
  function nestedWithHistory(doc: string): { view: EditorView; getDoc: () => string } {
    let state = EditorState.create({ doc, extensions: [history()] })
    const view = {
      get state() {
        return state
      },
      dispatch(spec: { [k: string]: unknown }) {
        state = state.update(spec as never).state
      }
    } as unknown as EditorView
    return { view, getDoc: () => state.doc.toString() }
  }

  it('undoes the nested in-cell history first and never forwards to main', () => {
    const { view: nested, getDoc } = nestedWithHistory('cell')
    nested.dispatch({ changes: { from: 0, insert: 'X' } })
    expect(getDoc()).toBe('Xcell')
    const forwards: EditorView[] = []
    const { nav } = navSpy()
    const bindings = cellKeymap(main, {
      ...nav,
      undoMain: (m) => (forwards.push(m), true)
    })
    expect(runKey(bindings, 'Mod-z', nested)).toBe(true)
    expect(getDoc()).toBe('cell')
    expect(forwards).toEqual([])
  })

  it('forwards to nav.undoMain when the nested history is empty (post structure-op)', () => {
    const { view: nested } = nestedWithHistory('cell')
    const forwards: EditorView[] = []
    const { nav } = navSpy()
    const bindings = cellKeymap(main, {
      ...nav,
      undoMain: (m) => (forwards.push(m), true)
    })
    // The state right after a table structure op: the nested cell editor holds
    // focus with an empty history — Mod-z must reach the MAIN history (the
    // structure-op stack) instead of dying in historyKeymap's preventDefault.
    expect(runKey(bindings, 'Mod-z', nested)).toBe(true)
    expect(forwards).toEqual([main])
  })

  it('falls through (false) when neither history has an undoable step', () => {
    const { view: nested } = nestedWithHistory('cell')
    const { nav } = navSpy()
    const bindings = cellKeymap(main, { ...nav, undoMain: () => false })
    expect(runKey(bindings, 'Mod-z', nested)).toBe(false)
  })
})
