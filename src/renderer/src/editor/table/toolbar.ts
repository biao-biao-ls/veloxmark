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
  sourceFrom: number
  model: TableModel
  row: number
  col: number
}

export function mountTableToolbar(host: HTMLElement, opts: TableToolbarOpts): void {
  const { view, sourceFrom, model, row, col } = opts
  const bar = document.createElement('div')
  bar.className = 'cm-md-table-toolbar'
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

  group.appendChild(
    btn('grid', '⊞', t('table.gridPickerTitle'), (b) => {
      const resolved = resolveTableModel(view, sourceFrom)
      if (!resolved) return
      openGridPicker(b, {
        initRow: resolved.model.cells.length,
        initCol: resolved.model.colCount,
        fitWidth: view.dom.clientWidth,
        onPick: (rows, nextCols) => {
          const a = getTableEdit(view.state).active
          runTableOp(
            view,
            sourceFrom,
            (m) => resizeTableOp(m, rows, nextCols, a?.row ?? 0, a?.col ?? 0),
            'input.table.resize',
            (w) => w
          )
        }
      })
    })
  )

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

  const sep = document.createElement('div')
  sep.className = 'cm-md-table-toolbar-sep'
  group.appendChild(sep)

  group.appendChild(
    btn('more', '⋮', t('table.moreTitle'), (b) => {
      const act = getTableEdit(view.state).active
      const rect = b.getBoundingClientRect()
      openTableContextMenu(view, sourceFrom, act?.row ?? row, act?.col ?? col, rect.left, rect.bottom + 2)
      b.classList.add('is-source')
      const off = subscribeContextMenu(() => {
        b.classList.remove('is-source')
        off()
      })
    })
  )

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
  zoneId: number
}

export function bindTableChromeHost(wrap: HTMLElement, opts: TableChromeHostOpts): void {
  const { editing, view, zoneId } = opts
  if (editing) {
    chromeState.editEnter(zoneId)
    return
  }
  chromeState.editExit(zoneId)
  const bornUnderPointer = wrap.matches(':hover')
  if (bornUnderPointer) chromeState.retarget(wrap)
  let leftOnce = false
  wrap.addEventListener('pointerenter', (e) => {
    if (e.buttons !== 0) return
    if (!chromeAllowed(view.state.selection.main.empty)) return
    const related = e.relatedTarget
    const fromOutside = !(related instanceof Element) || !related.closest('.cm-md-table-wrap')
    chromeState.enter(wrap, { boundary: fromOutside && (!bornUnderPointer || leftOnce) })
  })
  wrap.addEventListener('pointerleave', () => {
    leftOnce = true
    chromeState.leave(wrap)
  })
}
