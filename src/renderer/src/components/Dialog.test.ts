/**
 * FE-08 PEND-04 — dialog 单例 bus「最上层模态」分层挂点纯逻辑断言。
 *
 * `isModalOpen()` 是 FE-09 useHushLayer 的最小消费面：模态在场时 Esc/空白
 * 由最上层对话框消费（只关确认框），不再走一键回安静。对话框队列本身即
 * topmost-close 语义（settle 只出队 current，下一请求才顶上）。
 * DOM 点击/Esc 路径由 CDP 冒烟覆盖（宪法：单测不渲染组件）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { dialog } from './Dialog'

afterEach(() => {
  dialog.setAutoResponse(null)
})

describe('dialog.isModalOpen — FE-09 分层挂点', () => {
  it('无模态时 false；confirm 在场时 true；settle 后回到 false', async () => {
    expect(dialog.isModalOpen()).toBe(false)
    const pending = dialog.confirm({ message: 'x' })
    expect(dialog.isModalOpen()).toBe(true)
    // e2e canned settle drains the queue (node 环境无宿主 DOM，走同一 settle 路径)
    dialog.setAutoResponse({ confirm: true })
    await expect(pending).resolves.toBe(true)
    expect(dialog.isModalOpen()).toBe(false)
  })

  it('排队模态保持 isModalOpen=true（current 出队后下一请求顶上）', async () => {
    const first = dialog.confirm({ message: 'a' })
    const second = dialog.confirm({ message: 'b' })
    expect(dialog.getState().queued).toBe(1)
    expect(dialog.isModalOpen()).toBe(true)
    dialog.setAutoResponse({ confirm: false })
    await expect(first).resolves.toBe(false)
    await expect(second).resolves.toBe(false)
    expect(dialog.isModalOpen()).toBe(false)
  })
})
