/**
 * P27 context-menu registry + menu store.
 *
 * `registerContextMenuOps(kind, factory)` lets block families attach delta
 * ops; `buildContextMenu(view, hit)` assembles the shared skeleton (剪切/
 * 拷贝/粘贴 → 复制为…▶ → 段落▶ → 格式▶ → 插入▶) plus those deltas. The menu
 * itself is stateless presentation — items carry ids + translated labels and
 * the React host (components/EditorContextMenu.tsx) renders what the store
 * holds. Zero business logic in the DOM.
 */
import type { EditorView } from '@codemirror/view'
import { t } from '../../i18n'
import {
  deleteColOp,
  deleteRowOp,
  insertColOp,
  insertRowOp,
  pasteCellOp,
  setAlignOp,
  writeCellOp,
  type TableOp
} from '../table/ops'
import { unescapeCell, type TableModel } from '../table/parse'
import { getTableEdit, setActiveCell } from '../table/state'
import { detectAtCoords } from './detect'
import {
  deleteTableRange,
  formatTableSourceRange,
  markdownToPlainText,
  selectionOrDocMarkdown,
  setHeadingLevel,
  tableMarkdown,
  tableModelOf
} from './transforms'
import type { BlockHit, BlockKind, CtxMenuItem, CtxMenuState, CtxRuntime } from './types'

// ---- runtime + store ---------------------------------------------------------

let runtime: CtxRuntime | null = null
export function setCtxRuntime(rt: CtxRuntime | null): void {
  runtime = rt
}
export function getCtxRuntime(): CtxRuntime | null {
  return runtime
}

let menuState: CtxMenuState | null = null
const listeners = new Set<() => void>()
const FOCUS_RETURN_SEL = '.cm-content'

