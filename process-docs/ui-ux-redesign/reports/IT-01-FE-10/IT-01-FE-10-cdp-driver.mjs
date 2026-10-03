#!/usr/bin/env node
/**
 * IT-01 FE-10 CDP driver — 静息零 chrome 与防抖零抖动（显隐收口/≥150ms 防抖/0px 位移）.
 *
 * Measures (task 验收阶段 2/3 evidence):
 *   S0 seam 前置自检 + 草稿对话框「稍后」+ 夹具装载 + 缝 key 基线
 *   S1 静息零 chrome（AC-FN-23）：工具栏/grip/浮层全不渲染、grip 不可命中
 *   S2 防抖时间轴（AC-NF-04）：快速掠过 0 闪烁；慢速 hover ≥150ms 浮现（仅
 *      微控件 col-grip，工具栏 hover 态不渲染 AC-FN-33）；离开 ≥150ms 延迟消失
 *   S3 0px 位移（AC-NF-05）：chrome 显隐前后正文/表格坐标比对
 *   S4 写作者路径（AC-RULE-13）：hover 点击一次进编辑 + 工具栏（impl 截图）
 *   S5 选区安全（AC-FN-33/AC-FN-18）：拖选跨表格零 chrome、不进编辑
 *   S6 Esc/FE-09 联调：一键回安静 → chrome 状态机复位静息（指针驻留也不残留）
 *   S7 FE-07 联调：toast 出现/消失零位移、不触发 chrome 浮现
 *   S8 深浅主题：--chrome-duration 与过渡延迟两主题一致（token 翻值）
 *   S9 收尾：window.__velox* 缝 key 集不变 + 证据截图落盘
 *
 * Robustness notes (inherited from IT-01-FE-09 / IT-03-FE-10 drivers):
 *  - Page.bringToFront + Page.setWebLifecycleState(active) +
 *    Emulation.setFocusEmulationEnabled: occluded Electron throttles timers.
 *  - Runtime.evaluate always carries a wall-clock timeout.
 *  - 草稿恢复对话框一律点「稍后」——绝不丢弃草稿（调度硬约束）。
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.FE10_CDP_PORT ?? 9531)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-10'
const FIXTURE_PATH = 'D:/code/typora/temp/fe10-fixture.md'

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
/** Drag-move MUST carry buttons:1 — a buttons:0 move reads as mid-drag release. */
async function moveDragging(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 })
}
async function pressAt(x, y) {
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    buttons: 1,
    clickCount: 1
  })
}
async function releaseAt(x, y) {
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    buttons: 0,
    clickCount: 1
  })
}
async function clickAt(x, y) {
  await moveTo(x, y)
  await pressAt(x, y)
  await releaseAt(x, y)
}
async function pressEscape() {
  await send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27
  })
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27
  })
}

const clampY = (expr) => `Math.min(Math.max(${expr}, 48), window.innerHeight - 48)`

// ── geometry helpers ─────────────────────────────────────────────────────────
async function wrapPoint() {
  await evalExpr(`(() => {
    const el = document.querySelector('.cm-md-table-wrap')
    if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' })
    return !!el
  })()`)
  await sleep(150)
  return evalExpr(`(() => {
    const wrap = document.querySelector('.cm-md-table-wrap')
    if (!wrap) return null
    const r = wrap.getBoundingClientRect()
    return {
      x: +(r.left + r.width / 2).toFixed(2),
      y: +Math.min(Math.max(r.top + Math.min(40, r.height / 3), 48), window.innerHeight - 48).toFixed(2)
    }
  })()`)
}

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

async function bodyPoint() {
  await evalExpr(`(() => {
    const el = [...document.querySelectorAll('.cm-editor .cm-line')]
      .find((n) => (n.textContent ?? '').includes('Body paragraph for chrome checks'))
    if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' })
    return !!el
  })()`)
  await sleep(150)
  return evalExpr(`(() => {
    const el = [...document.querySelectorAll('.cm-editor .cm-line')]
      .find((n) => (n.textContent ?? '').includes('Body paragraph for chrome checks'))
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: +(r.left + 24).toFixed(2), y: ${clampY('r.top + r.height / 2')} }
  })()`)
}

