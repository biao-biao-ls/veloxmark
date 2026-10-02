#!/usr/bin/env node
/**
 * 批 F-v2 三态矩阵重拍（v2）— 修复 v1 focus/active 同图 bug.
 * v1 根因：focus/active 均裁同一条被点行（点击→outline-active，ArrowDown 后
 * 焦点环落在下一行但 clip 仍框旧行）；dark-hover 又落在已 active 行上 → 三张同图。
 *
 * v2：每主题三态分用三个不同行，裁剪前逐态断言 DOM（:hover / outline-kbd-focus /
 * outline-active），断言不过即抛错不落盘。产物仍命名 batch-f2-{theme}-{state}.png。
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.BATCH_F2_CDP_PORT ?? 9566)
const SHOTS = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-02-FE-10/shots'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) throw new Error('no CDP page target')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let msgId = 0
const pending = new Map()
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(String(ev.data))
  if (!msg.id || !pending.has(msg.id)) return
  const { resolve, reject } = pending.get(msg.id)
  pending.delete(msg.id)
  if (msg.error) reject(new Error(JSON.stringify(msg.error)))
  else resolve(msg.result)
})
function send(method, params = {}) {
  const id = ++msgId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evalExpr(expression, timeoutMs = 15000) {
  const run = send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  const r = await Promise.race([
    run,
    sleep(timeoutMs).then(() => { throw new Error(`Runtime.evaluate timeout ${timeoutMs}ms`) })
  ])
  if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails))
  return r.result.value
}
async function moveTo(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
}
async function clickAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
}
async function pressArrow(key) {
  const vk = key === 'ArrowUp' ? 38 : 40
  const code = key
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
}
async function shot(file, clip) {
  const params = { format: 'png' }
  if (clip) params.clip = { ...clip, scale: 1 }
  const s = await send('Page.captureScreenshot', params)
  writeFileSync(file, Buffer.from(s.data, 'base64'))
  console.log('shot:', file.split('/').pop())
}

mkdirSync(SHOTS, { recursive: true })
await send('Page.enable')
await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 800, deviceScaleFactor: 1, mobile: false })
await sleep(200)

// 草稿对话框 → 「稍后」
await evalExpr(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.trim() === '稍后')
  if (b) { b.click(); return true } return false
})()`)

// 确保大纲 tab + intro.md 场景就位
await evalExpr(`(() => {
  const t = document.querySelectorAll('.sidebar-tabs .sidebar-tab')
  if (t[1]) t[1].click(); return true
})()`)
await sleep(250)
const n = await evalExpr(`(() => document.querySelectorAll('.outline-item').length)()`)
if (!n || n < 5) throw new Error('outline rows not ready: ' + n)

const ROW = (i) => `.outline-item:nth-of-type(${i + 1})`
// 状态驱动：active=行3(Gamma)、focus=行1(Alpha)、hover=行4(Delta)
const centerOf = async (i) => evalExpr(`(() => {
  const rows = document.querySelectorAll('.outline-item')
  const row = rows[${i}]
  if (!row) return null
  row.scrollIntoView({ block: 'nearest' })
  row.dataset.b2 = '1'
  const r = row.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, cls: row.className }
})()`)

const clipOf = async () => evalExpr(`(() => {
  const el = document.querySelector('.outline-item[data-b2="1"]')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: Math.max(0, r.left - 2), y: Math.max(0, r.top - 8), width: Math.ceil(r.width + 4), height: Math.ceil(r.height + 16) }
})()`)

const clearTag = () => evalExpr(`(() => {
  const el = document.querySelector('.outline-item[data-b2]')
  if (el) delete el.dataset.b2
  return true
})()`)

const assert = (ok, msg) => { if (!ok) throw new Error('assert failed: ' + msg) }

const setTheme = async (t) => {
  await evalExpr(`(() => { window.__veloxP26.setPrefs({ theme: ${JSON.stringify(t)} }); return true })()`)
  await sleep(350)
}

const states = {}
for (const theme of ['light', 'dark']) {
  await setTheme(theme)
  // ── active：点 Gamma(3) → outline-active；鼠标移出后裁该行 ──
  await clearTag()
  let c = await centerOf(3)
  assert(c, 'row3 missing')
  await clickAt(c.x, c.y)
  await sleep(300)
  await moveTo(700, 700)
  await sleep(150)
  let chk = await evalExpr(`(() => {
    const row = document.querySelector('.outline-item[data-b2="1"]')
    return { cls: row.className, hover: row.matches(':hover'), nav: row.hasAttribute('data-nav-focus') }
  })()`)
  assert(chk.cls.includes('outline-active') && !chk.hover && !chk.nav, 'active state bad: ' + JSON.stringify(chk))
  states[theme + '-active'] = chk
  await shot(`${SHOTS}/batch-f2-${theme}-active.png`, await clipOf())

  // ── focus：不能点行（onSelect→jumpToHeading 把 DOM 焦点交给编辑器，方向键
  // 被 CM 吃掉，nav 的 onKeyDown 不触发）。改为 .focus() 落 DOM 焦点到 Beta(2)
  // 行（不触发 onSelect/不改 activePos），再发真实 CDP ArrowUp → kbdNav=true
  // 且焦点移到 Alpha(1) 行（非 active），裁该行。 ──
  await moveTo(700, 700)
  await sleep(100)
  await clearTag()
  const seed = await evalExpr(`(() => {
    const rows = document.querySelectorAll('.outline-item')
    const row = rows[2]
    if (!row) return null
    row.focus()
    return { idx: 2, cls: row.className }
  })()`)
  assert(seed, 'focus seed row missing')
  await sleep(120)
  await pressArrow('ArrowUp')
  await sleep(250)
  const tagRes = await evalExpr(`(() => {
    const k = document.querySelector('.outline-item.outline-kbd-focus')
      || document.querySelector('.outline-item[data-nav-focus]')
    if (!k) return { ok: false, dump: Array.from(document.querySelectorAll('.outline-item')).map((r) => r.className) }
    k.dataset.b2 = '1'
    return { ok: true, cls: k.className, idx: k.dataset.navIndex }
  })()`)
  assert(tagRes && tagRes.ok, 'no kbd/nav-focus row: ' + JSON.stringify(tagRes))
  chk = await evalExpr(`(() => {
    const row = document.querySelector('.outline-item[data-b2="1"]')
    if (!row) return null
    return { cls: row.className, hover: row.matches(':hover'), nav: row.hasAttribute('data-nav-focus'), idx: row.dataset.navIndex }
  })()`)
  assert(chk && chk.nav && chk.cls.includes('outline-kbd-focus') && !chk.hover, 'focus state bad: ' + JSON.stringify(chk))
  assert(!chk.cls.includes('outline-active'), 'focus row must not be active')
  states[theme + '-focus'] = chk
  await shot(`${SHOTS}/batch-f2-${theme}-focus.png`, await clipOf())

  // ── hover：鼠标悬停 Delta(4)（非 active 非 kbd）；裁该行 ──
  await clearTag()
  c = await centerOf(4)
  assert(c, 'row4 missing')
  await moveTo(c.x, c.y)
  await sleep(250)
  chk = await evalExpr(`(() => {
    const row = document.querySelector('.outline-item[data-b2="1"]')
    return { cls: row.className, hover: row.matches(':hover'), nav: row.hasAttribute('data-nav-focus') }
  })()`)
  assert(chk.hover && !chk.cls.includes('outline-active') && !chk.nav, 'hover state bad: ' + JSON.stringify(chk))
  states[theme + '-hover'] = chk
  await shot(`${SHOTS}/batch-f2-${theme}-hover.png`, await clipOf())
  await clearTag()
  await moveTo(700, 700)
  await sleep(100)
}

writeFileSync(`${SHOTS}/batch-f2-matrix-states.json`, JSON.stringify(states, null, 2))
console.log('states:', JSON.stringify(states, null, 1))
console.log('DONE')
ws.close()
process.exit(0)
