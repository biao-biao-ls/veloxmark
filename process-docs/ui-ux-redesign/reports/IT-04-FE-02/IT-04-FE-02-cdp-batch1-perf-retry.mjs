#!/usr/bin/env node
/** IT-04 FE-02 批次① 1.1 复测（热身后重复采样，排除冷启动噪声）。 */
import { writeFileSync } from 'node:fs'
const PORT = Number(process.env.IT04_FE02_CDP_PORT ?? 9501)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-04-FE-02'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/it04-fe02-perf.md`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function buildTableMd(rows, cols) {
  const head = Array.from({ length: cols }, (_, i) => `H${i + 1}`).join(' | ')
  const sep = Array.from({ length: cols }, () => '---').join(' | ')
  const body = []
  for (let r = 1; r < rows; r++) body.push(Array.from({ length: cols }, (_, c) => `r${r}c${c + 1}`).join(' | '))
  return `| ${head} |\n| ${sep} |\n${body.map((l) => `| ${l} |`).join('\n')}`
}
const TABLE_MD = `# FE-02 性能夹具\n\n${buildTableMd(30, 12)}\n\n表后段落。\n`

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
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
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) })
}
async function evalExpr(expression, timeoutMs = 15000) {
  let timer
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), timeoutMs) })
  try {
    const r = await Promise.race([send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }), timeout])
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  } finally { clearTimeout(timer) }
}
async function clickAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
}

await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })

await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(TABLE_MD)}, ${JSON.stringify(FIXTURE_PATH)})`)
await sleep(1500)
const cell = await evalExpr(`(() => {
  const td = document.querySelector('.cm-md-table-wrap table tr td, .cm-md-table-wrap table tr th')
  const r = td.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
await clickAt(cell.x, cell.y)
await sleep(600)

const samples = []
for (let i = 0; i < 6; i++) {
  const m = await evalExpr(`(async () => {
    const before = document.querySelectorAll('.cm-md-table-wrap table tr').length
    const t0 = performance.now()
    const fire = (type) => {
      const ev = new KeyboardEvent(type, { key: 'Enter', code: 'Enter', ctrlKey: true, bubbles: true, cancelable: true })
      const cm = document.querySelector('.cm-content')
      ;(cm ?? document.body).dispatchEvent(ev)
    }
    fire('keydown'); fire('keyup')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const rows = document.querySelectorAll('.cm-md-table-wrap table tr').length
    const t1 = performance.now()
    return { before, rows, ms: +(t1 - t0).toFixed(2) }
  })()`)
  samples.push(m)
  await sleep(250)
}
const okCount = samples.filter((s) => s.rows > s.before && s.ms <= 100).length
const growing = samples.filter((s) => s.rows > s.before)
const sorted = growing.map((s) => s.ms).sort((a, b) => a - b)
const mid = sorted.length >> 1
const median = sorted.length === 0 ? null : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
const out = { samples, okCount, growing: growing.length, median }
console.log(JSON.stringify(out, null, 2))
writeFileSync(`${OUT_DIR}/IT-04-FE-02-cdp-batch1-retry.json`, JSON.stringify(out, null, 2))
process.exit(0)
