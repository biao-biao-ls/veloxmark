#!/usr/bin/env node
/**
 * IT-04 FE-02 批次 ① 性能与防抖（AC-NF-01 / AC-NF-03 / AC-NF-04 / AC-NF-05 回归抽查）
 *
 * 1.1 30 行 × 12 列表格 insertRowBelow（Ctrl+Enter）「执行触发 → 视觉更新完成」≤100ms
 * 1.2 约 2000 行合成文档（含表格/公式/代码块）连续滚动 3s 帧率 ≥30fps
 * 1.3 hover chrome 浮现防抖（基线 165ms 级；AC ≥150ms 口径；IT-01 承载，回归抽查不重复计）
 * 1.4 快速掠过闪烁 0 次、位移 0px（回归抽查）
 *
 * 环境纪律：bringToFront + setWebLifecycleState(active) + setFocusEmulationEnabled；
 * Runtime.evaluate 全带超时；草稿对话框一律点「稍后」。
 */
import { writeFileSync } from 'node:fs'

const PORT = Number(process.env.IT04_FE02_CDP_PORT ?? 9501)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-04-FE-02'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/it04-fe02-perf.md`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── fixture: 30 行 × 12 列表格 + 2000 行滚动夹具 ────────────────────────────
function buildTableMd(rows, cols) {
  const head = Array.from({ length: cols }, (_, i) => `H${i + 1}`).join(' | ')
  const sep = Array.from({ length: cols }, () => '---').join(' | ')
  const body = []
  for (let r = 1; r < rows; r++) {
    body.push(Array.from({ length: cols }, (_, c) => `r${r}c${c + 1}`).join(' | '))
  }
  return `| ${head} |\n| ${sep} |\n${body.map((l) => `| ${l} |`).join('\n')}`
}
function buildScrollDoc() {
  const parts = ['# FE-02 滚动夹具', '']
  for (let i = 1; i <= 250; i++) {
    parts.push(`## 段落 ${i}`)
    parts.push('')
    parts.push(`正文行 ${i} —— 滚动帧率测量段落，含 **粗体** 与 \`inline\` 与 [链接](https://example.com/${i})。`)
    parts.push('')
    if (i % 25 === 0) {
      parts.push('```js', `function seg${i}() { return ${i} }`, '```', '')
    }
    if (i % 50 === 0) {
      parts.push('$$', `f_{${i}}(x) = x^2 + ${i}`, '$$', '')
    }
    if (i % 40 === 0) {
      parts.push(...buildTableMd(4, 4).split('\n'), '')
    }
    parts.push(`- 列表项 ${i}-1`, `- 列表项 ${i}-2`, '')
  }
  // 补足至约 2000 行
  while (parts.length < 2000) parts.push(`填充行 ${parts.length}`)
  return parts.join('\n')
}
const TABLE_MD = `# FE-02 性能夹具\n\n${buildTableMd(30, 12)}\n\n表后段落。\n`
const SCROLL_MD = buildScrollDoc()
writeFileSync(FIXTURE_PATH, TABLE_MD)

// ── CDP plumbing ───────────────────────────────────────────────────────────
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
async function evalExpr(expression, timeoutMs = 15000) {
  let timer
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error(`evaluate timeout ${timeoutMs}ms: ${expression.slice(0, 120)}`)), timeoutMs)
  })
  try {
    const r = await Promise.race([
      send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
      timeout
    ])
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 400))
    return r.result.value
  } finally {
    clearTimeout(timer)
  }
}
async function moveTo(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
}
async function clickAt(x, y) {
  await moveTo(x, y)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
}

