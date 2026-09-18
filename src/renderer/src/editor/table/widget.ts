import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, type KeyBinding } from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import type { SyntaxNode } from '@lezer/common'
import type { ThemeName } from '../theme'
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
import { showTableMenu, type TableMenuItem } from './menu'
import { getTableEdit, setActiveCell, setColWidth } from './state'
import { formatTable } from './parse'

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
function resolveWithFallback(
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

function activeNestedView(): EditorView | null {
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
    lineHeight: 'inherit'
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
    // Cell docs are single-line (newlines commit as <br>), so up/down on a
    // cell boundary always means cross-cell movement (Typora semantics).
    { key: 'ArrowUp', run: (v) => (moveCell(v, main, 'up'), true) },
    { key: 'ArrowDown', run: (v) => (moveCell(v, main, 'down'), true) }
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
    const change = cellChange()
    main.dispatch({
      changes: cellChanged && !change
        ? { from: model.tableFrom, to: model.tableTo, insert: formatTable(model.aligns, gridWithPending()) }
        : change ?? undefined,
      effects: setActiveCell.of(null),
      userEvent: 'input.table.exit'
    })
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

function activateCellAt(main: EditorView, tableFromHint: number, row: number, col: number): void {
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
      caret: target && !isSentinelCell(target) ? target.text.length : 0
    }),
    userEvent: 'input.table.activate'
  })
}