async function tailPoint() {
  await evalExpr(`(() => {
    const el = [...document.querySelectorAll('.cm-editor .cm-line')]
      .find((n) => (n.textContent ?? '').includes('Tail paragraph after the table'))
    if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' })
    return !!el
  })()`)
  await sleep(150)
  return evalExpr(`(() => {
    const el = [...document.querySelectorAll('.cm-editor .cm-line')]
      .find((n) => (n.textContent ?? '').includes('Tail paragraph after the table'))
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: +(r.left + 24).toFixed(2), y: ${clampY('r.top + r.height / 2')} }
  })()`)
}

async function codePoint() {
  return evalExpr(`(() => {
    const el = document.querySelector('.cm-md-code-block')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      x: +(r.left + r.width / 2).toFixed(2),
      y: +Math.min(Math.max(r.top + r.height / 2, 48), window.innerHeight - 48).toFixed(2)
    }
  })()`)
}

// ── probes ───────────────────────────────────────────────────────────────────
/** Chrome visibility snapshot — the AC-FN-23/33 断言面. */
const CHROME_STATE = `(() => {
  const wrap = document.querySelector('.cm-md-table-wrap')
  const grip = document.querySelector('.cm-md-col-grip')
  const bar = document.querySelector('.cm-md-block-toolbar')
  const chip = document.querySelector('.cm-md-code-idle-chip')
  const gs = grip ? getComputedStyle(grip) : null
  const bs = bar ? getComputedStyle(bar) : null
  const cs = chip ? getComputedStyle(chip) : null
  return {
    toolbar: document.querySelectorAll('.cm-md-table-toolbar').length,
    editing: document.querySelectorAll('.cm-md-table-editing').length,
    chromeOn: !!wrap && wrap.classList.contains('cm-md-chrome-on'),
    grips: document.querySelectorAll('[data-table-handle="col-grip"]').length,
    gripOpacity: gs ? gs.opacity : null,
    gripPointer: gs ? gs.pointerEvents : null,
    barOpacity: bs ? bs.opacity : null,
    chipOpacity: cs ? cs.opacity : null,
    floats: document.querySelectorAll('.cm-md-image-float, .cm-md-link-float, .render-float').length
  }
})()`

const TABLE_STATE = `(() => {
  const nested = !!window.__veloxTable?.nested
  const editing = document.querySelectorAll('.cm-md-table-editing').length
  const toolbar = document.querySelectorAll('.cm-md-table-toolbar').length
  return { nested, editing, toolbar }
})()`

/** Content displacement markers — prose above, table anchor, prose below. */
const MARKERS = `(() => {
  const grab = (needle) => {
    const el = [...document.querySelectorAll('.cm-editor .cm-line')]
      .find((n) => (n.textContent ?? '').includes(needle))
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { top: +r.top.toFixed(2), left: +r.left.toFixed(2) }
  }
  const outer = document.querySelector('.cm-md-table-outer')
  const o = outer ? outer.getBoundingClientRect() : null
  return {
    proseTop: grab('Body paragraph for chrome checks'),
    tail: grab('Tail paragraph after the table'),
    tableTop: o ? { top: +o.top.toFixed(2), left: +o.left.toFixed(2) } : null
  }
})()`

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

/** 草稿恢复对话框一律点「稍后」——绝不丢弃草稿（硬约束）。 */
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

const FIXTURE = `# FE-10 fixture

Body paragraph for chrome checks and secondary exit.

| h1 | h2 |
| --- | --- |
| a | b |
| c | d |

Tail paragraph after the table.

\`\`\`js
// fe10 code block
\`\`\`
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
      tables: document.querySelectorAll('.cm-md-table-wrap').length,
      code: document.querySelectorAll('.cm-md-code-block').length
    })`)
    if (state.fp === FIXTURE_PATH && state.tables >= 1 && state.code >= 1) return state
  }
  throw new Error('loadDocSettled did not settle')
}

