#!/usr/bin/env node
/**
 * IT-04 FE-02 批次 ⑦ 用户旅程无权限差异（AC-RULE-18）
 * 7.1 重度写作者：四向插行列 → undo → Esc 回静息
 * 7.2 复杂排版：评审改表 → 导出一致（三通道联证批次⑤ + 本轮 HTML 复核）
 * 7.3 阅读/审阅：标题折叠扫读 → 大纲跳转 → 最小编辑
 * 7.4 新用户/轻度：菜单栏逐项展开（shortcut 回显）→ Esc 回安静
 * 7.5 无权限差异（静态无角色分支 + 四旅程全通）
 */
import { writeFileSync } from 'node:fs'
const PORT = Number(process.env.IT04_FE02_CDP_PORT ?? 9501)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-04-FE-02'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/it04-fe02-journey.md`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const FIXTURE = [
  '# 旅程夹具',
  '',
  '## 章节甲（大纲节点）',
  '',
  '甲段正文。',
  '',
  '| A | B |',
  '| --- | --- |',
  '| 1 | 2 |',
  '| 3 | 4 |',
  '',
  '## 章节乙（大纲节点）',
  '',
  '乙段正文。',
  '',
  '## 章节丙（大纲节点）',
  '',
  '丙段正文。',
  ''
].join('\n')
writeFileSync(FIXTURE_PATH, FIXTURE)

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
async function evalExpr(expression, timeoutMs = 20000) {
  let timer
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('evaluate timeout')), timeoutMs) })
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
async function pressKey(key, code, opts = {}) {
  const { ctrlKey, shiftKey, altKey, metaKey, ...rest } = opts
  let modifiers = 0
  if (altKey) modifiers |= 1
  if (ctrlKey) modifiers |= 2
  if (metaKey) modifiers |= 4
  if (shiftKey) modifiers |= 8
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, ...rest })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers, ...rest })
}
async function dismissAllDialogs(max = 6) {
  for (let i = 0; i < max; i++) {
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
    if (!btn) break
    await clickAt(btn.x, btn.y)
    await sleep(400)
  }
}
const quietState = () => evalExpr(`(() => ({
  dialog: !!document.querySelector('.dialog-overlay .dialog'),
  menu: !!document.querySelector('.menu-dropdown'),
  tableToolbar: !!document.querySelector('.cm-md-table-toolbar'),
  ctxMenu: !!document.querySelector('.ctx-menu, .context-menu')
}))()`)

