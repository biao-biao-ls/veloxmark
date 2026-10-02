#!/usr/bin/env node
/**
 * IT-03 FE-06 CDP selftest driver — 列表行首拖拽排序 + 任务项勾选。
 *
 * Measures (per tasks/IT-03/FE-06.md 验收阶段 1–3):
 *   S0 seam 前置自检（isWritable 可达、P12/P13/P18/P21 就绪）
 *   S1 hover 把手（UI-IXD-08 判据1 + FE-03 联调）：按需浮现、不常驻、不遮挡正文、
 *      正文位移 0px、快速掠过 0 闪现、移出即隐零残留、impl 截图（把手 + 任务两态）
 *   S2 拖拽排序（AC-OP-16 + UI-IXD-08 判据2）：拖动中插入指示线 + 把手不消失、
 *      同层级换序、缩进/子树不变、toast 精确「已移动列表项（Ctrl+Z 可撤销）」、
 *      一次 Ctrl+Z 逐字节还原、Esc 取消零写入、autosave 落盘
 *   S3 任务勾选（AC-OP-15 + AC-RULE-04 + UI-IXD-09 + PEND-15）：单击 toggle 即时
 *      反馈、其它项不变、全程无 toast、一次 Ctrl+Z 还原、再勾选后 autosave 落盘
 *   S4 单项列表空态（REN-render-zone）：把手灰显 is-disabled、拖不动
 *   S5 只读拦截（AC-ERR-08）：拖拽/勾选被拦、文档逐字节不变、toast 冻结文案；
 *      另存（恢复可写）后拖拽恢复正常
 *   S6 导出一致性（AC-OP-18 列表/任务切片）：renderExportHtml 的行序 + 勾选态
 *      与编辑视图一致
 *
 * Robustness notes (inherited from IT-03-FE-05-cdp-driver.mjs):
 *  - Page.bringToFront + Page.setWebLifecycleState(active) +
 *    Emulation.setFocusEmulationEnabled: an occluded Electron window throttles
 *    timers (hover debounce / autosave debounce would silently stretch).
 *  - Runtime.evaluate always carries a wall-clock timeout.
 *  - 草稿恢复对话框一律点「稍后」——绝不点「丢弃草稿」（调度硬约束）。
 *  - headingFolds persist per-path — loadDoc 后 restoreKeys([])。
 */
import { chmodSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'

const PORT = Number(process.env.FE06_CDP_PORT ?? 9456)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-03-FE-06'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/fe06-list-drag-selftest.md`
const READONLY_PATH = `${FIXTURE_DIR}/fe06-list-readonly-selftest.md`

const TOAST_LIST_MOVED = '已移动列表项（Ctrl+Z 可撤销）'
const TOAST_READONLY = '文件为只读，无法修改，可另存后编辑'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── CDP plumbing (same shape as FE-05 driver, evaluate w/ wall-clock timeout) ─
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
async function moveToPressed(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 })
}
async function pressAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
}
async function releaseAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
}
async function clickAt(x, y) {
  await pressAt(x, y)
  await releaseAt(x, y)
}
async function pressCtrlZ() {
  const mods = 2 // Ctrl
  await send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: 'z', code: 'KeyZ', modifiers: mods,
    windowsVirtualKeyCode: 90, nativeVirtualKeyCode: 90
  })
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'z', code: 'KeyZ', modifiers: mods,
    windowsVirtualKeyCode: 90, nativeVirtualKeyCode: 90
  })
}
async function pressEscape() {
  await send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27
  })
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27
  })
}

