import { useEffect, useMemo, useRef } from 'react'
import { t } from '../i18n'
import {
  buildTableMarkdown,
  convertSelectionToTable,
  type TableAlign
} from '../editor/table/insert'
import { sniffDelimiter, type DelimKind } from '../editor/table/ops'

export type TableDialogMode = 'insert' | 'convert'

export interface TableInsertForm {
  rows: number
  cols: number
  hoverRow: number
  hoverCol: number
  align: TableAlign
  headerPrefix: boolean
  delim?: DelimKind
}

export const defaultTableForm = (): TableInsertForm => ({
  rows: 2,
  cols: 3,
  hoverRow: 2,
  hoverCol: 3,
  align: '' as TableAlign,
  headerPrefix: true,
  delim: undefined
})

const GRID_MAX_ROW = 20
const GRID_MAX_COL = 12
const ALIGN_KEYS: Array<{ value: TableAlign; key: string }> = [
  { value: '', key: 'tableInsert.alignNone' },
  { value: 'left', key: 'tableInsert.alignLeft' },
  { value: 'center', key: 'tableInsert.alignCenter' },
  { value: 'right', key: 'tableInsert.alignRight' }
]
const DELIM_KEYS: DelimKind[] = ['tab', 'comma', 'pipe', 'spaces']

interface Props {
  open: TableDialogMode | null
  form: TableInsertForm
  selectionText: string
  onClose: () => void
  onFormChange: (patch: Partial<TableInsertForm>) => void
  onConfirm: () => void
}

/**
 * P22 controlled table dialog — insert builds a blank grid, convert re-parses
 * the captured selection. The grid is mouse-first; keyboard arrows + Enter
 * drive the same hover/click state (acceptance ⑤).
 */
export function TableInsertDialog({ open, form, selectionText, onClose, onFormChange, onConfirm }: Props) {
  const gridRef = useRef<HTMLDivElement | null>(null)
  // Optimistic mirror of `form`: rapid key repeats compute against the value
  // the previous key produced even before React re-renders the prop.
  const formRef = useRef(form)
  formRef.current = form

  // Sniff once per open in convert mode (form.delim may already be user-set).
  const sniffed = useMemo(
    () => (open === 'convert' ? sniffDelimiter(selectionText) : undefined),
    [open, selectionText]
  )
  const delim: DelimKind = form.delim ?? sniffed ?? 'tab'

  useEffect(() => {
    if (!open) return
    const el = gridRef.current
    if (el) el.focus()
  }, [open])

  if (!open) return null

  const preview =
    open === 'insert'
      ? buildTableMarkdown(form.rows, form.cols, form.align, form.headerPrefix)
      : convertSelectionToTable(selectionText, delim)

  const onKey = (e: React.KeyboardEvent): void => {
    const base = formRef.current
    let { hoverRow, hoverCol } = base
    if (e.key === 'ArrowDown') hoverRow = Math.min(GRID_MAX_ROW, hoverRow + 1)
    else if (e.key === 'ArrowUp') hoverRow = Math.max(1, hoverRow - 1)
    else if (e.key === 'ArrowRight') hoverCol = Math.min(GRID_MAX_COL, hoverCol + 1)
    else if (e.key === 'ArrowLeft') hoverCol = Math.max(1, hoverCol - 1)
    else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open === 'insert') {
        const patch = { rows: hoverRow, cols: hoverCol }
        formRef.current = { ...base, ...patch }
        onFormChange(patch)
      }
      onConfirm()
      return
    } else return
    e.preventDefault()
    const patch: Partial<TableInsertForm> = { hoverRow, hoverCol }
    if (open === 'insert') {
      patch.rows = hoverRow
      patch.cols = hoverCol
    }
    formRef.current = { ...base, ...patch }
    onFormChange(patch)
  }

  const cells = []
  for (let r = 1; r <= GRID_MAX_ROW; r++) {
    for (let c = 1; c <= GRID_MAX_COL; c++) {
      const hot = r <= form.hoverRow && c <= form.hoverCol
      cells.push(
        <button
          key={`${r}-${c}`}
          type="button"
          className={`table-insert-cell${hot ? ' is-hover' : ''}`}
          onMouseEnter={() => {
            const patch: Partial<TableInsertForm> = { hoverRow: r, hoverCol: c }
            if (open === 'insert') {
              patch.rows = r
              patch.cols = c
            }
            onFormChange(patch)
          }}
          onClick={() => {
            const patch: Partial<TableInsertForm> = { hoverRow: r, hoverCol: c }
            if (open === 'insert') {
              patch.rows = r
              patch.cols = c
            }
            onFormChange(patch)
            onConfirm()
          }}
        />
      )
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog prefs-dialog table-insert-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <div className="dialog-title">
          {t(open === 'insert' ? 'tableInsert.insertTitle' : 'tableInsert.convertTitle')}
        </div>

        {open === 'insert' ? (
          <>
            <div
              className="table-insert-grid"
              ref={gridRef}
              tabIndex={0}
              role="grid"
              aria-label={t('tableInsert.insertTitle')}
            >
              {cells}
            </div>
            <div className="prefs-row">
              <label>
                {t('tableInsert.rows')}{' '}
                <input
                  data-testid="table-rows"
                  type="number"
                  min={1}
                  max={GRID_MAX_ROW}
                  value={form.rows}
                  onChange={(e) => onFormChange({ rows: Number(e.target.value) || 1 })}
                />
              </label>
              <label>
                {t('tableInsert.cols')}{' '}
                <input
                  data-testid="table-cols"
                  type="number"
                  min={1}
                  max={GRID_MAX_COL}
                  value={form.cols}
                  onChange={(e) => onFormChange({ cols: Number(e.target.value) || 1 })}
                />
              </label>
            </div>
            <div className="prefs-row">
              <span>{t('tableInsert.align')}</span>
              {ALIGN_KEYS.map((a) => (
                <label key={a.value || 'none'}>
                  <input
                    type="radio"
                    name="table-align"
                    checked={form.align === a.value}
                    onChange={() => onFormChange({ align: a.value })}
                  />
                  {t(a.key)}
                </label>
              ))}
            </div>
            <div className="prefs-row">
              <label>
                <input
                  type="checkbox"
                  checked={form.headerPrefix}
                  onChange={(e) => onFormChange({ headerPrefix: e.target.checked })}
                />
                {t('tableInsert.headerPrefix')}
              </label>
            </div>
          </>
        ) : (
          <>
            <div className="prefs-row table-insert-delim" ref={gridRef} tabIndex={0} role="radiogroup">
              {DELIM_KEYS.map((k) => (
                <label key={k}>
                  <input
                    type="radio"
                    name="table-delim"
                    checked={delim === k}
                    onChange={() => onFormChange({ delim: k })}
                  />
                  {t(`tableInsert.${k}`)}
                </label>
              ))}
              <span className="table-insert-sniff">{t('tableInsert.sniffed', { kind: t(`tableInsert.${sniffed ?? 'tab'}`) })}</span>
            </div>
          </>
        )}

        <pre className="table-insert-preview" data-testid="table-preview">{preview}</pre>

        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>
            {t('dialog.cancel')}
          </button>
          <button type="button" className="primary" onClick={onConfirm}>
            {t('tableInsert.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
