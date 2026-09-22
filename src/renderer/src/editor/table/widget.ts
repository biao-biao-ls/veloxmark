import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, type KeyBinding } from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import type { SyntaxNode } from '@lezer/common'
import type { ThemeName } from '../theme'
import { t } from '../../i18n'
import { livePreviewField } from '../livePreview/field'
import { livePreviewConfigFacet } from '../livePreview/config'
import { BlockWidget, type BlockToolbarItem } from '../widgets'
import {
  escapeCell,
  isSentinelCell,
  parseTableModel,
  renderInlineCell,
  unescapeCell,
  type CellInfo,
  type TableModel
} from './parse'
import {
  deleteColOp,
  deleteRowOp,
  gridWithCellText,
  insertColOp,
  insertRowOp,
  pasteCellOp,
  pasteTsvOp,
  setAlignOp,
  writeCellOp,
  type TableOp
} from './ops'
import { getTableEdit, setActiveCell, setColWidth } from './state'
import { getCtxRuntime } from '../contextMenu/registry'
import { formatTable } from './parse'
import { buildContextMenu, openContextMenu } from '../contextMenu/registry'

/**
 * P10 interactive table widget.
 *
 * Markdown stays the single source of truth: the widget is still one block
 * replace over the whole table source, but its DOM is a real HTML table.
 * Clicking a cell activates cell-editing state (tableEditField) and mounts a
 * nested CodeMirror view on that cell — so inline marks follow the same
 * P09 live-preview rules as the main editor. Cell commits and row/col ops
 * write back to the table source via precise transactions.
 *
 * Stale-instance discipline (P05 ImageWidget precedent): widget instances are
 * recreated on every decoration rebuild and event closures must NOT capture
 * cell offsets. Every handler re-resolves the table model from `view.state`
 * at event time (resolveTableModel), anchored on `tableFrom` which the
 * tableEditField maps through doc changes.
 */

// ---- model re-resolution -----------------------------------------------------

/** Resolve the Table syntax node covering `approxFrom` and re-parse its source. */
function resolveTableModel(
  view: EditorView,
  approxFrom: number
): { model: TableModel; lineFrom: number } | null {
  const state = view.state
  const tree = syntaxTree(state)
  let node: SyntaxNode | null = tree.resolveInner(approxFrom, 1)
  while (node && node.name !== 'Table') node = node.parent
  if (!node || node.name !== 'Table') {
    let b: SyntaxNode | null = tree.topNode.firstChild
    while (b) {
      if (b.name === 'Table' && b.from <= approxFrom + 4 && approxFrom <= b.to + 4) {
        node = b
        break
      }
      b = b.nextSibling
    }
  }
  if (!node || node.name !== 'Table') return null
  const lineFrom = state.doc.lineAt(node.from).from
  const lineTo = state.doc.lineAt(node.to).to
  return { model: parseTableModel(state.sliceDoc(lineFrom, lineTo), lineFrom), lineFrom }
}

/**
 * Resolve with fallbacks: the active cell's mapped tableFrom first, then the
 * widget-supplied hint (fresh even when the mapped anchor drifted through a
 * large doc replacement, e.g. a test setDoc that swaps the whole document).
 */
export function resolveWithFallback(
  view: EditorView,
  activeFrom: number | null | undefined,
  hintFrom: number
): { model: TableModel; lineFrom: number } | null {
  if (activeFrom != null) {
    const r = resolveTableModel(view, activeFrom)
    if (r) return r
  }
  return resolveTableModel(view, hintFrom)
}

// ---- nested cell editor ------------------------------------------------------

/** The live nested view of the active cell (module-level: widgets are ephemeral). */
let nestedViewInstance: EditorView | null = null

/** Exported for lifecycle.ts self-heal focus (widgets are ephemeral). */
export function activeNestedView(): EditorView | null {
  if (nestedViewInstance && nestedViewInstance.dom.isConnected) return nestedViewInstance
  nestedViewInstance = null
  return null
}

/**
 * Compact theme for the in-cell editor: inherit cell typography, none of the
 * main editor's padding/margins. Decorations (cm-md-strong etc.) come from
 * styles.css and apply globally.
 */