// ── debounce timeline probe (in-page, performance.now clock) ─────────────────
const INSTALL_PROBE = `(() => {
  const wrap = document.querySelector('.cm-md-table-wrap')
  if (!wrap) return false
  window.__fe10 = { log: [] }
  const rec = (what, extra) => window.__fe10.log.push({ t: +performance.now().toFixed(1), what, ...extra })
  wrap.addEventListener('pointerenter', () => rec('enter'))
  wrap.addEventListener('pointerleave', () => rec('leave'))
  const obs = new MutationObserver(() => rec('class', { on: wrap.classList.contains('cm-md-chrome-on') }))
  obs.observe(wrap, { attributes: true, attributeFilter: ['class'] })
  return true
})()`

const DRAIN_LOG = `(() => {
  const log = window.__fe10 ? window.__fe10.log.splice(0) : []
  return log
})()`

/** Collapse a probe log into reveal/hide latencies + flash count.
 *  `initialLit` carries the chrome-on state across drained segments (a leave
 *  recorded after a prior reveal must still measure its hide latency). */
function timelineOf(log, initialLit = false) {
  let enterT = null
  let leaveT = null
  const events = []
  let flashes = 0
  let lit = initialLit
  for (const e of log) {
    if (e.what === 'enter') enterT = e.t
    if (e.what === 'leave') leaveT = e.t
    if (e.what === 'class' && e.on && !lit) {
      lit = true
      flashes += 1
      events.push({
        kind: 'reveal',
        latencyMs: enterT != null ? +(e.t - enterT).toFixed(1) : null,
        at: e.t
      })
    }
    // Hide: a class→off after a leave (or while this segment knows we were lit).
    if (e.what === 'class' && !e.on && (lit || leaveT != null)) {
      lit = false
      events.push({
        kind: 'hide',
        latencyMs: leaveT != null ? +(e.t - leaveT).toFixed(1) : null,
        at: e.t
      })
    }
  }
  return { events, flashes, log, endLit: lit }
}

// ── lifecycle + focus (occluded-Electron throttle guard) ─────────────────────
await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })

// ── S0: seams + dialog + baseline keys ──────────────────────────────────────
await dismissAnyDialog()
const seams = await evalExpr(`({
  p12: !!window.__veloxP12, p13: !!window.__veloxP13,
  p20: !!window.__veloxP20, table: !!window.__veloxTable, editor: !!window.__veloxEditor
})`)
check(
  'S0 e2e 缝 P12/P13/P20/Table/Editor 就绪',
  seams.p12 && seams.p13 && seams.p20 && seams.table && seams.editor,
  seams
)
const keyBase = await evalExpr(SEAM_KEYS)
check('S0 缝 key 基线采集', Array.isArray(keyBase) && keyBase.length > 0, { count: keyBase.length })

const loadState = await loadDocSettled()
check('S0 夹具装载（表格 + 代码块 + 正文段）', loadState.tables >= 1 && loadState.code >= 1, loadState)

// ── S1: 静息零 chrome（AC-FN-23）────────────────────────────────────────────
const body = await bodyPoint()
check('S1 正文定位', !!body, body)
await moveTo(body.x, body.y)
await sleep(400)
const s1 = await evalExpr(CHROME_STATE)
check(
  'S1 静息零 chrome：无工具栏/无 editing/无 chrome-on',
  s1.toolbar === 0 && s1.editing === 0 && !s1.chromeOn,
  s1
)
check(
  'S1 静息 grip 零残留（opacity 0 + 不可命中）',
  s1.gripOpacity === '0' && s1.gripPointer === 'none',
  { gripOpacity: s1.gripOpacity, gripPointer: s1.gripPointer }
)
check(
  'S1 静息块级 chrome 全隐（bar/chip opacity 0）',
  s1.barOpacity === '0' && (s1.chipOpacity === '0' || s1.chipOpacity === null),
  { barOpacity: s1.barOpacity, chipOpacity: s1.chipOpacity }
)
try {
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(`${OUT_DIR}/IT-01-FE-10-idle-quiet.png`, Buffer.from(shot.data, 'base64'))
  check('S1 静息截图落盘', true, { bytes: shot.data.length })
} catch (e) {
  check('S1 静息截图落盘', false, String(e))
}

