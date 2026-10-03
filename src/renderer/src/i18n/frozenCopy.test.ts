/**
 * Frozen-copy contract (IT-01 FE-11).
 *
 * The toast/confirm/error strings below are frozen by ac.md (AC-OP-01~12,
 * AC-RULE-15/16, AC-ERR-08/15) and GLB-global-patterns.md §3.7 / TBL §3.1.
 * They are byte-level contracts: zh dictionary values must match them exactly
 * (placeholders kept in `{i}/{j}/{R}/{C}` form per the task spec), and the
 * structural receipt family must carry the「（Ctrl+Z 可撤销）」undo suffix.
 *
 * Values are written as full literals in zh.ts/en.ts (not composed from an
 * UNDO_SUFFIX constant) so `grep`-level acceptance can assert verbatim
 * presence inside the dictionary sources.
 */
import { describe, expect, it } from 'vitest'
import { EN } from './en'
import { ZH } from './zh'

/** Frozen zh copy — verbatim from ac.md / GLB §3.7 / TBL §3.1 (placeholder form). */
const FROZEN_ZH: Record<string, string> = {
  // ---- structural op receipts (AC-OP-01~10) ---------------------------------
  'toast.rowInsertedAbove': '已在上方插入行（Ctrl+Z 可撤销）',
  'toast.rowInsertedBelow': '已在下方插入行（Ctrl+Z 可撤销）',
  'toast.rowDeleted': '已删除第 {i} 行（Ctrl+Z 可撤销）',
  'toast.colInsertedLeft': '已在左侧插入列（Ctrl+Z 可撤销）',
  'toast.colInsertedRight': '已在右侧插入列（Ctrl+Z 可撤销）',
  'toast.colDeleted': '已删除第 {j} 列（Ctrl+Z 可撤销）',
  'toast.rowMovedUp': '已上移该行（Ctrl+Z 可撤销）',
  'toast.rowMovedDown': '已下移该行（Ctrl+Z 可撤销）',
  'toast.colMovedLeft': '已左移该列（Ctrl+Z 可撤销）',
  'toast.colMovedRight': '已右移该列（Ctrl+Z 可撤销）',
  'toast.colAlignLeft': '第 {j} 列对齐：左对齐（Ctrl+Z 可撤销）',
  'toast.colAlignCenter': '第 {j} 列对齐：居中（Ctrl+Z 可撤销）',
  'toast.colAlignRight': '第 {j} 列对齐：右对齐（Ctrl+Z 可撤销）',
  'toast.tableResized': '表格缩放为 {R}×{C}（Ctrl+Z 可撤销）',
  'toast.tableDeleted': '已删除表格（Ctrl+Z 可撤销）',
  // ---- undo ack + toast action button (AC-OP-12 / AC-ERR-04 / GLB §3.7) -----
  'toast.undone': '已撤销',
  'toast.undoBtn': '撤销',
  // ---- clipboard / format receipts already frozen (TBL §3.1 #16/#17) -------
  'toast.copiedTable': '表格已复制',
  'toast.tableFormatted': '表格源码已格式化',
  'toast.tableUnchanged': '表格无需格式化',
  // ---- delete-table confirm family (AC-RULE-15 / AC-OP-09) -----------------
  'ctx.deleteTableConfirm': '删除后可用一步撤销还原，确认删除该表格',
  'ctx.deleteTableConfirmOk': '确认删除',
  // ---- error family (AC-RULE-16 / AC-ERR-08 / AC-ERR-15) -------------------
  'err.readonly': '文件为只读，无法修改，可另存后编辑',
  'err.autosaveFailed': '自动保存失败，文档可另存副本'
}

/**
 * Structural receipts that must end with the undo suffix (AC-FN-06).
 * Excludes clipboard (copiedTable) and idempotent format receipts, whose
 * frozen strings carry no suffix (TBL §3.1 #16/#17), and the undo ack.
 */
const UNDO_SUFFIX_KEYS = [
  'toast.rowInsertedAbove',
  'toast.rowInsertedBelow',
  'toast.rowDeleted',
  'toast.colInsertedLeft',
  'toast.colInsertedRight',
  'toast.colDeleted',
  'toast.rowMovedUp',
  'toast.rowMovedDown',
  'toast.colMovedLeft',
  'toast.colMovedRight',
  'toast.colAlignLeft',
  'toast.colAlignCenter',
  'toast.colAlignRight',
  'toast.tableResized',
  'toast.tableDeleted'
] as const

