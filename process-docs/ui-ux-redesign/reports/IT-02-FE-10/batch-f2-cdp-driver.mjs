#!/usr/bin/env node
/**
 * 批 F-v2 侧栏补证 + 修复后主实现图重截（CDP 驱动）.
 *
 * 产出（全部 1200×800 视口）：
 *  1) IT-02-FE-06/IT-02-FE-06-impl.png        文件树态（多级缩进+导引线+目录 accent+twisty 占位）
 *     IT-02-FE-06/IT-02-FE-06-impl-light.png  同态浅色交叉印证
 *  2) IT-02-FE-07/IT-02-FE-07-impl.png        大纲态（active 三件套 + 层级缩进）
 *  3) IT-02-FE-08/IT-02-FE-08-impl.png        大纲+正文折叠同屏（▾/▸ + 占位行 + 镜像指向）
 *  4) IT-02-FE-10/IT-02-FE-10-impl.png        .lv 徽标 H1/H2/H3 + hover 行
 *  5) IT-02-FE-10/shots/batch-f2-{light,dark}-{hover,focus,active}.png  三态矩阵特写
 *     IT-02-FE-10/shots/batch-f2-filetree-hover.png                    文件树 hover 特写
 *
 * 纪律：草稿恢复对话框一律点「稍后」；Runtime.evaluate 全程 15s 超时；
 * 真实 CDP 键盘事件触发 kbdNav 焦点环（合成事件不切调制态）。
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.BATCH_F2_CDP_PORT ?? 9566)
const R = 'D:/code/typora/process-docs/ui-ux-redesign/reports'
const FIXTURE = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/fe10-fixture'
const INTRO = `${FIXTURE}/intro.md`
const SHOTS = `${R}/IT-02-FE-10/shots`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── CDP plumbing ───────────────────────────────────────────────────────────
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
  const vk = key === 'ArrowDown' ? 40 : key === 'ArrowUp' ? 38 : 37
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code: key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
}
async function shot(file, clip) {
  const params = { format: 'png' }
  if (clip) params.clip = { ...clip, scale: 1 }
  const s = await send('Page.captureScreenshot', params)
  writeFileSync(file, Buffer.from(s.data, 'base64'))
  console.log('shot:', file)
}
const rectOf = (sel) => evalExpr(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)})
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
})()`)
const clickSel = async (sel) => {
  const c = await rectOf(sel)
  if (!c) throw new Error('selector not found: ' + sel)
  await clickAt(c.cx, c.cy)
  return c
}

// ── boot ───────────────────────────────────────────────────────────────────
mkdirSync(SHOTS, { recursive: true })
await send('Page.enable')
await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await send('Emulation.setDeviceMetricsOverride', {
  width: 1200, height: 800, deviceScaleFactor: 1, mobile: false
})
await sleep(300)

// 草稿恢复对话框 → 一律「稍后」
await evalExpr(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.trim() === '稍后')
  if (b) { b.click(); return true }
  return false
})()`)
await sleep(200)

// 打开混合树工作区 + intro.md
console.log('folder:', await evalExpr(`(async () => {
  if (!window.__veloxP13) return 'no-seam'
  await window.__veloxP13.openFolder(${JSON.stringify(FIXTURE)})
  return true
})()`))
await sleep(400)
await evalExpr(`(() => {
  const t = document.querySelectorAll('.sidebar-tabs .sidebar-tab')
  if (t[0]) t[0].click(); return t.length
})()`)
await sleep(150)
for (const d of ['docs', 'deep']) {
  await evalExpr(`(() => {
    const row = Array.from(document.querySelectorAll('.filetree-dir-label'))
      .find((r) => r.querySelector('.filetree-dir-name')?.textContent === ${JSON.stringify(d)})
    if (row) { row.click(); return true } return false
  })()`)
  await sleep(250)
}
console.log('open:', await evalExpr(`(async () => {
  if (!window.__veloxP26) return 'no-seam'
  return await window.__veloxP26.openPath(${JSON.stringify(INTRO)})
})()`))
await sleep(500)
const setTheme = async (t) => {
  await evalExpr(`(() => { window.__veloxP26.setPrefs({ theme: ${JSON.stringify(t)} }); return true })()`)
  await sleep(350)
}
const outOfRow = () => moveTo(700, 700) // 移出侧栏行，清 hover

// ── 1. FE-06 文件树态（深色主稿 + 浅色交叉）────────────────────────────────
await setTheme('dark')
await outOfRow()
await sleep(150)
await shot(`${R}/IT-02-FE-06/IT-02-FE-06-impl.png`)
await setTheme('light')
await outOfRow()
await sleep(150)
await shot(`${R}/IT-02-FE-06/IT-02-FE-06-impl-light.png`)

// ── 2. FE-07 大纲态 active 三件套（深色主稿）───────────────────────────────
await setTheme('dark')
await evalExpr(`(() => {
  const t = document.querySelectorAll('.sidebar-tabs .sidebar-tab')
  if (t[1]) t[1].click(); return true
})()`)
await sleep(250)
// 点击 H3「三级小节 Beta」行 → active-follow 三件套
console.log('active click:', await evalExpr(`(() => {
  const rows = Array.from(document.querySelectorAll('.outline-item'))
  const row = rows.find((r) => r.querySelector('.outline-title')?.textContent.includes('Beta')) || rows[1]
  if (!row) return 'no-row'
  row.scrollIntoView({ block: 'nearest' })
  const r = row.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
})()`).then((c) => (c && c.x ? clickAt(c.x, c.y) : c)))
await sleep(300)
await outOfRow()
await sleep(150)
await shot(`${R}/IT-02-FE-07/IT-02-FE-07-impl.png`)

// ── 3. FE-08 折叠同屏（浅色主稿，与既有命名一致）───────────────────────────
await setTheme('light')
// 折叠「第二节 Alpha」（有子节）→ 正文占位行 + 大纲 ▸ 镜像；Intro 保持 ▾
console.log('fold:', await evalExpr(`(() => {
  const rows = Array.from(document.querySelectorAll('.outline-item'))
  const i = rows.findIndex((r) => r.querySelector('.outline-title')?.textContent.includes('Alpha'))
  if (i < 0) return 'no-row'
  const btn = rows[i].querySelector('.outline-fold:not(.empty)')
  if (!btn) return 'no-fold-btn'
  btn.click()
  return 'folded-' + i
})()`))
await sleep(400)
// 让占位行入镜
await evalExpr(`(() => {
  const s = document.querySelector('.cm-md-fold-summary')
  if (s) s.scrollIntoView({ block: 'center' })
  return !!s
})()`)
await sleep(300)
await outOfRow()
await sleep(150)
console.log('fold-state:', await evalExpr(`(() => ({
  summary: document.querySelector('.cm-md-fold-summary')?.textContent ?? null,
  triangles: Array.from(document.querySelectorAll('.outline-fold')).map((f) => ({
    folded: f.classList.contains('is-folded'), txt: f.textContent.trim()
  }))
}))()`))
await shot(`${R}/IT-02-FE-08/IT-02-FE-08-impl.png`)

// ── 4. FE-10 .lv 徽标 + hover 行（浅色主稿）────────────────────────────────
// 展示 H1/H2/H3 徽标：intro.md 含 H1/H2/H3；hover 一条非 active 大纲行
const hoverOutlineRow = async () => evalExpr(`(() => {
  const row = Array.from(document.querySelectorAll('.outline-item'))
    .find((r) => !r.classList.contains('outline-active')) || document.querySelector('.outline-item')
  if (!row) return null
  row.scrollIntoView({ block: 'nearest' })
  const r = row.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
})()`).then(async (c) => { if (c) await moveTo(c.x, c.y); return c })
await hoverOutlineRow()
await sleep(200)
console.log('lv:', await evalExpr(`(() => Array.from(document.querySelectorAll('.outline-lv')).map((e) => e.textContent))()`))
await shot(`${R}/IT-02-FE-10/IT-02-FE-10-impl.png`)

// ── 5. 三态矩阵特写（深浅 × hover/focus/active）────────────────────────────
const clipRow = async (sel) => {
  const c = await rectOf(sel)
  if (!c) return null
  const x = Math.max(0, c.x - 2), y = Math.max(0, c.y - 10)
  return { x, y, width: Math.ceil(c.w + 4), height: Math.ceil(c.h + 20) }
}
const stateShot = async (theme, state) => {
  await setTheme(theme)
  // 固定对准 H2「第二节 Alpha」行（有徽标层级信息），三态各自驱动
  const target = await evalExpr(`(() => {
    const rows = Array.from(document.querySelectorAll('.outline-item'))
    const row = rows.find((r) => r.querySelector('.outline-title')?.textContent.includes('Alpha')) || rows[1]
    if (!row) return null
    row.scrollIntoView({ block: 'nearest' })
    const r = row.getBoundingClientRect()
    row.dataset.b2 = '1'
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })()`)
  if (!target) throw new Error('no matrix target row')
  if (state === 'hover') {
    await moveTo(target.x, target.y)
    await sleep(200)
  } else if (state === 'focus') {
    // 真实点击（清 kbdNav）后按 ArrowDown → kbdNav 调制态 + 焦点环
    await clickAt(target.x, target.y)
    await sleep(150)
    await pressArrow('ArrowDown')
    await sleep(200)
    await moveTo(700, 700) // 移出，避免 hover 混入焦点态
    await sleep(150)
  } else {
    await clickAt(target.x, target.y)
    await sleep(250)
    await moveTo(700, 700)
    await sleep(150)
  }
  const clip = await clipRow('.outline-item[data-b2="1"]')
  await shot(`${SHOTS}/batch-f2-${theme}-${state}.png`, clip)
}
for (const theme of ['light', 'dark']) {
  for (const state of ['hover', 'focus', 'active']) {
    await stateShot(theme, state)
    await evalExpr(`(() => { delete document.querySelector('.outline-item[data-b2]')?.dataset.b2; return true })()`)
    await outOfRow()
    await sleep(100)
  }
}

// ── 6. 文件树 hover 特写（--bg-inset，顺手项）──────────────────────────────
await setTheme('light')
await evalExpr(`(() => {
  const t = document.querySelectorAll('.sidebar-tabs .sidebar-tab')
  if (t[0]) t[0].click(); return true
})()`)
await sleep(250)
const ftHover = await evalExpr(`(() => {
  const row = Array.from(document.querySelectorAll('.filetree-item'))
    .find((r) => !r.classList.contains('filetree-dir-label') && !r.classList.contains('filetree-active'))
    || document.querySelector('.filetree-item')
  if (!row) return null
  row.scrollIntoView({ block: 'nearest' })
  const r = row.getBoundingClientRect()
  row.dataset.b2 = '1'
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
})()`)
if (ftHover) {
  await moveTo(ftHover.x, ftHover.y)
  await sleep(200)
  const clip = await clipRow('.filetree-item[data-b2="1"]')
  await shot(`${SHOTS}/batch-f2-filetree-hover.png`, clip)
} else {
  console.log('skip filetree hover: no row')
}

console.log('DONE')
ws.close()
process.exit(0)