async function centerOf(selector) {
  return evalExpr(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      x: +(r.left + r.width / 2).toFixed(2),
      y: +(r.top + r.height / 2).toFixed(2),
      left: +r.left.toFixed(2), top: +r.top.toFixed(2),
      right: +r.right.toFixed(2), bottom: +r.bottom.toFixed(2),
      w: +r.width.toFixed(2), h: +r.height.toFixed(2)
    }
  })()`)
}

/** Rect of the list row whose trimmed text equals (or contains) `snippet`. */
async function rowRectOf(snippet, exact = true) {
  return evalExpr(`(() => {
    const q = ${JSON.stringify(snippet)}
    const rows = [...document.querySelectorAll('.cm-editor .cm-md-list')]
    const el = rows.find((n) => {
      const t = (n.textContent ?? '').trim()
      return ${exact ? 't === q' : 't.includes(q)'}
    })
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      text: (el.textContent ?? '').trim(),
      x: +(r.left + Math.min(24, r.width / 4)).toFixed(2),
      y: +(r.top + r.height / 2).toFixed(2),
      xTop: +(r.left + Math.min(24, r.width / 4)).toFixed(2),
      yTop: +(r.top + r.height * 0.25).toFixed(2),
      yBottom: +(r.top + r.height * 0.75).toFixed(2),
      left: +r.left.toFixed(2), top: +r.top.toFixed(2),
      right: +r.right.toFixed(2), bottom: +r.bottom.toFixed(2),
      w: +r.width.toFixed(2), h: +r.height.toFixed(2)
    }
  })()`)
}

async function waitFor(expr, timeoutMs = 3000, stepMs = 25) {
  const t0 = Date.now()
  for (;;) {
    const v = await evalExpr(expr)
    if (v) return { value: v, waitedMs: Date.now() - t0 }
    if (Date.now() - t0 > timeoutMs) return { value: null, waitedMs: Date.now() - t0 }
    await sleep(stepMs)
  }
}

const HANDLE_PRESENT = `!!document.querySelector('[data-testid="list-drag-handle"]')`
const HANDLE_STATE = `(() => {
  const h = document.querySelector('[data-testid="list-drag-handle"]')
  if (!h) return { present: false }
  const r = h.getBoundingClientRect()
  return {
    present: true,
    disabled: h.getAttribute('data-disabled') === 'true',
    className: h.className,
    title: h.getAttribute('title'),
    ariaLabel: h.getAttribute('aria-label'),
    rect: {
      left: +r.left.toFixed(2), top: +r.top.toFixed(2),
      right: +r.right.toFixed(2), bottom: +r.bottom.toFixed(2),
      w: +r.width.toFixed(2), h: +r.height.toFixed(2)
    }
  }
})()`
const DRAG_SESSION = `(() => ({
  ghost: !!document.querySelector('[data-testid="list-drag-ghost"]'),
  indicator: (() => {
    const el = document.querySelector('[data-testid="list-drop-indicator"]')
    if (!el) return null
    return {
      display: getComputedStyle(el).display,
      w: +el.getBoundingClientRect().width.toFixed(2),
      h: +el.getBoundingClientRect().height.toFixed(2)
    }
  })(),
  handle: !!document.querySelector('[data-testid="list-drag-handle"]')
}))()`

const DIALOG_STATE = `(() => {
  const d = document.querySelector('.dialog-overlay .dialog')
  if (!d) return { present: false }
  return {
    present: true,
    message: d.querySelector('.dialog-message')?.textContent ?? null,
    buttons: [...d.querySelectorAll('.dialog-buttons .dialog-btn')].map((b) => (b.textContent ?? '').trim())
  }
})()`

const TOAST = `document.querySelector('.toast-host .toast-msg')?.textContent ?? document.querySelector('.sb-toast')?.textContent ?? null`
const ANY_TOAST = `!!document.querySelector('.toast-host') || !!document.querySelector('.sb-toast')`
const DOC = `window.__veloxP13 ? window.__veloxP13.getDoc() : (window.__veloxEditor?.view.state.doc.toString() ?? null)`

const BODY_RECTS = `(() => {
  return [...document.querySelectorAll('.cm-line')].map((l) => {
    const r = l.getBoundingClientRect()
    return [
      l.textContent.slice(0, 24),
      +r.left.toFixed(2), +r.top.toFixed(2),
      +r.right.toFixed(2), +r.bottom.toFixed(2)
    ]
  })
})()`

function maxShift(a, b) {
  if (!a || !b || a.length !== b.length) return null
  let worst = 0
  for (let i = 0; i < a.length; i++) {
    for (let k = 1; k <= 4; k++) worst = Math.max(worst, Math.abs(a[i][k] - b[i][k]))
  }
  return worst
}

function rectsOverlap(a, b) {
  if (!a || !b) return null
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

const ITEM_RE = /^([ \t]*)([-*+]|\d+[.)])[ \t]+/
/** text → indent prefix for every list-item line (indent invariance proof). */
function itemIndents(doc) {
  const map = {}
  for (const line of (doc ?? '').split('\n')) {
    const m = ITEM_RE.exec(line)
    if (!m) continue
    const text = line.slice(m[0].length).replace(/^\[[ xX]\]\s*/, '').trim()
    map[text] = m[1].replace(/\t/g, '  ')
  }
  return map
}

/** Ordered list-item texts of a .md doc (marker + task box stripped). */
function itemOrder(doc) {
  const out = []
  for (const line of (doc ?? '').split('\n')) {
    const m = ITEM_RE.exec(line)
    if (!m) continue
    out.push(line.slice(m[0].length).replace(/^\[[ xX]\]\s*/, '').trim())
  }
  return out
}

/** Parse export <li> stream: [{text, checked}] in document order. */
function parseExportItems(html) {
  const items = []
  const re = /<li>([\s\S]*?)(?=<li>|<\/ul>|<\/ol>|$)/g
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const seg = m[1]
    const input = /<input type="checkbox" disabled( checked)?>/.exec(seg)
    const text = seg
      .replace(/<input type="checkbox"[^>]*>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .trim()
    items.push({ text, checked: !!input && input[1] === ' checked' })
  }
  return items
}

const results = { meta: { port: PORT, startedAt: new Date().toISOString() }, scenarios: {} }

const check = (name, ok, detail) => {
  const row = { name, ok: !!ok, detail }
  results.checks = results.checks ?? []
  results.checks.push(row)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail) : ''}`)
  return !!ok
}

/**
 * Dismiss any modal dialog. 草稿恢复对话框一律点「稍后」——绝不丢弃草稿（调度硬约束）。
 * Alert-style dialogs fall back to their single confirm button.
 */
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

async function loadDocExpanded(path, content, minRows = 9) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await dismissAnyDialog()
    await evalExpr(`(() => {
      window.__veloxP12.loadDoc(${JSON.stringify(content)}, ${JSON.stringify(path)})
      return true
    })()`)
    await sleep(900)
    await evalExpr(`(() => { window.__veloxP18?.restoreKeys([]); return true })()`)
    await sleep(300)
    const state = await evalExpr(`({
      fp: window.__veloxP12.getFilePath(),
      folded: window.__veloxP18 ? window.__veloxP18.getFoldedKeys().length : -1,
      rows: document.querySelectorAll('.cm-editor .cm-md-list').length
    })`)
    if (state.fp === path && state.folded === 0 && state.rows >= minRows) return state
  }
  const last = await evalExpr(`({
    fp: window.__veloxP12.getFilePath(),
    folded: window.__veloxP18 ? window.__veloxP18.getFoldedKeys().length : -1,
    rows: document.querySelectorAll('.cm-editor .cm-md-list').length
  })`)
  throw new Error(`loadDocExpanded(${path}) did not settle: ${JSON.stringify(last)}`)
}