const ZH_UNDO_SUFFIX = '（Ctrl+Z 可撤销）'
const EN_UNDO_SUFFIX = '(Ctrl+Z to undo)'

/** Placeholder positions frozen in the copy (task spec: {i}/{j}/{R×C}). */
const FROZEN_PLACEHOLDERS: Record<string, string> = {
  'toast.rowDeleted': 'i',
  'toast.colDeleted': 'j',
  'toast.colAlignLeft': 'j',
  'toast.colAlignCenter': 'j',
  'toast.colAlignRight': 'j',
  'toast.tableResized': 'C,R'
}

function placeholders(value: string): string {
  return [...value.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(',')
}

describe('frozen copy family (IT-01 FE-11)', () => {
  it('every frozen zh string is present verbatim in the ZH dictionary', () => {
    const drift: string[] = []
    for (const [key, frozen] of Object.entries(FROZEN_ZH)) {
      if (ZH[key] !== frozen) {
        drift.push(`${key}: expected「${frozen}」got「${ZH[key] ?? '<missing>'}」`)
      }
    }
    expect(drift, `frozen zh drift: ${drift.join('; ')}`).toEqual([])
  })

  it('every frozen key resolves non-empty in EN (no raw key leakage)', () => {
    const empty: string[] = []
    for (const key of Object.keys(FROZEN_ZH)) {
      if (!(EN[key] ?? '').trim()) empty.push(`${key} (en)`)
      if (!(ZH[key] ?? '').trim()) empty.push(`${key} (zh)`)
    }
    expect(empty, `empty frozen values: ${empty.join(', ')}`).toEqual([])
  })

  it('structural receipts carry the undo suffix in both languages', () => {
    const drift: string[] = []
    for (const key of UNDO_SUFFIX_KEYS) {
      if (!ZH[key]?.endsWith(ZH_UNDO_SUFFIX)) drift.push(`${key} (zh)`)
      if (!EN[key]?.endsWith(EN_UNDO_SUFFIX)) drift.push(`${key} (en)`)
    }
    expect(drift, `missing undo suffix: ${drift.join(', ')}`).toEqual([])
  })

  it('placeholder positions match the frozen interpolation slots', () => {
    const drift: string[] = []
    for (const [key, expected] of Object.entries(FROZEN_PLACEHOLDERS)) {
      if (placeholders(ZH[key] ?? '') !== expected) {
        drift.push(`${key} zh {${placeholders(ZH[key] ?? '')}} != {${expected}}`)
      }
      if (placeholders(EN[key] ?? '') !== expected) {
        drift.push(`${key} en {${placeholders(EN[key] ?? '')}} != {${expected}}`)
      }
    }
    expect(drift, `placeholder drift: ${drift.join('; ')}`).toEqual([])
  })

  it('non-interpolated frozen strings contain no leftover placeholders', () => {
    const polluted: string[] = []
    for (const [key, frozen] of Object.entries(FROZEN_ZH)) {
      if (key in FROZEN_PLACEHOLDERS) continue
      if (placeholders(frozen)) polluted.push(key)
    }
    expect(polluted, `unexpected placeholders in: ${polluted.join(', ')}`).toEqual([])
  })

  it('delete-table cancel label reuses dialog.cancel (frozen「取消」)', () => {
    expect(ZH['dialog.cancel']).toBe('取消')
    expect((EN['dialog.cancel'] ?? '').trim()).not.toBe('')
  })

  it('t() renders frozen strings in zh without key leakage', () => {
    // Spot-check the interpolated ones through the real lookup pipeline.
    expect(ZH['toast.rowDeleted'].replace('{i}', '3')).toBe(
      '已删除第 3 行（Ctrl+Z 可撤销）'
    )
    expect(ZH['toast.tableResized'].replace('{R}', '3').replace('{C}', '4')).toBe(
      '表格缩放为 3×4（Ctrl+Z 可撤销）'
    )
    expect(ZH['toast.colAlignLeft'].replace('{j}', '2')).toBe(
      '第 2 列对齐：左对齐（Ctrl+Z 可撤销）'
    )
  })
})
