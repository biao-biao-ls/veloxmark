#!/usr/bin/env node
/**
 * IT-04 FE-02 批次 ⑤ 复测2（retry 弹窗干扰修正版）
 * - dismissAllDialogs 循环清场（含「恢复未保存的草稿」→ 点「稍后」，绝不丢稿）
 * - 结构操作逐步断言生效（插行/插列/改对齐各自验证），无效则重试
 * - 5.6 只断言 Ctrl+Z「新增」的 toast/弹窗（测试前清场 + 前后对照）
 */
import { writeFileSync } from 'node:fs'
const PORT = Number(process.env.IT04_FE02_CDP_PORT ?? 9501)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-04-FE-02'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/it04-fe02-export.md`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const FIXTURE = [
  '# 导出对账夹具',
  '',
  '| 左列 | 中列 | 右列 |',
  '| :--- | :---: | ---: |',
  '| a1 | b1 | c1 |',
  '| a2 | b2 | c2 |',
  '',
  '表后段落。',
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
async function dialogInfo() {
  return evalExpr(`(() => {
    const d = document.querySelector('.dialog-overlay .dialog')
    if (!d) return null
    const btns = [...d.querySelectorAll('.dialog-buttons .dialog-btn')].map((b) => (b.textContent ?? '').trim())
    return { text: (d.textContent ?? '').trim().slice(0, 120), btns }
  })()`)
}
/** 循环清场对话框：一律点「稍后」（绝不丢弃草稿），其次「确定」/末按钮。 */
async function dismissAllDialogs(max = 6) {
  const seen = []
  for (let i = 0; i < max; i++) {
    const btn = await evalExpr(`(() => {
      const d = document.querySelector('.dialog-overlay .dialog')
      if (!d) return null
      const info = { text: (d.textContent ?? '').trim().slice(0, 120) }
      const btns = [...d.querySelectorAll('.dialog-buttons .dialog-btn')]
      const byText = (t) => btns.find((b) => (b.textContent ?? '').trim() === t)
      const target = byText('稍后') ?? byText('确定') ?? btns[btns.length - 1]
      if (!target) return { ...info, no: true }
      const r = target.getBoundingClientRect()
      return { ...info, x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2), label: (target.textContent ?? '').trim() }
    })()`)
    if (!btn) break
    if (btn.no) break
    seen.push({ text: btn.text, label: btn.label })
    await clickAt(btn.x, btn.y)
    await sleep(400)
  }
  return seen
}