/** Hover a list row (exact item text) until the handle appears; return its state. */
async function hoverRowHandle(itemText) {
  await moveTo(neutral.x, neutral.y)
  await sleep(400)
  const row = await rowRectOf(itemText, true)
  if (!row) return { row: null, handle: null, appeared: null }
  await moveTo(row.x, row.y)
  const appeared = await waitFor(HANDLE_PRESENT, 3000)
  await sleep(120) // total dwell ≥250ms — well past the 150ms debounce floor
  const handle = await evalExpr(HANDLE_STATE)
  return { row, handle, appeared }
}

/** Full pointer drag from the row handle to (tx, ty); samples mid-drag state. */
async function dragRowTo(fromText, targetYMode, targetText) {
  const h = await hoverRowHandle(fromText)
  if (!h.handle?.present) return { ok: false, reason: 'handle-not-shown', h }
  const startHandle = h.handle
  await pressAt(startHandle.rect.left + startHandle.rect.w / 2, startHandle.rect.top + startHandle.rect.h / 2)
  await sleep(60)
  const targetRow = await rowRectOf(targetText, true)
  if (!targetRow) {
    await releaseAt(neutral.x, neutral.y)
    return { ok: false, reason: 'target-row-missing', h }
  }
  const tx = targetRow.xTop
  const ty = targetYMode === 'before' ? targetRow.yTop : targetRow.yBottom
  // Two intermediate moves so the ghost/indicator ride the pointer like a real drag.
  await moveToPressed((startHandle.rect.left + tx) / 2, (startHandle.rect.top + ty) / 2)
  await sleep(40)
  await moveToPressed(tx, ty)
  await sleep(80)
  const mid = await evalExpr(DRAG_SESSION)
  const midHandle = await evalExpr(HANDLE_STATE)
  await releaseAt(tx, ty)
  return { ok: true, startHandle, targetRow, targetPoint: { x: tx, y: ty }, mid, midHandle }
}

// ── fixtures ──────────────────────────────────────────────────────────────
// 夹具刻意用非空段落分隔三个列表：CommonMark 语义下同缩进、仅空行相连的
// bullet 是同一个 loose list（同一重排组）。要验证「单项列表灰显」必须让
// only-item 成为真·单例列表（块级段落隔断），否则它属于 7 兄弟的大组。
const HEAD = '# FE-06 selftest'
const SECTIONS = {
  taskLead: 'Task list below.',
  singletonLead: 'Singleton below.',
  tail: 'Tail paragraph for neutral clicks.'
}

function fixtureWith(list1Head, tasks, singletonMarker) {
  return [
    HEAD,
    '',
    list1Head,
    '',
    SECTIONS.taskLead,
    '',
    tasks,
    '',
    SECTIONS.singletonLead,
    '',
    singletonMarker,
    '',
    SECTIONS.tail
  ].join('\n')
}

const TASKS_UNCHECKED = '- [x] review PRs\n- [ ] write docs\n- [ ] ship release'
const TASKS_CHECKED = '- [x] review PRs\n- [x] write docs\n- [ ] ship release'

const LIST1_BASE = '- alpha\n  - alpha-a1\n  - alpha-a2\n- beta\n- gamma'
const LIST1_DRAG1 = '- gamma\n- alpha\n  - alpha-a1\n  - alpha-a2\n- beta'
const LIST1_DRAG2 = '- alpha\n  - alpha-a1\n  - alpha-a2\n- gamma\n- beta'

const FIXTURE = fixtureWith(LIST1_BASE, TASKS_UNCHECKED, '- only-item')
const FIXTURE_DRAG1 = fixtureWith(LIST1_DRAG1, TASKS_UNCHECKED, '- only-item')
const FIXTURE_DRAG2 = fixtureWith(LIST1_DRAG2, TASKS_UNCHECKED, '- only-item')
const FIXTURE_FINAL = fixtureWith(LIST1_DRAG2, TASKS_CHECKED, '- only-item')
/** gamma→alpha 前 之后的终态（S5 另存恢复可写后的预期：任务态保持已勾选）。 */
const FIXTURE_FINAL_DRAG1 = fixtureWith(LIST1_DRAG1, TASKS_CHECKED, '- only-item')

// ── setup ─────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true })
await send('Page.enable')
await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })

// Reload so the page runs the current out/renderer build (ListDragHandle
// registration + TaskWidget click gate live in the new chunks).
await send('Page.reload', { ignoreCache: true })
await waitFor('window.__veloxP12 && window.__veloxP13 && window.__veloxP18 && window.__veloxP21', 15000, 100)

// A leftover draft can boot a modal recovery dialog — dismiss with 「稍后」.
const startupDialog = await dismissAnyDialog()
if (startupDialog) {
  console.log('startup dialog dismissed:', JSON.stringify(startupDialog))
  results.meta.startupDialog = startupDialog
}
await sleep(500)
const lateDialog = await dismissAnyDialog()
if (lateDialog) {
  console.log('late dialog dismissed:', JSON.stringify(lateDialog))
  results.meta.lateDialog = lateDialog
}

writeFileSync(FIXTURE_PATH, FIXTURE, 'utf-8')

