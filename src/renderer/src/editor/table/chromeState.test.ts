/**
 * FE-10 — block chrome four-state machine (tech-design §4.3 / AC-RULE-01):
 * 静息 / hover / 聚焦编辑(单元格激活含) / 错误.
 *
 * Pins the show/hide consolidation single point (收口单点):
 *   - four-state transitions incl. hush reset to 静息 (FE-09 协同)
 *   - debounce cancellation both directions — rapid pass-over flashes zero
 *     (AC-NF-04: <150ms leave never renders, ≥150ms dwell renders)
 *   - table toolbar edit-only exception (AC-FN-33 / UI-ELEM-05)
 *   - 0px layout slot on every transition (AC-NF-05 — overlay only)
 *
 * Pure reducer + timer-wrapped runtime (platform timers so vi.useFakeTimers
 * drives the machine — useHoverDiscipline.test.ts pattern). No widget DOM
 * rendering (constitution) — the DOM host lives in toolbar.ts and is CDP-verified.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { HOVER_DELAY_MS } from '../../hooks/useHoverDiscipline'
import {
  CHROME_DEBOUNCE_MS,
  CHROME_SLOT_PX,
  chromeSurfaces,
  createChromeRuntime,
  initChrome,
  reduceChrome,
  type ChromeEvent,
  type ChromeSnapshot
} from './chromeState'

// ---- pure reducer helpers ---------------------------------------------------

function step(snapshot: ChromeSnapshot<string>, ...events: ChromeEvent<string>[]): ChromeSnapshot<string> {
  let cur = snapshot
  for (const e of events) cur = reduceChrome(cur, e).snapshot
  return cur
}

const idle = (): ChromeSnapshot<string> => initChrome<string>()

// ---- 四态迁移 (AC-RULE-01) --------------------------------------------------

describe('chromeState 四态迁移', () => {
  it('静息初始态：零 chrome（AC-FN-23）', () => {
    const s = idle()
    expect(s.phase).toBe('idle')
    expect(s.toolbarVisible).toBe(false)
    expect(s.microVisible).toBe(false)
    expect(s.micro).toBe('hidden')
    expect(s.anchor).toBeNull()
  })

  it('静息 → hover：进入计时（show-pending），微控件未浮现', () => {
    const { snapshot, schedule } = reduceChrome(idle(), { type: 'enter', anchor: 'w' })
    expect(snapshot.phase).toBe('hover')
    expect(snapshot.micro).toBe('show-pending')
    expect(snapshot.microVisible).toBe(false)
    expect(schedule).toBe('show')
  })

  it('hover 防抖到点 → 微控件浮现，工具栏仍不渲染（AC-FN-33）', () => {
    const s = step(idle(), { type: 'enter', anchor: 'w' }, { type: 'dwell' })
    expect(s.phase).toBe('hover')
    expect(s.micro).toBe('visible')
    expect(s.microVisible).toBe(true)
    expect(s.toolbarVisible).toBe(false)
  })

  it('hover → 聚焦编辑：工具栏 + 微控件全开（FN-03）', () => {
    const s = step(idle(), { type: 'editEnter', id: 't1' })
    expect(s.phase).toBe('editing')
    expect(s.toolbarVisible).toBe(true)
    expect(s.microVisible).toBe(true)
    expect(s.editId).toBe('t1')
  })

  it('聚焦编辑 → 错误：chrome 保持（错误态不裸奔），errorFixed 回编辑态', () => {
    const into = step(idle(), { type: 'editEnter', id: 't1' }, { type: 'error' })
    expect(into.phase).toBe('error')
    expect(into.toolbarVisible).toBe(true)
    expect(into.microVisible).toBe(true)
    const back = step(into, { type: 'errorFixed' })
    expect(back.phase).toBe('editing')
    expect(back.toolbarVisible).toBe(true)
  })

  it('错误态可从静息进入，errorFixed 回静息', () => {
    const into = step(idle(), { type: 'error' })
    expect(into.phase).toBe('error')
    expect(into.errorFrom).toBe('idle')
    const back = step(into, { type: 'errorFixed' })
    expect(back.phase).toBe('idle')
    expect(back.toolbarVisible).toBe(false)
  })

  it('退出编辑（FN-31）：一次回静息，工具栏/把手/chip 全隐', () => {
    const s = step(
      idle(),
      { type: 'editEnter', id: 't1' },
      { type: 'enter', anchor: 'w' },
      { type: 'editExit', id: 't1' }
    )
    expect(s.phase).toBe('idle')
    expect(s.toolbarVisible).toBe(false)
    expect(s.microVisible).toBe(false)
    expect(s.editId).toBeNull()
    expect(s.anchor).toBeNull()
  })

  it('A→B 激活转移工具栏保持（AC-FN-32）：editEnter 换会话 id 不掉 chrome', () => {
    const s = step(idle(), { type: 'editEnter', id: 'A' }, { type: 'editEnter', id: 'B' })
    expect(s.phase).toBe('editing')
    expect(s.toolbarVisible).toBe(true)
    expect(s.editId).toBe('B')
  })

  it('过期 editExit 不清他人会话（跨表重建序竞态）', () => {
    const s = step(idle(), { type: 'editEnter', id: 'B' }, { type: 'editExit', id: 'A' })
    expect(s.phase).toBe('editing')
    expect(s.editId).toBe('B')
    expect(s.toolbarVisible).toBe(true)
  })

  it('hush（Esc/正文空白，FE-09 协同）：任意态一次回静息零 chrome', () => {
    for (const events of [
      [{ type: 'enter', anchor: 'w' }, { type: 'dwell' }] as ChromeEvent<string>[],
      [{ type: 'editEnter', id: 't1' }] as ChromeEvent<string>[],
      [{ type: 'error' }] as ChromeEvent<string>[]
    ]) {
      const s = step(idle(), ...events, { type: 'hush' })
      expect(s.phase).toBe('idle')
      expect(s.microVisible).toBe(false)
      expect(s.toolbarVisible).toBe(false)
      expect(s.editId).toBeNull()
      expect(s.errorFrom).toBeNull()
    }
  })
})

// ---- quietLock：回安静后立即静息（AC-FN-31，驻留指针不复燃）-----------------

describe('quietLock — Esc/退出编辑后立即静息（驻留指针不复燃）', () => {
  it('editExit 后驻留指针 enter 不复燃（重建合成 pointerenter 也被压制）', () => {
    const s = step(
      idle(),
      { type: 'editEnter', id: 't1' },
      { type: 'editExit', id: 't1' },
      { type: 'enter', anchor: 'w' }
    )
    expect(s.phase).toBe('idle')
    expect(s.micro).toBe('hidden')
    expect(s.microVisible).toBe(false)
    expect(s.toolbarVisible).toBe(false)
  })

  it('editExit 后 retarget 不复燃（退出重建的 :hover 回灌被压制）', () => {
    const s = step(
      idle(),
      { type: 'editEnter', id: 't1' },
      { type: 'editExit', id: 't1' },
      { type: 'retarget', anchor: 'w' }
    )
    expect(s.phase).toBe('idle')
    expect(s.microVisible).toBe(false)
  })

  it('hush 后驻留指针 enter 不复燃（回安静 = 静息直到离开）', () => {
    const s = step(
      idle(),
      { type: 'enter', anchor: 'w' },
      { type: 'dwell' },
      { type: 'hush' },
      { type: 'enter', anchor: 'w' }
    )
    expect(s.phase).toBe('idle')
    expect(s.microVisible).toBe(false)
  })

  it('leave 释放 quietLock：再 enter 走正常 hover 防抖', () => {
    const released = step(
      idle(),
      { type: 'editEnter', id: 't1' },
      { type: 'editExit', id: 't1' },
      { type: 'leave', anchor: 'w' }
    )
    expect(released.quietLock).toBe(false)
    const { snapshot: back, schedule } = reduceChrome(released, { type: 'enter', anchor: 'w' })
    expect(back.phase).toBe('hover')
    expect(back.micro).toBe('show-pending')
    expect(schedule).toBe('show')
  })

  it('编辑态 enter 不受 quietLock 影响（写作者路径点击直达，AC-RULE-13）', () => {
    const s = step(idle(), { type: 'editEnter', id: 't1' }, { type: 'editExit', id: 't1' })
    expect(s.quietLock).toBe(true)
    const again = step(s, { type: 'editEnter', id: 't2' })
    expect(again.phase).toBe('editing')
    expect(again.toolbarVisible).toBe(true)
  })

  // ---- quietLock 只压合成 enter：真跨界 enter 复燃（AC-NF-04 修复回归）----

  it('leave→hush→enter 真跨界：锁置位后跨界 enter 复燃防抖（AC-NF-04）', () => {
    // <150ms 掠过离开（leave 发生在锁置位之前）→ 点正文空白 hush 置锁 →
    // 指针不在 wrap 上，下一次真实跨界 enter 不许被吞。
    const locked = step(
      idle(),
      { type: 'enter', anchor: 'w' },
      { type: 'leave', anchor: 'w' },
      { type: 'hush' }
    )
    expect(locked.quietLock).toBe(true)
    const { snapshot: back, schedule } = reduceChrome(locked, {
      type: 'enter',
      anchor: 'w',
      boundary: true
    })
    expect(back.quietLock).toBe(false)
    expect(back.phase).toBe('hover')
    expect(back.micro).toBe('show-pending')
    expect(back.microVisible).toBe(false)
    expect(schedule).toBe('show')
  })

  it('编辑退出后首 hover 复燃（指针从未在场：真跨界 enter 解锁）', () => {
    const locked = step(idle(), { type: 'editEnter', id: 't1' }, { type: 'editExit', id: 't1' })
    expect(locked.quietLock).toBe(true)
    const { snapshot: back, schedule } = reduceChrome(locked, {
      type: 'enter',
      anchor: 'w',
      boundary: true
    })
    expect(back.quietLock).toBe(false)
    expect(back.phase).toBe('hover')
    expect(back.micro).toBe('show-pending')
    expect(schedule).toBe('show')
  })

  it('非跨界 enter 仍被压制（合成 enter 不复燃，AC-FN-31 语义不变）', () => {
    const s = step(
      idle(),
      { type: 'editEnter', id: 't1' },
      { type: 'editExit', id: 't1' },
      { type: 'enter', anchor: 'w', boundary: false }
    )
    expect(s.phase).toBe('idle')
    expect(s.quietLock).toBe(true)
    const omitted = step(
      idle(),
      { type: 'editEnter', id: 't1' },
      { type: 'editExit', id: 't1' },
      { type: 'enter', anchor: 'w' }
    )
    expect(omitted.phase).toBe('idle')
  })

  it('真跨界标记在无锁时与普通 enter 等价（不改既有防抖语义）', () => {
    const { snapshot, schedule } = reduceChrome(idle(), {
      type: 'enter',
      anchor: 'w',
      boundary: true
    })
    expect(snapshot.quietLock).toBe(false)
    expect(snapshot.phase).toBe('hover')
    expect(snapshot.micro).toBe('show-pending')
    expect(schedule).toBe('show')
  })
})

// ---- 防抖取消 / ≥150ms（AC-NF-04） -----------------------------------------

describe('chromeState 防抖语义', () => {
  it('进入计时 ≥150ms（glb-calm:debounce 阈值）', () => {
    const { schedule } = reduceChrome(idle(), { type: 'enter', anchor: 'w' })
    expect(schedule).toBe('show')
    expect(CHROME_DEBOUNCE_MS).toBeGreaterThanOrEqual(150)
  })

  it('<150ms 离开取消计时：从未浮现，闪烁 0 次', () => {
    const entered = reduceChrome(idle(), { type: 'enter', anchor: 'w' })
    const left = reduceChrome(entered.snapshot, { type: 'leave', anchor: 'w' })
    expect(left.snapshot.micro).toBe('hidden')
    expect(left.snapshot.microVisible).toBe(false)
    expect(left.snapshot.phase).toBe('idle')
    // Cancel directive — the pending show timer dies with no render.
    expect(left.schedule).toBe('clear')
    // A stale dwell arriving after the cancel must not resurrect the flash.
    const after = reduceChrome(left.snapshot, { type: 'dwell' })
    expect(after.snapshot.microVisible).toBe(false)
    expect(after.schedule).toBeNull()
  })

  it('离开同延迟消失：visible → hide-pending，到点才隐', () => {
    const shown = step(idle(), { type: 'enter', anchor: 'w' }, { type: 'dwell' })
    const left = reduceChrome(shown, { type: 'leave', anchor: 'w' })
    expect(left.snapshot.micro).toBe('hide-pending')
    expect(left.snapshot.microVisible).toBe(true) // still painted — 延迟消失
    expect(left.snapshot.phase).toBe('hover') // hide-pending 仍是 hover（到点才回静息）
    expect(left.schedule).toBe('hide')
    const gone = reduceChrome(left.snapshot, { type: 'dwell' })
    expect(gone.snapshot.micro).toBe('hidden')
    expect(gone.snapshot.microVisible).toBe(false)
    expect(gone.snapshot.phase).toBe('idle')
  })

  it('hide-pending 期间返回：取消隐藏，直接回可见', () => {
    const shown = step(idle(), { type: 'enter', anchor: 'w' }, { type: 'dwell' })
    const left = reduceChrome(shown, { type: 'leave', anchor: 'w' })
    const back = reduceChrome(left.snapshot, { type: 'enter', anchor: 'w' })
    expect(back.snapshot.micro).toBe('visible')
    expect(back.snapshot.microVisible).toBe(true)
    expect(back.schedule).toBe('clear')
  })

  it('同锚重复 enter 不重置防抖时钟（hover 子元素抖动不拖长）', () => {
    const first = reduceChrome(idle(), { type: 'enter', anchor: 'w' })
    const again = reduceChrome(first.snapshot, { type: 'enter', anchor: 'w' })
    expect(again.snapshot.micro).toBe('show-pending')
    expect(again.schedule).toBeNull() // clock keeps running
  })

  it('hover 中换锚：重启计时（新目标新阈值）', () => {
    const first = reduceChrome(idle(), { type: 'enter', anchor: 'w1' })
    const moved = reduceChrome(first.snapshot, { type: 'enter', anchor: 'w2' })
    expect(moved.snapshot.anchor).toBe('w2')
    expect(moved.schedule).toBe('show')
  })

  it('DOM 重建 retarget：show-pending 保时钟，hidden 视作进入', () => {
    const pending = reduceChrome(idle(), { type: 'enter', anchor: 'w1' })
    const rebuilt = reduceChrome(pending.snapshot, { type: 'retarget', anchor: 'w2' })
    expect(rebuilt.snapshot.anchor).toBe('w2')
    expect(rebuilt.snapshot.micro).toBe('show-pending')
    expect(rebuilt.schedule).toBeNull() // dwell clock survives the remount
    const fresh = reduceChrome(idle(), { type: 'retarget', anchor: 'w2' })
    expect(fresh.snapshot.micro).toBe('show-pending')
    expect(fresh.schedule).toBe('show')
  })

  it('编辑会话存活期间 enter/leave 不动 hover 计时（工具栏在 wrap 外不误隐）', () => {
    const editing = step(idle(), { type: 'editEnter', id: 't1' })
    const left = reduceChrome(editing, { type: 'leave', anchor: 'w' })
    expect(left.snapshot.phase).toBe('editing')
    expect(left.snapshot.toolbarVisible).toBe(true)
    const entered = reduceChrome(left.snapshot, { type: 'enter', anchor: 'w' })
    expect(entered.snapshot.phase).toBe('editing')
    expect(entered.schedule).toBeNull()
  })

  it('过期 leave（锚不匹配）忽略', () => {
    const shown = step(idle(), { type: 'enter', anchor: 'w1' }, { type: 'dwell' })
    const stale = reduceChrome(shown, { type: 'leave', anchor: 'other' })
    expect(stale.snapshot.micro).toBe('visible')
    expect(stale.schedule).toBeNull()
  })
})

// ---- 收口单点（chromeSurfaces 唯一显隐策略）--------------------------------

describe('chromeState 收口单点', () => {
  it('hover 态永不渲染表格工具栏（AC-FN-33 / UI-ELEM-05 例外）', () => {
    expect(chromeSurfaces('hover').toolbar).toBe(false)
    expect(chromeSurfaces('hover').micro).toBe(true)
  })

  it('静息零 chrome 断言面（AC-FN-23）', () => {
    expect(chromeSurfaces('idle')).toEqual({ toolbar: false, micro: false })
  })

  it('仅编辑/错误态带工具栏', () => {
    expect(chromeSurfaces('editing')).toEqual({ toolbar: true, micro: true })
    expect(chromeSurfaces('error')).toEqual({ toolbar: true, micro: true })
  })

  it('settled 态的显隐标记必须与 chromeSurfaces 同源', () => {
    const settled: Array<ChromeSnapshot<string>> = [
      idle(),
      step(idle(), { type: 'enter', anchor: 'w' }, { type: 'dwell' }),
      step(idle(), { type: 'editEnter', id: 't1' }),
      step(idle(), { type: 'error' })
    ]
    for (const s of settled) {
      const policy = chromeSurfaces(s.phase)
      expect(s.toolbarVisible).toBe(policy.toolbar)
      // editing/error forces micro visible (structural chrome); hover shows it
      // only settled after the debounce — policy.micro is the settled contract.
      if (s.phase === 'hover') expect(s.microVisible).toBe(policy.micro)
      if (s.phase === 'editing' || s.phase === 'error') expect(s.microVisible).toBe(policy.micro)
    }
  })

  it('防抖阈值与 hover 基座 / CSS token 三方同源（≥150ms 口径）', () => {
    expect(CHROME_DEBOUNCE_MS).toBe(HOVER_DELAY_MS)
    const tokens = readFileSync(
      fileURLToPath(new URL('../../styles/tokens.css', import.meta.url)),
      'utf8'
    )
    expect(tokens).toMatch(/--chrome-duration:\s*150ms/)
  })
})

// ---- 0px 位移（AC-NF-05）---------------------------------------------------

describe('chromeState 0px 槽位不变量', () => {
  it('所有迁移 slotPx 恒 0（overlay 槽位，显隐不动正文坐标）', () => {
    const events: Array<ChromeEvent<string>> = [
      { type: 'enter', anchor: 'w' },
      { type: 'dwell' },
      { type: 'leave', anchor: 'w' },
      { type: 'dwell' },
      { type: 'editEnter', id: 't1' },
      { type: 'error' },
      { type: 'errorFixed' },
      { type: 'hush' }
    ]
    let cur = idle()
    expect(cur.slotPx).toBe(CHROME_SLOT_PX)
    for (const e of events) {
      cur = reduceChrome(cur, e).snapshot
      expect(cur.slotPx).toBe(CHROME_SLOT_PX)
    }
    expect(CHROME_SLOT_PX).toBe(0)
  })
})

// ---- runtime（模块级防抖计时器）-------------------------------------------

describe('createChromeRuntime 防抖计时', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('<150ms 进出不触发浮现（AC-NF-04 单测断言）', () => {
    const paint = vi.fn()
    const rt = createChromeRuntime<string>({ paint })
    rt.enter('w')
    vi.advanceTimersByTime(CHROME_DEBOUNCE_MS - 1)
    rt.leave('w')
    vi.advanceTimersByTime(CHROME_DEBOUNCE_MS * 2)
    expect(paint).not.toHaveBeenCalled()
    expect(rt.getSnapshot().microVisible).toBe(false)
    rt.dispose()
  })

  it('≥150ms 才浮现（AC-NF-04 单测断言）', () => {
    const paint = vi.fn()
    const rt = createChromeRuntime<string>({ paint })
    rt.enter('w')
    vi.advanceTimersByTime(CHROME_DEBOUNCE_MS - 1)
    expect(paint).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(paint).toHaveBeenCalledWith('w', true)
    expect(rt.getSnapshot().microVisible).toBe(true)
    rt.dispose()
  })

  it('离开同延迟隐藏', () => {
    const paint = vi.fn()
    const rt = createChromeRuntime<string>({ paint })
    rt.enter('w')
    vi.advanceTimersByTime(CHROME_DEBOUNCE_MS)
    expect(paint).toHaveBeenCalledWith('w', true)
    rt.leave('w')
    vi.advanceTimersByTime(CHROME_DEBOUNCE_MS - 1)
    expect(rt.getSnapshot().microVisible).toBe(true)
    // 延迟消失：到点前不掉漆（离开同延迟 ≥150ms，AC-NF-04）
    expect(paint).not.toHaveBeenCalledWith('w', false)
    vi.advanceTimersByTime(1)
    expect(paint).toHaveBeenCalledWith('w', false)
    expect(rt.getSnapshot().microVisible).toBe(false)
    rt.dispose()
  })

  it('快速掠过多次闪烁 0 次', () => {
    const paint = vi.fn()
    const rt = createChromeRuntime<string>({ paint })
    for (let i = 0; i < 5; i++) {
      rt.enter('w')
      vi.advanceTimersByTime(40)
      rt.leave('w')
      vi.advanceTimersByTime(40)
    }
    vi.advanceTimersByTime(CHROME_DEBOUNCE_MS * 2)
    expect(paint).not.toHaveBeenCalled()
    rt.dispose()
  })

  it('编辑态立即浮现（不走 hover 防抖），hush 立即复位静息', () => {
    const paint = vi.fn()
    const rt = createChromeRuntime<string>({ paint })
    rt.editEnter('t1')
    expect(rt.getSnapshot().phase).toBe('editing')
    expect(rt.getSnapshot().toolbarVisible).toBe(true)
    rt.hush()
    expect(rt.getSnapshot().phase).toBe('idle')
    expect(rt.getSnapshot().microVisible).toBe(false)
    expect(rt.getSnapshot().toolbarVisible).toBe(false)
    // hush 同时清掉挂起计时（无残留）
    rt.enter('w')
    rt.hush()
    vi.advanceTimersByTime(CHROME_DEBOUNCE_MS * 2)
    expect(paint).not.toHaveBeenCalled()
    rt.dispose()
  })

  it('dispose 清计时清画（零残留）', () => {
    const paint = vi.fn()
    const rt = createChromeRuntime<string>({ paint })
    rt.enter('w')
    vi.advanceTimersByTime(CHROME_DEBOUNCE_MS)
    expect(paint).toHaveBeenCalledWith('w', true)
    rt.dispose()
    expect(paint).toHaveBeenCalledWith('w', false)
    vi.advanceTimersByTime(CHROME_DEBOUNCE_MS * 2)
    expect(rt.getSnapshot().microVisible).toBe(false)
  })

  it('quietLock 后真跨界 enter 复燃 150ms 浮现（leave→hush→enter 序）', () => {
    const paint = vi.fn()
    const rt = createChromeRuntime<string>({ paint })
    rt.enter('w')
    vi.advanceTimersByTime(20) // <150ms 快速掠过
    rt.leave('w')
    rt.hush() // 点正文空白：leave 已先于锁发生，锁不得吞掉下一次真进入
    expect(rt.getSnapshot().quietLock).toBe(true)
    rt.enter('w', { boundary: true })
    expect(rt.getSnapshot().quietLock).toBe(false)
    expect(rt.getSnapshot().micro).toBe('show-pending')
    vi.advanceTimersByTime(CHROME_DEBOUNCE_MS - 1)
    expect(paint).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(paint).toHaveBeenCalledWith('w', true)
    rt.dispose()
  })

  it('编辑退出后首 hover 复燃 150ms 浮现（指针从未在场）', () => {
    const paint = vi.fn()
    const rt = createChromeRuntime<string>({ paint })
    rt.editEnter('t1')
    rt.editExit('t1')
    expect(rt.getSnapshot().quietLock).toBe(true)
    rt.enter('w', { boundary: true })
    vi.advanceTimersByTime(CHROME_DEBOUNCE_MS)
    expect(paint).toHaveBeenCalledWith('w', true)
    expect(rt.getSnapshot().micro).toBe('visible')
    rt.dispose()
  })

  it('quietLock 下合成 enter 不复燃（不带 boundary 仍整段 no-op）', () => {
    const paint = vi.fn()
    const rt = createChromeRuntime<string>({ paint })
    rt.editEnter('t1')
    rt.editExit('t1')
    rt.enter('w')
    vi.advanceTimersByTime(CHROME_DEBOUNCE_MS * 2)
    expect(paint).not.toHaveBeenCalled()
    expect(rt.getSnapshot().phase).toBe('idle')
    rt.dispose()
  })
})