const nestedCellTheme = EditorView.theme({
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

type Dir = 'next' | 'prev' | 'up' | 'down' | 'out'

function cellKeymap(main: EditorView): KeyBinding[] {
  return [
    { key: 'Tab', run: (v) => (moveCell(v, main, 'next'), true) },
    { key: 'Shift-Tab', run: (v) => (moveCell(v, main, 'prev'), true) },
    { key: 'Enter', run: (v) => (moveCell(v, main, 'down'), true) },
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
    { key: 'Escape', run: (v) => (moveCell(v, main, 'out'), true) },
    { key: 'ArrowLeft', run: (v) => boundaryNav(v, main, 'prev') },
    { key: 'ArrowRight', run: (v) => boundaryNav(v, main, 'next') },
    // UX-P10 nav-leak: while the in-cell editor holds focus, vertical arrows
    // move the caret INSIDE cell text only — they must not jump cells (probe
    // contract + Google-Sheets edit-mode semantics). Cross-cell motion stays
    // Tab / Shift-Tab / Enter (commit + below) / Esc then arrows.
    { key: 'ArrowUp', run: () => false },
    { key: 'ArrowDown', run: () => false }
  ]
}

function boundaryNav(v: EditorView, main: EditorView, dir: 'prev' | 'next'): boolean {
  const sel = v.state.selection.main
  if (!sel.empty) return false
  if (dir === 'prev' && sel.from === 0) {
    moveCell(v, main, 'prev')
    return true
  }
  if (dir === 'next' && sel.to === v.state.doc.length) {
    moveCell(v, main, 'next')
    return true
  }
  return false
}

/** Model with the pending nested-cell text folded in (for whole-table ops). */
function modelWithPendingText(
  view: EditorView,
  model: TableModel
): { model: TableModel; lineFrom: number; pending: boolean } | null {
  const edit = getTableEdit(view.state)
  const nested = activeNestedView()
  if (!nested || !edit.active) return { model, lineFrom: model.tableFrom, pending: false }
  const newText = escapeCell(nested.state.doc.toString())
  const cell = model.cells[edit.active.row]?.[edit.active.col]
  if (!cell || isSentinelCell(cell) || newText === cell.text) {
    return { model, lineFrom: model.tableFrom, pending: false }
  }
  const cells = model.cells.map((row, r) =>
    row.map((c, ci) =>
      r === edit.active!.row && ci === edit.active!.col ? { ...c, text: newText } : c
    )
  )
  return { model: { ...model, cells }, lineFrom: model.tableFrom, pending: true }
}

/**
 * Commit the active cell's nested text, then move / exit / clamp.
 * Structural cases (last-cell Tab) rebuild the whole table in ONE transaction
 * together with the commit so undo is a single doc-level step.
 *
 * IMPORTANT: cell commits compare nested text against the ORIGINAL model's
 * cell source — never against a pending-folded copy (that would make
 * `changed` always false and silently drop the write-back).
 */
function moveCell(nested: EditorView, main: EditorView, dir: Dir): void {
  const edit = getTableEdit(main.state)
  if (!edit.active) return
  const resolved = resolveTableModel(main, edit.active.tableFrom)
  if (!resolved) return
  const model = resolved.model
  const lineFrom = resolved.lineFrom
  const a = edit.active
  const nestedText = escapeCell(nested.state.doc.toString())
  const cell = model.cells[a.row]?.[a.col]
  const cellChanged = !!cell && nestedText !== cell.text

  /** Grid carrying the pending cell text — for whole-table rewrites. */
  const gridWithPending = (): string[][] => {
    const grid = model.cells.map((r) => r.map((c) => c.text))
    if (grid[a.row]) {
      while (grid[a.row].length <= a.col) grid[a.row].push('')
      grid[a.row][a.col] = nestedText
    }
    return grid
  }
  /** Cell-range replace when the cell has a real source range; else null. */
  const cellChange = (): { from: number; to: number; insert: string } | null =>
    cellChanged && cell && !isSentinelCell(cell)
      ? { from: cell.from, to: cell.to, insert: nestedText }
      : null

  if (dir === 'out') {
    // UX-P28: use exitTableEdit for consistent commit+clear semantics.
    // For non-sentinel cells, commitActiveOnly handles the commit.
    // Sentinel cell pending (ragged tables) is committed via whole-table
    // rewrite only in the moveCell hop path; 'out' via exitTableEdit skips
    // sentinel (D3 known limitation, out of scope).
    exitTableEdit(main, { select: 'after' })
    main.focus()
    return
  }

  const lastRow = model.cells.length - 1
  const lastCol = model.colCount - 1
  let nextRow = a.row
  let nextCol = a.col
  let structural = false

  switch (dir) {
    case 'next':
      if (a.col < lastCol) nextCol = a.col + 1
      else if (a.row < lastRow) {
        nextRow = a.row + 1
        nextCol = 0
      } else {
        structural = true
        const grid = gridWithPending()
        grid.push(new Array(model.colCount).fill(''))
        main.dispatch({
          changes: { from: model.tableFrom, to: model.tableTo, insert: formatTable(model.aligns, grid) },
          effects: setActiveCell.of({
            tableFrom: lineFrom,
            row: grid.length - 1,
            col: 0,
            caret: 0
          }),
          userEvent: 'input.table.appendRow'
        })
        return
      }
      break
    case 'prev':
      if (a.col > 0) nextCol = a.col - 1
      else if (a.row > 0) {
        nextRow = a.row - 1
        nextCol = lastCol
      }
      break
    case 'down':
      if (a.row < lastRow) nextRow = a.row + 1
      break
    case 'up':
      if (a.row > 0) nextRow = a.row - 1
      break
  }
  if (structural) return

  // Same-cell move (clamped at an edge): just commit; keep the cell active.
  if (nextRow === a.row && nextCol === a.col) {
    const change = cellChange()
    if (change) {
      main.dispatch({ changes: change, userEvent: 'input.table.cell' })
    } else if (cellChanged) {
      main.dispatch({
        changes: {
          from: model.tableFrom,
          to: model.tableTo,
          insert: formatTable(model.aligns, gridWithPending())
        },
        userEvent: 'input.table.cell'
      })
    }
    return
  }

  const target = model.cells[nextRow]?.[nextCol]
  const caret = target && !isSentinelCell(target) ? target.text.length : 0
  const change = cellChange()
  main.dispatch({
    changes:
      change ??
      (cellChanged
        ? {
            from: model.tableFrom,
            to: model.tableTo,
            insert: formatTable(model.aligns, gridWithPending())
          }
        : undefined),
    effects: setActiveCell.of({ tableFrom: lineFrom, row: nextRow, col: nextCol, caret }),
    userEvent: 'input.table.nav'
  })
}

/** Dispatch a whole-table op (handles/menu), folding in any pending cell text. */
/**
 * wave③ toast 统一: structure-destructive ops get a completion toast at the
 * dispatch layer so EVERY caller (widget handles, P27 menu via shared ops,
 * e2e hooks) produces the same visible feedback. Insert/align stay quiet —
 * the table change itself is the feedback.
 */
const STRUCTURE_TOASTS: Record<string, string> = {
  'input.table.deleteRow': 'toast.rowDeleted',
  'input.table.deleteCol': 'toast.colDeleted'
}

function runTableOp(
  main: EditorView,
  tableFromHint: number,
  opFn: (model: TableModel) => TableOp | null,
  userEvent: string
): void {
  const edit = getTableEdit(main.state)
  const resolved = resolveWithFallback(main, edit.active?.tableFrom, tableFromHint)
  if (!resolved) return
  const withPending = modelWithPendingText(main, resolved.model)
  if (!withPending) return
  const op = opFn(withPending.model)
  if (!op) return
  main.dispatch({
    changes: { from: op.from, to: op.to, insert: op.insert },
    effects: setActiveCell.of({
      tableFrom: resolved.lineFrom,
      row: op.nextActive.row,
      col: op.nextActive.col,
      caret: 0
    }),
    userEvent
  })
  const toastKey = STRUCTURE_TOASTS[userEvent]
  if (toastKey) getCtxRuntime()?.toast(t(toastKey))
}

/** Commit pending nested text (if any) without changing the active cell. */
function commitActiveOnly(main: EditorView, hintFrom?: number): void {
  const nested = activeNestedView()
  const edit = getTableEdit(main.state)
  if (!nested || !edit.active) return
  const resolved = resolveWithFallback(main, edit.active.tableFrom, hintFrom ?? edit.active.tableFrom)
  if (!resolved) return
  const cell = resolved.model.cells[edit.active.row]?.[edit.active.col]
  const newText = escapeCell(nested.state.doc.toString())
  if (cell && !isSentinelCell(cell) && newText !== cell.text) {
    main.dispatch({
      changes: { from: cell.from, to: cell.to, insert: newText },
      userEvent: 'input.table.cell'
    })
  }
}

/**
 * UX-P28: commit pending cell text and exit table editing.
 *
 * @param select - 'none' for blur-path (don't change selection);
 *                 'after' for Escape path (place cursor adjacent to table).
 */
export function exitTableEdit(
  main: EditorView,
  opts?: { select?: 'none' | 'after' }
): void {
  const edit = getTableEdit(main.state)
  if (!edit.active) return

  // Commit pending first.
  commitActiveOnly(main)

  const selectMode = opts?.select ?? 'none'
  const spec: Parameters<EditorView['dispatch']>[0] = {
    effects: setActiveCell.of(null),
    userEvent: 'input.table.exit'
  }

  if (selectMode === 'after') {
    const resolved = resolveWithFallback(
      main,
      edit.active.tableFrom,
      edit.active.tableFrom
    )
    if (resolved) {
      const docLen = main.state.doc.length
      const { lineFrom, model } = resolved
      // Place cursor adjacent to table — outside [tableFrom, tableTo] so
      // the enterTable hatch (blockTouched, inclusive) doesn't suppress.
      spec.selection = {
        anchor: model.tableTo < docLen
          ? model.tableTo + 1
          : Math.max(0, lineFrom - 1)
      }
    }
  }

  main.dispatch(spec)
}

function activateCellAt(main: EditorView, tableFromHint: number, row: number, col: number, caretOverride?: number): void {
  const edit = getTableEdit(main.state)
  const resolved = resolveWithFallback(main, edit.active?.tableFrom, tableFromHint)
  if (!resolved) return
  const nested = activeNestedView()
  const changes = []
  // Commit any pending nested-cell text before hopping to the target cell.
  if (nested && edit.active) {
    const a = edit.active
    const orig = resolved.model.cells[a.row]?.[a.col]
    const newText = escapeCell(nested.state.doc.toString())
    if (orig && newText !== orig.text) {
      if (isSentinelCell(orig)) {
        const grid = gridWithCellText(resolved.model, a.row, a.col, newText)
        changes.push({
          from: resolved.model.tableFrom,
          to: resolved.model.tableTo,
          insert: formatTable(resolved.model.aligns, grid)
        })
      } else {
        changes.push({ from: orig.from, to: orig.to, insert: newText })
      }
    }
  }
  const target = resolved.model.cells[row]?.[col]
  main.dispatch({
    changes: changes.length ? changes : undefined,
    effects: setActiveCell.of({
      tableFrom: resolved.lineFrom,
      row,
      col,
      // UX-P28 F2: use click-computed caret when available; else end-of-cell.
      caret: caretOverride != null
        ? Math.min(Math.max(caretOverride, 0), target && !isSentinelCell(target) ? target.text.length : 0)
        : target && !isSentinelCell(target) ? target.text.length : 0
    }),
    userEvent: 'input.table.activate'
  })
}

function clearTableEditAndFocusSource(main: EditorView, sourceFrom: number): void {
  // UX-P28: merge to single dispatch — the old two-dispatch path (commit then
  // selection+clear) would trigger the lifecycle auto-exit listener on the first
  // dispatch (docChanged without setActiveCell, selection still outside table).
  const nested = activeNestedView()
  const edit = getTableEdit(main.state)
  const changes = []
  if (nested && edit.active) {
    const resolved = resolveWithFallback(main, edit.active.tableFrom, sourceFrom)
    const cell = resolved?.model.cells[edit.active.row]?.[edit.active.col]
    const newText = escapeCell(nested.state.doc.toString())
    if (cell && !isSentinelCell(cell) && newText !== cell.text) {
      changes.push({ from: cell.from, to: cell.to, insert: newText })
    }
  }
  main.dispatch({
    changes: changes.length ? changes : undefined,
    selection: { anchor: sourceFrom },
    effects: setActiveCell.of(null),
    scrollIntoView: true,
    userEvent: 'select.table.exit'
  })
}

// ---- TSV paste / clipboard ---------------------------------------------------

function handleTsvPaste(main: EditorView, tsv: string): void {
  const edit = getTableEdit(main.state)
  if (!edit.active) return
  const resolved = resolveWithFallback(main, edit.active.tableFrom, edit.active.tableFrom)
  if (!resolved) return
  const op = pasteTsvOp(resolved.model, edit.active.row, edit.active.col, tsv)
  if (!op) return
  main.dispatch({
    changes: { from: op.from, to: op.to, insert: op.insert },
    effects: setActiveCell.of({
      tableFrom: resolved.lineFrom,
      row: op.nextActive.row,
      col: op.nextActive.col,
      caret: 0
    }),
    userEvent: 'input.table.pasteTsv'
  })
}

function cellClipboard(
  main: EditorView,
  tableFromHint: number,
  row: number,
  col: number,
  mode: 'cut' | 'copy' | 'paste'
): void {
  if (mode === 'paste') {
    void window.api.clipboardRead().then((text) => {
      if (!text) return
      runTableOp(
        main,
        tableFromHint,
        (m) => pasteCellOp(m, row, col, text),
        'input.table.pasteCell'
      )
    })
    return
  }
  const resolved = resolveWithFallback(main, getTableEdit(main.state).active?.tableFrom, tableFromHint)
  const cell = resolved?.model.cells[row]?.[col]
  const text = cell ? unescapeCell(cell.text) : ''
  void window.api.clipboardWrite(text).then(() => {
    if (mode === 'cut') {
      runTableOp(main, tableFromHint, (m) => writeCellOp(m, row, col, ''), 'input.table.cutCell')
    }
  })
}

// ---- context menu (P27: unified .editor-context-menu) -----------------------

function openTableContextMenu(
  main: EditorView,
  tableFromHint: number,
  row: number,
  col: number,
  x: number,
  y: number
): void {
  // Commit any pending nested-cell text first so the shared table-cell delta
  // (registry) parses a fresh source model — one menu surface, no widget-only
  // dispatch path to drift.
  commitActiveOnly(main, tableFromHint)
  const resolved = resolveWithFallback(main, getTableEdit(main.state).active?.tableFrom, tableFromHint)
  const from = resolved?.lineFrom ?? tableFromHint
  const to = resolved?.model.tableTo ?? main.state.doc.length
  openContextMenu({
    x,
    y,
    items: buildContextMenu(main, {
      kind: 'table-cell',
      pos: from,
      lineFrom: from,
      lineTo: to,
      table: { from, to, row, col }
    })
  })
}

// ---- nested view mount -------------------------------------------------------

function mountCellEditor(
  td: HTMLElement,
  cellText: string,
  theme: ThemeName,
  main: EditorView,
  caret: number
): EditorView {
  td.classList.add('cm-md-table-cell-editing')
  td.textContent = ''
  const nested = new EditorView({
    state: EditorState.create({
      doc: cellText,
      extensions: [
        markdown({ extensions: [GFM], addKeymap: false, pasteURLAsLink: false }),
        // P09 live-preview rules inside the cell — same decoration pipeline.
        livePreviewField,
        livePreviewConfigFacet.of({
          theme,
          baseDir: '',
          imageEpoch: 0,
          linkEpoch: 0,
          mode: 'live',
          focusMode: false,
          typewriterMode: false
        }),
        nestedCellTheme,
        EditorView.lineWrapping,
        history(),
        keymap.of([...cellKeymap(main), ...defaultKeymap, ...historyKeymap]),
        // diag-P28 B1-gap: selection-leave auto-exit only fires on MAIN-editor
        // selection changes. Clicks outside the editor (panels, other apps)
        // blur the nested view without touching main selection — exit there
        // too ("失焦即退场"). Deferred so a click that re-enters another cell
        // (or a table handle) can restore focus first and cancel the exit.
        EditorView.updateListener.of((u) => {
          if (!u.focusChanged || u.view.hasFocus) return
          setTimeout(() => {
            // CM6 has no public isDestroyed (destroyed is a private field);
            // a destroyed view's dom is detached from the document.
            if (!main.dom.isConnected) return
            if (!getTableEdit(main.state).active) return
            if (main.hasFocus) return
            const nv = activeNestedView()
            if (nv && nv.hasFocus) return
            const wrap = u.view.dom.closest?.('.cm-md-table-wrap')
            const ae = document.activeElement
            if (wrap && ae && ae !== document.body && wrap.contains(ae)) return
            exitTableEdit(main, { select: 'none' })
          }, 0)
        }),
        EditorView.domEventHandlers({
          paste(e, v) {
            const text = e.clipboardData?.getData('text/plain') ?? ''
            if (text && (text.includes('\t') || text.includes('\n'))) {
              e.preventDefault()
              handleTsvPaste(main, text)
              return true
            }
            return false
          }
        })
      ]
    }),
    parent: td
  })
  ;(td as unknown as { __cellView?: EditorView }).__cellView = nested
  ;(window as unknown as { __veloxTableCellView?: EditorView }).__veloxTableCellView = nested
  nestedViewInstance = nested
  const pos = Math.min(Math.max(caret, 0), nested.state.doc.length)
  nested.dispatch({ selection: { anchor: pos }, scrollIntoView: false })
  // UX-P28 F1 / diag-P28: defer focus until after CM6 inserts the widget DOM
  // into the document (toDOM runs before insertion, so sync focus() is a
  // silent no-op on a detached node). Multi-shot: microtask covers the common
  // case (same task, right after DOM sync); the timeout backstops remount
  // chains. tableEditLifecycle's self-heal listener covers any remaining gap.
  const tryFocus = (): void => {
    if (nested.dom.isConnected) nested.focus()
  }
  queueMicrotask(tryFocus)
  setTimeout(tryFocus, 10)
  return nested
}

// ---- widget ------------------------------------------------------------------

export interface TableWidgetActive {
  row: number
  col: number
  caret: number
}

export interface TableWidgetSpec {
  active: TableWidgetActive | null
  colWidths?: number[]
  theme: ThemeName
  /** wave④: UI-language epoch — handle/toolbar titles are t()-sourced; the
   *  epoch in eq() forces DOM rebuild on language flips. */
  i18nEpoch?: number
}

function widthsEqual(a?: number[], b?: number[]): boolean {
  if (a === b) return true
  if (!a || !b) return (a?.length ?? 0) === 0 && (b?.length ?? 0) === 0
  return a.length === b.length && a.every((w, i) => w === b[i])
}

function handleBtn(
  label: string,
  title: string,
  onClick: () => void,
  disabled = false
): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.className = 'cm-md-table-handle-btn'
  btn.textContent = label
  btn.title = title
  btn.disabled = disabled
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!btn.disabled) onClick()
  })
  return btn
}

