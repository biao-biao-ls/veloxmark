#!/usr/bin/env node
/**
 * 批 r3 N1 证据：⊞ 弹层 label 补「· 缩放整表」后缀。
 *
 * 启动（单实例，别名 batch-r3）：
 *   npx electron-vite dev -- --remote-debugging-port=9597 --user-data-dir=temp/batch-r3-gridlabel-userdata
 *
 * 动作：Page.reload → 载 5×4 表 fixture → 进表格编辑态 → 开 ⊞ → 拖选 3×4
 * 证据帧（只写 reports/IT-01-FE-05/）：
 *   shots/batch-r3-gridlabel-close.png   label 特写（2× 放大）
 *   shots/batch-r3-gridlabel-pop.png     弹层全景
 *   IT-01-FE-05-impl.png                 全页（弹层含 label 场景；旧图先归档 *-r2-era.png）
 * 断言：b=「3 × 4」accent/600 实时联动 + 后缀「 · 缩放整表」（U+00B7）gray/--fg-dim。
 */
import { mkdirSync, writeFileSync, renameSync, existsSync } from 'node:fs'

const PORT = Number(process.env.BATCHR3_CDP_PORT ?? 9597)
const REPORTS = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-05'
const SHOTS = `${REPORTS}/shots`
const TEMP = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/temp'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 5×4 表（拖选 3×4 = 设计样张态）；fixture 是工作文件，落 temp 不落 reports
const FIXTURE_PATH = `${TEMP}/batch-r3-gridlabel-fixture.md`
const FIXTURE = [
  '# FE-05 grid label r3',
  '',
  '| H1 | H2 | H3 | H4 |',
  '| --- | --- | --- | --- |',
  '| a1 | a2 | a3 | a4 |',
  '| b1 | b2 | b3 | b4 |',
  '| c1 | c2 | c3 | c4 |',
  '| d1 | d2 | d3 | d4 |',
  '| e1 | e2 | e3 | e4 |',
  ''
].join('\n')

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page' && /VeloxMark/i.test(t.title ?? '')) ?? targets.find((t) => t.type === 'page')
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
async function evalExpr(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails))
  return r.result.value
}
async function clickAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
  await sleep(30)
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
}
async function pressAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
}
async function moveAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 })
}
async function releaseAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
}