// ── S0: seam 前置自检 ─────────────────────────────────────────────────────
{
  const probe = await evalExpr(`window.api.isWritable(${JSON.stringify(FIXTURE_PATH)}).then(
    (v) => ({ ok: true, v }),
    (e) => ({ ok: false, err: String(e) })
  )`)
  results.meta.isWritableProbe = probe
  if (!probe.ok && /No handler registered/i.test(probe.err ?? '')) {
    console.error('LAUNCH_ERROR: window.api.isWritable has no handler — stale Electron build (pre-AC-ERR-08 IPC).')
    results.meta.LAUNCH_ERROR = probe.err
    results.meta.finishedAt = new Date().toISOString()
    writeFileSync(`${OUT_DIR}/IT-03-FE-06-cdp-data.json`, JSON.stringify(results, null, 2))
    process.exit(3)
  }
  if (!probe.ok) {
    console.error('LAUNCH_ERROR: window.api.isWritable rejected:', probe.err)
    results.meta.LAUNCH_ERROR = probe.err
    results.meta.finishedAt = new Date().toISOString()
    writeFileSync(`${OUT_DIR}/IT-03-FE-06-cdp-data.json`, JSON.stringify(results, null, 2))
    process.exit(3)
  }
  check('S0 isWritable IPC 可达（非 stale 构建）', probe.ok === true, probe)
  const seams = await evalExpr(`({
    p12: typeof window.__veloxP12?.loadDoc === 'function',
    p13: typeof window.__veloxP13?.getDoc === 'function',
    p18: typeof window.__veloxP18?.restoreKeys === 'function',
    p21: typeof window.__veloxP21?.renderExportHtml === 'function'
  })`)
  check('S0 e2e 缝 P12/P13/P18/P21 就绪', seams.p12 && seams.p13 && seams.p18 && seams.p21, seams)
  results.meta.seams = seams
}

await loadDocExpanded(FIXTURE_PATH, FIXTURE, 9)
await dismissAnyDialog()

// Neutral point inside the editor but off every hover zone / fold control.
const neutral = await evalExpr(`(() => {
  for (let y = 40; y < window.innerHeight; y += 12) {
    for (let x = 40; x < window.innerWidth; x += 12) {
      const el = document.elementFromPoint(x, y)
      if (!el) continue
      if (el.closest('.cm-md-image-wrap, .cm-md-link, .cm-md-list, .render-float, .cm-md-img-resize')) continue
      if (el.closest('.cm-md-heading, .cm-md-fold-placeholder, .cm-gutters, .cm-fold-gutter, .cm-md-fold-gutter, .cm-md-fold-arrow')) continue
      if (el.closest('.cm-editor')) return { x, y }
    }
  }
  const ed = document.querySelector('.cm-editor')
  const r = ed ? ed.getBoundingClientRect() : { left: 0, top: 0 }
  return { x: Math.round(r.left + 8), y: Math.round(r.top + 8) }
})()`)
results.neutral = neutral
console.log('neutral', JSON.stringify(neutral))

// ── S1: hover 把手（UI-IXD-08 判据1 + FE-03 联调）─────────────────────────
{
  await moveTo(neutral.x, neutral.y)
  await sleep(500)
  const idle = await evalExpr(`({
    handles: document.querySelectorAll('[data-testid="list-drag-handle"]').length,
    floats: document.querySelectorAll('.render-float').length,
    idleClass: !!document.querySelector('.cm-md-drag-handle.is-idle')
  })`)
  check('S1 静置不渲染把手（按需浮现、无常驻占位）', idle.handles === 0 && idle.floats === 0, idle)

  const before = await evalExpr(BODY_RECTS)
  const h = await hoverRowHandle('alpha')
  check('S1 hover 行首把手浮现（≥150ms debounce 之上）', h.appeared?.value === true, h.appeared)
  check('S1 把手 testid 为 list-drag-handle', h.handle?.present === true, h.handle?.present)
  check('S1 把手 title/aria 为「拖拽排序」',
    h.handle?.title === '拖拽排序' && h.handle?.ariaLabel === '拖拽排序',
    { title: h.handle?.title, ariaLabel: h.handle?.ariaLabel })
  check('S1 可拖行把手非灰显（draggable）', h.handle?.present && h.handle.disabled === false, h.handle?.className)
  const overlapRow = rectsOverlap(h.handle?.rect, {
    left: h.row.left, top: h.row.top, right: h.row.right, bottom: h.row.bottom
  })
  check('S1 把手不遮挡行文本（UI-IXD-08）', overlapRow === false, { handle: h.handle?.rect, row: h.row })
  const after = await evalExpr(BODY_RECTS)
  const shift = maxShift(before, after)
  check('S1 浮现前后正文位移 0px（FE-03 联调零布局位移）', shift === 0, { lines: before?.length, shift })

  // Hide discipline: leave → gone within ~600ms + zero residue.
  await moveTo(neutral.x, neutral.y)
  const hidden = await waitFor(`!document.querySelector('[data-testid="list-drag-handle"]')`, 800, 20)
  check('S1 移出后 ~600ms 内把手消失', hidden.value === true && hidden.waitedMs <= 600 + 25, { hideMs: hidden.waitedMs })
  const residue = await evalExpr(`({
    handles: document.querySelectorAll('[data-testid="list-drag-handle"]').length,
    floats: document.querySelectorAll('.render-float').length
  })`)
  check('S1 移出后零残留（把手/浮层均卸载）', residue.handles === 0 && residue.floats === 0, residue)

  // Rapid pass-over across ≥3 list rows: 0 flashes (<150ms dwell per point).
  const rowPoints = await evalExpr(`[...document.querySelectorAll('.cm-editor .cm-md-list')].map((el) => {
    const r = el.getBoundingClientRect()
    return { x: +(r.left + Math.min(24, r.width / 4)).toFixed(2), y: +(r.top + r.height / 2).toFixed(2), text: (el.textContent ?? '').trim() }
  })`)
  check('S1 快速掠过目标行 ≥3', (rowPoints ?? []).length >= 3, rowPoints?.length)
  let flashes = 0
  const swipeSamples = []
  await moveTo(neutral.x, neutral.y)
  await sleep(50)
  for (const pt of rowPoints.slice(0, 6)) {
    await moveTo(pt.x, pt.y)
    const present = await evalExpr(HANDLE_PRESENT)
    swipeSamples.push({ text: pt.text, present })
    if (present) flashes++
  }
  check('S1 快速掠过列表行 0 闪现（UI-IXD-08 + FE-03）', flashes === 0, { flashes, swipeSamples })

  // Impl shot: hover a task row — handle + checked (strikethrough) + unchecked
  // in one frame (design ui_06 block C region).
  const h2 = await hoverRowHandle('write docs')
  check('S1 任务行 hover 把手亦浮现', h2.appeared?.value === true, h2.appeared)
  const clip = await evalExpr(`(() => {
    const rows = [...document.querySelectorAll('.cm-editor .cm-md-list')]
    const first = rows[0]?.getBoundingClientRect()
    const last = rows[rows.length - 1]?.getBoundingClientRect()
    const handle = document.querySelector('[data-testid="list-drag-handle"]')?.getBoundingClientRect()
    const pad = 48
    const left = Math.max(0, Math.min(first?.left ?? 1e9, handle?.left ?? 1e9) - pad)
    const top = Math.max(0, (first?.top ?? 0) - pad)
    const right = Math.min(document.documentElement.clientWidth, Math.max(first?.right ?? 0, last?.right ?? 0, handle?.right ?? 0) + pad)
    const bottom = Math.min(document.documentElement.clientHeight, (last?.bottom ?? 0) + pad)
    return {
      x: +left.toFixed(2), y: +top.toFixed(2),
      width: +Math.max(1, right - left).toFixed(2),
      height: +Math.max(1, bottom - top).toFixed(2),
      scrollX: window.scrollX, scrollY: window.scrollY
    }
  })()`)
  let shot
  try {
    shot = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      clip: { x: clip.x + clip.scrollX, y: clip.y + clip.scrollY, width: clip.width, height: clip.height, scale: 1 }
    })
  } catch (e) {
    console.log('clip screenshot failed, falling back to full page:', String(e).slice(0, 200))
    shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  }
  writeFileSync(`${OUT_DIR}/IT-03-FE-06-impl.png`, Buffer.from(shot.data, 'base64'))
  console.log('impl screenshot →', `${OUT_DIR}/IT-03-FE-06-impl.png`)

  // Both task states visible in the shot region (checked line strikes through).
  const taskStates = await evalExpr(`[...document.querySelectorAll('.cm-editor .cm-md-task-item')].map((el) => ({
    text: (el.textContent ?? '').trim(),
    done: el.classList.contains('cm-md-task-done'),
    checked: !!el.querySelector('[data-testid="task-checkbox"]')?.checked
  }))`)
  check('S1 截图区域含任务两态（已勾选删除线 + 未勾选）',
    (taskStates ?? []).some((t) => t.done && t.checked) && (taskStates ?? []).some((t) => !t.done && !t.checked),
    taskStates)

  await moveTo(neutral.x, neutral.y)
  await sleep(500)
  results.scenarios.s1 = { idle, appeared: h.appeared?.waitedMs, handle: h.handle, row: h.row, overlapRow, shift, residue, swipeSamples, flashes, clip, taskStates }
}