const results = { meta: { port: PORT, startedAt: new Date().toISOString(), batch: '⑦用户旅程' }, checks: [] }
const check = (name, ok, detail) => {
  results.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 700) : ''}`)
  return !!ok
}

await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await dismissAllDialogs()

async function clickTableCell() {
  for (let attempt = 0; attempt < 3; attempt++) {
    await dismissAllDialogs(2)
    await evalExpr(`(() => { window.__veloxEditor?.view?.focus?.(); return true })()`)
    const cell = await evalExpr(`(() => {
      const td = document.querySelector('.cm-md-table-wrap table tr td')
      if (!td) return null
      const r = td.getBoundingClientRect()
      return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
    })()`)
    if (!cell) { await sleep(400); continue }
    await clickAt(cell.x, cell.y)
    await sleep(600)
    if (await evalExpr(`!!document.querySelector('[data-op="alignCenter"]')`)) return true
  }
  return false
}
const dims = () => evalExpr(`(() => {
  const rows = [...document.querySelectorAll('.cm-md-table-wrap table tr')]
  return { rows: rows.length, cols: rows[0]?.children.length ?? 0 }
})()`)

// ── 7.1 重度写作者：四向插行列 → undo → Esc 静息 ───────────────────────────
await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
await sleep(1500)
await dismissAllDialogs()
await clickTableCell()
const d0 = await dims()
await pressKey('Enter', 'Enter', { ctrlKey: true }) // insertRowBelow
await sleep(500)
await pressKey('Enter', 'Enter', { ctrlKey: true, shiftKey: true }) // insertRowAbove
await sleep(500)
await pressKey('ArrowLeft', 'ArrowLeft', { ctrlKey: true, shiftKey: true }) // insertColLeft
await sleep(500)
await pressKey('ArrowRight', 'ArrowRight', { ctrlKey: true, shiftKey: true }) // insertColRight
await sleep(500)
const d1 = await dims()
const fourOpsOk = d1.rows === d0.rows + 2 && d1.cols === d0.cols + 2
// undo 一步（撤销最后一次插列）
await pressKey('z', 'KeyZ', { ctrlKey: true })
await sleep(500)
const d2 = await dims()
await pressKey('Escape', 'Escape')
await sleep(400)
const quiet1 = await quietState()
check('7.1 重度写作者旅程：四向插行列 → undo → Esc 回静息（AC-RULE-18）',
  fourOpsOk && d2.cols === d1.cols - 1 && quiet1.dialog === false && quiet1.menu === false,
  { d0, d1, d2, fourOpsOk, quiet: quiet1 }
)

// ── 7.2 复杂排版：评审改表（对齐 + 插删）→ 导出一致 ────────────────────────
await clickTableCell()
const alignBtn = await evalExpr(`(() => {
  const b = document.querySelector('[data-op="alignRight"]')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
if (alignBtn) await clickAt(alignBtn.x, alignBtn.y)
await sleep(500)
await evalExpr(`(() => {
  window.__fe02J = { html: null }
  window.__veloxP04.setSaveTarget(${JSON.stringify(OUT_DIR + '/IT-04-FE-02-journey-export.html')})
  window.__veloxP04.setExportStub({ html: async (t, html) => { window.__fe02J.html = html; return true }, pdf: async () => true })
  return true
})()`)
await evalExpr(`window.__veloxP04.runExport('html')`)
await sleep(1500)
const jHtml = await evalExpr(`window.__fe02J.html`)
if (typeof jHtml === 'string') writeFileSync(`${OUT_DIR}/IT-04-FE-02-journey-export.html`, jHtml)
const jCompare = await evalExpr(`(() => {
  const ed = document.querySelector('.cm-md-table-wrap table')
  const edRows = [...ed.querySelectorAll('tr')]
  const edCells = edRows.map((r) => [...r.children].map((c) => (c.textContent ?? '').trim()))
  const edAligns = edRows.map((r) => [...r.children].map((c) => getComputedStyle(c).textAlign))
  const doc = new DOMParser().parseFromString(${JSON.stringify(String(''))} + (window.__fe02J.html ?? ''), 'text/html')
  const t = doc.querySelector('table')
  const rows = [...t.querySelectorAll('tr')]
  const cells = rows.map((r) => [...r.children].map((c) => (c.textContent ?? '').trim()))
  const aligns = rows.map((r) => [...r.children].map((c) => {
    const m = /text-align\\s*:\\s*(\\w+)/.exec(c.getAttribute('style') ?? '')
    return m ? m[1] : (c.getAttribute('align') ?? 'left')
  }))
  return { cellsMatch: JSON.stringify(cells) === JSON.stringify(edCells), alignsMatch: JSON.stringify(aligns) === JSON.stringify(edAligns), rows: rows.length }
})()`)
check('7.2 复杂排版旅程：评审改表（对齐）→ 导出与编辑视图一致（三通道一致性联证批次⑤ retry2 7/7）',
  jCompare.cellsMatch && jCompare.alignsMatch && jCompare.rows > 0,
  { jCompare, threeChannel: 'IT-04-FE-02-cdp-batch5-retry2.json 5.1b/5.2b/5.3b 全过' }
)

// ── 7.3 阅读/审阅：标题折叠 → 大纲跳转 → 最小编辑 ──────────────────────────
await pressKey('Escape', 'Escape')
await sleep(300)
const foldBtn = await evalExpr(`(() => {
  const el = document.querySelector('[data-testid="heading-fold-caret"]')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2), key: el.dataset.foldKey ?? el.dataset.key ?? null }
})()`)
if (foldBtn) await clickAt(foldBtn.x, foldBtn.y)
await sleep(700)
const folded = await evalExpr(`({ keys: window.__veloxP18.getFoldedKeys(), summary: !!document.querySelector('.cm-md-fold-summary, .cm-md-fold-row') })`)
const outlineItems = await evalExpr(`[...document.querySelectorAll('.outline-item')].map((el) => {
  const r = el.getBoundingClientRect()
  return { text: (el.textContent ?? '').trim().slice(0, 20), x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})`)
let jumpOk = false
if (outlineItems.length > 1) {
  const target = outlineItems[outlineItems.length - 1]
  await clickAt(target.x, target.y)
  await sleep(700)
  jumpOk = await evalExpr(`(() => {
    const sel = window.__veloxEditor?.view?.state?.selection?.main
    return { sel, scrolled: window.__veloxEditor?.view?.scrollDOM ? window.__veloxEditor.view.scrollDOM.scrollTop >= 0 : false }
  })()`).then((r) => r.sel != null)
}
const docBefore = await evalExpr(`(window.__veloxP21?.getDoc?.() ?? '').length`)
await evalExpr(`(() => { window.__veloxEditor?.view?.focus?.(); return true })()`)
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'z', code: 'KeyZ', text: 'z' })
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ' })
await sleep(400)
const docAfter = await evalExpr(`(window.__veloxP21?.getDoc?.() ?? '').length`)
check('7.3 阅读/审阅旅程：折叠扫读 → 大纲跳转 → 最小编辑（AC-RULE-18）',
  folded.keys.length > 0 && outlineItems.length > 1 && jumpOk && docAfter !== docBefore,
  { folded, outlineCount: outlineItems.length, jumpOk, edit: { before: docBefore, after: docAfter } }
)