const results = { meta: { port: PORT, startedAt: new Date().toISOString(), batch: '⑤复测2（弹窗清场修正）' }, checks: [] }
const check = (name, ok, detail) => {
  results.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 700) : ''}`)
  return !!ok
}

await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
const cleared0 = await dismissAllDialogs()

await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
await sleep(1600)
const cleared1 = await dismissAllDialogs()
results.meta.dialogsCleared = { before: cleared0, afterLoadDoc: cleared1 }

// ── 结构操作（每步断言生效，无效重试一次）──────────────────────────────────
async function clickFirstCell() {
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
    const inEdit = await evalExpr(`!!document.querySelector('[data-op="alignCenter"]')`)
    if (inEdit) return true
  }
  return false
}
const entered = await clickFirstCell()
check('5.0a 点入单元格进入编辑态（7C 工具栏挂载）', entered)

const rowCount = () => evalExpr(`document.querySelectorAll('.cm-md-table-wrap table tr').length`)
// 插行 Ctrl+Enter
let r0 = await rowCount()
await pressKey('Enter', 'Enter', { ctrlKey: true })
await sleep(600)
let r1 = await rowCount()
if (!(r1 > r0)) {
  await clickFirstCell()
  await pressKey('Enter', 'Enter', { ctrlKey: true })
  await sleep(600)
  r1 = await rowCount()
}
const colCount = () => evalExpr(`document.querySelectorAll('.cm-md-table-wrap table tr')[0]?.children.length ?? 0`)
// 插列 Ctrl+Shift+→
let c0 = await colCount()
await pressKey('ArrowRight', 'ArrowRight', { ctrlKey: true, shiftKey: true })
await sleep(600)
let c1 = await colCount()
if (!(c1 > c0)) {
  await clickFirstCell()
  await pressKey('ArrowRight', 'ArrowRight', { ctrlKey: true, shiftKey: true })
  await sleep(600)
  c1 = await colCount()
}
// 改对齐 alignCenter（点工具栏真实通道）
const alignBtn = await evalExpr(`(() => {
  const b = document.querySelector('[data-op="alignCenter"]')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
if (alignBtn) await clickAt(alignBtn.x, alignBtn.y)
await sleep(600)

const editorTable = await evalExpr(`(() => {
  const t = document.querySelector('.cm-md-table-wrap table')
  if (!t) return null
  const rows = [...t.querySelectorAll('tr')]
  return {
    rowCount: rows.length,
    colCount: rows[0]?.children.length ?? 0,
    cells: rows.map((r) => [...r.children].map((c) => (c.textContent ?? '').trim())),
    aligns: rows.map((r) => [...r.children].map((c) => getComputedStyle(c).textAlign))
  }
})()`)
check('5.0b 结构操作后编辑视图 4×4（含空列）', editorTable && editorTable.rowCount === 4 && editorTable.colCount === 4 && JSON.stringify(editorTable.cells).includes('""'), editorTable)

// ── 三通道导出捕获 ─────────────────────────────────────────────────────────
await evalExpr(`(() => {
  window.__fe02Cap = { html: null, pdf: null }
  window.__veloxP04.setSaveTarget(${JSON.stringify(OUT_DIR + '/IT-04-FE-02-export-fixed.html')})
  window.__veloxP04.setExportStub({
    html: async (target, html) => { window.__fe02Cap.html = html; return true },
    pdf: async (target, html, opts) => { window.__fe02Cap.pdf = html; return true }
  })
  return true
})()`)
await evalExpr(`window.__veloxP04.runExport('html')`)
await sleep(1500)
const htmlCh = await evalExpr(`window.__fe02Cap.html`)
if (typeof htmlCh === 'string') writeFileSync(`${OUT_DIR}/IT-04-FE-02-export-fixed.html`, htmlCh)

await evalExpr(`window.__veloxP04.setSaveTarget(${JSON.stringify(OUT_DIR + '/IT-04-FE-02-export-fixed-pdf.html')})`)
await evalExpr(`window.__veloxP04.runExport('pdf')`)
await sleep(1500)
const pdfCh = await evalExpr(`window.__fe02Cap.pdf`)
if (typeof pdfCh === 'string') writeFileSync(`${OUT_DIR}/IT-04-FE-02-export-fixed-pdf.html`, pdfCh)

await evalExpr(`window.__veloxP20.copyRichText()`)
await sleep(800)
const rich = await evalExpr(`window.__veloxP20.getClipboard()`)
if (typeof rich?.html === 'string') writeFileSync(`${OUT_DIR}/IT-04-FE-02-export-fixed-rich.html`, rich.html)

const ANALYZE = `(html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const t = doc.querySelector('table')
  if (!t) return null
  const rows = [...t.querySelectorAll('tr')]
  return {
    rowCount: rows.length,
    colCount: rows[0]?.children.length ?? 0,
    cells: rows.map((r) => [...r.children].map((c) => (c.textContent ?? '').trim())),
    aligns: rows.map((r) => [...r.children].map((c) => {
      const style = (c.getAttribute('style') ?? '') + '|' + (c.getAttribute('align') ?? '')
      const cs = /text-align\\s*:\\s*(\\w+)/.exec(style)
      if (cs) return cs[1]
      return c.getAttribute('align') ?? 'left'
    }))
  }
}`
function compareTable(label, parsed, expected) {
  if (!parsed) return { label, ok: false, reason: 'no table in export' }
  const rowsOk = parsed.rowCount === expected.rowCount
  const colsOk = parsed.colCount === expected.colCount
  const cellsOk = JSON.stringify(parsed.cells) === JSON.stringify(expected.cells)
  const alignsOk = JSON.stringify(parsed.aligns) === JSON.stringify(expected.aligns)
  return { label, ok: rowsOk && colsOk && cellsOk && alignsOk, rowsOk, colsOk, cellsOk, alignsOk, parsed, expected }
}
const expected = editorTable
const htmlParsed = await evalExpr(`(${ANALYZE})(${JSON.stringify(htmlCh ?? '')})`)
const pdfParsed = await evalExpr(`(${ANALYZE})(${JSON.stringify(pdfCh ?? '')})`)
const richParsed = await evalExpr(`(${ANALYZE})(${JSON.stringify(rich?.html ?? '')})`)
const cmpHtml = compareTable('HTML', htmlParsed, expected)
check('5.1b HTML 通道表格逐项一致（修复后回归）（AC-OP-17 判据 2）', cmpHtml.ok, cmpHtml)
const cmpPdf = compareTable('PDF', pdfParsed, expected)
check('5.2b PDF 通道表格逐项一致（修复后回归）（AC-OP-17 判据 2）', cmpPdf.ok, cmpPdf)
const cmpRich = compareTable('富文本', richParsed, expected)
check('5.3b 富文本通道表格逐项一致（修复后回归）（AC-OP-17 判据 2）', cmpRich.ok, cmpRich)

const mdNow = await evalExpr(`window.__veloxP21.getDoc()`)
const colonLine = (mdNow ?? '').split('\n').find((l) => l.includes(':---') || l.includes('---:'))
check('5.1c/5.2c/5.3c 冒号行在 .md 中且对齐语义已兑现（三通道 aligns 一致）', !!colonLine && cmpHtml.ok && cmpPdf.ok && cmpRich.ok, { colonLine })

// ── 5.6 空 undo 栈 Ctrl+Z 静默（前后对照口径）──────────────────────────────
await dismissAllDialogs()
await evalExpr(`window.__veloxP12.loadDoc('# 空栈夹具\\n\\n干净段落。', null)`)
await sleep(1000)
const drain = await evalExpr(`(() => {
  let n = 0
  while (n < 30 && window.__veloxP23.undo()) n++
  return { drained: n, stackEmpty: !window.__veloxP23.undo() }
})()`)
await sleep(300)
await dismissAllDialogs()
const preUndo = await evalExpr(`({
  doc: (window.__veloxP21?.getDoc?.() ?? ''),
  toast: window.__veloxP20.getToast(),
  toastDom: (document.querySelector('.toast-host .toast-msg, .toast-host .toast, .sb-toast')?.textContent ?? '').trim()
})`)
const preDialog = await dialogInfo()
await evalExpr(`(() => { window.__veloxEditor?.view?.focus?.(); return true })()`)
await pressKey('z', 'KeyZ', { ctrlKey: true })
await sleep(800)
const postUndo = await evalExpr(`({
  doc: (window.__veloxP21?.getDoc?.() ?? ''),
  toast: window.__veloxP20.getToast(),
  toastDom: (document.querySelector('.toast-host .toast-msg, .toast-host .toast, .sb-toast')?.textContent ?? '').trim()
})`)
const postDialog = await dialogInfo()
const toastFresh = (postUndo.toastDom === '' || postUndo.toastDom === preUndo.toastDom) && (postUndo.toast == null || postUndo.toast === preUndo.toast)
check('5.6b undo 空栈 Ctrl+Z 静默不动作（文档不变 + 无新增 toast/弹窗）',
  drain.stackEmpty && postUndo.doc === preUndo.doc && toastFresh && postDialog == null,
  { drain, pre: { len: preUndo.doc.length, toastDom: preUndo.toastDom, dialog: preDialog }, post: { len: postUndo.doc.length, toastDom: postUndo.toastDom, dialog: postDialog } }
)

results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-04-FE-02-cdp-batch5-retry2.json`, JSON.stringify(results, null, 2))
const failed = results.checks.filter((c) => !c.ok).length
console.log(`\n批次⑤复测2 done: ${results.checks.length - failed}/${results.checks.length} PASS`)
process.exit(failed > 0 ? 1 : 0)