// ── S2: 拖拽排序（AC-OP-16 + UI-IXD-08 判据2）────────────────────────────
{
  // (a) Esc 取消：ghost/指示线清场、零写入。
  const hEsc = await hoverRowHandle('gamma')
  check('S2 Esc 取消前把手可见', hEsc.appeared?.value === true, hEsc.appeared)
  const docEscBefore = await evalExpr(DOC)
  await pressAt(hEsc.handle.rect.left + hEsc.handle.rect.w / 2, hEsc.handle.rect.top + hEsc.handle.rect.h / 2)
  await sleep(60)
  await moveToPressed(neutral.x, (hEsc.row.top + hEsc.row.bottom) / 2)
  await sleep(60)
  const escMid = await evalExpr(DRAG_SESSION)
  check('S2 拖动会话中 ghost + 插入指示线可见（UI-IXD-08）',
    escMid.ghost === true && !!escMid.indicator && escMid.indicator.display !== 'none' && escMid.handle === true,
    escMid)
  await pressEscape()
  await sleep(200)
  const escAfter = await evalExpr(DRAG_SESSION)
  check('S2 Esc 取消后 ghost/指示线清场', escAfter.ghost === false && escAfter.indicator === null, escAfter)
  check('S2 Esc 取消零写入', (await evalExpr(DOC)) === docEscBefore, null)

  // (b) 拖拽 gamma → alpha 之前：同层级换序、子树/缩进不变、toast + 一次 Ctrl+Z。
  const docBefore = await evalExpr(DOC)
  check('S2 拖拽前 .md 基线与夹具一致', docBefore === FIXTURE, null)
  const drag1 = await dragRowTo('gamma', 'before', 'alpha')
  check('S2 拖拽会话建立（gamma 把手）', drag1.ok === true, drag1.reason ?? drag1.mid)
  check('S2 落点前把手稳定不消失（FE-03 pin）',
    drag1.mid?.handle === true && drag1.midHandle?.present === true,
    { mid: drag1.mid, midHandle: drag1.midHandle })
  check('S2 落点前插入指示线可见（UI-IXD-08 判据2）',
    !!drag1.mid?.indicator && drag1.mid.indicator.display !== 'none',
    drag1.mid?.indicator)

  const toastDrop = await waitFor(`(() => { const t = ${TOAST}; return t ?? null })()`, 2500)
  check('S2 toast 精确为「已移动列表项（Ctrl+Z 可撤销）」(AC-OP-16)',
    toastDrop.value === TOAST_LIST_MOVED, toastDrop.value)

  const docAfter = await evalExpr(DOC)
  check('S2 落位后行序：gamma 上移到 alpha 前（同层级）', docAfter === FIXTURE_DRAG1, {
    expected: itemOrder(FIXTURE_DRAG1),
    actual: itemOrder(docAfter)
  })
  const indentsBefore = itemIndents(docBefore)
  const indentsAfter = itemIndents(docAfter)
  const indentStable =
    Object.keys(indentsBefore).length === Object.keys(indentsAfter).length &&
    Object.keys(indentsBefore).every((k) => indentsAfter[k] === indentsBefore[k])
  check('S2 全部列表行缩进不变（层级保持）', indentStable,
    { before: indentsBefore, after: indentsAfter })
  check('S2 子树整体随行移动（alpha-a1/a2 跟随 alpha）',
    itemOrder(docAfter).join('>') === itemOrder(FIXTURE_DRAG1).join('>'), itemOrder(docAfter))

  await evalExpr(`window.__veloxEditor.view.focus(); true`)
  await pressCtrlZ()
  await sleep(400)
  const docUndone = await evalExpr(DOC)
  check('S2 一次 Ctrl+Z 逐字节还原（AC-OP-16 单步 undo）', docUndone === docBefore, null)

  // (c) 反向拖拽 beta → gamma 之后 + autosave 落盘。
  const drag2 = await dragRowTo('beta', 'after', 'gamma')
  check('S2 反向拖拽会话建立', drag2.ok === true, drag2.reason ?? drag2.mid)
  const toastDrop2 = await waitFor(`(() => { const t = ${TOAST}; return t ?? null })()`, 2500)
  check('S2 反向拖拽 toast 同文案', toastDrop2.value === TOAST_LIST_MOVED, toastDrop2.value)
  const docAfter2 = await evalExpr(DOC)
  check('S2 反向落位行序（beta 移到 gamma 后）', docAfter2 === FIXTURE_DRAG2, {
    expected: itemOrder(FIXTURE_DRAG2),
    actual: itemOrder(docAfter2)
  })
  const indents2 = itemIndents(docAfter2)
  check('S2 反向拖拽缩进仍不变',
    Object.keys(indentsBefore).every((k) => indents2[k] === indentsBefore[k]), indents2)

  // autosave (debounce 3s) 落盘。
  await sleep(4200)
  const diskAfter = readFileSync(FIXTURE_PATH, 'utf-8')
  const lastSave = await evalExpr(`window.__veloxP12.getLastAutoSaveAt ? window.__veloxP12.getLastAutoSaveAt() : null`)
  check('S2 autosave 已落盘且与编辑器一致（AC-OP-16 落盘）', diskAfter === docAfter2 && diskAfter === FIXTURE_DRAG2, {
    matchesDoc: diskAfter === docAfter2,
    matchesExpected: diskAfter === FIXTURE_DRAG2,
    lastAutoSaveAt: lastSave
  })

  results.scenarios.s2 = {
    escMid, escAfter,
    drag1: { mid: drag1.mid, midHandle: drag1.midHandle, targetPoint: drag1.targetPoint },
    toastDrop: toastDrop.value,
    docBefore, docAfter, docUndone,
    indentsBefore, indentsAfter,
    drag2: { mid: drag2.mid, targetPoint: drag2.targetPoint },
    toastDrop2: toastDrop2.value,
    docAfter2, diskAfter, lastSave
  }
}