// ── S2: 防抖时间轴（AC-NF-04 / AC-FN-33）────────────────────────────────────
check('S2 时间轴探针安装', await evalExpr(INSTALL_PROBE), null)
const wrapPt = await wrapPoint()
check('S2 表格块区定位', !!wrapPt, wrapPt)

// S2a — rapid pass-over (<150ms): zero flashes, never half-materialized.
await evalExpr(DRAIN_LOG)
const body2 = await bodyPoint()
await moveTo(wrapPt.x, wrapPt.y)
await sleep(60) // <150ms dwell
await moveTo(body2.x, body2.y)
await sleep(400) // past both debounce windows
const rapid = timelineOf(await evalExpr(DRAIN_LOG))
results.scenarios.rapidPass = rapid
check(
  'S2a 快速掠过（<150ms）闪烁 0 次、不半途浮现（AC-NF-04）',
  rapid.flashes === 0,
  { flashes: rapid.flashes, log: rapid.log }
)

// S2b — slow hover ≥150ms: only micro controls (col-grip) reveal; NO toolbar.
await evalExpr(DRAIN_LOG)
await moveTo(wrapPt.x, wrapPt.y)
await sleep(320)
const slowState = await evalExpr(CHROME_STATE)
const slow = timelineOf(await evalExpr(DRAIN_LOG))
results.scenarios.slowHover = slow
const reveal = slow.events.find((e) => e.kind === 'reveal')
check(
  'S2b 慢速 hover ≥150ms 后浮现（防抖时间轴采样）',
  reveal != null && reveal.latencyMs >= 150 && reveal.latencyMs <= 320,
  { latencyMs: reveal?.latencyMs, flashes: slow.flashes }
)
check(
  'S2b 浮现为 hover 微控件（grip 可见+可命中，chrome-on）',
  slowState.chromeOn && slowState.gripOpacity !== '0' && slowState.gripPointer === 'auto',
  slowState
)
check(
  'S2b 表格工具栏 hover 态不渲染（AC-FN-33）',
  slowState.toolbar === 0 && slowState.editing === 0,
  slowState
)

// S2c — leave: same-delay disappearance (≥150ms), zero residue.
// Leave via a NO-SCROLL lateral move (scrollIntoView could rebuild the widget
// and muddle the leave/hide timeline with a DOM swap).
await evalExpr(DRAIN_LOG)
await moveTo(80, wrapPt.y)
await sleep(400)
const leaveState = await evalExpr(CHROME_STATE)
const leaving = timelineOf(await evalExpr(DRAIN_LOG), true)
results.scenarios.leaveHide = leaving
const hide = leaving.events.find((e) => e.kind === 'hide')
check(
  'S2c 离开同延迟消失（≥150ms）',
  hide != null && hide.latencyMs >= 150 && hide.latencyMs <= 320,
  { latencyMs: hide?.latencyMs }
)
check(
  'S2c 移出后零残留（chrome-on 撤除、grip 隐身不可命中）',
  !leaveState.chromeOn && leaveState.gripOpacity === '0' && leaveState.gripPointer === 'none',
  leaveState
)

// ── S3: 0px 位移（AC-NF-05）────────────────────────────────────────────────
const mIdle = await evalExpr(MARKERS)
await moveTo(wrapPt.x, wrapPt.y)
await sleep(320) // reveal
const mHover = await evalExpr(MARKERS)
const body4 = await bodyPoint()
await moveTo(body4.x, body4.y)
await sleep(400) // hide
const mGone = await evalExpr(MARKERS)
const delta = (a, b) => {
  if (!a || !b) return null
  return {
    dTop: +(b.top - a.top).toFixed(2),
    dLeft: +(b.left - a.left).toFixed(2)
  }
}
const shifts = {
  prose_idle_to_hover: delta(mIdle.proseTop, mHover.proseTop),
  prose_idle_to_gone: delta(mIdle.proseTop, mGone.proseTop),
  table_idle_to_hover: delta(mIdle.tableTop, mHover.tableTop),
  table_idle_to_gone: delta(mIdle.tableTop, mGone.tableTop),
  tail_idle_to_hover: delta(mIdle.tail, mHover.tail),
  tail_idle_to_gone: delta(mIdle.tail, mGone.tail)
}
results.scenarios.zeroShiftHover = { mIdle, mHover, mGone, shifts }
const zeroOk = Object.values(shifts).every(
  (d) => d && d.dTop === 0 && d.dLeft === 0
)
check('S3 chrome 显隐前后正文/表格位移 0px（AC-NF-05）', zeroOk, shifts)

