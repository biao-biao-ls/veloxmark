/**
 * In-cell keymap / theme / TSV paste factories (task 3.10) — bodies moved
 * verbatim from table/widget.ts. Navigation vocabulary (`Dir`/`NestedNavFns`)
 * lives here with the bindings.
 *
 * Cycle-break seam: this module must NOT import commands.ts — the move/exit/
 * tsv actions enter as parameters (`NestedNavFns`, injected by the
 * mountCellEditor caller). Same precedent as setNestedPreviewField (1D).
 * Keep keymap.ts free of project-local value imports.
 */
import { EditorView, keymap, type KeyBinding } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

export type Dir = 'next' | 'prev' | 'up' | 'down' | 'out'

export type MoveCellFn = (nested: EditorView, main: EditorView, dir: Dir) => void

/** 7B structure-op vocabulary (Ctrl+Enter / Alt+arrows — Typora parity). */
export type StructCmd = 'insertRowBelow' | 'moveRowUp' | 'moveRowDown' | 'moveColLeft' | 'moveColRight'

/**
 * 7B handler: run `cmd` against the table editing session of `view` (the MAIN
 * view). Returns true when the key was taken — false falls through to the
 * default bindings (non-table contexts must not be hijacked).
 */
export type StructTryFn = (view: EditorView, cmd: StructCmd) => boolean

/**
 * Command callbacks the nested session needs — injected so nestedSession →
 * keymap stays acyclic (see file header).
 */
export interface NestedNavFns {
  move: MoveCellFn
  exit: (main: EditorView, opts?: { select?: 'none' | 'after' }) => void
  tsv: (main: EditorView, text: string) => void
  struct: StructTryFn
}

/**
 * 7B shared binding table — key literals live here ONCE for both the in-cell
 * keymap and the main-editor backstop (⑨ shortcut hints read this source).
 */
export const STRUCT_KEYS: ReadonlyArray<{ key: string; cmd: StructCmd }> = [
  { key: 'Ctrl-Enter', cmd: 'insertRowBelow' },
  { key: 'Alt-ArrowUp', cmd: 'moveRowUp' },
  { key: 'Alt-ArrowDown', cmd: 'moveRowDown' },
  { key: 'Alt-ArrowLeft', cmd: 'moveColLeft' },
  { key: 'Alt-ArrowRight', cmd: 'moveColRight' }
]

export function structKeyBindings(tryRun: StructTryFn): KeyBinding[] {
  return STRUCT_KEYS.map(({ key, cmd }) => ({ key, run: (v: EditorView) => tryRun(v, cmd) }))
}

/** Arrow-name → glyph for shortcut-hint display (7D). */
const KEY_GLYPHS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→'
}

/**
 * 7D pure display converter: CM key syntax → fmtShortcut input style
 * (`Ctrl-Enter` → `Ctrl+Enter`, `Alt-ArrowUp` → `Alt+↑`). Enter stays a word
 * (对照 table-btn-4.png: `Ctrl+Enter`). The caller runs fmtShortcut for the
 * mac ⌘/⇧/⌥ pass — this module keeps its zero project-import discipline.
 */
export function cmKeyToDisplay(key: string): string {
  return key
    .split('-')
    .map((seg) => KEY_GLYPHS[seg] ?? seg)
    .join('+')
}

/**
 * Compact theme for the in-cell editor: inherit cell typography, none of the
 * main editor's padding/margins. Decorations (cm-md-strong etc.) come from
 * styles.css and apply globally.
 */
export const nestedCellTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: 'inherit',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    lineHeight: 'inherit',
    // F01: the main editor's theme rules are descendant selectors rooted on
    // the main .cm-editor class, and nested cell editors live inside that
    // DOM tree — plain theme values (40vh content padding, 48px line
    // gutter) cascade in and balloon the cell. Overriding the *variables*
    // at this root wins for every descendant regardless of stylesheet
    // injection order.
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

export function cellKeymap(main: EditorView, nav: NestedNavFns): KeyBinding[] {
  const move = nav.move
  return [
    // 7B: structure shortcuts — cmd runs against `main` (the table session).
    ...structKeyBindings((_v, cmd) => nav.struct(main, cmd)),
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
    { key: 'ArrowLeft', run: (v) => boundaryNav(v, main, 'prev', move) },
    { key: 'ArrowRight', run: (v) => boundaryNav(v, main, 'next', move) },
    // UX-P10 nav-leak: while the in-cell editor holds focus, vertical arrows
    // move the caret INSIDE cell text only — they must not jump cells (probe
    // contract + Google-Sheets edit-mode semantics). Cross-cell motion stays
    // Tab / Shift-Tab / Enter (commit + below) / Esc then arrows.
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

/** TSV paste dom handler — multi-cell plain-text pastes route to the table op. */
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
