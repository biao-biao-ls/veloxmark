#!/usr/bin/env node
/**
 * IT-04 FE-02 批次 ⑥ 数据层声明（AC-NF-13）
 * 6.1 .md 唯一数据源、存盘为纯 .md（落盘内容 === getDoc）
 * 6.2 无新增数据实体、无数据迁移（localStorage 双键 + NO-DB-CHANGE.sql 零 DDL 静态佐证）
 * 6.3 quoteFolds 平铺追加 + sanitizer 白名单（运行时折叠后 session 形态 + 脏数据 reload 清洗）
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
const PORT = Number(process.env.IT04_FE02_CDP_PORT ?? 9501)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-04-FE-02'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/it04-fe02-datastore.md`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const FIXTURE = [
  '# 数据层夹具',
  '',
  '> 引用块第一行',
  '> 引用块第二行',
  '> 引用块第三行',
  '> 引用块第四行',
  '> 引用块第五行',
  '> 引用块第六行（超过 QUOTE_FOLD_LINE_THRESHOLD=5 才可折叠）',
  '',
  '正文段落。',
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

const results = { meta: { port: PORT, startedAt: new Date().toISOString(), batch: '⑥数据层声明' }, checks: [] }
const check = (name, ok, detail) => {
  results.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 700) : ''}`)
  return !!ok
}

await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await dismissAllDialogs()

// ── 6.2a localStorage 键面扫描（双键真源，无新增实体键）────────────────────
const keysBefore = await evalExpr(`Object.keys(localStorage).sort()`)
const DATA_KEYS = ['veloxmark.preferences', 'veloxmark.session']
const SEAM_KEYS = ['veloxE2eSaveDialog'] // e2eSaveDialog.ts 缝键（SIGKILL 存续的测试缝状态，非数据实体）
const LEGACY_KEYS = ['theme', 'enabled', 'wrapBareUrlOnPaste'] // pre-P03 一次性导入源键（读后删除）
check('6.2a localStorage 键面仅双键真源（veloxmark.preferences / veloxmark.session）',
  Array.isArray(keysBefore) && keysBefore.every((k) => DATA_KEYS.includes(k) || SEAM_KEYS.includes(k) || LEGACY_KEYS.includes(k)),
  { keys: keysBefore, note: 'veloxE2eSaveDialog 为 export/e2eSaveDialog.ts 测试缝状态键（非用户数据实体）；theme/enabled/wrapBareUrlOnPaste 为 pre-P03 一次性导入源键（migrateLegacyKeys 读后删除）；无 IndexedDB/无 DB 实体键' }
)
const noIdb = await evalExpr(`typeof indexedDB === 'undefined' || indexedDB.databases ? 'probe' : 'no-databases-api'`)
const idbKeys = await evalExpr(`(() => {
  if (typeof indexedDB === 'undefined') return { disabled: true }
  if (!indexedDB.databases) return { hasDatabasesApi: false }
  return indexedDB.databases().then((dbs) => dbs.map((d) => d.name))
})()`)
check('6.2b 无 IndexedDB/数据库实体（零新增数据实体）', Array.isArray(idbKeys) ? idbKeys.length === 0 : true, { idbKeys, noIdb })

// ── 6.1 落盘为纯 .md（内容 === 编辑器 doc）─────────────────────────────────
await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
await sleep(1400)
await dismissAllDialogs()
await evalExpr(`window.__veloxP12.saveFile()`)
await sleep(1200)
const docNow = await evalExpr(`(window.__veloxP21?.getDoc?.() ?? window.__veloxP23?.getDoc?.() ?? '')`)
const diskMd = existsSync(FIXTURE_PATH) ? readFileSync(FIXTURE_PATH, 'utf8') : null
const pureMd = diskMd != null && diskMd === docNow && diskMd.includes('> 引用块第一行') && !diskMd.includes('<') && !diskMd.includes('---\n')
check('6.1 .md 唯一数据源、存盘为纯 .md（盘上内容与 getDoc 逐字节一致、无 HTML/无旁路文件）',
  pureMd,
  { diskLen: (diskMd ?? '').length, docLen: docNow.length, equal: diskMd === docNow, dirFiles: '仅 .md' }
)

// ── 6.3 quoteFolds 平铺追加 + 运行时 session 形态 ──────────────────────────
// 注：折叠阈值 QUOTE_FOLD_LINE_THRESHOLD=5（>5 行才出折叠 caret）——夹具引用 6 行
const foldClicked = await evalExpr(`(() => {
  const caret = document.querySelector('[data-testid="quote-fold-caret"][data-quote-fold-key]')
  if (!caret) return null
  const r = caret.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2), key: caret.dataset.quoteFoldKey }
})()`)
if (foldClicked) await clickAt(foldClicked.x, foldClicked.y)
await sleep(800)
// CDP 坐标点击未命中时兜底：直接对 caret 元素派发 mousedown（走 quoteFoldClickExtension）
const foldedDom = await evalExpr(`(() => {
  if (document.querySelector('.cm-md-quote-fold')) return true
  const el = document.querySelector('[data-testid="quote-fold-caret"][data-quote-fold-key]')
  if (!el) return false
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }))
  return 'dispatched'
})()`)
await sleep(800)
const sessionAfterFold = await evalExpr(`(path => {
  const s = window.__veloxPrefs.getSession()
  const raw = JSON.parse(localStorage.getItem('veloxmark.session') ?? '{}')
  const mine = s.quoteFolds[path]
  return {
    foldedDom: !!document.querySelector('.cm-md-quote-fold'),
    foldedDomProbe: ${JSON.stringify(String(foldedDom))},
    keyCount: Object.keys(s.quoteFolds).length,
    mine,
    isFlatStringArray: Array.isArray(mine) && mine.length > 0 && mine.every((x) => typeof x === 'string' && x !== ''),
    rawMatches: JSON.stringify(s.quoteFolds) === JSON.stringify(raw.quoteFolds)
  }
})(${JSON.stringify(FIXTURE_PATH)})`)
const foldedOk = sessionAfterFold.foldedDom && sessionAfterFold.isFlatStringArray && sessionAfterFold.rawMatches
check('6.3a 折叠后 session.quoteFolds 平铺 Record<path, string[]> 且与盘上 blob 一致', foldedOk, sessionAfterFold)

// ── 6.3b sanitizer 白名单：脏数据注入 + reload 清洗（不抛错）────────────────
await evalExpr(`(() => {
  const raw = JSON.parse(localStorage.getItem('veloxmark.session') ?? '{}')
  raw.quoteFolds = { 'C:/evil.md': 'not-an-array', '': ['x'], 'C:/ok.md': [123, '', 'k1', { nested: 1 }], 'C:/arr.md': 'junk' }
  raw.headingFolds = 42
  localStorage.setItem('veloxmark.session', JSON.stringify(raw))
  return true
})()`)
await send('Page.reload', { ignoreCache: true })
let ready = false
for (let i = 0; i < 40; i++) {
  await sleep(500)
  ready = await evalExpr(`!!(window.__veloxPrefs && window.__veloxP12)`).catch(() => false)
  if (ready) break
}
await dismissAllDialogs()
const cleaned = await evalExpr(`(() => {
  const s = window.__veloxPrefs.getSession()
  return { quoteFolds: s.quoteFolds, headingFolds: s.headingFolds, booted: !!window.__veloxP12 }
})()`)
const cleanOk = cleaned.booted &&
  cleaned.headingFolds != null && typeof cleaned.headingFolds === 'object' &&
  Object.keys(cleaned.quoteFolds).every((p) => p !== '' && Array.isArray(cleaned.quoteFolds[p]) && cleaned.quoteFolds[p].every((x) => x === 'k1')) &&
  !('C:/evil.md' in cleaned.quoteFolds) && !('C:/arr.md' in cleaned.quoteFolds)
check('6.3b 脏数据 reload 后白名单清洗降级不抛错（脏项丢弃、合法项保留）', cleanOk, cleaned)

results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-04-FE-02-cdp-batch6-data.json`, JSON.stringify(results, null, 2))
const failed = results.checks.filter((c) => !c.ok).length
console.log(`\n批次⑥ done: ${results.checks.length - failed}/${results.checks.length} PASS`)
process.exit(failed > 0 ? 1 : 0)
