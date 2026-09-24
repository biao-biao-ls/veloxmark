import { describe, expect, it } from 'vitest'
import { gridPickerKey, GRID_MAX_COL, GRID_MAX_ROW } from './gridPicker'

describe('gridPickerKey', () => {
  it('moves with arrows and clamps at the 1×1 / 20×12 edges', () => {
    expect(gridPickerKey('ArrowDown', 1, 1)).toEqual({ kind: 'move', row: 2, col: 1 })
    expect(gridPickerKey('ArrowRight', 1, 1)).toEqual({ kind: 'move', row: 1, col: 2 })
    expect(gridPickerKey('ArrowUp', 2, 2)).toEqual({ kind: 'move', row: 1, col: 2 })
    expect(gridPickerKey('ArrowLeft', 2, 2)).toEqual({ kind: 'move', row: 2, col: 1 })
    expect(gridPickerKey('ArrowDown', GRID_MAX_ROW, 1)).toEqual({ kind: 'move', row: GRID_MAX_ROW, col: 1 })
    expect(gridPickerKey('ArrowRight', 1, GRID_MAX_COL)).toEqual({ kind: 'move', row: 1, col: GRID_MAX_COL })
    expect(gridPickerKey('ArrowUp', 1, 5)).toEqual({ kind: 'move', row: 1, col: 5 })
    expect(gridPickerKey('ArrowLeft', 5, 1)).toEqual({ kind: 'move', row: 5, col: 1 })
  })

  it('picks on Enter with the current hover dims', () => {
    expect(gridPickerKey('Enter', 3, 4)).toEqual({ kind: 'pick', row: 3, col: 4 })
  })

  it('closes on Escape and ignores unrelated keys', () => {
    expect(gridPickerKey('Escape', 3, 4)).toEqual({ kind: 'close' })
    expect(gridPickerKey('a', 3, 4)).toBeNull()
    expect(gridPickerKey('Tab', 3, 4)).toBeNull()
    expect(gridPickerKey(' ', 3, 4)).toBeNull()
  })
})
