import type { EditorView } from '@codemirror/view'
import { t } from '../../i18n'
import { hushLayers } from '../../hooks/useHushLayer'
import { chromeAllowed } from '../clickSemantics'
import { subscribeContextMenu } from '../contextMenu/ctxMenuStore'
import { confirmDeleteTable } from '../contextMenu/opsTable'
import { getCtxRuntime } from '../contextMenu/registry'
import { chromeState } from './chromeState'
import { exitTableEdit, openTableContextMenu, runTableOp, toastTableOp } from './commands'
import { TOOLBAR_DATA_OP, type ToolbarDataOpKey } from './contract'
import { openGridPicker } from './gridPicker'
import { resizeTableOp, setAlignOp } from './ops'
import { effectiveAlign, type TableModel } from './parse'
import { resolveTableModel } from './resolve'
import { getTableEdit } from './state'

export interface TableToolbarOpts {
  view: EditorView
  /** Widget identity hint — events re-resolve from here (stale-instance). */
  sourceFrom: number
  /** Build-time model — PAINT ONLY (align pressed states). */
  model: TableModel
  /** Build-time active cell (fallback anchors for the event-time reads). */
  row: number
  col: number
}

/**
 * 7C: edit-state table toolbar — ui_02/ui_03 复刻（批 A 裁定, CHANGE-13）:
 * 表格右上浮动紧凑 pill，6 钮单组连续排列「⊞ ◧ ▣ ◨ ｜ ⋮ 🗑」（.tsep 竖线在
 * ⋮ 前）。定位语义 = ui_02 `.table-toolbar` 的 `top:-40px right:0`（对表块）。
 *
 * Layout: absolute bar on the gap outer — NOT inside wrap (`overflow-x: auto`
 * clips escaped children). Paint-only; zero layout shift (UX-P28 F3). Built
 * only while editing; the bar is part of the widget DOM and dies with it.
 *
 * FE-03 契约面: every button carries `data-op` from TOOLBAR_DATA_OP — op-class
 * keys share the opsTable 19 literals (four-surface 同源), ⊞/⋮ keep their
 * entry anchors (change-log CHANGE-3). `.cm-md-table-handle-btn` class stays
 * on the buttons (7G 探针契约) even though the skin is now the ui_02 `.tbtn`.
 *
 * Stale-instance discipline: closures hold `view` + `sourceFrom` hint only —
 * dims/column/anchor re-resolve at event time (getTableEdit / resolveTableModel).
 */
