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
import { undo } from '@codemirror/commands'
import type { Extension } from '@codemirror/state'

export type Dir = 'next' | 'prev' | 'up' | 'down' | 'out'

export type MoveCellFn = (nested: EditorView, main: EditorView, dir: Dir) => void

/**
 * Structure-op vocabulary — values are the TBL §3.1 op ids (four-face same
 * source: shortcut / toolbar / ⋮ menu / cell context menu).
 */
export type StructCmd =
  | 'insertRowBelow'
  | 'insertRowAbove'
  | 'insertColLeft'
  | 'insertColRight'
  | 'moveRowUp'
  | 'moveRowDown'
  | 'moveColLeft'
  | 'moveColRight'

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
  /** Q8 keyboard channel (FE-04): Shift+F10 / Menu key → ⋮=right-click menu. */
  openMenu: (main: EditorView) => boolean
  /**
   * FE-07/glb-undo:triple-entry (AC-OP-12): one undo step on the MAIN doc's
   * history with the frozen「已撤销」ack. The in-cell Mod-z falls back to this
   * when the nested history is empty (the state right after a structure op).
   */
  undoMain: (main: EditorView) => boolean
}

/**
 * Shared binding table — key literals live here ONCE for both the in-cell
 * keymap and the main-editor backstop (shortcut hints / ⋮ menu echo derive
 * from this source — AC-RULE-11 zero exceptions).
 *
 * TBL §3.2 frozen 5 groups (Shift-upshift regime):
 *   ① 基础档   Ctrl+Enter          → insertRowBelow (PEND-13: dedicated insert,
 *                                    never a line break — breaks stay Shift+Enter)
 *   ② Shift 升档 Ctrl+Shift+Enter  → insertRowAbove (i=1 header migration, Q5)
 *   ③ Shift 升档 Ctrl+Shift+→     → insertColRight (Q4: only with empty selection)
 *   ④ Shift 升档 Ctrl+Shift+←     → insertColLeft  (Q4: only with empty selection)
 *   ⑤ 移动族   Alt+↑/↓/←/→        → moveRowUp/Down, moveColLeft/Right
 */
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

/**
 * Q4 context split (TBL §3.3, AC-PEND-03 收口): Ctrl+Shift+←/→ share their
 * chords with the in-cell word-selection extension. The binding consults
 * `selection.empty` at keydown — a text selection open means "extend the
 * selection" wins (return false → CM6 default Mod-Shift-Arrow group-select
 * continues); only a caret-only (empty) selection inserts a column.
 */
export function structCmdTakesKey(cmd: StructCmd, selectionEmpty: boolean): boolean {
  return selectionEmpty || (cmd !== 'insertColLeft' && cmd !== 'insertColRight')
}

export function structKeyBindings(tryRun: StructTryFn): KeyBinding[] {
  return STRUCT_KEYS.map(({ key, cmd }) => ({
    key,
    run: (v: EditorView) => structCmdTakesKey(cmd, v.state.selection.main.empty) && tryRun(v, cmd)
  }))
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

/**
 * Q8 keyboard channel (FE-04): Shift+F10 / Menu key open the ⋮=right-click
 * same-source menu. The run callback returns true when taken (table edit
 * active); false falls through — non-table contexts must not be hijacked
 * (AC-ERR-12). Shared by the in-cell keymap and the main-editor backstop.
 */
export function menuKeyBindings(tryOpen: (view: EditorView) => boolean): KeyBinding[] {
  return [
    { key: 'Shift-F10', run: tryOpen },
    { key: 'ContextMenu', run: tryOpen }
  ]
}

export function cellKeymap(main: EditorView, nav: NestedNavFns): KeyBinding[] {
  const move = nav.move
  return [
    // 7B: structure shortcuts — cmd runs against `main` (the table session).
    ...structKeyBindings((_v, cmd) => nav.struct(main, cmd)),
    // Q8: Shift+F10 / Menu key → same-source context menu.
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
    // FE-07/AC-OP-12 (glb-undo:triple-entry): in-cell Mod-z undoes nested
    // typing history first and falls back to the MAIN step (structure-op
    // stack) + frozen「已撤销」ack. Must sit before historyKeymap's Mod-z —
    // that binding is preventDefault:true and swallows the key when the
    // nested history is empty, while the widget's ignoreEvent keeps the
    // outer binding from ever seeing the event.
    { key: 'Mod-z', run: (v) => undo(v) || nav.undoMain(main) },
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
