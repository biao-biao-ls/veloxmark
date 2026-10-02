#!/usr/bin/env node
/**
 * IT-01 FE-09 fix-FN29 CDP driver — AC-FN-29 分级退格 定向缺口修复验证.
 *
 * Measures (per the gap-fix brief + AC-FN-29 per-criterion evidence):
 *   S0 seam 前置自检（P12/Table/Editor 就绪）+ 缝 key 基线 + 草稿对话框「稍后」
 *   S1 基线静息：无工具栏/无 editing
 *   S2 AC-FN-29 判据①：单元格激活 → 点 gap 空白 → 退出 active、回到表格编辑态
 *      （非直达静息：editing 保持、嵌套编辑器卸掉、光标不回表格源、文档零写入）
 *   S3 AC-FN-29 判据②：gap 点击后表格工具栏保持挂载（⊞/align-3/⋮/🗑 四键在位）
 *   S4 AC-FN-29 判据③：二次退出路径 —— Esc 一键回静息；再入后点击正文空白亦回静息
 *   S5 零回归：AC-FN-03 单元格激活 + AC-FN-32 A→B 激活转移（编辑态/工具栏保持）
 *   S6 零回归 + AC-FN-03 未命中路径：rest → 点 gap → 编辑态无 active + 工具栏；
 *      pending 文本经 gap 点击提交（pendingCommitChanges 零回归）
 *   S7 收尾：window.__velox* 缝 key 集不变
 *
 * Robustness notes (inherited from IT-03-FE-09 driver):
 *  - Page.bringToFront + Page.setWebLifecycleState(active) +
 *    Emulation.setFocusEmulationEnabled: occluded Electron throttles timers.
 *  - Runtime.evaluate always carries a wall-clock timeout.
 *  - 草稿恢复对话框一律点「稍后」——绝不丢弃草稿（调度硬约束）。
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.FN29_CDP_PORT ?? 9521)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-09'
const FIXTURE_PATH = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/fn29-fixture.md'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── CDP plumbing (evaluate w/ wall-clock timeout) ────────────────────────────
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
async function evalExpr(expression, timeoutMs = 8000) {
  let timer
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(
      () => rej(new Error(`Runtime.evaluate timeout ${timeoutMs}ms: ${expression.slice(0, 140)}`)),
      timeoutMs
    )
  })
  try {
    const r = await Promise.race([
      send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
      timeout
    ])
    if (r.exceptionDetails) {
      throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails))
    }
    return r.result.value
  } finally {
    clearTimeout(timer)
  }
}

async function moveTo(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
}
async function pressAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
}
async function releaseAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
}
async function clickAt(x, y) {
  await moveTo(x, y)
  await pressAt(x, y)
  await releaseAt(x, y)
}
async function pressEscape() {
  await send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27
  })
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27
  })
}

const clampY = (expr) => `Math.min(Math.max(${expr}, 48), window.innerHeight - 48)`

/** Click point at a table cell's visible center (scrolled into view first). */
async function cellPoint(row, col) {
  await evalExpr(`(() => {
    const td = document.querySelector('.cm-md-table td[data-row="${row}"][data-col="${col}"], .cm-md-table th[data-row="${row}"][data-col="${col}"]')
    if (td) td.scrollIntoView({ block: 'center', inline: 'nearest' })
    return !!td
  })()`)
  await sleep(150)
  return evalExpr(`(() => {
    const td = document.querySelector('.cm-md-table td[data-row="${row}"][data-col="${col}"], .cm-md-table th[data-row="${row}"][data-col="${col}"]')
    if (!td) return null
    const r = td.getBoundingClientRect()
    return {
      x: +(r.left + r.width / 2).toFixed(2),
      y: +Math.min(Math.max(r.top + r.height / 2, 48), window.innerHeight - 48).toFixed(2),
      text: td.textContent
    }
  })()`)
}

/** Click point in the table outer gap padding (below the <table> border box). */
async function gapPoint() {
  await evalExpr(`(() => {
    const el = document.querySelector('.cm-md-table-outer')
    if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' })
    return !!el
  })()`)
  await sleep(150)
  return evalExpr(`(() => {
    const outer = document.querySelector('.cm-md-table-outer')
    const table = document.querySelector('.cm-md-table')
    if (!outer || !table) return null
    const o = outer.getBoundingClientRect()
    const t = table.getBoundingClientRect()
    return {
      x: +(t.left + t.width / 2).toFixed(2),
      y: +(t.bottom + Math.min(6, Math.max(2, (o.bottom - t.bottom) / 2))).toFixed(2),
      gapH: +(o.bottom - t.bottom).toFixed(2)
    }
  })()`)
}