// ---- UX-P28: pending text handoff (correctness-critical) -------------------

/**
 * When a widget is destroyed due to a rebuild (theme/colWidths/i18n change),
 * the pending nested text must survive the remount cycle. destroy() captures
 * the pending text into this handoff; mountCellEditor consumes it to seed the
 * new nested view. Without this, a race of destroy→toDOM→microtask-commit
 * would clobber the pending text with stale committed source.
 *
 * Handoff is one-shot: destroy sets it, mountCellEditor consumes and clears.
 */
let pendingHandoff: { key: string; text: string } | null = null
const handoffKey = (t: number, r: number, c: number) => `${t}:${r}:${c}`

export class TableWidget extends BlockWidget {
  /** UX-P28: view reference set in toDOM, used by destroy for microtask dispatch. */
  private _view: EditorView | null = null

  constructor(
    readonly source: string,
    sourceFrom: number,
    sourceTo: number,
    readonly spec: TableWidgetSpec
  ) {
    super(sourceFrom, sourceTo)
  }

  eq(other: TableWidget): boolean {
    return (
      other.source === this.source &&
      other.sourceFrom === this.sourceFrom &&
      other.spec.theme === this.spec.theme &&
      (other.spec.i18nEpoch ?? 0) === (this.spec.i18nEpoch ?? 0) &&
      (other.spec.active?.row ?? -1) === (this.spec.active?.row ?? -1) &&
      (other.spec.active?.col ?? -1) === (this.spec.active?.col ?? -1) &&
      widthsEqual(other.spec.colWidths, this.spec.colWidths)
    )
    // caret intentionally excluded: caret-only changes reuse the DOM.
  }