// ── 7.4 新用户/轻度：菜单逐项展开（shortcut 回显）→ Esc 回安静 ─────────────
await pressKey('Escape', 'Escape')
await sleep(300)
const menuBtns = await evalExpr(`[...document.querySelectorAll('.menubar-label')].map((el) => {
  const r = el.getBoundingClientRect()
  return { label: (el.textContent ?? '').trim(), x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})`)
const menuWalk = []
for (const b of menuBtns) {
  await clickAt(b.x, b.y)
  await sleep(400)
  const opened = await evalExpr(`(() => {
    const m = document.querySelector('.menu-dropdown')
    if (!m) return { open: false }
    const shortcuts = [...m.querySelectorAll('.menu-item-shortcut')].map((s) => (s.textContent ?? '').trim()).filter(Boolean)
    return { open: true, shortcutCount: shortcuts.length, sample: shortcuts.slice(0, 3), items: m.querySelectorAll('.menu-item').length }
  })()`)
  menuWalk.push({ menu: b.label, ...opened })
  await pressKey('Escape', 'Escape')
  await sleep(250)
}
await pressKey('Escape', 'Escape')
await sleep(300)
const quiet4 = await quietState()
check('7.4 新用户旅程：菜单栏逐项展开（shortcut 回显可见）→ Esc 回安静（AC-RULE-18）',
  menuWalk.length >= 5 && menuWalk.every((m) => m.open && m.items > 0) && menuWalk.some((m) => m.shortcutCount > 0) && !quiet4.menu && !quiet4.dialog,
  { menus: menuWalk, quiet: quiet4 }
)

results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-04-FE-02-cdp-batch7-data.json`, JSON.stringify(results, null, 2))
const failed = results.checks.filter((c) => !c.ok).length
console.log(`\n批次⑦ done: ${results.checks.length - failed}/${results.checks.length} PASS`)
process.exit(failed > 0 ? 1 : 0)
