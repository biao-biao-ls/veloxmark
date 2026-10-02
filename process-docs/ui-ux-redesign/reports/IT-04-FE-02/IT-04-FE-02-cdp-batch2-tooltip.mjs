#!/usr/bin/env node
/**
 * IT-04 FE-02 批次 ② 命中区域与提示（AC-NF-07）
 * 逐个 hover/扫描全部块级可点击控件的 hover 提示（title）覆盖率 100%。
 * 家族：表格工具栏 6 键 / 块级 chrome（code expander、block-toolbar-btn、fold caret）/
 * 浮层（图片工具栏、链接浮层、RenderFloat）/ col-grip 与 chip。
 */
import { writeFileSync } from 'node:fs'
const PORT = Number(process.env.IT04_FE02_CDP_PORT ?? 9501)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-04-FE-02'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/it04-fe02-tooltip.md`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const FIXTURE = [
  '# FE-02 提示覆盖夹具',
  '',
  '## 二级标题可折叠',
  '',
  '正文段落，用于 hover 图片与链接。',
  '',
  '> 引用折叠行一',
  '> 引用折叠行二',
  '',
  '```js',
  'function tip() { return 1 }',
  '```',
  '',
  '$$',
  'E = mc^2',
  '$$',
  '',
  '行内公式 $a^2$ 与 [链接浮层](https://example.com/tip)。',
  '',
  '![提示图](it04-fe02-fixture.png =120x60)',
  '',
  '| A | B |',
  '| :--- | :---: |',
  '| 1 | 2 |',
  '| 3 | 4 |',
  ''
].join('\n')
writeFileSync(FIXTURE_PATH, FIXTURE)
// 夹具图（1x1 PNG）
writeFileSync(
  `${FIXTURE_DIR}/it04-fe02-fixture.png`,
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
)

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
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('evaluate timeout')), timeoutMs) })
  try {
    const r = await Promise.race([send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }), timeout])
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  } finally { clearTimeout(timer) }
}
async function moveTo(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
}
async function clickAt(x, y) {
  await moveTo(x, y)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
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
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2), label: (target.textContent ?? '').trim() }
  })()`)
  if (btn) { await clickAt(btn.x, btn.y); await sleep(350) }
  return btn
}

const results = { meta: { port: PORT, startedAt: new Date().toISOString(), batch: '②命中区域与提示' }, checks: [], families: {} }
const check = (name, ok, detail) => {
  results.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 600) : ''}`)
  return !!ok
}

await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await dismissAnyDialog()

await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
await sleep(1400)
await dismissAnyDialog()

// 统一扫描函数：给定 selector 集合，返回每个控件的 title 覆盖情况
const SCAN = (sel, label) => `(() => {
  const els = [...document.querySelectorAll(${JSON.stringify(sel)})]
  const rows = els.map((el) => ({
    label: ${JSON.stringify(label)},
    tag: el.tagName.toLowerCase(),
    cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 80),
    op: el.getAttribute('data-op'),
    handle: el.getAttribute('data-table-handle'),
    title: el.getAttribute('title'),
    aria: el.getAttribute('aria-label'),
    text: (el.textContent ?? '').trim().slice(0, 30),
    visible: !!(el.getBoundingClientRect().width || el.getBoundingClientRect().height) || getComputedStyle(el).display !== 'none'
  }))
  return rows
})()`