  toDOM(view: EditorView): HTMLElement {
    this._view = view // UX-P28: store for destroy() microtask dispatch.
    const model = parseTableModel(this.source, this.sourceFrom)
    const active = this.spec.active
    const editing = active != null

    const wrap = document.createElement('div')
    wrap.className = 'cm-md-table-wrap'
    if (editing) wrap.classList.add('cm-md-table-editing')
    wrap.dataset.tableFrom = String(this.sourceFrom)

    const table = document.createElement('table')
    table.className = 'cm-md-table'

    if (this.spec.colWidths?.some((w) => w > 0)) {
      const cg = document.createElement('colgroup')
      for (let c = 0; c < model.colCount; c++) {
        const col = document.createElement('col')
        col.dataset.col = String(c)
        const w = this.spec.colWidths?.[c]
        if (w && w > 0) col.style.width = `${w}px`
        cg.appendChild(col)
      }
      table.appendChild(cg)
    }

    // UX-P28 F3: handle buttons are now absolutely positioned INSIDE content
    // cells (not separate th/td). Row buttons live in td[data-col="0"];
    // col buttons + grip live in header th. This eliminates handle th/tr
    // from the table DOM → pure <table> with zero layout shift.

    const addRowHandles = (el: HTMLElement, uiRow: number): void => {
      const canDeleteRow = model.cells.length > 1
      const btnInsert = handleBtn('+', t('tableHandle.insertRowBelow'), () =>
        runTableOp(view, this.sourceFrom, (m) => insertRowOp(m, uiRow), 'input.table.insertRow')
      )
      btnInsert.className = 'cm-md-table-handle-btn cm-md-table-btn-row-insert'
      btnInsert.dataset.tableHandle = 'row-insert'
      btnInsert.dataset.row = String(uiRow)
      const btnDelete = handleBtn('−', t('tableHandle.deleteRow'), () =>
        runTableOp(view, this.sourceFrom, (m) => deleteRowOp(m, uiRow), 'input.table.deleteRow'),
        !canDeleteRow
      )
      btnDelete.className = 'cm-md-table-handle-btn cm-md-table-btn-row-delete'
      btnDelete.dataset.tableHandle = 'row-delete'
      btnDelete.dataset.row = String(uiRow)
      el.append(btnInsert, btnDelete)
    }

    const addColHandles = (el: HTMLElement, col: number): void => {
      const canDeleteCol = model.colCount > 1
      const btnInsert = handleBtn('+', t('tableHandle.insertColLeft'), () =>
        runTableOp(view, this.sourceFrom, (m) => insertColOp(m, col), 'input.table.insertCol')
      )
      btnInsert.className = 'cm-md-table-handle-btn cm-md-table-btn-col-insert'
      btnInsert.dataset.tableHandle = 'col-insert-left'
      btnInsert.dataset.col = String(col)
      const btnDelete = handleBtn('−', t('tableHandle.deleteCol'), () =>
        runTableOp(view, this.sourceFrom, (m) => deleteColOp(m, col), 'input.table.deleteCol'),
        !canDeleteCol
      )
      btnDelete.className = 'cm-md-table-handle-btn cm-md-table-btn-col-delete'
      btnDelete.dataset.tableHandle = 'col-delete'
      btnDelete.dataset.col = String(col)
      const grip = document.createElement('span')
      grip.className = 'cm-md-col-grip'
      grip.title = t('tableHandle.colGrip')
      grip.dataset.tableHandle = 'col-grip'
      grip.dataset.col = String(col)
      grip.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        // UX-P28 F3: header cell is always children[col] (no handle offset).
        const headerRow = table.querySelector('thead tr')
        const cellEl = headerRow?.children[col] as HTMLElement | undefined
        if (!cellEl) return
        const startW = cellEl.getBoundingClientRect().width
        const startX = e.clientX
        const applyLive = (w: number): void => {
          const colEl = table.querySelector(`col[data-col="${col}"]`) as HTMLElement | null
          if (colEl) colEl.style.width = `${w}px`
          else {
            const target = headerRow?.children[col] as HTMLElement | undefined
            if (target) target.style.minWidth = `${w}px`
          }
        }
        const onMove = (ev: MouseEvent): void => {
          applyLive(Math.max(40, Math.round(startW + (ev.clientX - startX))))
        }
        const onUp = (ev: MouseEvent): void => {
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
          const w = Math.max(40, Math.round(startW + (ev.clientX - startX)))
          const current = getTableEdit(view.state).colWidths.get(this.sourceFrom) ?? []
          const next = [...current]
          while (next.length <= col) next.push(0)
          next[col] = w
          view.dispatch({ effects: setColWidth.of({ tableFrom: this.sourceFrom, widths: next }) })
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      })
      el.append(btnInsert, btnDelete, grip)
    }