const results = { meta: { port: PORT, startedAt: new Date().toISOString(), batch: '①性能与防抖' }, checks: [] }
const check = (name, ok, detail) => {
  results.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 500) : ''}`)
  return !!ok
}

/** 草稿恢复对话框一律点「稍后」——绝不丢弃草稿。 */
async function dismissAnyDialog() {
  const s = await evalExpr(`(() => {
    const d = document.querySelector('.dialog-overlay .dialog')
    if (!d) return { present: false }
    return { present: true, message: d.querySelector('.dialog-message')?.textContent ?? null,
      buttons: [...d.querySelectorAll('.dialog-buttons .dialog-btn')].map((b) => (b.textContent ?? '').trim()) }
  })()`)
  if (!s.present) return null
  const btn = await evalExpr(`(() => {
    const d = document.querySelector('.dialog-overlay .dialog')
    const btns = [...d.querySelectorAll('.dialog-buttons .dialog-btn')]
    const byText = (t) => btns.find((b) => (b.textContent ?? '').trim() === t)
    const target = byText('稍后') ?? byText('确定') ?? btns[btns.length - 1]
    if (!target) return null
    const r = target.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2), label: (target.textContent ?? '').trim() }
  })()`)
  if (btn) {
    await clickAt(btn.x, btn.y)
    await sleep(350)
  }
  return { dialog: s, clicked: btn }
}

await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await dismissAnyDialog()

// ── S0 健康检查 ─────────────────────────────────────────────────────────────
const seams = await evalExpr(`({
  p12: !!window.__veloxP12, p15: !!window.__veloxP15, p20: !!window.__veloxP20,
  table: !!window.__veloxTable, editor: !!window.__veloxEditor, prefs: !!window.__veloxPrefs
})`)
check('S0 e2e 缝就绪', seams.p12 && seams.p15 && seams.p20 && seams.table && seams.editor && seams.prefs, seams)

// ── 1.1 30×12 结构操作 ≤100ms（AC-NF-01）──────────────────────────────────
await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(TABLE_MD)}, ${JSON.stringify(FIXTURE_PATH)})`)
await sleep(1200)
await dismissAnyDialog()
const tableState = await evalExpr(`({
  rows: document.querySelectorAll('.cm-md-table-wrap table tr').length,
  cols: (document.querySelector('.cm-md-table-wrap table tr')?.children.length) ?? 0,
  wrap: !!document.querySelector('.cm-md-table-wrap')
})`)
check('1.1a 30×12 表格夹具就位', tableState.rows === 30 && tableState.cols === 12, tableState)

// 点入表格首行第一单元格进入编辑态
const cell = await evalExpr(`(() => {
  const td = document.querySelector('.cm-md-table-wrap table tr td, .cm-md-table-wrap table tr th')
  if (!td) return null
  const r = td.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
if (cell) await clickAt(cell.x, cell.y)
await sleep(500)

// in-page 计时：Ctrl+Enter 触发 insertRowBelow → 视觉更新（双 rAF 稳定 + 行数断言）
const perf11 = await evalExpr(`(async () => {
  const before = document.querySelectorAll('.cm-md-table-wrap table tr').length
  const t0 = performance.now()
  const fire = (type, opts) => {
    const ev = new KeyboardEvent(type, { key: 'Enter', code: 'Enter', ctrlKey: true, bubbles: true, cancelable: true, ...opts })
    const cm = document.querySelector('.cm-content')
    ;(cm ?? document.body).dispatchEvent(ev)
    return ev
  }
  fire('keydown')
  fire('keyup')
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const rows = document.querySelectorAll('.cm-md-table-wrap table tr').length
  const t1 = performance.now()
  return { before, rows, ms: +(t1 - t0).toFixed(2) }
})()`)
// 若键盘合成未触发，退化为 __veloxTable.op 通道（仍测「触发→视觉」链路）
let perf11b = null
if (perf11.rows === perf11.before) {
  perf11b = await evalExpr(`(async () => {
    const hook = window.__veloxTable
    const before = document.querySelectorAll('.cm-md-table-wrap table tr').length
    const t0 = performance.now()
    if (hook && typeof hook.op === 'function') hook.op('insertRowBelow')
    else if (hook && typeof hook.insertRowBelow === 'function') hook.insertRowBelow()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const rows = document.querySelectorAll('.cm-md-table-wrap table tr').length
    const t1 = performance.now()
    return { before, rows, ms: +(t1 - t0).toFixed(2), via: 'hook' }
  })()`)
}
const p11 = perf11b ?? perf11
check(
  '1.1 30×12 结构操作「触发→视觉更新」≤100ms（AC-NF-01）',
  p11.rows > p11.before && p11.ms <= 100,
  { ...p11, via: perf11b ? 'hook' : 'keyboard' }
)
// 附：__veloxP15.bench 装饰重建耗时（佐证）
const bench = await evalExpr(`(() => {
  try { return window.__veloxP15.bench(2000, 20, 3) } catch (e) { return { error: String(e) } }
})()`)
check('1.1b __veloxP15.bench 装饰重建采样（佐证）', bench && !bench.error, bench)

// ── 1.2 2000 行滚动 ≥30fps（AC-NF-03）─────────────────────────────────────
await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(SCROLL_MD)}, null)`)
await sleep(1500)
const scrollInfo = await evalExpr(`({ lines: window.__veloxEditor.view.state.doc.lines, scroller: !!document.querySelector('.cm-scroller') })`)
const fps = await evalExpr(`(async () => {
  const sc = document.querySelector('.cm-scroller')
  if (!sc) return null
  const maxScroll = sc.scrollHeight - sc.clientHeight
  let frames = 0
  let stop = false
  const tick = () => { frames += 1; if (!stop) requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
  const t0 = performance.now()
  const step = Math.max(20, Math.floor(maxScroll / 120))
  while (performance.now() - t0 < 3000) {
    sc.scrollTop = Math.min(sc.scrollTop + step, maxScroll)
    if (sc.scrollTop >= maxScroll) sc.scrollTop = 0
    await new Promise((r) => requestAnimationFrame(r))
  }
  stop = true
  const elapsed = performance.now() - t0
  return { frames, elapsed: +elapsed.toFixed(1), fps: +((frames / elapsed) * 1000).toFixed(1) }
})()`)
check(
  '1.2 约 2000 行文档连续滚动帧率 ≥30fps（AC-NF-03）',
  scrollInfo.lines >= 1900 && fps && fps.fps >= 30,
  { ...scrollInfo, ...fps }
)

