/**
 * glb-modal:stacking z 序契约（IT-01 FE-09 P2a，AC-RULE「确认框开启时最上层」）。
 *
 * 契约式源扫描（editor/table/contract.test.ts 同法）：浮层相互覆盖是纯 CSS
 * z-index 决定的，把「确认框恒最大」的层序钉成不变量——
 *
 *   dialog-overlay (2000) > grid/code popover (1500) > editor-context-menu (1000)
 *
 * 取舍说明（其余高于确认框的字面值不在本不变量内，见 FE-09 doc-drift）：
 *   quickopen-overlay 2100 = .dialog-overlay 子类自模态；tab-context-menu 3000
 *   的菜单项先 setMenu(null) 再动作（叠加不可构造）；cm-md-table-menu 3000 为
 *   无 TS 消费方的遗留规则；mermaid lightbox / link tooltip 为遮罩模态/纯 hover 面。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const readStyle = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

/** z-index of the rule block whose selector list contains `selector`. */
function zIndexOf(css: string, selector: string): number {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const at = clean.indexOf(selector)
  expect(at, `selector "${selector}" not found`).toBeGreaterThanOrEqual(0)
  const open = clean.indexOf('{', at)
  const close = clean.indexOf('}', open)
  const m = clean.slice(open, close).match(/z-index:\s*(\d+)/)
  expect(m, `z-index declaration missing for "${selector}"`).not.toBeNull()
  return Number(m![1])
}

describe('浮层 z 序不变量（glb-modal:stacking / 确认框恒最大）', () => {
  const overlays = readStyle('./overlays.css')
  const ctxMenu = readStyle('./context-menu.css')
  const dialogZ = zIndexOf(overlays, '.dialog-overlay')
  const gridZ = zIndexOf(overlays, '.table-grid-picker')
  const langPickerZ = zIndexOf(overlays, '.code-lang-picker')
  const ctxZ = zIndexOf(ctxMenu, '.editor-context-menu')

  it('dialog-overlay z > table-grid-picker z > editor-context-menu z', () => {
    expect(dialogZ).toBeGreaterThan(gridZ)
    expect(gridZ).toBeGreaterThan(ctxZ)
  })

  it('code-lang-picker 与 grid-picker 同 popover 层级（低于确认框、高于菜单）', () => {
    expect(langPickerZ).toBeLessThan(dialogZ)
    expect(langPickerZ).toBeGreaterThan(ctxZ)
    expect(langPickerZ).toBe(gridZ)
  })
})
