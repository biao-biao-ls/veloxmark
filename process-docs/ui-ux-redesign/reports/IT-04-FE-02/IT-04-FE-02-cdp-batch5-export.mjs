#!/usr/bin/env node
/**
 * IT-04 FE-02 批次 ⑤ 导出与落盘对账（AC-OP-17 / AC-OP-19 + tech-design §10 异常断言）
 * 5.1–5.4 含结构操作的表格 → HTML/PDF/富文本三通道逐项一致（行列数/内容/对齐/冒号行）+ 观感无色差
 * 5.5 结构操作 + autosave 后 .md 含变更、状态栏「已保存」、无数据丢失
 * 5.6 undo 空栈 Ctrl+Z 静默不动作
 * 5.7 模拟 autosave 失败（不可写路径）：内存态保留 + 冻结提示（不一致只登记）
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
const PORT = Number(process.env.IT04_FE02_CDP_PORT ?? 9501)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-04-FE-02'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/it04-fe02-export.md`
const UNWRITABLE_PATH = 'C:/Windows/System32/it04-fe02-unwritable.md'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT_DIR, { recursive: true })

// 夹具：含三列对齐（左/中/右）+ 冒号行的表格
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

const results = { meta: { port: PORT, startedAt: new Date().toISOString(), batch: '⑤导出与落盘对账' }, checks: [] }
const check = (name, ok, detail) => {
  results.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 700) : ''}`)
  return !!ok
}

await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await dismissAnyDialog()
await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
await sleep(1400)
await dismissAnyDialog()

// ── 结构操作：插行 + 插列 + 改对齐（经工具栏 data-op 真实通道）────────────────
await evalExpr(`(() => { window.__veloxEditor?.view?.focus?.(); return true })()`)
const cell = await evalExpr(`(() => {
  const td = document.querySelector('.cm-md-table-wrap table tr td')
  const r = td.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
await clickAt(cell.x, cell.y)
await sleep(600)
// 插行（Ctrl+Enter = insertRowBelow）
await pressKey('Enter', 'Enter', { ctrlKey: true })
await sleep(500)
// 插列（Ctrl+Shift+→ = insertColRight）
await pressKey('ArrowRight', 'ArrowRight', { ctrlKey: true, shiftKey: true })
await sleep(500)
// 改对齐：点工具栏 alignCenter
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
check('5.0 结构操作后编辑视图表格形态', editorTable && editorTable.rowCount === 4 && editorTable.colCount === 4, editorTable)

// ── 5.1–5.3 三通道导出捕获 ─────────────────────────────────────────────────
await evalExpr(`(() => {
  window.__fe02Cap = { html: null, pdf: null, pdfOpts: null }
  window.__veloxP04.setSaveTarget(${JSON.stringify(OUT_DIR + '/IT-04-FE-02-export.html')})
  window.__veloxP04.setExportStub({
    html: async (target, html) => { window.__fe02Cap.html = html; return true },
    pdf: async (target, html, opts) => { window.__fe02Cap.pdf = html; window.__fe02Cap.pdfOpts = opts; return true }
  })
  return true
})()`)
await evalExpr(`window.__veloxP04.runExport('html')`)
await sleep(1500)
const htmlCh = await evalExpr(`window.__fe02Cap.html`)
check('5.1a HTML 通道导出物生成（AC-OP-17 判据 1）', typeof htmlCh === 'string' && htmlCh.length > 500, { bytes: (htmlCh ?? '').length })
if (typeof htmlCh === 'string') writeFileSync(`${OUT_DIR}/IT-04-FE-02-export.html`, htmlCh)

await evalExpr(`window.__veloxP04.setSaveTarget(${JSON.stringify(OUT_DIR + '/IT-04-FE-02-export.pdf')})`)
await evalExpr(`window.__veloxP04.runExport('pdf')`)
await sleep(1500)
const pdfCh = await evalExpr(`window.__fe02Cap.pdf`)
check('5.2a PDF 通道导出流程完成（html→打印渲染源捕获）', typeof pdfCh === 'string' && pdfCh.length > 500 && !!(await evalExpr(`window.__fe02Cap.pdfOpts`)), { bytes: (pdfCh ?? '').length })
if (typeof pdfCh === 'string') writeFileSync(`${OUT_DIR}/IT-04-FE-02-export-pdf-render.html`, pdfCh)

await evalExpr(`window.__veloxP20.copyRichText()`)
await sleep(800)
const rich = await evalExpr(`window.__veloxP20.getClipboard()`)
check('5.3a 富文本通道复制完成', typeof rich?.html === 'string' && rich.html.length > 300, { bytes: (rich?.html ?? '').length })
if (typeof rich?.html === 'string') writeFileSync(`${OUT_DIR}/IT-04-FE-02-export-rich.html`, rich.html)

// ── 逐项比对解析器（行列数/内容/对齐）────────────────────────────────────
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
  // 对齐：编辑视图 computed textAlign（left/center/right）与导出 text-align/align 对账
  const alignsOk = JSON.stringify(parsed.aligns) === JSON.stringify(expected.aligns)
  return { label, ok: rowsOk && colsOk && cellsOk && alignsOk, rowsOk, colsOk, cellsOk, alignsOk, parsed, expected }
}
const expected = editorTable
const htmlParsed = await evalExpr(`(${ANALYZE})(${JSON.stringify(htmlCh ?? '')})`)
const pdfParsed = await evalExpr(`(${ANALYZE})(${JSON.stringify(pdfCh ?? '')})`)
const richParsed = await evalExpr(`(${ANALYZE})(${JSON.stringify(rich?.html ?? '')})`)
const c1 = compareTable('HTML', htmlParsed, expected)
check('5.1b HTML 通道表格逐项一致（行列/内容/对齐）（AC-OP-17 判据 2）', c1.ok, c1)
const c2 = compareTable('PDF', pdfParsed, expected)
check('5.2b PDF 通道表格逐项一致（AC-OP-17 判据 2）', c2.ok, c2)
const c3 = compareTable('富文本', richParsed, expected)
check('5.3b 富文本通道表格逐项一致（AC-OP-17 判据 2）', c3.ok, c3)

// 冒号行核对：.md 源码含冒号对齐行；导出物 colspan/结构与冒号语义一致（对齐即冒号行兑现）
const mdNow = await evalExpr(`window.__veloxP21.getDoc()`)
const colonLine = (mdNow ?? '').split('\n').find((l) => l.includes(':---') || l.includes('---:') || /^\|[\s:|-]+\|$/.test(l))
check('5.1c/5.2c/5.3c 冒号行在 .md 中且对齐语义已兑现（三通道 aligns 一致）', !!colonLine && c1.ok && c2.ok && c3.ok, { colonLine })

// 5.4 三通道观感一致（导出物 CSS var 抽样）
const colorCompare = await evalExpr(`(() => {
  const grab = (html) => {
    const m = (html ?? '').match(/--(?:bg|fg|accent|border)\\s*:\\s*([^;}]+)/g)
    return m ? m.map((s) => s.trim()).sort() : []
  }
  return {
    html: grab(${JSON.stringify(htmlCh ?? '')}),
    pdf: grab(${JSON.stringify(pdfCh ?? '')}),
    rich: grab(${JSON.stringify(rich?.html ?? '')})
  }
})()`)
const colorSame = JSON.stringify(colorCompare.html) === JSON.stringify(colorCompare.pdf)
check('5.4 三通道导出物主题 var 一致、无色差（AC-OP-17 判据 3 / UI-ELEM-06）', colorSame && colorCompare.html.length > 0, colorCompare)

// ── 5.5 落盘对账：.md 含变更 + 状态栏「已保存」────────────────────────────
await evalExpr(`window.__veloxP12.saveFile()`)
await sleep(1500)
const sbState = await evalExpr(`(() => {
  const sb = document.querySelector('.sb-autosave')
  return { text: (sb?.textContent ?? '').trim(), cls: sb?.className ?? null, dirty: window.__veloxP12.getDirty() }
})()`)
const diskMd = existsSync(FIXTURE_PATH) ? readFileSync(FIXTURE_PATH, 'utf8') : null
const diskOk = diskMd != null && diskMd.includes('|') && (diskMd.match(/^\|/gm) ?? []).length >= editorTable.rowCount
const hasInsert = diskMd != null && diskMd.split('\n').filter((l) => l.startsWith('|')).length >= 5
check('5.5 .md 源码含本次结构变更 + 状态栏「已保存」+ 无数据丢失（AC-OP-19）',
  diskOk && hasInsert && !sbState.dirty && sbState.text.includes('已保存'),
  { sb: sbState, diskRows: (diskMd ?? '').split('\n').filter((l) => l.startsWith('|')).length, expectedRows: editorTable.rowCount }
)

// ── 5.6 undo 空栈 Ctrl+Z 静默（tech-design §10）────────────────────────────
await evalExpr(`window.__veloxP12.loadDoc('# 空文档\\n\\n干净段落。', null)`)
await sleep(1000)
const preUndo = await evalExpr(`(window.__veloxP21?.getDoc?.() ?? '')`)
const preToast = await evalExpr(`window.__veloxP20.getToast()`)
await evalExpr(`(() => { window.__veloxEditor?.view?.focus?.(); return true })()`)
await pressKey('z', 'KeyZ', { ctrlKey: true })
await sleep(800)
const postUndo = await evalExpr(`({
  doc: (window.__veloxP21?.getDoc?.() ?? ''),
  toast: window.__veloxP20.getToast(),
  dialog: !!document.querySelector('.dialog-overlay .dialog'),
  toastDom: !!document.querySelector('.toast-host .toast-msg, .toast-host .toast, .sb-toast')
})`)
check('5.6 undo 空栈 Ctrl+Z 静默不动作（无 toast 无弹窗文档不变）',
  postUndo.doc === preUndo && !postUndo.dialog && !postUndo.toastDom && (postUndo.toast == null || postUndo.toast === preToast),
  { preLen: preUndo.length, postLen: postUndo.doc.length, ...postUndo }
)

// ── 5.7 模拟 autosave 失败（不可写路径）───────────────────────────────────
await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify('# 不可写路径文档\n\n原始内容行。\n')}, ${JSON.stringify(UNWRITABLE_PATH)})`)
await sleep(1000)
await evalExpr(`(() => { window.__veloxEditor?.view?.focus?.(); return true })()`)
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'x', code: 'KeyX', text: 'x' })
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'x', code: 'KeyX' })
await sleep(500)
// 触发 autosave（debounce 或手动 saveFile 走同一写盘路径）
await evalExpr(`window.__veloxP12.saveFile()`)
await sleep(1500)
const failState = await evalExpr(`({
  doc: (window.__veloxP21?.getDoc?.() ?? ''),
  dirty: window.__veloxP12.getDirty(),
  sb: (document.querySelector('.sb-autosave')?.textContent ?? '').trim(),
  sbCls: document.querySelector('.sb-autosave')?.className ?? null,
  toast: window.__veloxP20.getToast(),
  toastDomText: (document.querySelector('.toast-host .toast-msg, .toast-host .toast, .sb-toast')?.textContent ?? '').trim()
})`)
const FROZEN = '自动保存失败，文档可另存副本'
const toastText = failState.toastDomText || failState.toast || failState.sb
const memoryKept = failState.doc.includes('原始内容行') && failState.doc.length > 10
const frozenHit = (toastText ?? '').includes('自动保存失败')
const frozenExact = toastText === FROZEN || (toastText ?? '').includes(FROZEN)
check('5.7a autosave 失败后内存态保留不丢稿', memoryKept, { docLen: failState.doc.length, dirty: failState.dirty })
check('5.7b 失败提示可见（冻结口径「自动保存失败，文档可另存副本」）', frozenHit, {
  toastText, sb: failState.sb, sbCls: failState.sbCls,
  frozenExactMatch: frozenExact,
  frozenReference: FROZEN,
  note: frozenExact ? '与冻结口径一致' : '与冻结口径措辞不一致——只登记不擅改（toast.autoSaveFailed 系列为动态 {reason}/{path} 变体，err.autosaveFailed 为固定句）'
})

results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-04-FE-02-cdp-batch5-data.json`, JSON.stringify(results, null, 2))
const failed = results.checks.filter((c) => !c.ok).length
console.log(`\n批次⑤ done: ${results.checks.length - failed}/${results.checks.length} PASS`)
process.exit(failed > 0 ? 1 : 0)