    const mountCell = (el: HTMLElement, uiRow: number, col: number, cell: CellInfo | undefined): void => {
      el.dataset.row = String(uiRow)
      el.dataset.col = String(col)
      const align = model.aligns[col]
      if (align) el.style.textAlign = align
      const isActive = active != null && active.row === uiRow && active.col === col
      if (isActive) {
        // UX-P28 D1: consume pendingHandoff if this mount matches the handoff
        // cell — the destroy→remount cycle preserves pending text this way.
        let cellText = cell?.text ?? ''
        if (pendingHandoff) {
          const key = handoffKey(this.sourceFrom, active.row, active.col)
          if (pendingHandoff.key === key) {
            cellText = pendingHandoff.text
            pendingHandoff = null
          }
        }
        mountCellEditor(el, cellText, this.spec.theme, view, active.caret)
      } else {
        el.innerHTML = renderInlineCell(cell?.text ?? '')
        el.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return
          e.preventDefault()
          e.stopPropagation()
          // UX-P28 F2: map click position to caret offset within the rendered
          // cell text, then clamp to cell source length. Plain cells render
          // identically (exact); rich cells approximate (P2 exempt).
          // Skip synthetic (0,0) events (probe hooks) → default end-of-cell.
          let caret: number | undefined
          if (e.clientX !== 0 || e.clientY !== 0) {
            try {
              const pos = document.caretPositionFromPoint?.(e.clientX, e.clientY)
              if (pos && pos.offsetNode && el.contains(pos.offsetNode)) {
                // Walk text nodes to compute char offset within td.textContent.
                const walker = document.createTreeWalker(
                  el,
                  NodeFilter.SHOW_TEXT
                )
                let charOffset = 0
                while (walker.nextNode()) {
                  const node = walker.currentNode
                  if (node === pos.offsetNode) {
                    charOffset += pos.offset
                    break
                  }
                  charOffset += (node.textContent ?? '').length
                }
                const renderedLen = (el.textContent ?? '').length
                const cellTextLen = (cell?.text ?? '').length
                // Proportional mapping: rendered text may differ from source
                // (markdown marks stripped); clamp to cell source length.
                caret = renderedLen > 0
                  ? Math.round((charOffset / renderedLen) * cellTextLen)
                  : undefined
              }
            } catch {
              // caretPositionFromPoint may throw on edge cases; fall back to default.
            }
          }
          activateCellAt(view, this.sourceFrom, uiRow, col, caret)
        })
      }
      // UX-P28 F3: add absolutely-positioned handle buttons in editing mode.
      // Row buttons → first body column cells (td[data-col="0"], uiRow > 0).
      // Col buttons + grip → header cells (uiRow === 0).
      if (editing) {
        if (uiRow === 0) {
          addColHandles(el, col)
        } else if (col === 0) {
          addRowHandles(el, uiRow)
        }
      }
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        openTableContextMenu(view, this.sourceFrom, uiRow, col, e.clientX, e.clientY)
      })
    }

    // UX-P28 F3: pure <table> — no handle th/tr. Handles are absolutely
    // positioned inside content cells via mountCell → addRowHandles/addColHandles.
    const thead = document.createElement('thead')

    const headerCells = model.cells[0] ?? []
    const htr = document.createElement('tr')
    for (let c = 0; c < model.colCount; c++) {
      const th = document.createElement('th')
      mountCell(th, 0, c, headerCells[c])
      htr.appendChild(th)
    }
    thead.appendChild(htr)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    for (let r = 1; r < model.cells.length; r++) {
      const tr = document.createElement('tr')
      for (let c = 0; c < model.colCount; c++) {
        const td = document.createElement('td')
        mountCell(td, r, c, model.cells[r][c])
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    wrap.appendChild(table)

    const toolbarItems: BlockToolbarItem[] = [
      {
        label: t('toolbar.copy'),
        title: t('table.copyTitle'),
        onClick: (btn) => void this.copyWithFeedback(this.source, btn, t('toast.copiedTable'))
      }
    ]
    this.attachBlockToolbar(wrap, toolbarItems)

    // Outer gap wrapper with a custom click-to-source: padding clicks commit
    // any pending cell text, exit cell editing, and jump the cursor to the
    // table source (which then reveals the raw Markdown — existing escape hatch).
    const outer = document.createElement('div')
    outer.className = 'cm-md-block-gap'
    outer.appendChild(wrap)
    outer.addEventListener('mousedown', (e) => {
      if (e.target instanceof Element && e.target.closest('.cm-md-block-toolbar, .cm-md-table')) {
        return
      }
      e.preventDefault()
      clearTableEditAndFocusSource(view, this.sourceFrom)
    })
    return outer
  }

  destroy(dom: HTMLElement): void {
    const cellEl = dom.querySelector('.cm-md-table-cell-editing')
    const host = (cellEl ?? null) as HTMLElement | null
    const maybe = host ? EditorView.findFromDOM(host) : null
    if (maybe && host && host.contains(maybe.dom)) {
      // UX-P28 D1: capture pending text BEFORE destroying the nested view.
      // The handoff ensures the next mount (after rebuild) seeds with this
      // text instead of the stale committed source — preventing the
      // destroy→remount→commit→destroy→"old overwrites PRECIOUS" clobber.
      //
      // diag-P28: the handoff identity MUST be this widget's own active cell
      // (spec.active + sourceFrom). Reading getTableEdit(view.state).active
      // instead would point at the NEW cell on hops (state already moved)
      // while `maybe` still holds the OLD cell's text — the handoff then
      // seeds the hop TARGET with the source cell's text and the microtask
      // clobbers the target's source with it.
      const pendingText = escapeCell(maybe.state.doc.toString())
      const view = this._view
      const own = this.spec.active
      const stateActive = view ? getTableEdit(view.state).active : null
      // Hop (or re-target): activateCellAt/runTableOp already committed this
      // cell's pending text in the same transaction and the new mount owns
      // the session — skip handoff + microtask entirely.
      const isRetarget =
        stateActive != null &&
        (stateActive.row !== own?.row || stateActive.col !== own?.col)
      if (view && own && !isRetarget) {
        const resolved = resolveWithFallback(view, this.sourceFrom, this.sourceFrom)
        const cell = resolved?.model.cells[own.row]?.[own.col]
        const key = handoffKey(this.sourceFrom, own.row, own.col)
        // Only set handoff if pending differs from committed source.
        if (cell && !isSentinelCell(cell) && pendingText !== cell.text) {
          pendingHandoff = { key, text: pendingText }
        }
        // Microtask commit: runs after the CM6 update task completes.
        // Commits pending text without clearing active (rebuild preserves session).
        const capturedView = view
        const capturedRow = own.row
        const capturedCol = own.col
        queueMicrotask(() => {
          try {
            const st = capturedView.state
            const ed = getTableEdit(st)
            if (!ed.active) return // Already cleared (product exit path).
            // Only commit if the active cell still matches what we captured.
            if (ed.active.row !== capturedRow || ed.active.col !== capturedCol) return
            const r = resolveWithFallback(capturedView, ed.active.tableFrom, ed.active.tableFrom)
            const c = r?.model.cells[capturedRow]?.[capturedCol]
            if (!r || !c || isSentinelCell(c)) return
            if (pendingText !== c.text) {
              capturedView.dispatch({
                changes: { from: c.from, to: c.to, insert: pendingText },
                userEvent: 'input.table.cell'
              })
            }
          } catch {
            // View may be destroyed; no-op.
          }
        })
      }
      maybe.destroy()
      if (nestedViewInstance === maybe) nestedViewInstance = null
      const wv = (window as unknown as { __veloxTableCellView?: EditorView }).__veloxTableCellView
      if (wv === maybe) {
        ;(window as unknown as { __veloxTableCellView?: EditorView }).__veloxTableCellView = undefined
      }
    }
  }

  ignoreEvent(): boolean {
    return true
  }
}