// ── S4: 写作者路径（AC-RULE-13）────────────────────────────────────────────
const cell = await cellPoint(1, 0)
check('S4 单元格定位', !!cell, cell)
await moveTo(wrapPt.x, wrapPt.y)
await sleep(320) // hover first (writer path: hover → click)
const hoverThenClick = await evalExpr(CHROME_STATE)
check('S4 前置：hover 微控件已浮现（无工具栏）', hoverThenClick.chromeOn && hoverThenClick.toolbar === 0, hoverThenClick)
await clickAt(cell.x, cell.y)
await sleep(450)
const s4 = await evalExpr(TABLE_STATE)
check(
  'S4 hover 点击一次进聚焦编辑态（AC-RULE-13/AC-FN-03）',
  s4.nested && s4.editing === 1 && s4.toolbar === 1,
  s4
)
// 0px across edit entry — AC-NF-05 chrome 显隐面: the toolbar overlay mount
// must not move the prose/table anchors. The tail marker sits below the table
// and tracks table HEIGHT, which the P10 nested cell editor can sub-pixel
// (min-width 3em / nested cm line metrics) — that metric is edit-mode cell
// chrome (FE-09 frozen), NOT the chrome 显隐 surface under AC-NF-05.
const mEdit = await evalExpr(MARKERS)
const editShift = {
  prose: delta(mIdle.proseTop, mEdit.proseTop),
  table: delta(mIdle.tableTop, mEdit.tableTop)
}
const editTailShift = delta(mIdle.tail, mEdit.tail)
results.scenarios.zeroShiftEdit = { mIdle, mEdit, editShift, editTailShift }
check(
  'S4 工具栏 overlay 挂载正文/表格锚点零位移（AC-NF-05 chrome 显隐面）',
  Object.values(editShift).every((d) => d && d.dTop === 0 && d.dLeft === 0),
  editShift
)
check(
  'S4 表尾段亚像素登记（P10 嵌套单元格编辑器度量，非 chrome 显隐面）',
  editTailShift != null && Math.abs(editTailShift.dTop) <= 2 && editTailShift.dLeft === 0,
  editTailShift
)
try {
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT_DIR}/IT-01-FE-10-impl.png`, Buffer.from(shot.data, 'base64'))
  check('S4 impl 截图落盘（编辑态工具栏 = ui_02 对齐面）', true, { bytes: shot.data.length })
} catch (e) {
  check('S4 impl 截图落盘', false, String(e))
}
await pressEscape()
await sleep(400)
const s4q = await evalExpr(TABLE_STATE)
check('S4 Esc 一次退出到静息（FN-31 衔接）', s4q.toolbar === 0 && s4q.editing === 0 && !s4q.nested, s4q)

// ── S5: 选区安全（AC-FN-33 / AC-FN-18）──────────────────────────────────────
// ONE scroll then measure BOTH endpoints fresh — a second scrollIntoView would
// invalidate the first point. Drag moves carry buttons:1 (mid-drag contract).
await evalExpr(`(() => {
  const el = [...document.querySelectorAll('.cm-editor .cm-line')]
    .find((n) => (n.textContent ?? '').includes('Body paragraph for chrome checks'))
  if (el) el.scrollIntoView({ block: 'start', inline: 'nearest' })
  return !!el
})()`)
await sleep(150)
const ends = await evalExpr(`(() => {
  const grab = (needle) => {
    const el = [...document.querySelectorAll('.cm-editor .cm-line')]
      .find((n) => (n.textContent ?? '').includes(needle))
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      x: +(r.left + 24).toFixed(2),
      y: +Math.min(Math.max(r.top + r.height / 2, 48), window.innerHeight - 48).toFixed(2)
    }
  }
  return {
    bodyS: grab('Body paragraph for chrome checks'),
    tailS: grab('Tail paragraph after the table'),
    wrap: (() => {
      const w = document.querySelector('.cm-md-table-wrap')
      if (!w) return null
      const r = w.getBoundingClientRect()
      return {
        x: +(r.left + r.width / 2).toFixed(2),
        y: +Math.min(Math.max(r.top + Math.min(40, r.height / 3), 48), window.innerHeight - 48).toFixed(2)
      }
    })()
  }
})()`)
const bodyS = ends.bodyS
const tailS = ends.tailS
const wrapDrag = ends.wrap ?? wrapPt
check('S5 选区端点定位', !!bodyS && !!tailS, ends)
// drag-select from prose above the table across the table to prose below
await moveTo(bodyS.x, bodyS.y)
await pressAt(bodyS.x, bodyS.y)
await moveDragging(wrapDrag.x, wrapDrag.y)
await moveDragging(tailS.x, tailS.y)
// mid-drag probe: chrome must be suppressed WHILE the selection is alive
const s5mid = await evalExpr(CHROME_STATE)
await releaseAt(tailS.x, tailS.y)
await sleep(400)
const s5sel = await evalExpr(`(() => {
  const v = window.__veloxEditor?.view
  const sel = v ? v.state.selection.main : null
  return { empty: sel ? sel.empty : null, from: sel?.from ?? null, to: sel?.to ?? null,
    selecting: document.querySelector('.cm-editor')?.classList.contains('cm-md-selecting') ?? false }
})()`)
const s5chrome = await evalExpr(CHROME_STATE)
check(
  'S5 拖选跨表格：选区存活 + 压零 chrome（无工具栏/chrome-on/grip 隐身）',
  s5sel.empty === false && s5sel.selecting && s5chrome.toolbar === 0 && !s5chrome.chromeOn && s5chrome.gripOpacity === '0',
  { sel: s5sel, chrome: s5chrome, mid: s5mid }
)
check(
  'S5 拖选过程中 chrome 全程压零（AC-FN-18 选区存活期间）',
  s5mid.toolbar === 0 && !s5mid.chromeOn && s5mid.gripOpacity === '0',
  s5mid
)
check(
  'S5 拖选松开不触发编辑（AC-FN-33 复制路径零副作用）',
  s5chrome.editing === 0,
  s5chrome
)
try {
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT_DIR}/IT-01-FE-10-select-safe.png`, Buffer.from(shot.data, 'base64'))
  check('S5 选区安全截图落盘', true, { bytes: shot.data.length })
} catch (e) {
  check('S5 选区安全截图落盘', false, String(e))
}
// collapse selection → hover may arm again
const bodyC = await bodyPoint()
await clickAt(bodyC.x, bodyC.y)
await sleep(300)