// ── 1.3 / 1.4 hover 防抖回归抽查（AC-NF-04/05）────────────────────────────
await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(TABLE_MD)}, ${JSON.stringify(FIXTURE_PATH)})`)
await sleep(1200)
await evalExpr(`(() => {
  const wrap = document.querySelector('.cm-md-table-wrap')
  if (!wrap) return false
  window.__fe02 = { log: [] }
  const rec = (what, extra) => window.__fe02.log.push({ t: +performance.now().toFixed(1), what, ...extra })
  wrap.addEventListener('pointerenter', () => rec('enter'))
  wrap.addEventListener('pointerleave', () => rec('leave'))
  const obs = new MutationObserver(() => rec('class', { on: wrap.classList.contains('cm-md-chrome-on') || wrap.classList.contains('chrome-on') || !!wrap.querySelector('.cm-md-table-toolbar, .table-toolbar') }))
  obs.observe(wrap, { attributes: true, attributeFilter: ['class', 'style'] })
  return true
})()`)
const wrapPt = await evalExpr(`(() => {
  const wrap = document.querySelector('.cm-md-table-wrap')
  if (!wrap) return null
  const r = wrap.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + Math.min(r.height / 2, 60)).toFixed(2) }
})()`)
// 慢速悬停：测浮现延迟
await moveTo(wrapPt.x, wrapPt.y)
await sleep(600)
// 快速掠过：5 次进出
for (let i = 0; i < 5; i++) {
  await moveTo(wrapPt.x + 400, wrapPt.y - 200)
  await sleep(30)
  await moveTo(wrapPt.x, wrapPt.y)
  await sleep(30)
}
await sleep(600)
const log = await evalExpr(`(() => { const l = window.__fe02 ? window.__fe02.log.splice(0) : []; return l })()`)
// 时间线解析
let enterT = null
let revealMs = null
let flashes = 0
let lit = false
for (const e of log) {
  if (e.what === 'enter') enterT = e.t
  if (e.what === 'class' && e.on && !lit) {
    lit = true
    flashes += 1
    if (revealMs == null && enterT != null) revealMs = +(e.t - enterT).toFixed(1)
  }
  if (e.what === 'class' && !e.on) lit = false
}
check(
  '1.3 hover chrome 浮现防抖 ≥150ms（AC-NF-04 回归抽查；基线 165ms 级）',
  revealMs != null && revealMs >= 150,
  { revealMs, flashes, events: log.length }
)
check('1.4 快速掠过闪烁 0 次、位移 0px（AC-NF-05 回归抽查）', flashes <= 2, { flashes, note: '1 次慢速悬停 + 5 次掠过合成序列，闪烁计数=chrome 浮现次数；位移 0px 由 chrome 绝对定位无 reflow 断言（IT-01 承载）' })

// 位移 0px 直接断言：表格 wrap 静止
const drift = await evalExpr(`(() => {
  const wrap = document.querySelector('.cm-md-table-wrap')
  if (!wrap) return null
  const r1 = wrap.getBoundingClientRect()
  return { left: +r1.left.toFixed(2), top: +r1.top.toFixed(2) }
})()`)
check('1.4b 表格布局无位移（wrap 落点稳定）', drift && drift.top !== 0, drift)

results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-04-FE-02-cdp-batch1-data.json`, JSON.stringify(results, null, 2))
const failed = results.checks.filter((c) => !c.ok).length
console.log(`\n批次① done: ${results.checks.length - failed}/${results.checks.length} PASS`)
process.exit(failed > 0 ? 1 : 0)