function clearTableEditAndFocusSource(main: EditorView, sourceFrom: number): void {
  commitActiveOnly(main)
  main.dispatch({
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

// ---- context menu ------------------------------------------------------------

function openTableContextMenu(
  main: EditorView,
  tableFromHint: number,
  row: number,
  col: number,
  x: number,
  y: number
): void {
  commitActiveOnly(main, tableFromHint)
  const items: TableMenuItem[] = [
    {
      label: 'Insert row above',
      action: () => runTableOp(main, tableFromHint, (m) => insertRowOp(m, row - 1), 'input.table.insertRow')
    },
    {
      label: 'Insert row below',
      action: () => runTableOp(main, tableFromHint, (m) => insertRowOp(m, row), 'input.table.insertRow')
    },
    {
      label: 'Delete row',
      danger: true,
      action: () => runTableOp(main, tableFromHint, (m) => deleteRowOp(m, row), 'input.table.deleteRow')
    },
    {
      label: 'Insert column left',
      action: () => runTableOp(main, tableFromHint, (m) => insertColOp(m, col), 'input.table.insertCol')
    },
    {
      label: 'Insert column right',
      action: () => runTableOp(main, tableFromHint, (m) => insertColOp(m, col + 1), 'input.table.insertCol')
    },
    {
      label: 'Delete column',
      danger: true,
      action: () => runTableOp(main, tableFromHint, (m) => deleteColOp(m, col), 'input.table.deleteCol')
    },
    { label: 'Align left', action: () => runTableOp(main, tableFromHint, (m) => setAlignOp(m, col, 'left'), 'input.table.align') },
    { label: 'Align center', action: () => runTableOp(main, tableFromHint, (m) => setAlignOp(m, col, 'center'), 'input.table.align') },
    { label: 'Align right', action: () => runTableOp(main, tableFromHint, (m) => setAlignOp(m, col, 'right'), 'input.table.align') },
    { label: 'Cut cell', action: () => cellClipboard(main, tableFromHint, row, col, 'cut') },
    { label: 'Copy cell', action: () => cellClipboard(main, tableFromHint, row, col, 'copy') },
    { label: 'Paste cell', action: () => cellClipboard(main, tableFromHint, row, col, 'paste') }
  ]
  showTableMenu(x, y, items)
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
          mode: 'live',
          focusMode: false,
          typewriterMode: false
        }),
        nestedCellTheme,
        EditorView.lineWrapping,
        history(),
        keymap.of([...cellKeymap(main), ...defaultKeymap, ...historyKeymap]),
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
  nested.focus()
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

export class TableWidget extends BlockWidget {
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
      (other.spec.active?.row ?? -1) === (this.spec.active?.row ?? -1) &&
      (other.spec.active?.col ?? -1) === (this.spec.active?.col ?? -1) &&
      widthsEqual(other.spec.colWidths, this.spec.colWidths)
    )
    // caret intentionally excluded: caret-only changes reuse the DOM.
  }

  toDOM(view: EditorView): HTMLElement {
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

    const rowHandleCell = (uiRow: number): HTMLElement => {
      const th = document.createElement('th')
      th.className = 'cm-md-handle-cell cm-md-row-handle-cell'
      const canDeleteRow = model.cells.length > 1
      th.append(
        handleBtn('+', 'Insert row below', () =>
          runTableOp(view, this.sourceFrom, (m) => insertRowOp(m, uiRow), 'input.table.insertRow')
        ),
        handleBtn(
          '−',
          'Delete row',
          () =>
            runTableOp(view, this.sourceFrom, (m) => deleteRowOp(m, uiRow), 'input.table.deleteRow'),
          !canDeleteRow
        )
      )
      return th
    }

    const colHandleCell = (col: number): HTMLElement => {
      const th = document.createElement('th')
      th.className = 'cm-md-handle-cell cm-md-col-handle-cell'
      const canDeleteCol = model.colCount > 1
      const grip = document.createElement('span')
      grip.className = 'cm-md-col-grip'
      grip.title = 'Drag to resize column (this session only)'
      grip.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        const headerRow = table.querySelector('thead tr:not(.cm-md-handle-row)')
        const cellEl = headerRow?.children[editing ? col + 1 : col] as HTMLElement | undefined
        if (!cellEl) return
        const startW = cellEl.getBoundingClientRect().width
        const startX = e.clientX
        const applyLive = (w: number): void => {
          const colEl = table.querySelector(`col[data-col="${col}"]`) as HTMLElement | null
          if (colEl) colEl.style.width = `${w}px`
          else {
            // No colgroup yet — stamp widths via cell min-width.
            const hr = table.querySelector('thead tr:not(.cm-md-handle-row)')
            const target = hr?.children[editing ? col + 1 : col] as HTMLElement | undefined
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
      th.append(
        handleBtn('+', 'Insert column left', () =>
          runTableOp(view, this.sourceFrom, (m) => insertColOp(m, col), 'input.table.insertCol')
        ),
        handleBtn(
          '−',
          'Delete column',
          () =>
            runTableOp(view, this.sourceFrom, (m) => deleteColOp(m, col), 'input.table.deleteCol'),
          !canDeleteCol
        ),
        grip
      )
      return th
    }

    const mountCell = (el: HTMLElement, uiRow: number, col: number, cell: CellInfo | undefined): void => {
      el.dataset.row = String(uiRow)
      el.dataset.col = String(col)
      const align = model.aligns[col]
      if (align) el.style.textAlign = align
      const isActive = active != null && active.row === uiRow && active.col === col
      if (isActive) {
        mountCellEditor(el, cell?.text ?? '', this.spec.theme, view, active.caret)
      } else {
        el.innerHTML = renderInlineCell(cell?.text ?? '')
        el.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return
          e.preventDefault()
          e.stopPropagation()
          activateCellAt(view, this.sourceFrom, uiRow, col)
        })
      }
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        openTableContextMenu(view, this.sourceFrom, uiRow, col, e.clientX, e.clientY)
      })
    }

    // Column handle row (only while a cell is active).
    const thead = document.createElement('thead')
    if (editing) {
      const hr = document.createElement('tr')
      hr.className = 'cm-md-handle-row'
      hr.appendChild(document.createElement('th')).className = 'cm-md-handle-cell'
      for (let c = 0; c < model.colCount; c++) hr.appendChild(colHandleCell(c))
      thead.appendChild(hr)
    }

    const headerCells = model.cells[0] ?? []
    const htr = document.createElement('tr')
    if (editing) htr.appendChild(rowHandleCell(0))
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
      if (editing) tr.appendChild(rowHandleCell(r))
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
        label: 'Copy',
        title: 'Copy table as Markdown',
        onClick: (btn) => void this.copyWithFeedback(this.source, btn)
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
  activate(view: EditorView, from: number, row: number, col: number): void {
    activateCellAt(view, from, row, col)
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
    runTableOp(view, from, (m) => table(m, arg), 'test.table.op')
    return true
  },
  pasteTsv(view: EditorView, tsv: string): void {
    handleTsvPaste(view, tsv)
  }
}
if (typeof window !== 'undefined') {
  ;(window as unknown as { __veloxTable?: unknown }).__veloxTable = tableTestHook
}