export function getContextMenuState(): CtxMenuState | null {
  return menuState
}
export function subscribeContextMenu(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function emit(): void {
  for (const fn of [...listeners]) fn()
}
export function openContextMenu(state: CtxMenuState): void {
  menuState = state
  emit()
}
export function closeContextMenu(): void {
  if (!menuState) return
  menuState = null
  emit()
  // Focus contract: return to the editor surface unless focus is somewhere
  // meaningful already (dialog, prefs panel, …).
  const active = document.activeElement as HTMLElement | null
  const meaningful =
    active != null &&
    active.isConnected &&
    active !== document.body &&
    active !== document.documentElement &&
    !active.closest?.('.editor-context-menu, .velox-ctx-menu')
  if (!meaningful) {
    document.querySelector<HTMLElement>(FOCUS_RETURN_SEL)?.focus()
  }
}

// ---- block-op registry -------------------------------------------------------

export type CtxOpFactory = (view: EditorView, hit: BlockHit, rt: CtxRuntime) => CtxMenuItem[]

const blockDeltas = new Map<BlockKind, CtxOpFactory[]>()
// e2e seam: delta registration inventory (probe contract — stable API).
if (typeof window !== 'undefined') {
  ;(window as unknown as { __veloxCtxDebug?: unknown }).__veloxCtxDebug = {
    deltaKinds: () => [...blockDeltas.keys()],
    deltaCount: (kind: string) => (blockDeltas.get(kind as BlockKind) ?? []).length
  }
}
export function registerContextMenuOps(kind: BlockKind, factory: CtxOpFactory): void {
  const list = blockDeltas.get(kind) ?? []
  list.push(factory)
  blockDeltas.set(kind, list)
}

// ---- skeleton ----------------------------------------------------------------

function sep(id: string): CtxMenuItem {
  return { id, label: '', separator: true }
}

function cmdItem(
  rt: CtxRuntime,
  id: string,
  labelKey: string,
  opts: Partial<CtxMenuItem> = {}
): CtxMenuItem {
  // P22-F3: unified disabled state — explicit opts win, else consult the
  // command catalog (buildCommands … isDisabled) through the runtime bridge.
  const disabled = opts.disabled ?? rt.isCommandDisabled?.(id) ?? false
  return {
    id,
    label: t(labelKey),
    run: () => rt.runCommand(id),
    ...opts,
    disabled
  }
}

function paragraphSubmenu(view: EditorView, hit: BlockHit, rt: CtxRuntime, locked: boolean): CtxMenuItem {
  const headingLevel = hit.kind === 'heading' ? hit.headingLevel : undefined
  return {
    id: 'paragraph',
    label: t('ctx.paragraphGroup'),
    submenu: [
      ...[1, 2, 3, 4, 5, 6].map((n) => ({
        id: `heading${n}`,
        label: t(`cmd.heading${n}`),
        checked: headingLevel === n,
        disabled: locked,
        run: () => {
          setHeadingLevel(view, n)
        }
      })),
      {
        id: 'paragraphPlain',
        label: t('cmd.paragraph'),
        checked: hit.kind === 'paragraph',
        disabled: locked,
        run: () => setHeadingLevel(view, 0)
      },
      sep('paragraph-sep'),
      cmdItem(rt, 'blockquote', 'cmd.blockquote', {
        checked: hit.kind === 'blockquote',
        disabled: locked
      }),
      cmdItem(rt, 'listUl', 'cmd.listUl', {
        checked: hit.kind === 'list-ul',
        disabled: locked
      }),
      cmdItem(rt, 'listOl', 'cmd.listOl', {
        checked: hit.kind === 'list-ol',
        disabled: locked
      }),
      cmdItem(rt, 'taskList', 'cmd.taskList', {
        checked: hit.kind === 'task-item',
        disabled: locked
      }),
      sep('paragraph-sep2'),
      cmdItem(rt, 'lift', 'cmd.lift', { disabled: locked })
    ]
  }
}

function formatSubmenu(rt: CtxRuntime, locked: boolean): CtxMenuItem {
  return {
    id: 'format',
    label: t('menu.format'),
    submenu: [
      // wave⑥-6 P23-F4: whole-document format lives with its inline siblings
      // (Edit menu + Shift+Alt+F already dispatch the same command).
      cmdItem(rt, 'formatDocument', 'cmd.formatDocument'),
      sep('format-doc-sep'),
      cmdItem(rt, 'bold', 'cmd.bold', { disabled: locked }),
      cmdItem(rt, 'italic', 'cmd.italic', { disabled: locked }),
      cmdItem(rt, 'inlineCode', 'cmd.inlineCode', { disabled: locked }),
      cmdItem(rt, 'code', 'cmd.code', { disabled: locked }),
      cmdItem(rt, 'strikethrough', 'cmd.strikethrough', { disabled: locked }),
      cmdItem(rt, 'highlight', 'cmd.highlight', { disabled: locked }),
      sep('format-sep'),
      cmdItem(rt, 'insertLink', 'cmd.insertLink', { disabled: locked }),
      cmdItem(rt, 'clearFormat', 'cmd.clearFormat', { disabled: locked })
    ]
  }
}

function insertSubmenu(rt: CtxRuntime): CtxMenuItem {
  return {
    id: 'insert',
    label: t('menu.insert'),
    submenu: [
      cmdItem(rt, 'insertMermaidDiagram', 'cmd.insertMermaidDiagram'),
      cmdItem(rt, 'insertCallout', 'cmd.insertCallout'),
      cmdItem(rt, 'insertTable', 'cmd.insertTable'),
      // P22-F3: convertToTable greys out without a selection (isDisabled).
      cmdItem(rt, 'convertToTable', 'cmd.convertToTable')
    ]
  }
}

function copyAsSubmenu(view: EditorView, rt: CtxRuntime, locked: boolean): CtxMenuItem {
  return {
    id: 'copyAs',
    label: t('ctx.copyAs'),
    disabled: locked,
    submenu: [
      {
        id: 'copyAsMarkdown',
        label: t('cmd.copyAsMarkdown'),
        run: () => {
          void rt.clipboardWrite(selectionOrDocMarkdown(view)).then(() => rt.toast(t('toast.copiedMarkdown')))
        }
      },
      cmdItem(rt, 'copyAsHtml', 'cmd.copyAsHtml'),
      {
        id: 'copyAsPlainText',
        label: t('cmd.copyAsPlainText'),
        run: () => {
          void rt
            .clipboardWrite(markdownToPlainText(selectionOrDocMarkdown(view)))
            .then(() => rt.toast(t('toast.copiedPlain')))
        }
      }
    ]
  }
}

function linkDelta(hit: BlockHit, rt: CtxRuntime): CtxMenuItem[] {
  return [
    {
      id: 'openLink',
      label: t('cmd.openLink'),
      disabled: !hit.href,
      run: () => {
        if (hit.href) rt.openLink(hit.href)
      }
    },
    {
      id: 'copyLinkAddress',
      label: t('cmd.copyLinkAddress'),
      disabled: !hit.href,
      run: () => {
        if (!hit.href) return
        void rt.clipboardWrite(hit.href).then(() => rt.toast(t('toast.copiedLink')))
      }
    },
    sep('link-sep')
  ]
}

/** Assemble skeleton + block deltas for `hit`. */
export function buildContextMenu(view: EditorView, hit: BlockHit): CtxMenuItem[] {
  const rt = runtime
  // e2e debug seam（kind/pos/deltaCount — probe 契约）
  if (typeof window !== 'undefined') {
    ;(window as unknown as { __veloxCtxLastHit?: unknown }).__veloxCtxLastHit = {
      kind: hit.kind,
      pos: hit.pos,
      deltaCount: (blockDeltas.get(hit.kind) ?? []).length
    }
  }
  if (!rt) return []
  const sel = view.state.selection.main
  const selEmpty = sel.from === sel.to
  // task-checkbox: "mostly disabled" — the checkbox owns its own interaction.
  const locked = hit.kind === 'task-checkbox'
  const emptyish = hit.kind === 'empty'

  const items: CtxMenuItem[] = []
  for (const factory of blockDeltas.get(hit.kind) ?? []) {
    items.push(...factory(view, hit, rt))
  }
  if (hit.kind === 'link') items.unshift(...linkDelta(hit, rt))
  if (hit.kind === 'image' && hit.href) items.unshift(...linkDelta(hit, rt))

  items.push(
    {
      id: 'cut',
      label: t('cmd.cut'),
      disabled: selEmpty || locked || emptyish,
      run: () => rt.runCommand('cut')
    },
    {
      id: 'copy',
      label: t('cmd.copy'),
      disabled: selEmpty || emptyish,
      run: () => rt.runCommand('copy')
    },
    {
      id: 'paste',
      label: t('cmd.paste'),
      disabled: locked,
      run: () => rt.runCommand('paste')
    },
    sep('s-copy-as'),
    copyAsSubmenu(view, rt, locked),
    sep('s-paragraph'),
    paragraphSubmenu(view, hit, rt, locked),
    sep('s-format'),
    formatSubmenu(rt, locked),
    sep('s-insert'),
    insertSubmenu(rt)
  )
  return items
}

// ---- table delta (P10 migration: one unified menu) ---------------------------

export interface TableDeltaDeps {
  view: EditorView
  tableFrom: number
  row: number
  col: number
  runOp: (opFn: (m: TableModel) => TableOp | null, userEvent: string) => boolean
  cellClipboard: (mode: 'cut' | 'copy' | 'paste') => void
  modelSpan: () => { from: number; to: number }
}

/**
 * Table-cell delta ops — the P10 context menu's product functions, rebuilt on
 * the unified item surface. Ids are the cdp-p10/cdp-p27 contract; labels go
 * through i18n (the old menu hard-coded English).
 */
export function tableDeltaItems(deps: TableDeltaDeps, rt: CtxRuntime): CtxMenuItem[] {
  const { view, tableFrom, row, col } = deps
  return [
    {
      id: 'insertRowAbove',
      label: t('ctx.insertRowAbove'),
      run: () => deps.runOp((m) => insertRowAboveOp(m, row), 'input.table.insertRow')
    },
    {
      id: 'insertRowBelow',
      label: t('ctx.insertRowBelow'),
      run: () => deps.runOp((m) => insertRowBelowOp(m, row), 'input.table.insertRow')
    },
    {
      id: 'deleteRow',
      label: t('ctx.deleteRow'),
      danger: true,
      run: () => {
        // wave③ toast 统一：结构删除需要完成反馈（插入/对齐保持安静——表格即时可见变化）。
        if (deps.runOp((m) => deleteRowOpSafe(m, row), 'input.table.deleteRow')) {
          rt.toast(t('toast.rowDeleted'))
        }
      }
    },
    {
      id: 'insertColLeft',
      label: t('ctx.insertColLeft'),
      run: () => deps.runOp((m) => insertColLeftOp(m, col), 'input.table.insertCol')
    },
    {
      id: 'insertColRight',
      label: t('ctx.insertColRight'),
      run: () => deps.runOp((m) => insertColRightOp(m, col), 'input.table.insertCol')
    },
    {
      id: 'deleteCol',
      label: t('ctx.deleteCol'),
      danger: true,
      run: () => {
        if (deps.runOp((m) => deleteColOpSafe(m, col), 'input.table.deleteCol')) {
          rt.toast(t('toast.colDeleted'))
        }
      }
    },
    {
      id: 'alignLeft',
      label: t('ctx.alignLeft'),
      run: () => deps.runOp((m) => setAlignLeftOp(m, col), 'input.table.align')
    },
    {
      id: 'alignCenter',
      label: t('ctx.alignCenter'),
      run: () => deps.runOp((m) => setAlignCenterOp(m, col), 'input.table.align')
    },
    {
      id: 'alignRight',
      label: t('ctx.alignRight'),
      run: () => deps.runOp((m) => setAlignRightOp(m, col), 'input.table.align')
    },
    sep('table-sep-cell'),
    { id: 'cutCell', label: t('ctx.cutCell'), run: () => deps.cellClipboard('cut') },
    { id: 'copyCell', label: t('ctx.copyCell'), run: () => deps.cellClipboard('copy') },
    { id: 'pasteCell', label: t('ctx.pasteCell'), run: () => deps.cellClipboard('paste') },
    sep('table-sep-doc'),
    {
      id: 'copyTable',
      label: t('ctx.copyTable'),
      run: () => {
        const span = deps.modelSpan()
        const md = tableMarkdown(view, span.from, span.to)
        if (!md) return
        void rt.clipboardWrite(md).then(() => rt.toast(t('toast.copiedTable')))
      }
    },
    {
      id: 'formatTableSource',
      label: t('ctx.formatTableSource'),
      run: () => {
        const span = deps.modelSpan()
        const changed = formatTableSourceRange(view, span.from, span.to)
        rt.toast(t(changed ? 'toast.tableFormatted' : 'toast.tableUnchanged'))
      }
    },
    {
      id: 'deleteTable',
      label: t('ctx.deleteTable'),
      danger: true,
      run: () => {
        const span = deps.modelSpan()
        void rt
          .confirm({
            title: t('ctx.deleteTable'),
            message: t('ctx.deleteTableConfirm'),
            confirmLabel: t('ctx.deleteTable'),
            danger: true
          })
          .then((ok) => {
            if (ok) {
              deleteTableRange(view, span.from, span.to)
              rt.toast(t('toast.tableDeleted'))
            }
          })
      }
    }
  ]
}

// Op adapters — thin wrappers over the P10 pure ops; deps.runOp supplies the
// dispatch path (widget folds pending cell text; source-mode path dispatches
// straight).
const insertRowAboveOp = (m: TableModel, row: number): TableOp | null => insertRowOp(m, row - 1)
const insertRowBelowOp = (m: TableModel, row: number): TableOp | null => insertRowOp(m, row)
const deleteRowOpSafe = (m: TableModel, row: number): TableOp | null => deleteRowOp(m, row)
const insertColLeftOp = (m: TableModel, col: number): TableOp | null => insertColOp(m, col)
const insertColRightOp = (m: TableModel, col: number): TableOp | null => insertColOp(m, col + 1)
const deleteColOpSafe = (m: TableModel, col: number): TableOp | null => deleteColOp(m, col)
const setAlignLeftOp = (m: TableModel, col: number): TableOp | null => setAlignOp(m, col, 'left')
const setAlignCenterOp = (m: TableModel, col: number): TableOp | null => setAlignOp(m, col, 'center')
const setAlignRightOp = (m: TableModel, col: number): TableOp | null => setAlignOp(m, col, 'right')

/**
 * table-cell delta — single source for the P10 migration ops + the three doc
 * level table actions. Both the widget path (td contextmenu → buildContextMenu
 * with a table-cell hit) and the editor-surface path (detect → same) land here:
 * ops re-parse the model at click time (stale-instance discipline) and dispatch
 * whole-table replaces. Labels are i18n; ids are the cdp-p10/p27 contract.
 */
registerContextMenuOps('table-cell', (view, hit, rt) => {
  const span = hit.table
  if (!span) return []
  const runOp = (opFn: (m: TableModel) => TableOp | null, userEvent: string): boolean => {
    const model = tableModelOf(view, span.from, span.to)
    if (!model) return false
    const op = opFn(model)
    if (!op) return false
    // UX-P28 B3: unify with widget runTableOp semantics — set active cell
    // at op.nextActive (stays in edit mode, no raw-source explosion).
    // Remove the old selection:{anchor:op.from} that triggered enterTable's
    // escape hatch (blockTouched + !isActive → widget suppressed).
    // op.from = model.tableFrom (whole-table rewrite) → post-change table
    // starts at op.from → tableFrom correct.
    const tableFrom = getTableEdit(view.state).active?.tableFrom ?? span.from
    view.dispatch({
      changes: { from: op.from, to: op.to, insert: op.insert },
      effects: setActiveCell.of({
        tableFrom,
        row: op.nextActive.row,
        col: op.nextActive.col,
        caret: 0
      }),
      userEvent
    })
    return true
  }
  return tableDeltaItems(
    {
      view,
      tableFrom: span.from,
      row: span.row,
      col: span.col,
      runOp,
      cellClipboard: (mode) => {
        if (mode === 'paste') {
          void window.api.clipboardRead().then((text) => {
            if (!text) return
            runOp((m) => pasteCellOp(m, span.row, span.col, text), 'input.table.pasteCell')
          })
          return
        }
        const model = tableModelOf(view, span.from, span.to)
        const cell = model?.cells[span.row]?.[span.col]
        const text = cell ? unescapeCell(cell.text) : ''
        void window.api.clipboardWrite(text).then(() => {
          if (mode === 'cut') runOp((m) => writeCellOp(m, span.row, span.col, ''), 'input.table.cutCell')
        })
      },
      modelSpan: () => {
        const fresh = tableModelOf(view, span.from, span.to)
        return fresh ? { from: fresh.tableFrom, to: fresh.tableTo } : { from: span.from, to: span.to }
      }
    },
    rt
  )
})

// ---- entry: editor-surface contextmenu ---------------------------------------

/**
 * setup.ts domEventHandlers entry. Empty-selection → cursor-first (the menu
 * acts on the right-clicked block, not on a stale selection elsewhere).
 * NOTE: no scrollIntoView here — the host treats scroll as "close menu", so an
 * open that scrolls would race itself shut (e2e: useSel opens vanished).
 */
export function handleEditorContextMenu(view: EditorView, e: MouseEvent): void {
  if (!runtime) return
  const hit = detectAtCoords(view, e.clientX, e.clientY)
  const sel = view.state.selection.main
  if (sel.empty && sel.from !== hit.pos) {
    view.dispatch({ selection: { anchor: hit.pos } })
  }
  e.preventDefault()
  openContextMenu({ x: e.clientX, y: e.clientY, items: buildContextMenu(view, hit) })
}

