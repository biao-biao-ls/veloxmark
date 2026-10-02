/**
 * linkFloatSession — 链接浮层会话纯逻辑（FE-05 换靶守卫，code-review P1）。
 *
 * 钉死的错链写回契约：编辑会话只对它绑定的 anchor 有效。
 * pin A 编辑态 → 换靶 B 后：展示值 = B 的 href、编辑态/draft 作废、
 * 确认闸拒绝把 A 的 draft 写进 B。
 */
import { describe, expect, it } from 'vitest'
import {
  beginEdit,
  bindSession,
  canConfirmEdit,
  exitEdit,
  updateDraft
} from './linkFloatSession'

/** anchor 身份用对象引用模拟（与 HTMLElement 身份判定同口径）。 */
const anchorA = { id: 'A' }
const anchorB = { id: 'B' }

describe('linkFloatSession retarget guard (ren-link:hover-float)', () => {
  it('retarget binds the new anchor and shows the new anchor href', () => {
    const onA = bindSession(anchorA, 'https://example.com/a')
    // 行扫式换靶（FE-03 retarget）：同通道 show() 直接换 anchor prop
    const onB = bindSession(anchorB, 'https://example.com/b')
    expect(onB.anchor).toBe(anchorB)
    expect(onB.href).toBe('https://example.com/b')
    expect(onA.href).toBe('https://example.com/a') // 旧会话不改写
  })

  it('pin A edit session dies on retarget: editing cleared, draft dropped', () => {
    const editingA = beginEdit(bindSession(anchorA, 'https://example.com/a'), anchorA, 'https://example.com/draft-of-a')
    expect(editingA.editing).toBe(true)
    expect(editingA.draft).toBe('https://example.com/draft-of-a')

    const retargeted = bindSession(anchorB, 'https://example.com/b')
    expect(retargeted.editing).toBe(false)
    expect(retargeted.draft).toBe('')
    expect(retargeted.href).toBe('https://example.com/b')
  })

  it('confirm refuses to write A draft into B (anchor-binding gate)', () => {
    const editingA = beginEdit(bindSession(anchorA, 'https://example.com/a'), anchorA, 'https://example.com/draft-of-a')
    updateDraft(editingA, 'https://example.com/draft-of-a')
    // 换靶后、守卫 effect 落地前的竞态窗口：会话仍绑 A，而 props.anchor 已是 B
    expect(canConfirmEdit(editingA, anchorB)).toBe(false)
    // 守卫落地后会话整体作废，同样不得写回
    const retargeted = bindSession(anchorB, 'https://example.com/b')
    expect(canConfirmEdit(retargeted, anchorB)).toBe(false)
  })

  it('confirm stays open for the bound anchor (no regression on same-target edit)', () => {
    const editingA = beginEdit(bindSession(anchorA, 'https://example.com/a'), anchorA, 'https://example.com/a')
    expect(canConfirmEdit(editingA, anchorA)).toBe(true)
    expect(canConfirmEdit(updateDraft(editingA, 'https://example.com/a2'), anchorA)).toBe(true)
    expect(canConfirmEdit(exitEdit(editingA), anchorA)).toBe(false)
    // 未进入编辑态的展示态也不可确认
    expect(canConfirmEdit(bindSession(anchorA, 'https://example.com/a'), anchorA)).toBe(false)
  })

  it('beginEdit rebinds to the anchor the edit actually started on', () => {
    const stale = beginEdit(bindSession(anchorA, 'https://example.com/a'), anchorA, 'x')
    // 同一实例换靶后重新发起编辑 → 改绑 B，此时对 B 确认合法
    const rebound = beginEdit(stale, anchorB, 'https://example.com/b')
    expect(rebound.anchor).toBe(anchorB)
    expect(canConfirmEdit(rebound, anchorB)).toBe(true)
    expect(canConfirmEdit(rebound, anchorA)).toBe(false)
  })
})
