import { EditorView, keymap, type KeyBinding } from '@codemirror/view'
import { undo } from '@codemirror/commands'
import type { Extension } from '@codemirror/state'

export type Dir = 'next' | 'prev' | 'up' | 'down' | 'out'

export type MoveCellFn = (nested: EditorView, main: EditorView, dir: Dir) => void

export type StructCmd =
  | 'insertRowBelow'
  | 'insertRowAbove'
  | 'insertColLeft'
  | 'insertColRight'
  | 'moveRowUp'
  | 'moveRowDown'
  | 'moveColLeft'
  | 'moveColRight'

export type StructTryFn = (view: EditorView, cmd: StructCmd) => boolean

export interface NestedNavFns {
  move: MoveCellFn
  exit: (main: EditorView, opts?: { select?: 'none' | 'after' }) => void
  tsv: (main: EditorView, text: string) => void
  struct: StructTryFn
  openMenu: (main: EditorView) => boolean
  undoMain: (main: EditorView) => boolean
}

export const STRUCT_KEYS: ReadonlyArray<{ key: string; cmd: StructCmd }> = [
  { key: 'Ctrl-Enter', cmd: 'insertRowBelow' },
  { key: 'Ctrl-Shift-Enter', cmd: 'insertRowAbove' },
  { key: 'Ctrl-Shift-ArrowRight', cmd: 'insertColRight' },
  { key: 'Ctrl-Shift-ArrowLeft', cmd: 'insertColLeft' },
  { key: 'Alt-ArrowUp', cmd: 'moveRowUp' },
  { key: 'Alt-ArrowDown', cmd: 'moveRowDown' },
  { key: 'Alt-ArrowLeft', cmd: 'moveColLeft' },
  { key: 'Alt-ArrowRight', cmd: 'moveColRight' }
]

export function structCmdTakesKey(cmd: StructCmd, selectionEmpty: boolean): boolean {
  return selectionEmpty || (cmd !== 'insertColLeft' && cmd !== 'insertColRight')
}

export function structKeyBindings(tryRun: StructTryFn): KeyBinding[] {
  return STRUCT_KEYS.map(({ key, cmd }) => ({
    key,
    run: (v: EditorView) => structCmdTakesKey(cmd, v.state.selection.main.empty) && tryRun(v, cmd)
  }))
}

const KEY_GLYPHS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→'
}

export function cmKeyToDisplay(key: string): string {
  return key
    .split('-')
    .map((seg) => KEY_GLYPHS[seg] ?? seg)
    .join('+')
}

export const nestedCellTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: 'inherit',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    lineHeight: 'inherit',
    '--cm-content-padding': '0',
    '--cm-content-max-width': 'none',
    '--editor-gutter': '0'
  },
  '.cm-content': {
    padding: '0',
    margin: '0',
    maxWidth: 'none',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    lineHeight: 'inherit',
    caretColor: 'currentColor'
  },
  '.cm-line': { padding: '0' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: 'currentColor', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(96, 165, 250, 0.35)'
  }
})

export function menuKeyBindings(tryOpen: (view: EditorView) => boolean): KeyBinding[] {
  return [
    { key: 'Shift-F10', run: tryOpen },
    { key: 'ContextMenu', run: tryOpen }
  ]
}

export function cellKeymap(main: EditorView, nav: NestedNavFns): KeyBinding[] {
  const move = nav.move
  return [
    ...structKeyBindings((_v, cmd) => nav.struct(main, cmd)),
    ...menuKeyBindings(() => nav.openMenu(main)),
    { key: 'Tab', run: (v) => (move(v, main, 'next'), true) },
    { key: 'Shift-Tab', run: (v) => (move(v, main, 'prev'), true) },
    { key: 'Enter', run: (v) => (move(v, main, 'down'), true) },
    {
      key: 'Shift-Enter',
      run: (v) => {
        const range = v.state.selection.main
        v.dispatch({
          changes: { from: range.from, to: range.to, insert: '<br>' },
          selection: { anchor: range.from + 4 },
          userEvent: 'input.table.br'
        })
        return true
      }
    },
    { key: 'Escape', run: (v) => (move(v, main, 'out'), true) },
    { key: 'Mod-z', run: (v) => undo(v) || nav.undoMain(main) },
    { key: 'ArrowLeft', run: (v) => boundaryNav(v, main, 'prev', move) },
    { key: 'ArrowRight', run: (v) => boundaryNav(v, main, 'next', move) },
    { key: 'ArrowUp', run: () => false },
    { key: 'ArrowDown', run: () => false }
  ]
}

export function boundaryNav(v: EditorView, main: EditorView, dir: 'prev' | 'next', move: MoveCellFn): boolean {
  const sel = v.state.selection.main
  if (!sel.empty) return false
  if (dir === 'prev' && sel.from === 0) {
    move(v, main, 'prev')
    return true
  }
  if (dir === 'next' && sel.to === v.state.doc.length) {
    move(v, main, 'next')
    return true
  }
  return false
}

export function tsvPasteHandler(main: EditorView, tsv: NestedNavFns['tsv']): Extension {
  return EditorView.domEventHandlers({
    paste(e, v) {
      const text = e.clipboardData?.getData('text/plain') ?? ''
      if (text && (text.includes('\t') || text.includes('\n'))) {
        e.preventDefault()
        tsv(main, text)
        return true
      }
      return false
    }
  })
}