/** Click point in body prose, clear of the table (secondary exit path). */
async function bodyPoint() {
  await evalExpr(`(() => {
    const el = [...document.querySelectorAll('.cm-editor .cm-line')]
      .find((n) => (n.textContent ?? '').includes('Body paragraph for secondary exit'))
    if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' })
    return !!el
  })()`)
  await sleep(150)
  return evalExpr(`(() => {
    const el = [...document.querySelectorAll('.cm-editor .cm-line')]
      .find((n) => (n.textContent ?? '').includes('Body paragraph for secondary exit'))
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: +(r.left + 24).toFixed(2), y: ${clampY('r.top + r.height / 2')} }
  })()`)
}

// ── probes ───────────────────────────────────────────────────────────────────
/** Table edit-form state: nested (active cell), editing chrome, toolbar + ops. */
const TABLE_STATE = `(() => {
  const nested = !!window.__veloxTable?.nested
  const editing = document.querySelectorAll('.cm-md-table-editing').length
  const toolbar = document.querySelectorAll('.cm-md-table-toolbar')
  const ops = [...document.querySelectorAll('.cm-md-table-toolbar [data-op]')].map((b) => b.dataset.op)
  const cellEditing = document.querySelectorAll('.cm-md-table-cell-editing').length
  return { nested, editing, toolbar: toolbar.length, ops, cellEditing }
})()`

const SELECTION = `(() => {
  const v = window.__veloxEditor?.view
  if (!v) return null
  const sel = v.state.selection.main
  return { empty: sel.empty, from: sel.from, to: sel.to }
})()`

const DOC = `window.__veloxP13 ? window.__veloxP13.getDoc() : (window.__veloxEditor?.view.state.doc.toString() ?? null)`

const SEAM_KEYS = `Object.keys(window).filter((k) => k.startsWith('__velox')).sort()`

const DIALOG_STATE = `(() => {
  const d = document.querySelector('.dialog-overlay .dialog')
  if (!d) return { present: false }
  return {
    present: true,
    message: d.querySelector('.dialog-message')?.textContent ?? null,
    buttons: [...d.querySelectorAll('.dialog-buttons .dialog-btn')].map((b) => (b.textContent ?? '').trim())
  }
})()`

const results = { meta: { port: PORT, startedAt: new Date().toISOString() }, scenarios: {} }

const check = (name, ok, detail) => {
  const row = { name, ok: !!ok, detail }
  results.checks = results.checks ?? []
  results.checks.push(row)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail) : ''}`)
  return !!ok
}

/** Dismiss any modal dialog. 草稿恢复对话框一律点「稍后」——绝不丢弃草稿（硬约束）。 */
async function dismissAnyDialog() {
  const s = await evalExpr(DIALOG_STATE)
  if (!s.present) return null
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
  if (btn) {
    await clickAt(btn.x, btn.y)
    await sleep(350)
  }
  return { dialog: s, clicked: btn }
}

const FIXTURE = `# FN29 fixture

Body paragraph for secondary exit checks.

| h1 | h2 |
| --- | --- |
| a | b |
| c | d |