export function mountTableToolbar(host: HTMLElement, opts: TableToolbarOpts): void {
  const { view, sourceFrom, model, row, col } = opts
  const bar = document.createElement('div')
  bar.className = 'cm-md-table-toolbar'
  // Single compact group (ui_02: one cluster + .tsep hairline).
  const group = document.createElement('div')
  group.className = 'cm-md-table-toolbar-group'

  const btn = (
    op: ToolbarDataOpKey,
    glyph: string,
    title: string,
    onClick: (b: HTMLButtonElement) => void
  ): HTMLButtonElement => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'cm-md-table-handle-btn cm-md-table-toolbar-btn'
    b.dataset.op = TOOLBAR_DATA_OP[op]
    b.dataset.testid = `table-toolbar-${op.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}-btn`
    b.textContent = glyph
    b.title = title
    // Never let toolbar presses fall through to outer's click-to-source.
    b.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    b.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      onClick(b)
    })
    return b
  }

  // ⊞ — 7E grid picker, moved here from the hover bar (its interim home).
  group.appendChild(
    btn('grid', '⊞', t('table.gridPickerTitle'), (b) => {
      const resolved = resolveTableModel(view, sourceFrom)
      if (!resolved) return
      openGridPicker(b, {
        initRow: resolved.model.cells.length,
        initCol: resolved.model.colCount,
        // FE-05「自动适应窗口」estimates columns from the editor content width.
        fitWidth: view.dom.clientWidth,
        onPick: (rows, nextCols) => {
          const a = getTableEdit(view.state).active
          runTableOp(
            view,
            sourceFrom,
            (m) => resizeTableOp(m, rows, nextCols, a?.row ?? 0, a?.col ?? 0),
            'input.table.resize',
            // FE-06/AC-ERR-03: resize only grows/shrinks at the far edge —
            // identity remap + sanitize drops residue / pads the new columns.
            (w) => w
          )
        }
      })
    })
  )

  // Align keys (7.4) — same setAlignOp + input.table.align as the menu items;
  // pressed state paints the build-time colon row (rebuilds track the source).
  // UI-IXD-04 / CHANGE-14: echo through effectiveAlign — GFM `---` (no colons)
  // renders left-aligned, so the left key must read as pressed for it too.
  const alignAtBuild = effectiveAlign(model.aligns[col] ?? '')
  for (const a of [
    { op: 'alignLeft', glyph: '◧', title: t('ctx.alignLeft'), value: 'left' },
    { op: 'alignCenter', glyph: '▣', title: t('ctx.alignCenter'), value: 'center' },
    { op: 'alignRight', glyph: '◨', title: t('ctx.alignRight'), value: 'right' }
  ] as const) {
    const b = btn(a.op, a.glyph, a.title, () => {
      const targetCol = getTableEdit(view.state).active?.col ?? col
      const targetRow = getTableEdit(view.state).active?.row ?? row
      if (runTableOp(view, sourceFrom, (m) => setAlignOp(m, targetCol, a.value), 'input.table.align')) {
        toastTableOp(view, a.op, { row: targetRow, col: targetCol })
      }
    })
    if (alignAtBuild === a.value) b.classList.add('is-pressed')
    group.appendChild(b)
  }

  // ui_02 .tsep: 1px×18px hairline before ⋮ (single-cluster rhythm).
  const sep = document.createElement('div')
  sep.className = 'cm-md-table-toolbar-sep'
  group.appendChild(sep)

  // ⋮ — the SAME menu as a cell right-click (ids/items/disabled stay one surface).
  group.appendChild(
    btn('more', '⋮', t('table.moreTitle'), (b) => {
      const act = getTableEdit(view.state).active
      const rect = b.getBoundingClientRect()
      openTableContextMenu(view, sourceFrom, act?.row ?? row, act?.col ?? col, rect.left, rect.bottom + 2)
      // ui_03 .tool-btn.source (FE-04#6): accent-solid while its menu is open.
      // Armed AFTER openContextMenu's emit so the open itself doesn't clear it;
      // the next state change (close / another open) clears + unsubscribes.
      b.classList.add('is-source')
      const off = subscribeContextMenu(() => {
        b.classList.remove('is-source')
        off()
      })
    })
  )

  // 🗑 — same confirm + toast as the menu's deleteTable (shared flow).
  // Danger red is the delete-table affordance only (CHANGE-13 / FE-01#3).
  const del = btn('deleteTable', '🗑', t('ctx.deleteTable'), () => {
    const resolved = resolveTableModel(view, sourceFrom)
    if (!resolved) return
    const rt = getCtxRuntime()
    if (!rt) return
    confirmDeleteTable(view, { from: resolved.model.tableFrom, to: resolved.model.tableTo }, rt)
  })
  del.classList.add('is-danger')
  group.appendChild(del)

  bar.append(group)
  host.appendChild(bar)

  // FE-09 (glb-hush:one-shot / glb-hush:boundary): the edit toolbar is the
  // 'chrome' tier of the hush stack — Esc/body-blank from the bus collapses it
  // to quiet (exitTableEdit commits, then the bus returns focus to the body).
  // Table-internal blanks never reach the bus (boundary: graded step-back is
  // the table click router's domain). isAlive prunes on widget teardown; the
  // identity-guarded unregister keeps a remounted bar's registration intact.
  hushLayers.register({
    id: 'table-toolbar',
    tier: 'chrome',
    close: () => exitTableEdit(view),
    owns: (target) => target instanceof Node && bar.contains(target),
    isAlive: () => bar.isConnected
  })
}

export interface TableChromeHostOpts {
  editing: boolean
  view: EditorView
  /** Stable widget identity (sourceFrom) — edit-session guard across rebuilds. */
  zoneId: number
}

/**
 * FE-10 chrome 显隐宿主: wires one table wrap into the four-state machine
 * (chromeState.ts 收口单点). Hover enter/leave debounces the micro-control
 * reveal (≥150ms both ways; leave before the show fires cancels it); the
 * edit session enters its phase immediately (toolbar/grips are structural
 * there). `retarget` keeps a live hover dwell across widget DOM rebuilds
 * (the wrap element dies with every eq()-failed remount).
 */
export function bindTableChromeHost(wrap: HTMLElement, opts: TableChromeHostOpts): void {
  const { editing, view, zoneId } = opts
  if (editing) {
    chromeState.editEnter(zoneId)
    return
  }
  chromeState.editExit(zoneId)
  // Rebuild under a resting pointer: the NEW wrap is the hover/paint anchor.
  // After an editExit the machine is quiet-locked (AC-FN-31) — retarget and any
  // synthetic pointerenter from the DOM swap stay no-ops until a real leave.
  const bornUnderPointer = wrap.matches(':hover')
  if (bornUnderPointer) chromeState.retarget(wrap)
  let leftOnce = false
  wrap.addEventListener('pointerenter', (e) => {
    // AC-FN-18: never arm hover chrome mid-drag or while a text selection exists.
    if (e.buttons !== 0) return
    if (!chromeAllowed(view.state.selection.main.empty)) return
    // 真跨界 enter（可穿透 quietLock，AC-NF-04 首 hover 复燃）：relatedTarget
    // 不在任何 wrap 内 = 指针确从区外过来。wrap 生于驻留指针下时，首个 enter
    // 是置换合成事件（无 leave 前序）——不算跨界，锁继续压制（AC-FN-31）。
    const related = e.relatedTarget
    const fromOutside = !(related instanceof Element) || !related.closest('.cm-md-table-wrap')
    chromeState.enter(wrap, { boundary: fromOutside && (!bornUnderPointer || leftOnce) })
  })
  wrap.addEventListener('pointerleave', () => {
    leftOnce = true
    chromeState.leave(wrap)
  })
}