const results = { checks: [] }
const check = (name, ok, detail) => {
  results.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail) : ''}`)
  return !!ok
}
/** clip: page coords（含 scroll）；scale>1 出特写放大帧。 */
async function shot(name, clip, scale = 1) {
  const s = await send('Page.captureScreenshot', {
    format: 'png',
    ...(clip ? { clip: { ...clip, scale } } : {})
  })
  mkdirSync(SHOTS, { recursive: true })
  const out = name.startsWith('shots/') ? `${REPORTS}/${name}` : `${REPORTS}/${name}`
  writeFileSync(out, Buffer.from(s.data, 'base64'))
  console.log(`SHOT  ${name}`)
}
async function dismissAnyDialog() {
  const s = await evalExpr(`(() => {
    const d = document.querySelector('.dialog-overlay .dialog')
    if (!d) return { present: false }
    return { present: true, buttons: [...d.querySelectorAll('.dialog-buttons .dialog-btn')].map((b) => (b.textContent ?? '').trim()) }
  })()`)
  if (!s.present) return
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
    console.log('dismissed dialog')
  }
}

// 读数探针：b 数字 + 后缀 span 分开取，字节级断言间隔点口径
const READOUT_PROBE = `(() => {
  const el = document.querySelector('.table-grid-picker')
  const readout = el?.querySelector('.table-grid-picker-readout')
  const b = readout?.querySelector('b')
  const suffix = readout?.querySelector('.table-grid-picker-readout-suffix')
  const cs = b ? getComputedStyle(b) : null
  const ss = suffix ? getComputedStyle(suffix) : null
  return {
    open: !!el,
    bText: b?.textContent ?? null,
    suffixText: suffix?.textContent ?? null,
    fullText: readout?.textContent ?? null,
    bColor: cs?.color ?? null,
    bWeight: cs?.fontWeight ?? null,
    bSize: cs?.fontSize ?? null,
    suffixColor: ss?.color ?? null,
    suffixSize: ss?.fontSize ?? null
  }
})()`
const RECT = `(() => {
  const el = document.querySelector('.table-grid-picker')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height }
})()`
const LABEL_RECT = `(() => {
  const el = document.querySelector('.table-grid-picker-readout')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    x: Math.max(0, r.left + window.scrollX - 10),
    y: Math.max(0, r.top + window.scrollY - 6),
    width: r.width + 20,
    height: r.height + 12
  }
})()`

// ── run ─────────────────────────────────────────────────────────────────────
await send('Page.enable')
await send('Runtime.enable')
await send('Page.bringToFront')
await send('Emulation.setFocusEmulationEnabled', { enabled: true })

console.log('>> Page.reload')
await send('Page.reload')
await sleep(1800)
await dismissAnyDialog()

writeFileSync(FIXTURE_PATH, FIXTURE)
for (let attempt = 1; attempt <= 4; attempt++) {
  await dismissAnyDialog()
  await evalExpr(`(() => {
    window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})
    return true
  })()`)
  await sleep(900)
  const state = await evalExpr(`({
    fp: window.__veloxP12.getFilePath(),
    tables: document.querySelectorAll('.cm-md-table-wrap').length
  })`)
  console.log('load attempt', attempt, JSON.stringify(state))
  if (state.fp === FIXTURE_PATH && state.tables >= 1) break
}

// 进表格编辑态（点击首格）
const cellPoint = await evalExpr(`(() => {
  const td = document.querySelector('.cm-md-table td[data-row="1"][data-col="0"], .cm-md-table th[data-row="1"][data-col="0"]')
  if (!td) return null
  td.scrollIntoView({ block: 'center', inline: 'nearest' })
  const r = td.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
if (!cellPoint) throw new Error('table cell not found')
await clickAt(cellPoint.x, cellPoint.y)
await sleep(700)
const editing = await evalExpr(`!!document.querySelector('.cm-md-table-wrap.cm-md-table-editing')`)
check('表格编辑态已进入', editing)

// 开 ⊞
const btn = await evalExpr(`(() => {
  const b = document.querySelector('.cm-md-table-toolbar-btn[data-testid="table-toolbar-grid-btn"]')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
if (!btn) throw new Error('grid toolbar btn not found')
await clickAt(btn.x, btn.y)
await sleep(500)
check('⊞ 弹层已打开', await evalExpr(`!!document.querySelector('.table-grid-picker')`))

// 拖选 3×4（press-drag-release，mouseup 落格区确认）
const pickPoint = async (row, col) =>
  evalExpr(`(() => {
    const c = document.querySelector('.table-grid-picker .table-grid-cell[data-row="${row}"][data-col="${col}"]')
    if (!c) return null
    const r = c.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
const pStart = await pickPoint(1, 1)
const pMid = await pickPoint(2, 2)
const pEnd = await pickPoint(3, 4)
if (!pStart || !pEnd) throw new Error('picker cells missing')
await pressAt(pStart.x, pStart.y)
await sleep(80)
await moveAt(pMid.x, pMid.y)
await sleep(80)
await moveAt(pEnd.x, pEnd.y)
await sleep(150)

const probe = await evalExpr(READOUT_PROBE)
console.log('readout probe', JSON.stringify(probe))

// N1 断言：后缀逐字 + 间隔点口径（space + U+00B7 + space）
const expectSuffix = ' · 缩放整表'
check('N1 后缀逐字「 · 缩放整表」（space+U+00B7+space）', probe.suffixText === expectSuffix, {
  got: probe.suffixText,
  codepoints: [...(probe.suffixText ?? '')].map((c) => '0x' + c.codePointAt(0).toString(16))
})
check('N1 label 全文「3 × 4 · 缩放整表」', probe.fullText === `3 × 4${expectSuffix}`, probe.fullText)
check('拖选 3×4 时 <b> 实时=「3 × 4」（数字逻辑不回归）', probe.bText === '3 × 4', probe.bText)
check('<b> 保持 accent/600 强调态', /9,\s*105,\s*218/.test(probe.bColor ?? '') && Number(probe.bWeight) >= 600, {
  bColor: probe.bColor,
  bWeight: probe.bWeight
})
check('后缀灰字（--fg-dim 系，非 accent）', /107,\s*107,\s*107/.test(probe.suffixColor ?? '') && !/9,\s*105,\s*218/.test(probe.suffixColor ?? ''), {
  suffixColor: probe.suffixColor,
  suffixSize: probe.suffixSize
})

// 实时联动复测：改 hover 到 2×2，b 变、后缀不变
const p22 = await pickPoint(2, 2)
await moveAt(p22.x, p22.y)
await sleep(120)
const probe22 = await evalExpr(READOUT_PROBE)
check('hover 2×2 时 <b> 实时联动为「2 × 2」', probe22.bText === '2 × 2', probe22.bText)
check('后缀不随拖选改写', probe22.suffixText === expectSuffix, probe22.suffixText)
// 回到 3×4（设计样张态）再拍
await moveAt(pEnd.x, pEnd.y)
await sleep(150)
const probe34 = await evalExpr(READOUT_PROBE)
check('回拖 3×4 恢复「3 × 4」', probe34.bText === '3 × 4', probe34.bText)

// ── 取证帧 ──────────────────────────────────────────────────────────────────
const labelRect = await evalExpr(LABEL_RECT)
if (!labelRect) throw new Error('label rect missing')
await shot('shots/batch-r3-gridlabel-close.png', labelRect, 2)
const popRect = await evalExpr(RECT)
if (!popRect) throw new Error('picker rect missing')
await shot('shots/batch-r3-gridlabel-pop.png', popRect, 2)

// impl.png：场景含弹层 → 旧图归档 *-r2-era.png 后刷新（任务取证纪律 #4）
const implPath = `${REPORTS}/IT-01-FE-05-impl.png`
const archivePath = `${REPORTS}/IT-01-FE-05-impl-r2-era.png`
if (existsSync(implPath) && !existsSync(archivePath)) {
  renameSync(implPath, archivePath)
  console.log('ARCHIVE IT-01-FE-05-impl.png → IT-01-FE-05-impl-r2-era.png')
}
await shot('IT-01-FE-05-impl.png')

// 收尾：拖选确认缩放 3×4 后关弹层，避免留在交互态
await releaseAt(pEnd.x, pEnd.y)
await sleep(300)

const failed = results.checks.filter((c) => !c.ok)
console.log(`\n${results.checks.length - failed.length}/${results.checks.length} checks passed`)
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' | '))
  process.exitCode = 1
}
ws.close()
process.exit(process.exitCode ?? 0)