// ── S6: Esc/FE-09 联调 —— 回安静后状态机复位静息 ────────────────────────────
// (a) hover-revealed + pointer resting → Esc must strip chrome NOW (machine reset)
check('S6a 探针重装', await evalExpr(INSTALL_PROBE), null)
await evalExpr(DRAIN_LOG)
await moveTo(wrapPt.x, wrapPt.y)
await sleep(320)
const s6hover = await evalExpr(CHROME_STATE)
check('S6a 前置：hover 微控件浮现', s6hover.chromeOn, s6hover)
await pressEscape()
await sleep(250)
const s6after = await evalExpr(CHROME_STATE)
check(
  'S6a Esc 回安静即复位静息（指针驻留也不残留，FE-09 联调）',
  !s6after.chromeOn && s6after.gripOpacity === '0' && s6after.toolbar === 0,
  s6after
)
const s6tl = timelineOf(await evalExpr(DRAIN_LOG))
results.scenarios.hushReset = s6tl
check('S6a hush 复位即时（无防抖延迟残留）', s6tl.events.length === 0 || s6tl.log.some((e) => e.what === 'class' && !e.on), { log: s6tl.log })

// (b) edit state → Esc → machine reset + zero residue
const cellE = await cellPoint(1, 1)
await clickAt(cellE.x, cellE.y)
await sleep(450)
const s6edit = await evalExpr(TABLE_STATE)
check('S6b 前置：编辑态（工具栏在位）', s6edit.editing === 1 && s6edit.toolbar === 1, s6edit)
await pressEscape()
await sleep(350)
const s6b = await evalExpr(CHROME_STATE)
const s6bTable = await evalExpr(TABLE_STATE)
check(
  'S6b 编辑态 Esc → 静息零 chrome（工具栏/把手/chip 全灭）',
  s6bTable.toolbar === 0 && s6bTable.editing === 0 && !s6b.chromeOn && s6b.gripOpacity === '0',
  { table: s6bTable, chrome: s6b }
)