// ── S3: 任务勾选（AC-OP-15 + AC-RULE-04 + UI-IXD-09 + PEND-15）───────────
{
  // Toast from S2 must expire first — PEND-15 requires a toast-free operation.
  await waitFor(`!(${ANY_TOAST})`, 7000, 100)
  const toastBaseline = await evalExpr(TOAST)
  check('S3 勾选前 toast 已清空（PEND-15 无 toast 断言基线）', toastBaseline === null, toastBaseline)

  const docBefore = await evalExpr(DOC)
  const tasksBefore = await evalExpr(`[...document.querySelectorAll('.cm-editor .cm-md-task-item')].map((el) => ({
    text: (el.textContent ?? '').trim(),
    done: el.classList.contains('cm-md-task-done'),
    checked: !!el.querySelector('[data-testid="task-checkbox"]')?.checked
  }))`)

  // Click the UNCHECKED one (write docs) — re-measure inside its row.
  const cbTarget = await evalExpr(`(() => {
    const row = [...document.querySelectorAll('.cm-editor .cm-md-task-item')]
      .find((n) => (n.textContent ?? '').trim() === 'write docs')
    const input = row?.querySelector('[data-testid="task-checkbox"]')
    if (!input) return null
    const r = input.getBoundingClientRect()
    return {
      x: +(r.left + r.width / 2).toFixed(2),
      y: +(r.top + r.height / 2).toFixed(2),
      checkedBefore: input.checked
    }
  })()`)
  check('S3 未勾选任务框可定位（write docs）', cbTarget != null && cbTarget.checkedBefore === false, cbTarget)

  const tClick = Date.now()
  await clickAt(cbTarget.x, cbTarget.y)
  const flipped = await waitFor(`(() => {
    const row = [...document.querySelectorAll('.cm-editor .cm-md-task-item')]
      .find((n) => (n.textContent ?? '').trim() === 'write docs')
    const input = row?.querySelector('[data-testid="task-checkbox"]')
    return input && input.checked && row.classList.contains('cm-md-task-done') ? {
      checked: input.checked,
      done: row.classList.contains('cm-md-task-done')
    } : null
  })()`, 1000)
  check('S3 单击即时反馈：勾选 + 删除线（UI-IXD-09）',
    flipped.value?.checked === true && flipped.value?.done === true,
    { waitedMs: flipped.waitedMs, value: flipped.value })

  const docAfter = await evalExpr(DOC)
  check('S3 .md 写回 [ ]→[x]（AC-OP-15）', docAfter === FIXTURE_FINAL, {
    expectedLine: '- [x] write docs',
    hasIt: (docAfter ?? '').includes('- [x] write docs')
  })
  const tasksAfter = await evalExpr(`[...document.querySelectorAll('.cm-editor .cm-md-task-item')].map((el) => ({
    text: (el.textContent ?? '').trim(),
    done: el.classList.contains('cm-md-task-done'),
    checked: !!el.querySelector('[data-testid="task-checkbox"]')?.checked
  }))`)
  const othersStable =
    (tasksBefore ?? []).filter((t) => t.text !== 'write docs').every((t) => {
      const now = (tasksAfter ?? []).find((u) => u.text === t.text)
      return now && now.checked === t.checked && now.done === t.done
    })
  check('S3 其它任务项状态不变', othersStable, { before: tasksBefore, after: tasksAfter })
  check('S3 展示态与源一致（AC-RULE-04：唯一真源）',
    (tasksAfter ?? []).every((t) => t.checked === (docAfter ?? '').includes(`- [x] ${t.text}`)),
    tasksAfter)

  // PEND-15: no toast across the whole toggle window.
  const toastSamples = []
  for (let i = 0; i < 5; i++) {
    toastSamples.push(await evalExpr(ANY_TOAST))
    await sleep(160)
  }
  check('S3 勾选全程无 toast 弹出（PEND-15 显式豁免）', toastSamples.every((s) => s === false), toastSamples)

  // One Ctrl+Z restores.
  await evalExpr(`window.__veloxEditor.view.focus(); true`)
  await pressCtrlZ()
  await sleep(400)
  const docUndone = await evalExpr(DOC)
  check('S3 一次 Ctrl+Z 还原 [ ]（AC-OP-15 单步 undo）', docUndone === docBefore, null)

  // Re-toggle and prove autosave lands the checked state on disk.
  const cbTarget2 = await evalExpr(`(() => {
    const row = [...document.querySelectorAll('.cm-editor .cm-md-task-item')]
      .find((n) => (n.textContent ?? '').trim() === 'write docs')
    const input = row?.querySelector('[data-testid="task-checkbox"]')
    if (!input) return null
    const r = input.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2), checked: input.checked }
  })()`)
  await clickAt(cbTarget2.x, cbTarget2.y)
  const reFlipped = await waitFor(`(() => {
    const row = [...document.querySelectorAll('.cm-editor .cm-md-task-item')]
      .find((n) => (n.textContent ?? '').trim() === 'write docs')
    const input = row?.querySelector('[data-testid="task-checkbox"]')
    return input && input.checked ? true : null
  })()`, 1000)
  check('S3 再次勾选生效', reFlipped.value === true, reFlipped)
  const docFinal = await evalExpr(DOC)
  check('S3 终态 .md 含 - [x] write docs', docFinal === FIXTURE_FINAL, null)

  await sleep(4200)
  const diskAfter = readFileSync(FIXTURE_PATH, 'utf-8')
  check('S3 勾选结果 autosave 落盘（AC-OP-15 落盘）', diskAfter === docFinal && diskAfter === FIXTURE_FINAL, {
    matchesDoc: diskAfter === docFinal,
    matchesExpected: diskAfter === FIXTURE_FINAL
  })
  results.scenarios.s3 = {
    toastBaseline, tasksBefore, tasksAfter, flippedMs: flipped.waitedMs,
    toastSamples, docBefore, docAfter, docUndone, docFinal, diskAfter
  }
}

