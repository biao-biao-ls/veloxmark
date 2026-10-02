import { describe, expect, it } from 'vitest'
import { ZH } from '../../i18n/zh'
import {
  estimateAutoFitCols,
  GRID_AUTO_FIT_COL_PX,
  GRID_MAX_COL,
  GRID_MAX_ROW,
  gridPickerKey,
  gridUpperBound,
  presetDims
} from './gridPicker'

describe('gridUpperBound（AC-RULE-12 / AC-ERR-13 逐维 max(20,R0)×max(12,C0)）', () => {
  it('超限表上界扩至自身尺寸：R0=25 行上界=25、C0=15 列上界=15', () => {
    expect(gridUpperBound(25, 15)).toEqual({ maxRow: 25, maxCol: 15 })
  })

  it('单维超限只扩该维：25 行×10 列表 → 25×12', () => {
    expect(gridUpperBound(25, 10)).toEqual({ maxRow: 25, maxCol: 12 })
    expect(gridUpperBound(5, 15)).toEqual({ maxRow: 20, maxCol: 15 })
  })

  it('常规表上界仍是 20×12（R0=5）', () => {
    expect(gridUpperBound(5, 5)).toEqual({ maxRow: GRID_MAX_ROW, maxCol: GRID_MAX_COL })
    expect(gridUpperBound(1, 1)).toEqual({ maxRow: 20, maxCol: 12 })
  })

  it('非法输入回退 1×1 再取上界（?? 不吞 0 的边界：0 视为非法结构尺寸）', () => {
    expect(gridUpperBound(0, 0)).toEqual({ maxRow: 20, maxCol: 12 })
    expect(gridUpperBound(Number.NaN, -3)).toEqual({ maxRow: 20, maxCol: 12 })
    expect(gridUpperBound(25.7, 15.2)).toEqual({ maxRow: 25, maxCol: 15 })
  })
})

describe('gridPickerKey（方向键按动态上界钳制）', () => {
  const bounds = gridUpperBound(20, 12)

  it('moves with arrows and clamps at the 1×1 / 20×12 edges', () => {
    expect(gridPickerKey('ArrowDown', 1, 1, bounds)).toEqual({ kind: 'move', row: 2, col: 1 })
    expect(gridPickerKey('ArrowRight', 1, 1, bounds)).toEqual({ kind: 'move', row: 1, col: 2 })
    expect(gridPickerKey('ArrowUp', 2, 2, bounds)).toEqual({ kind: 'move', row: 1, col: 2 })
    expect(gridPickerKey('ArrowLeft', 2, 2, bounds)).toEqual({ kind: 'move', row: 2, col: 1 })
    expect(gridPickerKey('ArrowDown', GRID_MAX_ROW, 1, bounds)).toEqual({ kind: 'move', row: GRID_MAX_ROW, col: 1 })
    expect(gridPickerKey('ArrowRight', 1, GRID_MAX_COL, bounds)).toEqual({ kind: 'move', row: 1, col: GRID_MAX_COL })
    expect(gridPickerKey('ArrowUp', 1, 5, bounds)).toEqual({ kind: 'move', row: 1, col: 5 })
    expect(gridPickerKey('ArrowLeft', 5, 1, bounds)).toEqual({ kind: 'move', row: 5, col: 1 })
  })

  it('超限表上界处钳制：25×15 表可走到第 25 行 / 第 15 列且不再外扩', () => {
    const over = gridUpperBound(25, 15)
    expect(gridPickerKey('ArrowDown', 24, 3, over)).toEqual({ kind: 'move', row: 25, col: 3 })
    expect(gridPickerKey('ArrowDown', 25, 3, over)).toEqual({ kind: 'move', row: 25, col: 3 })
    expect(gridPickerKey('ArrowRight', 3, 14, over)).toEqual({ kind: 'move', row: 3, col: 15 })
    expect(gridPickerKey('ArrowRight', 3, 15, over)).toEqual({ kind: 'move', row: 3, col: 15 })
  })

  it('picks on Enter with the current hover dims', () => {
    expect(gridPickerKey('Enter', 3, 4, bounds)).toEqual({ kind: 'pick', row: 3, col: 4 })
  })

  it('closes on Escape and ignores unrelated keys', () => {
    expect(gridPickerKey('Escape', 3, 4, bounds)).toEqual({ kind: 'close' })
    expect(gridPickerKey('a', 3, 4, bounds)).toBeNull()
    expect(gridPickerKey('Tab', 3, 4, bounds)).toBeNull()
    expect(gridPickerKey(' ', 3, 4, bounds)).toBeNull()
  })
})

describe('estimateAutoFitCols（自动适应窗口列数估算）', () => {
  it('按名义列宽折算列数', () => {
    expect(estimateAutoFitCols(GRID_AUTO_FIT_COL_PX * 5, 12)).toBe(5)
    expect(estimateAutoFitCols(GRID_AUTO_FIT_COL_PX * 5 + 40, 12)).toBe(5)
  })

  it('钳制到 [1, 上界]：极窄窗口保 1 列、极宽不超列上界', () => {
    expect(estimateAutoFitCols(0, 12)).toBe(1)
    expect(estimateAutoFitCols(10, 12)).toBe(1)
    expect(estimateAutoFitCols(10_000, 15)).toBe(15)
    expect(estimateAutoFitCols(10_000, 12)).toBe(12)
  })
})

describe('presetDims（4 预设按钮组）', () => {
  const bounds = gridUpperBound(25, 15)

  it('1×1 / 2×2 / 3×3 立即按预设值缩放（含缩到 1×1）', () => {
    expect(presetDims('1x1', { curRows: 25, curCols: 15, bounds, fitWidth: 800 })).toEqual({ rows: 1, cols: 1 })
    expect(presetDims('2x2', { curRows: 25, curCols: 15, bounds, fitWidth: 800 })).toEqual({ rows: 2, cols: 2 })
    expect(presetDims('3x3', { curRows: 25, curCols: 15, bounds, fitWidth: 800 })).toEqual({ rows: 3, cols: 3 })
  })

  it('自动适应窗口：行数保持 R0，列数按窗口宽度估算且钳制在列上界内', () => {
    expect(presetDims('autoFit', { curRows: 25, curCols: 15, bounds, fitWidth: GRID_AUTO_FIT_COL_PX * 4 })).toEqual({
      rows: 25,
      cols: 4
    })
    expect(presetDims('autoFit', { curRows: 3, curCols: 2, bounds: gridUpperBound(3, 2), fitWidth: 10_000 })).toEqual({
      rows: 3,
      cols: 12
    })
  })
})

describe('缩放回执冻结文案（AC-OP-07）', () => {
  it('toast.tableResized 插值 1×1 为「表格缩放为 1×1（Ctrl+Z 可撤销）」', () => {
    expect(ZH['toast.tableResized'].replace('{R}', '1').replace('{C}', '1')).toBe(
      '表格缩放为 1×1（Ctrl+Z 可撤销）'
    )
  })
})