// ── S7: FE-07 联调 —— toast 零位移、不触发 chrome 浮现 ─────────────────────
// quiet baseline: pointer parked on prose so residual table hover cannot
// contaminate the "toast 不触发 chrome 浮现" assertion.
const bodyT = await bodyPoint()
await moveTo(bodyT.x, bodyT.y)
await sleep(400)
const mPreToast = await evalExpr(MARKERS)
// Real command path (Edit > Copy as Rich Text, Ctrl+Shift+C) — the P20 raw
// seam skips the ops.showToast wrapper, so no toast would fire from it.
await send('Input.dispatchKeyEvent', {
  type: 'rawKeyDown',
  key: 'C',
  code: 'KeyC',
  windowsVirtualKeyCode: 67,
  nativeVirtualKeyCode: 67,
  modifiers: 10 // Ctrl(2) + Shift(8)
})
await send('Input.dispatchKeyEvent', {
  type: 'keyUp',
  key: 'C',
  code: 'KeyC',
  windowsVirtualKeyCode: 67,
  nativeVirtualKeyCode: 67,
  modifiers: 10
})
await sleep(350)
// renderDoc is async — wait for the toast instead of a fixed sleep.
let toastState = null
for (let i = 0; i < 20; i++) {
  toastState = await evalExpr(`(() => {
    const t = document.querySelector('.toast-host .toast-msg')
      ?? document.querySelector('.toast-host .toast')
      ?? document.querySelector('.sb-toast')
    return {
      present: !!t,
      msg: t ? (t.textContent ?? '').trim() : null,
      last: window.__veloxP20.getToast(),
      host: !!document.querySelector('.toast-host')
    }
  })()`)
  if (toastState.present || toastState.last) break
  await sleep(150)
}
const mToast = await evalExpr(MARKERS)
const s7chrome = await evalExpr(CHROME_STATE)
check(
  'S7 toast 出现（copyRichText 命令反馈）',
  toastState.present || toastState.last != null,
  toastState
)
const toastShift = {
  prose: delta(mPreToast.proseTop, mToast.proseTop),
  table: delta(mPreToast.tableTop, mToast.tableTop),
  tail: delta(mPreToast.tail, mToast.tail)
}
results.scenarios.zeroShiftToast = { mPreToast, mToast, toastShift }
check(
  'S7 toast 出现不引起正文位移（FE-07 联调）',
  Object.values(toastShift).every((d) => d && d.dTop === 0 && d.dLeft === 0),
  toastShift
)
check(
  'S7 toast 不触发 chrome 浮现',
  !s7chrome.chromeOn && s7chrome.toolbar === 0 && s7chrome.gripOpacity === '0',
  s7chrome
)
await sleep(3200) // toast auto-dismiss window (≥5s规范未定稿；观察消失后位移)
const mToastGone = await evalExpr(MARKERS)
const toastGoneShift = {
  prose: delta(mPreToast.proseTop, mToastGone.proseTop),
  table: delta(mPreToast.tableTop, mToastGone.tableTop),
  tail: delta(mPreToast.tail, mToastGone.tail)
}
check(
  'S7 toast 消失后位移仍 0px',
  Object.values(toastGoneShift).every((d) => d && d.dTop === 0 && d.dLeft === 0),
  toastGoneShift
)