// ── S4: 单项列表空态（把手灰显、拖不动）──────────────────────────────────
{
  const h = await hoverRowHandle('only-item')
  check('S4 单项列表把手仍浮现', h.appeared?.value === true, h.appeared)
  check('S4 单项列表把手灰显（is-disabled + data-disabled）',
    h.handle?.present === true && h.handle.disabled === true && /is-disabled/.test(h.handle.className ?? ''),
    h.handle)
  const docBefore = await evalExpr(DOC)
  await pressAt(h.handle.rect.left + h.handle.rect.w / 2, h.handle.rect.top + h.handle.rect.h / 2)
  await sleep(80)
  const session = await evalExpr(DRAG_SESSION)
  check('S4 灰显把手不启动拖拽会话（无 ghost/指示线）',
    session.ghost === false && session.indicator === null, session)
  await moveToPressed(neutral.x, neutral.y)
  await releaseAt(neutral.x, neutral.y)
  await sleep(300)
  check('S4 拖拽尝试零写入', (await evalExpr(DOC)) === docBefore, null)
  results.scenarios.s4 = { handle: h.handle, session }
}

// ── S6: 导出一致性（AC-OP-18 列表/任务切片）──────────────────────────────
{
  const html = await evalExpr(`window.__veloxP21.renderExportHtml()`)
  const exportItems = parseExportItems(html ?? '')
  const expectedItems = itemOrder(FIXTURE_FINAL).map((text) => ({
    text,
    checked: ['- [x] review PRs', '- [x] write docs'].some((s) => s.endsWith(` ${text}`))
  }))
  check('S6 导出行序与编辑视图一致（AC-OP-18）',
    JSON.stringify(exportItems.map((i) => i.text)) === JSON.stringify(expectedItems.map((i) => i.text)),
    { export: exportItems.map((i) => i.text), expected: expectedItems.map((i) => i.text) })
  check('S6 导出任务勾选态与编辑视图一致（AC-OP-18）',
    JSON.stringify(exportItems.map((i) => i.checked)) === JSON.stringify(expectedItems.map((i) => i.checked)),
    { export: exportItems.map((i) => i.checked), expected: expectedItems.map((i) => i.checked) })
  const domOrder = await evalExpr(`[...document.querySelectorAll('.cm-editor .cm-md-list')].map((el) => (el.textContent ?? '').trim())`)
  check('S6 编辑视图行序与 .md 源一致',
    JSON.stringify(domOrder) === JSON.stringify(itemOrder(FIXTURE_FINAL)),
    { domOrder, docOrder: itemOrder(FIXTURE_FINAL) })
  results.scenarios.s6 = { exportItems, expectedItems, domOrder }
}

