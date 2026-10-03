#!/usr/bin/env node
/**
 * IT-01-PATH-08 CDP driver — FE-11 P2-1 证据补档：en→zh→en 切换渲染冒烟。
 *
 * 取证目标（FE-11 定向修复批 fix-list #3）：
 *   1) 结构回执 toast 双语文案完整、无裸 key（toast 驻留保持渲染时语言——
 *      CHANGE-24 (B) 边界取舍，驻留期切语言不换字属登记行为）
 *   2) 删表确认框 key-based live-relabel：打开中切语言即时换字（P2-2 修复面），
 *      双语文案完整、无裸 key
 *
 * Scenarios:
 *   S0 健康检查 + 表格 fixture + 语言置 en
 *   S1 en 下结构回执 toast（deleteRow 探针 op → STRUCTURE_TOASTS；另试 ⋮ 菜单
 *      insertRowBelow 的「已在下方插入行」族）+ 驻留期切 zh 不换字（CHANGE-24B）
 *   S2 zh 下新开 toast 即时为中文（渲染时语言正确、无裸 key）
 *   S3 en 下打开删表确认框：EN 冻结文案四件套
 *   S4 打开中切 zh：确认框即时换字（live-relabel 核心断言）→ 截图
 *   S5 打开中切回 en：再次即时换字（双向）→ 截图
 *   S6 取消零副作用 + isModalOpen 复位
 *
 * Robustness（FE-07 教训）：每个 CDP 调用 10s 硬超时；草稿对话框点「稍后」。
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.PATH08_CDP_PORT ?? 9582)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-PATH-08'
const TIMEOUT_MS = 10_000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT_DIR, { recursive: true })

// ── CDP plumbing ──────────────────────────────────────────────────────────
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = list.find((t) => t.type === 'page' && /index\.html|VeloxMark|localhost/.test(t.url + t.title))
if (!page) {
  console.error('no page target', list.map((t) => `${t.type}|${t.title}|${t.url.slice(0, 60)}`))
  process.exit(1)
}
console.log('target:', page.title, page.url.slice(0, 80))

const ws = new WebSocket(page.webSocketDebuggerUrl)
let msgId = 0
const pending = new Map()
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(String(ev.data))
  if (!msg.id || !pending.has(msg.id)) return
  const { resolve, reject, timer } = pending.get(msg.id)
  pending.delete(msg.id)
  clearTimeout(timer)
  if (msg.error) reject(new Error(JSON.stringify(msg.error)))
  else resolve(msg.result)
})
function send(method, params = {}) {
  const id = ++msgId
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`CDP timeout ${TIMEOUT_MS}ms: ${method}`))
    }, TIMEOUT_MS)
    pending.set(id, { resolve, reject, timer })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evalExpr(expression) {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  })
  if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 400))
  return r.result?.value
}
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('ws open timeout')), TIMEOUT_MS)
  ws.onopen = () => { clearTimeout(t); res() }
  ws.onerror = (e) => { clearTimeout(t); rej(new Error('ws error: ' + (e.message ?? 'unknown'))) }
})
await send('Page.enable')
await send('Runtime.enable')
await send('Page.setWebLifecycleState', { state: 'active' })
try {
  await send('Emulation.setFocusEmulationEnabled', { enabled: true })
} catch {
  try { await send('Emulation.setFocusEmulationFocusEmulationEnabled', { enabled: true }) } catch { /* older protocol */ }
}
await send('Page.bringToFront')