Tail paragraph after the table.
`

async function loadDocSettled() {
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
    if (state.fp === FIXTURE_PATH && state.tables >= 1) return state
  }
  throw new Error('loadDocSettled did not settle')
}

// ── lifecycle + focus (occluded-Electron throttle guard) ─────────────────────
await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })

// ── S0: seams + dialog + baseline keys ──────────────────────────────────────
await dismissAnyDialog()
const seams = await evalExpr(`({
  p12: !!window.__veloxP12, p13: !!window.__veloxP13,
  table: !!window.__veloxTable, editor: !!window.__veloxEditor
})`)
check('S0 e2e 缝 P12/P13/Table/Editor 就绪', seams.p12 && seams.p13 && seams.table && seams.editor, seams)
const keyBase = await evalExpr(SEAM_KEYS)
check('S0 缝 key 基线采集', Array.isArray(keyBase) && keyBase.length > 0, { count: keyBase.length })

await loadDocSettled()
check('S0 夹具装载（表格 + 正文段）', true, await evalExpr(`({ tables: document.querySelectorAll('.cm-md-table-wrap').length })`))

// ── S1: baseline quiet ───────────────────────────────────────────────────────
const s1 = await evalExpr(TABLE_STATE)
check('S1 基线静息：无 toolbar / 无 editing / 无 nested', !s1.nested && s1.editing === 0 && s1.toolbar === 0, s1)

// ── S2: AC-FN-29 判据① graded step-back ─────────────────────────────────────
const cell1 = await cellPoint(1, 0)
check('S2 单元格定位', !!cell1, cell1)
await clickAt(cell1.x, cell1.y)
await sleep(400)
const s2a = await evalExpr(TABLE_STATE)
check('S2 前置：单元格激活（nested + editing + toolbar）', s2a.nested && s2a.editing === 1 && s2a.toolbar === 1, s2a)

const gap = await gapPoint()
check('S2 gap 定位', !!gap && gap.gapH >= 0, gap)
const docBeforeGap = await evalExpr(DOC)
const selBeforeGap = await evalExpr(SELECTION)
await clickAt(gap.x, gap.y)
await sleep(400)
const s2b = await evalExpr(TABLE_STATE)
const docAfterGap = await evalExpr(DOC)
const selAfterGap = await evalExpr(SELECTION)
check(
  'S2 判据① gap 点击退出单元格激活态（nested/cell-editing 卸掉）',
  !s2b.nested && s2b.cellEditing === 0,
  s2b
)
check(
  'S2 判据① 回到表格编辑态（非直达静息：editing 保持）',
  s2b.editing === 1,
  s2b
)
check('S2 gap 点击零写入（纯点击不落文档）', docAfterGap === docBeforeGap, { same: docAfterGap === docBeforeGap })
check(
  'S2 gap 点击不跳表格源（光标保持原位）',
  selAfterGap && selBeforeGap && selAfterGap.from === selBeforeGap.from && selAfterGap.to === selBeforeGap.to,
  { before: selBeforeGap, after: selAfterGap }
)

// ── S3: AC-FN-29 判据② toolbar retention ────────────────────────────────────
const s3 = await evalExpr(TABLE_STATE)
check('S3 判据② 工具栏保持挂载', s3.toolbar === 1, s3)
// contract.ts TOOLBAR_DATA_OP — frozen literal ids (⊞/align-3/⋮/🗑)
const needOps = ['resizeTable', 'alignLeft', 'alignCenter', 'alignRight', 'TBL-MOR-OPN', 'deleteTable']
const gotOps = new Set(s3.ops)
const missingOps = needOps.filter((op) => !gotOps.has(op))
check('S3 判据② 工具栏四键在位（⊞/align-3/⋮/🗑）', missingOps.length === 0, { ops: s3.ops, missing: missingOps })

// ── S4: AC-FN-29 判据③ secondary exit paths ─────────────────────────────────
await pressEscape()
await sleep(400)
const s4a = await evalExpr(TABLE_STATE)
check('S4 判据③ 二次退出 Esc → 全静息（toolbar/editing 全灭）', s4a.toolbar === 0 && s4a.editing === 0 && !s4a.nested, s4a)

// re-enter: cell → gap → click body blank
const cell2 = await cellPoint(1, 1)
await clickAt(cell2.x, cell2.y)
await sleep(400)
const gap2 = await gapPoint()
await clickAt(gap2.x, gap2.y)
await sleep(400)
const s4mid = await evalExpr(TABLE_STATE)
check('S4 再入后 gap 分级退格保持（editing+toolbar、无 nested）', s4mid.editing === 1 && s4mid.toolbar === 1 && !s4mid.nested, s4mid)
const body = await bodyPoint()
check('S4 正文空白定位', !!body, body)
await clickAt(body.x, body.y)
await sleep(400)
const s4b = await evalExpr(TABLE_STATE)
check('S4 判据③ 二次退出 点击正文空白 → 全静息', s4b.toolbar === 0 && s4b.editing === 0 && !s4b.nested, s4b)

// ── S5: zero-regression AC-FN-03 / AC-FN-32 ──────────────────────────────────
const cellA = await cellPoint(1, 0)
await clickAt(cellA.x, cellA.y)
await sleep(400)
const s5a = await evalExpr(TABLE_STATE)
check('S5 AC-FN-03 零回归：单元格点击激活 + 工具栏', s5a.nested && s5a.editing === 1 && s5a.toolbar === 1, s5a)

const cellB = await cellPoint(2, 1)
await clickAt(cellB.x, cellB.y)
await sleep(400)
const s5b = await evalExpr(TABLE_STATE)
const activeCell = await evalExpr(`(() => {
  const td = [...document.querySelectorAll('.cm-md-table td, .cm-md-table th')]
    .find((t) => t.querySelector('.cm-editor'))
  return td ? { row: td.dataset.row, col: td.dataset.col } : null
})()`)
check(
  'S5 AC-FN-32 零回归：A→B 激活转移（B 激活、单 active、工具栏保持）',
  s5b.nested && s5b.toolbar === 1 && activeCell && activeCell.row === '2' && activeCell.col === '1',
  { s5: s5b, activeCell }
)

// from active B: gap → then click cell A (activation transfer from step-back form)
const gap3 = await gapPoint()
await clickAt(gap3.x, gap3.y)
await sleep(400)
const cellC = await cellPoint(1, 0)
await clickAt(cellC.x, cellC.y)
await sleep(400)
const s5c = await evalExpr(TABLE_STATE)
const activeCell2 = await evalExpr(`(() => {
  const td = [...document.querySelectorAll('.cm-md-table td, .cm-md-table th')]
    .find((t) => t.querySelector('.cm-editor'))
  return td ? { row: td.dataset.row, col: td.dataset.col } : null
})()`)
check(
  'S5 AC-FN-32：分级退格后再点单元格可再激活（edit→active 通路活）',
  s5c.nested && s5c.toolbar === 1 && activeCell2 && activeCell2.row === '1' && activeCell2.col === '0',
  { s5: s5c, activeCell: activeCell2 }
)
// clean up for S6
await pressEscape()
await sleep(300)

// ── S6: AC-FN-03 miss path + pending commit ─────────────────────────────────
const s6base = await evalExpr(TABLE_STATE)
check('S6 前置静息', s6base.toolbar === 0 && s6base.editing === 0, s6base)
const gap4 = await gapPoint()
await clickAt(gap4.x, gap4.y)
await sleep(400)
const s6a = await evalExpr(TABLE_STATE)
check(
  'S6 AC-FN-03 未命中路径：rest→gap → 编辑态无 active + 工具栏浮现',
  !s6a.nested && s6a.editing === 1 && s6a.toolbar === 1,
  s6a
)
await pressEscape()
await sleep(300)

// pending text commit on gap click (pendingCommitChanges zero-regression)
const cellD = await cellPoint(1, 0)
await clickAt(cellD.x, cellD.y)
await sleep(400)
await evalExpr(`(() => {
  const ok = window.__veloxTable.setCellDoc('pending-gap')
  return ok
})()`)
await sleep(200)
const gap5 = await gapPoint()
await clickAt(gap5.x, gap5.y)
await sleep(500)
const s6doc = await evalExpr(DOC)
check(
  'S6 pending 文本经 gap 点击提交（源码含 pending-gap）',
  typeof s6doc === 'string' && s6doc.includes('pending-gap'),
  { hit: typeof s6doc === 'string' && s6doc.includes('pending-gap') }
)
const s6b = await evalExpr(TABLE_STATE)
check('S6 提交后仍在编辑态（工具栏保持）', s6b.editing === 1 && s6b.toolbar === 1 && !s6b.nested, s6b)

// ── S7: seams unchanged + screenshots ───────────────────────────────────────
// __veloxTableCellView is a documented frozen seam (handles.d.ts / nestedSession.ts)
// lazily installed on first nested cell view — its key appearing mid-session is
// pre-existing contract behavior, not a seam break. Fail only on unknown keys.
const LAZY_SEAMS = new Set(['__veloxTableCellView'])
const keyEnd = await evalExpr(SEAM_KEYS)
const added = keyEnd.filter((k) => !keyBase.includes(k))
const removed = keyBase.filter((k) => !keyEnd.includes(k))
const unknown = added.filter((k) => !LAZY_SEAMS.has(k))
check(
  'S7 window.__velox* 缝 key 集不变（懒安装契约 key 白名单外零新增）',
  unknown.length === 0 && removed.length === 0,
  { added, removed, unknown }
)

try {
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(`${OUT_DIR}/IT-01-FE-09-fix-FN29-editform.png`, Buffer.from(shot.data, 'base64'))
  check('S7 证据截图落盘（编辑态工具栏保持）', true, { bytes: shot.data.length })
} catch (e) {
  check('S7 证据截图落盘（编辑态工具栏保持）', false, String(e))
}

// quiet screenshot
await pressEscape()
await sleep(300)
try {
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT_DIR}/IT-01-FE-09-fix-FN29-quiet.png`, Buffer.from(shot.data, 'base64'))
  check('S7 静息截图落盘', true, { bytes: shot.data.length })
} catch (e) {
  check('S7 静息截图落盘', false, String(e))
}

// ── summary ─────────────────────────────────────────────────────────────────
const passed = (results.checks ?? []).filter((c) => c.ok).length
const total = (results.checks ?? []).length
results.meta.passed = passed
results.meta.total = total
results.meta.finishedAt = new Date().toISOString()
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(`${OUT_DIR}/IT-01-FE-09-fix-FN29-cdp-results.json`, JSON.stringify(results, null, 2))
console.log(`\n== ${passed}/${total} PASS ==`)
ws.close()
process.exit(passed === total ? 0 : 1)