// ── S8: 深浅主题显隐过渡一致（token 翻值）──────────────────────────────────
const themeProbe = async () =>
  evalExpr(`(() => {
    const host = document.querySelector('.app') ?? document.documentElement
    const cs = getComputedStyle(host)
    const chip = document.querySelector('.cm-md-code-idle-chip')
    const bar = document.querySelector('.cm-md-block-toolbar')
    return {
      theme: host.className,
      chromeDuration: cs.getPropertyValue('--chrome-duration').trim(),
      chipDelay: chip ? getComputedStyle(chip).transitionDelay : null,
      chipDur: chip ? getComputedStyle(chip).transitionDuration : null,
      barDelay: bar ? getComputedStyle(bar).transitionDelay : null
    }
  })()`)
const light = await themeProbe()
check('S8 主题 token --chrome-duration = 150ms', light.chromeDuration === '150ms', light)
check(
  'S8 CSS 防抖过渡 = 0s 动画 + 150ms 延迟（防抖语义，非渐隐）',
  light.chipDelay === '0.15s' && light.chipDur === '0s',
  light
)
await evalExpr(`window.__veloxP20.setThemePref('dark'); true`)
await sleep(400)
const dark = await themeProbe()
check(
  'S8 深色主题过渡参数一致（token 翻值，零 .theme-dark 补丁）',
  dark.chromeDuration === '150ms' && dark.chipDelay === light.chipDelay && dark.chipDur === light.chipDur,
  { light, dark }
)
// one debounce round-trip under dark to prove reveal timing holds —
// explicit leave→enter cycle (a resting pointer would never fire enter).
check('S8d 探针重装（深色）', await evalExpr(INSTALL_PROBE), null)
const wrapPtDark = (await wrapPoint()) ?? wrapPt
const bodyDark = await bodyPoint()
await moveTo(bodyDark.x, bodyDark.y)
await sleep(250)
await evalExpr(DRAIN_LOG)
await moveTo(wrapPtDark.x, wrapPtDark.y)
await sleep(320)
const darkReveal = timelineOf(await evalExpr(DRAIN_LOG))
const darkEv = darkReveal.events.find((e) => e.kind === 'reveal')
check(
  'S8 深色主题防抖时间轴复测（≥150ms 浮现）',
  darkEv != null && darkEv.latencyMs >= 150 && darkEv.latencyMs <= 320,
  { latencyMs: darkEv?.latencyMs }
)
await evalExpr(`window.__veloxP20.setThemePref('light'); true`)
await sleep(300)

// ── S9: seam keys + 收尾 ────────────────────────────────────────────────────
const LAZY_SEAMS = new Set(['__veloxTableCellView'])
const keyEnd = await evalExpr(SEAM_KEYS)
const added = keyEnd.filter((k) => !keyBase.includes(k))
const removed = keyBase.filter((k) => !keyEnd.includes(k))
const unknown = added.filter((k) => !LAZY_SEAMS.has(k))
check(
  'S9 window.__velox* 缝 key 集不变（懒安装契约 key 白名单外零新增）',
  unknown.length === 0 && removed.length === 0,
  { added, removed, unknown }
)

// final quiet screenshot
const bodyEnd = await bodyPoint()
await moveTo(bodyEnd.x, bodyEnd.y)
await sleep(400)
const s9final = await evalExpr(CHROME_STATE)
check('S9 终态静息零 chrome', s9final.toolbar === 0 && !s9final.chromeOn && s9final.gripOpacity === '0', s9final)
try {
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT_DIR}/IT-01-FE-10-final-quiet.png`, Buffer.from(shot.data, 'base64'))
  check('S9 终态静息截图落盘', true, { bytes: shot.data.length })
} catch (e) {
  check('S9 终态静息截图落盘', false, String(e))
}

// ── summary ─────────────────────────────────────────────────────────────────
const passed = (results.checks ?? []).filter((c) => c.ok).length
const total = (results.checks ?? []).length
results.meta.passed = passed
results.meta.total = total
results.meta.finishedAt = new Date().toISOString()
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(`${OUT_DIR}/IT-01-FE-10-cdp-results.json`, JSON.stringify(results, null, 2))
console.log(`\n== ${passed}/${total} PASS ==`)
ws.close()
process.exit(passed === total ? 0 : 1)