// ── bookkeeping ───────────────────────────────────────────────────────────
const results = { meta: { port: PORT, startedAt: new Date().toISOString() }, scenarios: {} }
const checks = []
function check(name, ok, detail = null) {
  checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail !== null && detail !== undefined ? ' :: ' + JSON.stringify(detail).slice(0, 240) : ''}`)
}

async function clickAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
  await sleep(30)
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
}
async function clickSelector(sel) {
  const rect = await evalExpr(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)})
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })()`)
  if (!rect) return 'not-found'
  await clickAt(rect.x, rect.y)
  return 'clicked'
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT_DIR}/${name}`, Buffer.from(r.data, 'base64'))
  console.log('shot →', name)
}

const FIXTURE = [
  '# IT-01-PATH-08 language switch selftest',
  '',
  'lead paragraph before the table.',
  '',
  '| A | B | C |',
  '| --- | --- | --- |',
  '| a1 | b1 | c1 |',
  '| a2 | b2 | c2 |',
  '| a3 | b3 | c3 |',
  '| a4 | b4 | c4 |',
  '',
  'tail paragraph after the table.'
].join('\n')

const TOAST_DOM = `(() => {
  const msg = document.querySelector('.toast-msg')
  const btn = document.querySelector('[data-testid="toast-undo-btn"]')
  return {
    card: !!document.querySelector('.toast'),
    msg: msg ? msg.textContent : null,
    btnLabel: btn ? btn.textContent : null,
    cardCount: document.querySelectorAll('.toast').length
  }
})()`

const DIALOG_DOM = `(() => {
  const overlay = document.querySelector('[data-testid="dialog-overlay"]')
  const card = document.querySelector('.dialog')
  const title = document.querySelector('.dialog-title')
  const msg = document.querySelector('.dialog-message')
  const confirmBtn = document.querySelector('[data-testid="dialog-confirm-btn"]')
  const cancelBtn = document.querySelector('[data-testid="dialog-cancel-btn"]')
  return {
    open: !!overlay && !!card,
    title: title ? title.textContent : null,
    message: msg ? msg.textContent : null,
    confirmLabel: confirmBtn ? confirmBtn.textContent : null,
    cancelLabel: cancelBtn ? cancelBtn.textContent : null,
    confirmDanger: confirmBtn ? confirmBtn.classList.contains('dialog-btn-danger') : false
  }
})()`

/** key 形文案裸露哨兵：点分隔小写驼峰 key（如 ctx.deleteTable）视为裸 key。 */
function bareKey(s) {
  return typeof s === 'string' && /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/.test(s.trim())
}

async function dismissDraftDialog() {
  return evalExpr(`(() => {
    const later = [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('稍后'))
    if (later) { later.click(); return 'clicked-later' }
    return 'no-dialog'
  })()`)
}
async function getDoc() {
  return evalExpr(`window.__veloxP26.getDoc()`)
}
async function activateCell(row, col) {
  return evalExpr(`(() => {
    const v = window.__veloxEditor.view
    const wrap = document.querySelector('.cm-md-table-wrap')
    if (!wrap) return 'no-table'
    const from = Number(wrap.dataset.tableFrom)
    window.__veloxTable.activate(v, from, ${row}, ${col})
    return 'ok:' + from
  })()`)
}
async function setLang(lang) {
  return evalExpr(`window.__veloxP14.setLanguage(${JSON.stringify(lang)})`)
}

// 冻结文案真源（i18n/en.ts / zh.ts 逐字）——断言与字典同口径
const COPY = {
  en: {
    title: 'Delete table',
    message: 'Deleting can be undone in one step. Confirm deleting this table?',
    confirm: 'Confirm Delete',
    cancel: 'Cancel',
    rowDeleted: 'Row 3 deleted (Ctrl+Z to undo)',
    rowInsertedBelow: 'Row inserted below (Ctrl+Z to undo)'
  },
  zh: {
    title: '删除表格',
    message: '删除后可用一步撤销还原，确认删除该表格',
    confirm: '确认删除',
    cancel: '取消',
    rowDeleted: '已删除第 3 行（Ctrl+Z 可撤销）',
    rowInsertedBelow: '已在下方插入行（Ctrl+Z 可撤销）'
  }
}

// ── S0: health + fixture + language=en ────────────────────────────────────
{
  const health = await evalExpr(`(() => ({
    editor: !!window.__veloxEditor?.view,
    table: !!window.__veloxTable,
    p14: typeof window.__veloxP14?.setLanguage === 'function',
    p20: !!window.__veloxP20?.getToast,
    p26: typeof window.__veloxP26?.loadDoc === 'function',
    dialogBus: typeof window.dialog?.confirm === 'function',
    isModalOpen: typeof window.dialog?.isModalOpen === 'function'
  }))()`)
  check('S0 e2e seams reachable (editor/table/p14/p20/p26/dialog)',
    health?.editor && health?.table && health?.p14 && health?.p20 && health?.p26 && health?.dialogBus, health)

  await evalExpr(`window.dialog.setAutoResponse(null); localStorage.removeItem('veloxE2eDialogAuto'); 'cleared'`)
  const draft = await dismissDraftDialog()
  results.meta.draftDialog = draft

  await evalExpr(`window.__veloxP26.loadDoc(${JSON.stringify(FIXTURE)}, "D:/code/typora/temp/path08-selftest.md")`)
  await sleep(400)
  await dismissDraftDialog()
  const doc0 = await getDoc()
  check('S0 fixture loaded (table + tail)', (doc0 ?? '').includes('| a2 | b2 | c2 |') && (doc0 ?? '').includes('tail paragraph'), { len: doc0?.length })

  await setLang('en')
  await sleep(300)
  const lang = await evalExpr(`window.__veloxP14.getLang()`)
  results.meta.langStart = lang
  check('S0 language=en 已生效', lang === 'en', lang)
}

// ── S1: en 结构回执 toast + 驻留期切 zh 不换字（CHANGE-24B）────────────────
{
  const act = await activateCell(2, 1) // row=2 → 1-based 第 3 行
  await sleep(250)
  // 探针 deleteRow（派发层 STRUCTURE_TOASTS 同款 userEvent，FE-07 教训口径）
  await evalExpr(`(() => {
    const v = window.__veloxEditor.view
    const wrap = document.querySelector('.cm-md-table-wrap')
    const from = Number(wrap.dataset.tableFrom)
    return window.__veloxTable.op(v, from, 'deleteRow', 2)
  })()`)
  await sleep(300)
  const toastEn = await evalExpr(TOAST_DOM)
  check('S1 en 结构回执 toast 文案完整', toastEn?.msg === COPY.en.rowDeleted, toastEn?.msg)
  check('S1 en toast 无裸 key', !bareKey(toastEn?.msg) && !bareKey(toastEn?.btnLabel), toastEn)
  check('S1 en toast 携撤销按钮', typeof toastEn?.btnLabel === 'string' && toastEn.btnLabel.length > 0, toastEn?.btnLabel)
  await shot('IT-01-PATH-08-s1-toast-en.png')

  // CHANGE-24(B)：驻留期切语言不换字（渲染时语言驻留 5s TOAST_DWELL_MS）
  await setLang('zh')
  await sleep(200)
  const toastDwell = await evalExpr(TOAST_DOM)
  check('S1 驻留期切 zh toast 保持渲染时语言（CHANGE-24B 边界取舍）',
    toastDwell?.msg === COPY.en.rowDeleted, toastDwell?.msg)
  await shot('IT-01-PATH-08-s1-toast-dwell-keep-lang.png')
  results.scenarios.s1 = { act, toastEn, toastDwell }

  // ⋮ 菜单 insertRowBelow 族（「已在下方插入行」示例面）——尽力取证，失败如实记。
  // ⋮ 锚点 data-op 是 TOOLBAR_DATA_OP.more='TBL-MOR-OPN'（contract.ts 冻结面）。
  const moreRes = await clickSelector('[data-op="TBL-MOR-OPN"]')
  await sleep(350)
  const insRes = await clickSelector('[data-op="insertRowBelow"]')
  await sleep(300)
  const toastIns = await evalExpr(TOAST_DOM)
  results.scenarios.s1.insertFamily = { moreRes, insRes, toastIns }
  check('S1b zh ⋮ 菜单 insertRowBelow 回执族（示例面）',
    insRes === 'clicked' && toastIns?.msg === COPY.zh.rowInsertedBelow,
    { moreRes, insRes, msg: toastIns?.msg })
  if (insRes === 'clicked' && toastIns?.msg) await shot('IT-01-PATH-08-s1b-toast-zh-insertrow.png')
}

// ── S2: zh 新 toast 渲染时语言正确 + 切回 en 同理 ──────────────────────────
{
  await activateCell(2, 1)
  await sleep(250)
  await evalExpr(`(() => {
    const v = window.__veloxEditor.view
    const wrap = document.querySelector('.cm-md-table-wrap')
    const from = Number(wrap.dataset.tableFrom)
    return window.__veloxTable.op(v, from, 'deleteRow', 2)
  })()`)
  await sleep(300)
  const toastZh = await evalExpr(TOAST_DOM)
  check('S2 zh 新 toast 文案完整（渲染时语言正确）', toastZh?.msg === COPY.zh.rowDeleted, toastZh?.msg)
  check('S2 zh toast 无裸 key', !bareKey(toastZh?.msg) && !bareKey(toastZh?.btnLabel), toastZh)
  await shot('IT-01-PATH-08-s2-toast-zh.png')
  results.scenarios.s2 = { toastZh }
}

// ── S3: en 下打开删表确认框（冻结 EN 四件套）───────────────────────────────
{
  await setLang('en')
  await sleep(300)
  await activateCell(2, 1)
  await sleep(250)
  const clickRes = await clickSelector('[data-op="deleteTable"]')
  await sleep(300)
  const dlg = await evalExpr(DIALOG_DOM)
  check('S3 🗑 弹出确认框', clickRes === 'clicked' && dlg?.open === true, { clickRes, open: dlg?.open })
  check('S3 EN 标题/正文/双按钮逐字', dlg?.title === COPY.en.title && dlg?.message === COPY.en.message &&
    dlg?.confirmLabel === COPY.en.confirm && dlg?.cancelLabel === COPY.en.cancel,
    { title: dlg?.title, message: dlg?.message, confirm: dlg?.confirmLabel, cancel: dlg?.cancelLabel })
  check('S3 EN 确认按钮 danger', dlg?.confirmDanger === true, dlg?.confirmDanger)
  check('S3 EN 确认框无裸 key', !bareKey(dlg?.title) && !bareKey(dlg?.message) &&
    !bareKey(dlg?.confirmLabel) && !bareKey(dlg?.cancelLabel), dlg)
  await shot('IT-01-PATH-08-s3-dialog-en.png')
  results.scenarios.s3 = { clickRes, dlg }
}

// ── S4: 打开中切 zh —— live-relabel 核心断言（P2-2）───────────────────────
{
  await setLang('zh')
  await sleep(300)
  const dlg = await evalExpr(DIALOG_DOM)
  check('S4 打开中切 zh 即时换字（title/message/按钮全换）',
    dlg?.open === true && dlg?.title === COPY.zh.title && dlg?.message === COPY.zh.message &&
    dlg?.confirmLabel === COPY.zh.confirm && dlg?.cancelLabel === COPY.zh.cancel,
    { title: dlg?.title, message: dlg?.message, confirm: dlg?.confirmLabel, cancel: dlg?.cancelLabel })
  check('S4 ZH 确认框无裸 key', !bareKey(dlg?.title) && !bareKey(dlg?.message) &&
    !bareKey(dlg?.confirmLabel) && !bareKey(dlg?.cancelLabel), dlg)
  check('S4 danger 态保持', dlg?.confirmDanger === true, dlg?.confirmDanger)
  await shot('IT-01-PATH-08-s4-dialog-zh-live-relabel.png')
  results.scenarios.s4 = { dlg }
}

// ── S5: 打开中切回 en —— 双向即时 ─────────────────────────────────────────
{
  await setLang('en')
  await sleep(300)
  const dlg = await evalExpr(DIALOG_DOM)
  check('S5 打开中切回 en 再次即时换字', dlg?.open === true && dlg?.title === COPY.en.title &&
    dlg?.message === COPY.en.message && dlg?.confirmLabel === COPY.en.confirm &&
    dlg?.cancelLabel === COPY.en.cancel,
    { title: dlg?.title, message: dlg?.message, confirm: dlg?.confirmLabel, cancel: dlg?.cancelLabel })
  await shot('IT-01-PATH-08-s5-dialog-en-again.png')
  results.scenarios.s5 = { dlg }
}

// ── S6: 取消零副作用 + isModalOpen 复位 ────────────────────────────────────
{
  const docBefore = await getDoc()
  await clickSelector('[data-testid="dialog-cancel-btn"]')
  await sleep(250)
  const dlg = await evalExpr(DIALOG_DOM)
  const isModal = await evalExpr(`window.dialog.isModalOpen()`)
  const docAfter = await getDoc()
  check('S6 取消关框', dlg?.open !== true, dlg?.open)
  check('S6 文档逐字节不变', docAfter === docBefore, { lenBefore: docBefore?.length, lenAfter: docAfter?.length })
  check('S6 isModalOpen 复位 false', isModal === false, isModal)
  results.scenarios.s6 = { unchanged: docAfter === docBefore, isModal }
}

// ── report ────────────────────────────────────────────────────────────────
results.checks = checks
results.summary = {
  total: checks.length,
  passed: checks.filter((c) => c.ok).length,
  failed: checks.filter((c) => !c.ok).length
}
results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-01-PATH-08-cdp-results.json`, JSON.stringify(results, null, 2))
console.log('\n== summary ==', JSON.stringify(results.summary))
if (results.summary.failed > 0) {
  console.log('failed checks:')
  for (const c of checks.filter((x) => !x.ok)) console.log(' -', c.name, JSON.stringify(c.detail)?.slice(0, 200))
}
ws.close()
process.exit(results.summary.failed > 0 ? 1 : 0)