// Test/debug hook for CDP scripts (scripts/cdp-p10.mjs) — same pattern as
// window.__veloxEditor. DOM mousedown/contextmenu paths are exercised with
// synthetic events; these helpers drive nav/ops deterministically.
// P15: attached behind a window guard — vitest imports this module in a
// DOM-less node environment for buildDecorations snapshot tests.
const tableTestHook = {
  get nested(): EditorView | null {
    return activeNestedView()
  },
  resolve(view: EditorView, from: number): TableModel | null {
    return resolveTableModel(view, from)?.model ?? null
  },
  activate(view: EditorView, from: number, row: number, col: number, caret?: number): void {
    activateCellAt(view, from, row, col, caret)
  },
  move(view: EditorView, dir: Dir): boolean {
    const n = activeNestedView()
    if (!n) return false
    moveCell(n, view, dir)
    return true
  },
  setCellDoc(text: string): boolean {
    const n = activeNestedView()
    if (!n) return false
    n.dispatch({ changes: { from: 0, to: n.state.doc.length, insert: text } })
    return true
  },
  commit(view: EditorView): void {
    commitActiveOnly(view)
  },
  clearEdit(view: EditorView): void {
    view.dispatch({ effects: setActiveCell.of(null) })
  },
  op(view: EditorView, from: number, kind: string, arg = 0): boolean {
    const table = {
      insertRow: (m: TableModel, x: number) => insertRowOp(m, x),
      deleteRow: (m: TableModel, x: number) => deleteRowOp(m, x),
      insertCol: (m: TableModel, x: number) => insertColOp(m, x),
      deleteCol: (m: TableModel, x: number) => deleteColOp(m, x),
      alignLeft: (m: TableModel, x: number) => setAlignOp(m, x, 'left'),
      alignCenter: (m: TableModel, x: number) => setAlignOp(m, x, 'center'),
      alignRight: (m: TableModel, x: number) => setAlignOp(m, x, 'right')
    }[kind]
    if (!table) return false
    // wave③: drive the SAME userEvents as product paths so dispatch-layer
    // feedback (structure toasts) is exercised end-to-end by probes too.
    const userEvent =
      ({
        insertRow: 'input.table.insertRow',
        deleteRow: 'input.table.deleteRow',
        insertCol: 'input.table.insertCol',
        deleteCol: 'input.table.deleteCol',
        alignLeft: 'input.table.align',
        alignCenter: 'input.table.align',
        alignRight: 'input.table.align'
      } as Record<string, string>)[kind] ?? 'test.table.op'
    runTableOp(view, from, (m) => table(m, arg), userEvent)
    return true
  },
  pasteTsv(view: EditorView, tsv: string): void {
    handleTsvPaste(view, tsv)
  }
}
if (typeof window !== 'undefined') {
  ;(window as unknown as { __veloxTable?: unknown }).__veloxTable = tableTestHook
}
