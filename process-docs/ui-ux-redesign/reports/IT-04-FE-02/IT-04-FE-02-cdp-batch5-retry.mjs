#!/usr/bin/env node
/**
 * IT-04 FE-02 批次 ⑤ 复测（缺陷修复后 + 驱动重计）
 * 5.1b/5.2b/5.3b/5.1c 三通道导出逐项一致（listTable 空单元格修复后回归）
 * 5.6 重计：真·空 undo 栈（P23.undo() 排干至 false）后 Ctrl+Z 静默
 * 5.7 重计：autosave 管线失败（debounce 1s + 不可写路径），非手动 saveFile
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
const PORT = Number(process.env.IT04_FE02_CDP_PORT ?? 9501)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-04-FE-02'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/it04-fe02-export.md`
const UNWRITABLE_PATH = 'C:/Windows/System32/it04-fe02-unwritable.md'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const FROZEN = '自动保存失败，文档可另存副本'

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
  if (btn) { await clickAt(btn.x, btn.y); await sleep(350) }
  return btn
}

const results = { meta: { port: PORT, startedAt: new Date().toISOString(), batch: '⑤复测（空单元格修复后 + 5.6/5.7 重计）' }, checks: [] }
const check = (name, ok, detail) => {
  results.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 700) : ''}`)
  return !!ok
}

// 确保渲染进程已载入最新模块（listTable 修复经 HMR 应已生效；保险起见 reload）
await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await send('Page.reload', { ignoreCache: true })
for (let i = 0; i < 40; i++) {
  await sleep(500)
  const ready = await evalExpr(`!!(window.__veloxP12 && window.__veloxP04 && window.__veloxP20)`).catch(() => false)
  if (ready) break
}
await dismissAnyDialog()
await sleep(500)
await dismissAnyDialog()

await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
await sleep(1400)
await dismissAnyDialog()

// ── 结构操作：插行 + 插列 + 改对齐（同首轮夹具口径）─────────────────────────
await evalExpr(`(() => { window.__veloxEditor?.view?.focus?.(); return true })()`)
const cell = await evalExpr(`(() => {
  const td = document.querySelector('.cm-md-table-wrap table tr td')
  const r = td.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
await clickAt(cell.x, cell.y)
await sleep(600)
await pressKey('Enter', 'Enter', { ctrlKey: true })
await sleep(500)
await pressKey('ArrowRight', 'ArrowRight', { ctrlKey: true, shiftKey: true })
await sleep(500)
const alignBtn = await evalExpr(`(() => {
  const b = document.querySelector('[data-op="alignCenter"]')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
if (alignBtn) await clickAt(alignBtn.x, alignBtn.y)
await sleep(500)
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
check('5.0b 结构操作后编辑视图表格形态（前置）', editorTable && editorTable.rowCount === 4 && editorTable.colCount === 4, editorTable)

// ── 三通道导出捕获 ─────────────────────────────────────────────────────────
await evalExpr(`(() => {
  window.__fe02Cap = { html: null, pdf: null, pdfOpts: null }
  window.__veloxP04.setSaveTarget(${JSON.stringify(OUT_DIR + '/IT-04-FE-02-export-fixed.html')})
  window.__veloxP04.setExportStub({
    html: async (target, html) => { window.__fe02Cap.html = html; return true },
    pdf: async (target, html, opts) => { window.__fe02Cap.pdf = html; window.__fe02Cap.pdfOpts = opts; return true }
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
      const a = c.getAttribute('align')
      return a ?? 'left'
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
const c1 = compareTable('HTML', htmlParsed, expected)
check('5.1b HTML 通道表格逐项一致（修复后回归）（AC-OP-17 判据 2）', c1.ok, c1)
const c2 = compareTable('PDF', pdfParsed, expected)
check('5.2b PDF 通道表格逐项一致（修复后回归）（AC-OP-17 判据 2）', c2.ok, c2)
const c3 = compareTable('富文本', richParsed, expected)
check('5.3b 富文本通道表格逐项一致（修复后回归）（AC-OP-17 判据 2）', c3.ok, c3)

const mdNow = await evalExpr(`window.__veloxP21.getDoc()`)
const colonLine = (mdNow ?? '').split('\n').find((l) => l.includes(':---') || l.includes('---:') || /^\|[\s:|-]+\|$/.test(l))
check('5.1c/5.2c/5.3c 冒号行在 .md 中且对齐语义已兑现（三通道 aligns 一致）', !!colonLine && c1.ok && c2.ok && c3.ok, { colonLine })

// ── 5.6 重计：真·空 undo 栈后 Ctrl+Z 静默 ─────────────────────────────────
await evalExpr(`window.__veloxP12.loadDoc('# 空栈夹具\\n\\n干净段落。', null)`)
await sleep(1000)
// 排干 undo 栈：P23.undo() 返回 false 即空栈（loadDoc 会进历史，先吃掉）
const drain = await evalExpr(`(() => {
  let n = 0
  while (n < 30 && window.__veloxP23.undo()) n++
  return { drained: n, stackEmpty: !window.__veloxP23.undo() }
})()`)
await sleep(300)
const preUndo = await evalExpr(`({
  doc: (window.__veloxP21?.getDoc?.() ?? ''),
  toast: window.__veloxP20.getToast(),
  toastDom: (document.querySelector('.toast-host .toast-msg, .toast-host .toast, .sb-toast')?.textContent ?? '').trim()
})`)
await evalExpr(`(() => { window.__veloxEditor?.view?.focus?.(); return true })()`)
await pressKey('z', 'KeyZ', { ctrlKey: true })
await sleep(800)
const postUndo = await evalExpr(`({
  doc: (window.__veloxP21?.getDoc?.() ?? ''),
  toast: window.__veloxP20.getToast(),
  toastDom: (document.querySelector('.toast-host .toast-msg, .toast-host .toast, .sb-toast')?.textContent ?? '').trim(),
  dialog: !!document.querySelector('.dialog-overlay .dialog')
})`)
check('5.6b undo 空栈 Ctrl+Z 静默不动作（无 toast 无弹窗文档不变）',
  drain.stackEmpty && postUndo.doc === preUndo.doc && !postUndo.dialog &&
    (postUndo.toast == null || postUndo.toast === preUndo.toast) &&
    (postUndo.toastDom === '' || postUndo.toastDom === preUndo.toastDom),
  { drain, pre: { len: preUndo.doc.length, toastDom: preUndo.toastDom }, post: { len: postUndo.doc.length, ...postUndo } }
)

// ── 5.7 重计：autosave 管线失败（debounce 1s + 不可写路径）─────────────────
await evalExpr(`(() => { window.__veloxPrefs.setPreferences({ autoSaveMode: 'debounce', autoSaveDelaySec: 1 }); return true })()`)
await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify('# 不可写路径文档\n\n原始内容行。\n')}, ${JSON.stringify(UNWRITABLE_PATH)})`)
await sleep(1000)
await evalExpr(`(() => { window.__veloxEditor?.view?.focus?.(); return true })()`)
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'x', code: 'KeyX', text: 'x' })
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'x', code: 'KeyX' })
// 等 debounce（1s）+ 写盘失败回传
await sleep(3500)
const failState = await evalExpr(`({
  doc: (window.__veloxP21?.getDoc?.() ?? ''),
  dirty: window.__veloxP12.getDirty(),
  sb: (document.querySelector('.sb-autosave')?.textContent ?? '').trim(),
  sbCls: document.querySelector('.sb-autosave')?.className ?? null,
  toast: window.__veloxP20.getToast(),
  toastDomText: (document.querySelector('.toast-host .toast-msg, .toast-host .toast, .sb-toast')?.textContent ?? '').trim()
})`)
const toastText = failState.toastDomText || failState.toast || failState.sb
const memoryKept = failState.doc.includes('原始内容行') && failState.doc.includes('x')
const frozenHit = (toastText ?? '').includes('自动保存失败')
const stickyHit = (failState.sb ?? '').includes('自动保存失败') || (failState.sbCls ?? '').includes('error')
const frozenExact = toastText === FROZEN || (toastText ?? '').includes(FROZEN)
check('5.7a autosave 失败后内存态保留不丢稿（含本次编辑）', memoryKept, { docLen: failState.doc.length, dirty: failState.dirty, doc: failState.doc.slice(0, 60) })
check('5.7b autosave 失败提示可见（toast/常驻槽）+ 冻结口径登记', frozenHit || stickyHit, {
  toastText, sb: failState.sb, sbCls: failState.sbCls,
  frozenExactMatch: frozenExact,
  frozenReference: FROZEN,
  observedKeys: failState.toastDomText ? 'toast.autoSaveFailedPath/toast.autoSaveFailed + status.autoSaveFailed' : 'status.autoSaveFailed',
  note: frozenExact ? '与冻结口径一致' : `实测措辞「${toastText}」与冻结 err.autosaveFailed「${FROZEN}」不一致——只登记不擅改（toast.autoSaveFailed{,Path} 为动态 {reason}/{path} 变体；err.autosaveFailed 无运行时消费方，属冻结保留句）`
})

results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-04-FE-02-cdp-batch5-retry.json`, JSON.stringify(results, null, 2))
const failed = results.checks.filter((c) => !c.ok).length
console.log(`\n批次⑤复测 done: ${results.checks.length - failed}/${results.checks.length} PASS`)
process.exit(failed > 0 ? 1 : 0)
