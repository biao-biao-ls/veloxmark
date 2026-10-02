#!/usr/bin/env node
/**
 * IT-01 FE-10 r2 recapture — 定点补证（复刻评审 r2 #5/#6）.
 *
 * 1. Page.reload 强制（HMR 不传播 + 旧 CSS 缓存教训）
 * 2. 装载表格夹具 → 点击单元格进编辑态
 * 3. 源级/计算级取证：caret-color == accent（亮/暗）、U1 wrap outline、active cell 2px
 * 4. 连拍多帧取 caret blink 亮相帧（键入重置 blink 亮相相位后再拍）
 *
 * 产物只写 reports/IT-01-FE-10/（最终帧）；候选帧写 temp/fe10-r2-frames/。
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.FE10_CDP_PORT ?? 9595)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-10'
const FRAME_DIR = 'D:/code/typora/temp/fe10-r2-frames'
const FIXTURE_PATH = 'D:/code/typora/temp/fe10-fixture.md'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) throw new Error('no CDP page target')

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})

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
async function evalExpr(expression, timeoutMs = 8000) {
  let timer
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error(`eval timeout: ${expression.slice(0, 120)}`)), timeoutMs)
  })
  try {
    const r = await Promise.race([
      send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
      timeout
    ])
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails))
    return r.result.value
  } finally {
    clearTimeout(timer)
  }
}

const results = { meta: { port: PORT, startedAt: new Date().toISOString() }, checks: [] }
const check = (name, ok, detail) => {
  results.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail) : ''}`)
  return !!ok
}

async function moveTo(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
}
async function clickAt(x, y) {
  await moveTo(x, y)
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1
  })
}

async function dismissAnyDialog() {
  const btn = await evalExpr(`(() => {
    const d = document.querySelector('.dialog-overlay .dialog')
    if (!d) return null
    const btns = [...d.querySelectorAll('.dialog-buttons .dialog-btn')]
    const byText = (t) => btns.find((b) => (b.textContent ?? '').trim() === t)
    const target = byText('稍后') ?? byText('确定') ?? btns[btns.length - 1]
    if (!target) return null
    const r = target.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (btn) {
    await clickAt(btn.x, btn.y)
    await sleep(350)
  }
  return !!btn
}

const FIXTURE = `# FE-10 r2 recapture fixture

Body paragraph for chrome checks and secondary exit.

| h1 | h2 |
| --- | --- |
| 陈屿 | b |
| c | d |

Tail paragraph after the table.
`

// ── lifecycle + viewport (evidence parity 1200×800) ─────────────────────────
await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await send('Emulation.setDeviceMetricsOverride', {
  width: 1200,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false
})

// ── 0. Page.reload 强制（调度硬要求）────────────────────────────────────────
await send('Page.reload')
await sleep(2200)
await dismissAnyDialog()

const seams = await evalExpr(`({
  p12: !!window.__veloxP12, p20: !!window.__veloxP20, editor: !!window.__veloxEditor
})`)
check('reload 后 e2e 缝就绪', seams.p12 && seams.p20 && seams.editor, seams)

await evalExpr(`(() => {
  window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})
  return true
})()`)
await sleep(900)
await dismissAnyDialog()
const loadState = await evalExpr(`({
  fp: window.__veloxP12.getFilePath(),
  tables: document.querySelectorAll('.cm-md-table-wrap').length
})`)
check('夹具装载（表格在位）', loadState.tables >= 1, loadState)

// ── 1. 进编辑态（点击 row1 col0「陈屿」）────────────────────────────────────
await evalExpr(`(() => {
  const td = document.querySelector('.cm-md-table td[data-row="1"][data-col="0"]')
  if (td) td.scrollIntoView({ block: 'center', inline: 'nearest' })
  return !!td
})()`)
await sleep(200)
const cell = await evalExpr(`(() => {
  const td = document.querySelector('.cm-md-table td[data-row="1"][data-col="0"]')
  if (!td) return null
  const r = td.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +Math.min(Math.max(r.top + r.height / 2, 48), window.innerHeight - 48).toFixed(2), rect: { x: r.x, y: r.y, w: r.width, h: r.height } }
})()`)
check('单元格定位', !!cell, cell && { x: cell.x, y: cell.y })
await clickAt(cell.x, cell.y)
await sleep(450)

const editState = await evalExpr(`(() => {
  const wrap = document.querySelector('.cm-md-table-wrap')
  const editing = document.querySelectorAll('.cm-md-table-editing').length
  const toolbar = document.querySelectorAll('.cm-md-table-toolbar').length
  const cellEd = document.querySelector('.cm-md-table-cell-editing')
  const nested = !!window.__veloxTable?.nested
  return { editing, toolbar, nested, wrapEditing: !!wrap?.classList.contains('cm-md-table-editing'), hasCellEd: !!cellEd }
})()`)
check('编辑态就绪（editing + 工具栏 + 嵌套编辑器）', editState.editing === 1 && editState.toolbar === 1 && editState.nested, editState)

// ── 2. 计算级取证：caret / U1 / active-cell ─────────────────────────────────
const probe = await evalExpr(`(() => {
  const wrap = document.querySelector('.cm-md-table-wrap.cm-md-table-editing')
  const ws = wrap ? getComputedStyle(wrap) : null
  const cellEd = document.querySelector('.cm-md-table-cell-editing')
  const cs = cellEd ? getComputedStyle(cellEd) : null
  const content = document.querySelector('.cm-md-table-cell-editing .cm-editor .cm-content')
  const line = document.querySelector('.cm-md-table-cell-editing .cm-editor .cm-line')
  const caretC = content ? getComputedStyle(content).caretColor : null
  const caretL = line ? getComputedStyle(line).caretColor : null
  const accent = getComputedStyle(document.querySelector('.app') ?? document.documentElement).getPropertyValue('--accent').trim()
  const wrapRect = wrap ? wrap.getBoundingClientRect() : null
  const cellRect = cellEd ? cellEd.getBoundingClientRect() : null
  const tb = document.querySelector('.cm-md-table-toolbar')
  const tbText = tb ? [...tb.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim()) : []
  return {
    accent, caretC, caretL,
    u1: ws ? { style: ws.outlineStyle, width: ws.outlineWidth, color: ws.outlineColor, offset: ws.outlineOffset } : null,
    active: cs ? { style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor } : null,
    wrapRect, cellRect, tbText, tbCount: tb ? tb.querySelectorAll('button').length : 0
  }
})()`)
results.probeLight = probe

const accentRgb = 'rgb(9, 105, 218)' // #0969da light
check('caret-color == accent（亮）', probe.caretC === accentRgb && probe.caretL === accentRgb, { caretC: probe.caretC, caretL: probe.caretL, accent: probe.accent })
check('U1 整表外框 1px accent（亮，计算级）', probe.u1 && probe.u1.style === 'solid' && probe.u1.width === '1px' && probe.u1.color === accentRgb, probe.u1)
check('激活单元格 2px accent 外框（亮，计算级）', probe.active && probe.active.style === 'solid' && probe.active.width === '2px' && probe.active.color === accentRgb, probe.active)
check('工具栏 pill 在位（编辑态）', probe.tbCount >= 6, { tbCount: probe.tbCount, tbText: probe.tbText })

// 深色主题 caret 自查（翻 token，不截图）
await evalExpr(`window.__veloxP20.setThemePref('dark'); true`)
await sleep(300)
const darkProbe = await evalExpr(`(() => {
  const content = document.querySelector('.cm-md-table-cell-editing .cm-editor .cm-content')
  const line = document.querySelector('.cm-md-table-cell-editing .cm-editor .cm-line')
  return {
    caretC: content ? getComputedStyle(content).caretColor : null,
    caretL: line ? getComputedStyle(line).caretColor : null
  }
})()`)
const accentDarkRgb = 'rgb(88, 166, 255)' // #58a6ff dark
check('caret-color == accent（暗）', darkProbe.caretC === accentDarkRgb && darkProbe.caretL === accentDarkRgb, darkProbe)
results.probeDark = darkProbe
await evalExpr(`window.__veloxP20.setThemePref('light'); true`)
await sleep(300)

// ── 3. 连拍取 caret 亮相帧 ──────────────────────────────────────────────────
mkdirSync(FRAME_DIR, { recursive: true })
// 键入重置 blink 至亮相相位（End 归位不动文本）
await send('Input.dispatchKeyEvent', {
  type: 'rawKeyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35, nativeVirtualKeyCode: 35
})
await send('Input.dispatchKeyEvent', {
  type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35, nativeVirtualKeyCode: 35
})
const frames = []
for (let i = 0; i < 12; i++) {
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const buf = Buffer.from(shot.data, 'base64')
  const p = `${FRAME_DIR}/frame-${String(i).padStart(2, '0')}.png`
  writeFileSync(p, buf)
  frames.push({ i, path: p, bytes: buf.length })
  await sleep(90)
}
check('连拍 12 帧落盘（temp 候选）', frames.length === 12, { frames: frames.length })

writeFileSync(
  `${FRAME_DIR}/meta.json`,
  JSON.stringify({ cellRect: probe.cellRect, wrapRect: probe.wrapRect, accentRgb, frames }, null, 2)
)
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(`${OUT_DIR}/IT-01-FE-10-recapture-results.json`, JSON.stringify(results, null, 2))
console.log('recapture driver done')
ws.close()