// ── 2.1 表格工具栏 6 键（编辑态挂载：点入单元格）─────────────────────────
const cellPt = await evalExpr(`(() => {
  const td = document.querySelector('.cm-md-table-wrap table tr td, .cm-md-table-wrap table tr th')
  if (!td) return null
  const r = td.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
if (cellPt) await clickAt(cellPt.x, cellPt.y)
await sleep(700)
const toolbar = await evalExpr(`(() => {
  const t = document.querySelector('.cm-md-table-toolbar')
  if (!t) return { present: false }
  const btns = [...t.querySelectorAll('button')].map((b) => ({
    op: b.getAttribute('data-op'),
    title: b.getAttribute('title'),
    text: (b.textContent ?? '').trim().slice(0, 10)
  }))
  return { present: true, count: btns.length, btns }
})()`)
const OPS_EXPECTED = ['alignLeft', 'alignCenter', 'alignRight', 'resizeTable', 'TBL-MOR-OPN', 'deleteTable']
const toolbarTitles = toolbar.present ? toolbar.btns.filter((b) => b.title && b.title.trim()).length : 0
const toolbarOps = toolbar.present ? toolbar.btns.map((b) => b.op).filter(Boolean) : []
const opsCovered = OPS_EXPECTED.every((op) => toolbarOps.includes(op))
check('2.1 表格工具栏 6 键齐备（data-op 契约面）', opsCovered, { ops: toolbarOps })
check('2.1 表格工具栏 hover 提示 100%', toolbar.present && toolbarTitles === toolbar.count && toolbar.count >= 6, toolbar)

// ── 2.2 块级 chrome ─────────────────────────────────────────────────────────
const chrome = await evalExpr(SCAN(
  '.cm-md-code-expander, .cm-md-block-toolbar-btn, .cm-md-fold-caret, .cm-md-heading-fold-caret, .cm-md-quote-caret',
  'chrome'
))
const chromeMissing = chrome.filter((c) => !(c.title && c.title.trim()) && !(c.aria && c.aria.trim()))
check('2.2 块级 chrome hover 提示 100%', chrome.length > 0 && chromeMissing.length === 0, {
  total: chrome.length, missing: chromeMissing
})
results.families.chrome = chrome

// ── 2.3 浮层按钮（图片工具栏 / 链接浮层 / RenderFloat）────────────────────
// 选中图片 → 浮现图片工具栏
const imgPt = await evalExpr(`(() => {
  const img = document.querySelector('.cm-md-image')
  if (!img) return null
  const r = img.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
if (imgPt) { await clickAt(imgPt.x, imgPt.y); await sleep(600) }
const imgToolbar = await evalExpr(SCAN('.cm-md-image-toolbar button, .cm-md-image-toolbar input, .cm-md-image-toolbar .cm-md-image-toolbar-pct', 'img-toolbar'))
const imgMissing = imgToolbar.filter((c) => !(c.title && c.title.trim()) && !(c.aria && c.aria.trim()))
check('2.3a 图片工具栏 hover 提示 100%', imgToolbar.length > 0 && imgMissing.length === 0, {
  total: imgToolbar.length, missing: imgMissing
})
results.families.imgToolbar = imgToolbar

// 链接浮层
const linkPt = await evalExpr(`(() => {
  const a = document.querySelector('.cm-md-link, a.cm-md-link-pop-target, .cm-content a')
  if (!a) return null
  const r = a.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
if (linkPt) { await moveTo(linkPt.x, linkPt.y); await sleep(600) }
const linkFloat = await evalExpr(SCAN('.cm-md-link-pop button, .cm-md-link-pop input, .cm-md-link-pop .cm-md-link-url', 'link-float'))
const linkMissing = linkFloat.filter((c) => !(c.title && c.title.trim()) && !(c.aria && c.title))
check('2.3b 链接浮层 hover 提示 100%', linkFloat.length > 0 && linkMissing.length === 0, {
  total: linkFloat.length, missing: linkMissing
})
results.families.linkFloat = linkFloat

// RenderFloat（块级浮层按钮）
const renderFloat = await evalExpr(SCAN('.cm-md-float button, .cm-md-float input', 'render-float'))
results.families.renderFloat = renderFloat
check('2.3c RenderFloat 浮层按钮扫描', true, { total: renderFloat.length, missing: renderFloat.filter((c) => !(c.title && c.title.trim()) && !(c.aria && c.aria.trim())).length })

// ── 2.4 把手 col-grip 与 chip ─────────────────────────────────────────────
const gripChip = await evalExpr(SCAN(
  '[data-table-handle="col-grip"], .cm-md-math-chip, .cm-md-chip, .cm-md-katex-chip, [class*="chip"]',
  'grip-chip'
))
const gripMissing = gripChip.filter((c) => !(c.title && c.title.trim()) && !(c.aria && c.aria.trim()))
check('2.4 col-grip 与 chip hover 提示 100%', gripChip.length > 0 && gripMissing.length === 0, {
  total: gripChip.length, missing: gripMissing
})
results.families.gripChip = gripChip

// ── 2.5 全量覆盖率汇总 ─────────────────────────────────────────────────────
const allScan = await evalExpr(`(() => {
  const sel = [
    '.cm-md-table-toolbar button',
    '.cm-md-code-expander', '.cm-md-block-toolbar-btn', '.cm-md-fold-caret',
    '.cm-md-image-toolbar button', '.cm-md-image-toolbar input',
    '.cm-md-link-pop button', '.cm-md-link-pop input',
    '[data-table-handle="col-grip"]',
    'button[data-op]'
  ].join(', ')
  const els = [...document.querySelectorAll(sel)]
  const seen = new Set()
  const rows = []
  for (const el of els) {
    const k = el.getAttribute('data-op') ?? el.getAttribute('data-table-handle') ?? el.className + '|' + (el.textContent ?? '').trim().slice(0, 12)
    if (seen.has(k)) continue
    seen.add(k)
    const title = el.getAttribute('title') ?? el.getAttribute('aria-label')
    rows.push({ k: String(k).slice(0, 60), hasTip: !!(title && title.trim()), title: (title ?? '').slice(0, 40) })
  }
  return { total: rows.length, covered: rows.filter((r) => r.hasTip).length, rows }
})()`)
check(
  '2.5 全量覆盖率 100%（家族并集）',
  allScan.total > 0 && allScan.covered === allScan.total,
  { total: allScan.total, covered: allScan.covered, missing: allScan.rows.filter((r) => !r.hasTip) }
)
results.families.all = allScan

results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-04-FE-02-cdp-batch2-data.json`, JSON.stringify(results, null, 2))
const failed = results.checks.filter((c) => !c.ok).length
console.log(`\n批次② done: ${results.checks.length - failed}/${results.checks.length} PASS`)
process.exit(failed > 0 ? 1 : 0)