// ── S5: 只读拦截（AC-ERR-08）─────────────────────────────────────────────
{
  try { chmodSync(READONLY_PATH, 0o666) } catch { /* absent */ }
  writeFileSync(READONLY_PATH, FIXTURE_FINAL, 'utf-8')
  chmodSync(READONLY_PATH, 0o444)
  await loadDocExpanded(READONLY_PATH, FIXTURE_FINAL, 9)

  const docBefore = await evalExpr(DOC)
  const writableProbe = await evalExpr(`window.api.isWritable(${JSON.stringify(READONLY_PATH)}).then(
    (v) => ({ ok: true, v }), (e) => ({ ok: false, err: String(e) })
  )`)
  check('S5 只读探针报告不可写', writableProbe.ok === true && writableProbe.v === false, writableProbe)
  if (!writableProbe.ok && /No handler registered/i.test(writableProbe.err ?? '')) {
    console.error('LAUNCH_ERROR: window.api.isWritable has no handler — stale Electron build')
    results.meta.LAUNCH_ERROR = writableProbe.err
    results.meta.finishedAt = new Date().toISOString()
    writeFileSync(`${OUT_DIR}/IT-03-FE-06-cdp-data.json`, JSON.stringify(results, null, 2))
    process.exit(3)
  }

  // Drag refused.
  const dragR = await dragRowTo('gamma', 'before', 'alpha')
  check('S5 只读下拖拽会话仍可建立（提交时闸门）', dragR.ok === true, dragR.reason ?? dragR.mid)
  const toastDrag = await waitFor(`(() => { const t = ${TOAST}; return t ?? null })()`, 2500)
  check('S5 只读拖拽 toast 精确为冻结文案（AC-ERR-08）',
    toastDrag.value === TOAST_READONLY, toastDrag.value)
  check('S5 只读拖拽零写入（文档逐字节不变）', (await evalExpr(DOC)) === docBefore, null)

  // Checkbox refused.
  const cbTarget = await evalExpr(`(() => {
    const row = [...document.querySelectorAll('.cm-editor .cm-md-task-item')]
      .find((n) => (n.textContent ?? '').trim() === 'write docs')
    const input = row?.querySelector('[data-testid="task-checkbox"]')
    if (!input) return null
    const r = input.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2), checked: input.checked }
  })()`)
  await clickAt(cbTarget.x, cbTarget.y)
  await sleep(500)
  const toastCheck = await evalExpr(TOAST)
  check('S5 只读勾选 toast 为冻结文案（AC-ERR-08）', toastCheck === TOAST_READONLY, toastCheck)
  const docAfter = await evalExpr(DOC)
  check('S5 只读勾选零写入 + 勾选态不闪变（AC-RULE-04）', docAfter === docBefore, null)
  const cbStill = await evalExpr(`(() => {
    const row = [...document.querySelectorAll('.cm-editor .cm-md-task-item')]
      .find((n) => (n.textContent ?? '').trim() === 'write docs')
    const input = row?.querySelector('[data-testid="task-checkbox"]')
    return input ? input.checked : null
  })()`)
  check('S5 只读拒绝后展示态仍与源一致（未勾选保持）', cbStill === cbTarget.checked, { before: cbTarget.checked, after: cbStill })

  // 另存（恢复可写）后编辑恢复。
  chmodSync(READONLY_PATH, 0o666)
  const probeWritable = await evalExpr(`window.api.isWritable(${JSON.stringify(READONLY_PATH)}).then((v) => v)`)
  check('S5 另存后探针可写', probeWritable === true, probeWritable)
  await loadDocExpanded(READONLY_PATH, FIXTURE_FINAL, 9)
  const dragOk = await dragRowTo('gamma', 'before', 'alpha')
  check('S5 另存后拖拽恢复正常', dragOk.ok === true, dragOk.reason ?? dragOk.mid)
  const toastOk = await waitFor(`(() => { const t = ${TOAST}; return t ?? null })()`, 2500)
  check('S5 另存后 toast 恢复为回执文案', toastOk.value === TOAST_LIST_MOVED, toastOk.value)
  const docAfterSaveAs = await evalExpr(DOC)
  check('S5 另存后拖拽确实写入', docAfterSaveAs === FIXTURE_FINAL_DRAG1, {
    expected: itemOrder(FIXTURE_FINAL_DRAG1),
    actual: itemOrder(docAfterSaveAs)
  })

  results.scenarios.s5 = {
    writableProbe, toastDrag, toastCheck, cbStill,
    probeWritable, toastOk: toastOk.value, docAfterSaveAs
  }
}

// ── teardown ─────────────────────────────────────────────────────────────
try { chmodSync(READONLY_PATH, 0o666) } catch { /* best-effort */ }
try { rmSync(READONLY_PATH, { force: true }) } catch { /* best-effort */ }
try { chmodSync(FIXTURE_PATH, 0o666) } catch { /* best-effort */ }
try { rmSync(FIXTURE_PATH, { force: true }) } catch { /* best-effort */ }
// Leave the editor unfolded — fold keys persist per path in the session store.
try {
  await evalExpr(`(() => { window.__veloxP18?.restoreKeys([]); return true })()`)
} catch { /* best-effort */ }

results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-03-FE-06-cdp-data.json`, JSON.stringify(results, null, 2))

const failed = (results.checks ?? []).filter((c) => !c.ok)
console.log(`\n==== ${results.checks.length - failed.length}/${results.checks.length} checks passed ====`)
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' | '))
  process.exitCode = 1
}
ws.close()
