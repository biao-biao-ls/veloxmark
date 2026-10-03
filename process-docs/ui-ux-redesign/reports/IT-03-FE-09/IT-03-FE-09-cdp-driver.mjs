#!/usr/bin/env node
/**
 * IT-03 FE-09 CDP selftest driver — 点击语义固化与纯选中保护。
 *
 * Measures (per tasks/IT-03/FE-09.md 验收阶段 1–3 + AC-RULE-13/AC-FN-17/AC-FN-18):
 *   S0 seam 前置自检（isWritable 可达、P12/P13/P18/P21/Table/Editor 就绪）+ 缝 key 基线
 *   S1 AC-FN-18 纯选中保护：拖选文本松开 → 仅选区高亮、剪贴板得文本、不进编辑、
 *      无浮层/把手/chip（全 3 判据）；拖动中同样 0 chrome；选区存活时 hover 代码块
 *      CSS chip/toolbar 亦压零（.cm-md-selecting 守卫）；impl 截图（拖选静息）
 *   S2 陈旧选区不锁编辑入口（两供给规则）：拖选后不点别处直接点图 → 编辑浮层照常
 *   S3 AC-FN-17 逐元素点击：文本/表格/公式/代码/图/mermaid 分别进对应编辑形态，
 *      且无无关浮层（全 4 判据）
 *   S4 AC-RULE-13 判据 3：图/表/代码/文本相邻处反复点击，语义一致、一次点击一种语义
 *   S5 FE-04/05/06 联调：点图进编辑浮层（对齐/宽度/完成/缩放把手）；hover 链接浮层
 *      不被点击路由误触（纯选区路径压零）；拖选列表文本不触发把手拖拽；hover 把手不回归
 *   S6 表格零回归：单元格点击激活 + 工具栏（AC-FN-03）、A→B 激活转移（AC-FN-32）、
 *      gap 空白点击分级退格（AC-FN-29）
 *   S7 收尾：window.__velox* 缝 key 集不变、纯点击全程文档零写入
 *
 * Robustness notes (inherited from IT-03-FE-05/06 drivers):
 *  - Page.bringToFront + Page.setWebLifecycleState(active) +
 *    Emulation.setFocusEmulationEnabled: occluded Electron throttles timers.
 *  - Runtime.evaluate always carries a wall-clock timeout.
 *  - 草稿恢复对话框一律点「稍后」——绝不丢弃草稿（调度硬约束）。
 *  - headingFolds persist per-path — loadDoc 后 restoreKeys([])。
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.FE09_CDP_PORT ?? 9457)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-03-FE-09'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/fe09-click-selftest.md`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── CDP plumbing (same shape as FE-06 driver, evaluate w/ wall-clock timeout) ─
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
  await moveTo(x, y)
  await pressAt(x, y)
  await releaseAt(x, y)
}
async function pressCtrlC() {
  const mods = 2 // Ctrl
  await send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: 'c', code: 'KeyC', modifiers: mods,
    windowsVirtualKeyCode: 67, nativeVirtualKeyCode: 67
  })
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'c', code: 'KeyC', modifiers: mods,
    windowsVirtualKeyCode: 67, nativeVirtualKeyCode: 67
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

/**
 * Rect helpers scroll the target into view first (fixture is taller than the
 * window — off-viewport Input coordinates hit nothing) and clamp click anchors
 * into the visible band so tall widgets (240px image) still get a real hit.
 */
/** Clamp a click y into the visible band (tall widgets / below-fold targets). */
const clampY = (expr) => `Math.min(Math.max(${expr}, 48), window.innerHeight - 48)`

async function centerOf(selector) {
  await evalExpr(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' })
    return !!el
  })()`)
  await sleep(150)
  return evalExpr(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return null
    const r = el.getBoundingClientRect()
    const y = ${clampY('r.top + r.height / 2')}
    return {
      x: +(r.left + r.width / 2).toFixed(2),
      y: +y.toFixed(2),
      left: +r.left.toFixed(2), top: +r.top.toFixed(2),
      right: +r.right.toFixed(2), bottom: +r.bottom.toFixed(2),
      w: +r.width.toFixed(2), h: +r.height.toFixed(2)
    }
  })()`)
}

/** Rect of a .cm-line whose text contains `snippet` (plus click anchor points). */
async function lineRectOf(snippet) {
  await evalExpr(`(() => {
    const q = ${JSON.stringify(snippet)}
    const el = [...document.querySelectorAll('.cm-editor .cm-line')]
      .find((n) => (n.textContent ?? '').includes(q))
    if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' })
    return !!el
  })()`)
  await sleep(150)
  return evalExpr(`(() => {
    const q = ${JSON.stringify(snippet)}
    const lines = [...document.querySelectorAll('.cm-editor .cm-line')]
    const el = lines.find((n) => (n.textContent ?? '').includes(q))
    if (!el) return null
    const r = el.getBoundingClientRect()
    const y = ${clampY('r.top + r.height / 2')}
    return {
      text: (el.textContent ?? '').trim(),
      x: +(r.left + Math.min(24, r.width / 4)).toFixed(2),
      y: +y.toFixed(2),
      xLeft: +(r.left + 6).toFixed(2),
      xRight: +(r.right - 6).toFixed(2),
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

/**
 * Click a line at a point NOT covered by any floating chrome (the image edit
 * float is a fixed overlay that may cover the line above/below its anchor —
 * clicking the float itself is not an outside-click). Scrolls the line to the
 * top band first so below-anchor floats stay clear.
 */
async function clickLineClear(snippet) {
  await evalExpr(`(() => {
    const q = ${JSON.stringify(snippet)}
    const el = [...document.querySelectorAll('.cm-editor .cm-line')].find((n) => (n.textContent ?? '').includes(q))
    if (el) el.scrollIntoView({ block: 'start', inline: 'nearest' })
    return !!el
  })()`)
  await sleep(250)
  const pt = await evalExpr(`(() => {
    const q = ${JSON.stringify(snippet)}
    const el = [...document.querySelectorAll('.cm-editor .cm-line')].find((n) => (n.textContent ?? '').includes(q))
    if (!el) return null
    const r = el.getBoundingClientRect()
    for (const dx of [16, 40, 80, r.width * 0.25, r.width * 0.5]) {
      const x = r.left + dx
      const y = r.top + r.height / 2
      const at = document.elementFromPoint(x, y)
      if (!at) continue
      if (at.closest('.cm-md-float, .render-float, .cm-md-image-toolbar')) continue
      return { x: +x.toFixed(2), y: +y.toFixed(2), atClass: String(at.className ?? '') }
    }
    return null
  })()`)
  return pt
}

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
      y: +Math.min(Math.max(t.bottom + Math.min(6, Math.max(2, (o.bottom - t.bottom) / 2)), 48), window.innerHeight - 48).toFixed(2),
      gapH: +(o.bottom - t.bottom).toFixed(2)
    }
  })()`)
}

// ── probes ─────────────────────────────────────────────────────────────────
/** All hover/edit chrome a pure-selection gesture must NOT pop (AC-FN-18). */
const CHROME = `(() => {
  const shown = (el) => {
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden') return false
    if (parseFloat(s.opacity) < 0.05) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  return {
    selecting: !!document.querySelector('.cm-editor.cm-md-selecting'),
    imageFloat: [...document.querySelectorAll('[data-testid="image-edit-float"]')].filter(shown).length,
    linkFloat: [...document.querySelectorAll('[data-testid="link-hover-float"]')].filter(shown).length,
    listHandle: [...document.querySelectorAll('[data-testid="list-drag-handle"]')].filter(shown).length,
    imageToolbar: [...document.querySelectorAll('.cm-md-image-toolbar')].filter(shown).length,
    imageSelected: document.querySelectorAll('.cm-md-image-selected').length,
    blockToolbarsShown: [...document.querySelectorAll('.cm-md-block-toolbar')].filter(shown).length,
    idleChipsShown: [...document.querySelectorAll('.cm-md-code-idle-chip')].filter(shown).length,
    tableEditing: document.querySelectorAll('.cm-md-table-editing').length,
    mermaidLightbox: [...document.querySelectorAll('[data-testid="mermaid-lightbox"]')].filter(shown).length,
    dragGhost: document.querySelectorAll('[data-testid="list-drag-ghost"]').length,
    dropIndicator: document.querySelectorAll('[data-testid="list-drop-indicator"]').length
  }
})()`

const SELECTION = `(() => {
  const v = window.__veloxEditor?.view
  if (!v) return null
  const sel = v.state.selection.main
  return {
    empty: sel.empty, from: sel.from, to: sel.to,
    text: sel.empty ? '' : v.state.sliceDoc(sel.from, sel.to)
  }
})()`

const SEAM_KEYS = `Object.keys(window).filter((k) => k.startsWith('__velox')).sort()`

const ACTIVE_CELL = `(() => {
  const nested = !!window.__veloxTable?.nested
  const cell = [...document.querySelectorAll('.cm-md-table td, .cm-md-table th')]
    .find((td) => td.querySelector('.cm-editor'))
  return {
    nested,
    row: cell ? cell.dataset.row : null,
    col: cell ? cell.dataset.col : null,
    editing: document.querySelectorAll('.cm-md-table-editing').length,
    toolbar: document.querySelectorAll('.cm-md-table-toolbar').length
  }
})()`

const DIALOG_STATE = `(() => {
  const d = document.querySelector('.dialog-overlay .dialog')
  if (!d) return { present: false }
  return {
    present: true,
    message: d.querySelector('.dialog-message')?.textContent ?? null,
    buttons: [...d.querySelectorAll('.dialog-buttons .dialog-btn')].map((b) => (b.textContent ?? '').trim())
  }
})()`

const DOC = `window.__veloxP13 ? window.__veloxP13.getDoc() : (window.__veloxEditor?.view.state.doc.toString() ?? null)`

/** Chrome keys that count as "unrelated floats" for a given expected channel. */
function unrelated(ch, expected) {
  const out = {}
  for (const [k, v] of Object.entries(ch)) {
    if (k === 'selecting') continue
    if (expected.includes(k)) continue
    if (typeof v === 'number' && v > 0) out[k] = v
  }
  return out
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

async function loadDocSettled(path, content) {
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
      tables: document.querySelectorAll('.cm-md-table-wrap').length,
      images: document.querySelectorAll('.cm-md-image-wrap').length
    })`)
    if (state.fp === path && state.folded === 0 && state.tables >= 1 && state.images >= 1) return state
  }
  const last = await evalExpr(`({
    fp: window.__veloxP12.getFilePath(),
    folded: window.__veloxP18 ? window.__veloxP18.getFoldedKeys().length : -1,
    tables: document.querySelectorAll('.cm-md-table-wrap').length,
    images: document.querySelectorAll('.cm-md-image-wrap').length
  })`)
  throw new Error(`loadDocSettled(${path}) did not settle: ${JSON.stringify(last)}`)
}

/**
 * Reset chrome + table edit state via product/test seams (setup only).
 * Collapses any stale text selection with a REAL click on the Alpha paragraph
 * (plain-text mousedown places the cursor — the product path we assert later).
 */
async function resetChrome(neutral) {
  await pressEscape()
  await sleep(120)
  await evalExpr(`(() => {
    try { window.__veloxTable?.clearEdit(window.__veloxEditor.view) } catch {}
    return true
  })()`)
  const anchor = (await lineRectOf('Alpha plain paragraph')) ?? neutral
  if (anchor) {
    await moveTo(anchor.xLeft + 20, anchor.y)
    await pressAt(anchor.xLeft + 20, anchor.y)
    await releaseAt(anchor.xLeft + 20, anchor.y)
    await sleep(250)
  }
}

// ── fixture ────────────────────────────────────────────────────────────────
// 各元素块刻意留段落间距：段内纯文本（无 mark）供纯选区测试；链接在 Beta 段内；
// 表/公式/代码/图/mermaid/列表依次排布，供相邻区反复点击与逐元素路由。
const FENCE = '```'
const FIXTURE = [
  '# FE-09 click semantics selftest',
  '',
  'Alpha plain paragraph text for drag-select copy checks here.',
  '',
  'Beta adjacent paragraph with [a link](https://example.com/page) inline.',
  '',
  '| head a | head b |',
  '| --- | --- |',
  '| cell one | cell two |',
  '| cell three | cell four |',
  '',
  'Math block follows.',
  '',
  '$$',
  'E = mc^2',
  '$$',
  '',
  'Code block follows.',
  '',
  FENCE + 'js',
  "console.log('code body')",
  FENCE,
  '',
  'Image follows.',
  '',
  '![cover](logo-master.png =360x240)',
  '',
  'Mermaid follows.',
  '',
  FENCE + 'mermaid',
  'graph TD',
  '  A-->B',
  FENCE,
  '',
  '- list alpha row',
  '- list beta row',
  '  - [ ] review PRs',
  '  - [x] write docs',
  '',
  'Tail paragraph for neutral clicks.'
].join('\n')

const MATH_FROM = FIXTURE.indexOf('$$')
const CODE_FROM = FIXTURE.indexOf(FENCE + 'js')
const MERMAID_FROM = FIXTURE.indexOf(FENCE + 'mermaid')
const TABLE_FROM = FIXTURE.indexOf('| head a')
const IMAGE_SRC = '![cover]'

// ── setup ─────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true })
await send('Page.enable')
await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })

// Reload so the page runs the current out/renderer build (clickSemantics +
// hoverZones guards live in the new chunks).
await send('Page.reload', { ignoreCache: true })
await waitFor(
  'window.__veloxP12 && window.__veloxP13 && window.__veloxP18 && window.__veloxP21',
  15000,
  100
)

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

// ── S0: seam 前置自检 + key 基线 ──────────────────────────────────────────
{
  const probe = await evalExpr(`window.api.isWritable(${JSON.stringify(FIXTURE_PATH)}).then(
    (v) => ({ ok: true, v }),
    (e) => ({ ok: false, err: String(e) })
  )`)
  results.meta.isWritableProbe = probe
  if (!probe.ok) {
    console.error('LAUNCH_ERROR: window.api.isWritable failed:', probe.err)
    results.meta.LAUNCH_ERROR = probe.err
    results.meta.finishedAt = new Date().toISOString()
    writeFileSync(`${OUT_DIR}/IT-03-FE-09-cdp-data.json`, JSON.stringify(results, null, 2), 'utf-8')
    process.exit(1)
  }
  check('S0 isWritable IPC 可达（非 stale 构建）', probe.ok === true, probe)

  const seams = await evalExpr(`({
    p12: typeof window.__veloxP12?.loadDoc === 'function',
    p13: typeof window.__veloxP13?.getDoc === 'function',
    p18: typeof window.__veloxP18?.restoreKeys === 'function',
    p21: typeof window.__veloxP21?.renderExportHtml === 'function',
    table: typeof window.__veloxTable?.activate === 'function',
    editor: !!window.__veloxEditor?.view
  })`)
  check(
    'S0 e2e 缝 P12/P13/P18/P21/Table/Editor 就绪',
    seams.p12 && seams.p13 && seams.p18 && seams.p21 && seams.table && seams.editor,
    seams
  )
  results.meta.seams = seams
  results.meta.seamKeysBaseline = await evalExpr(SEAM_KEYS)
}

await loadDocSettled(FIXTURE_PATH, FIXTURE)
await dismissAnyDialog()
// widgets mount async (image naturalWidth / mermaid svg)
await waitFor('document.querySelector(".cm-md-image-wrap img")?.naturalWidth > 0', 8000, 100)
await waitFor('document.querySelector(".cm-md-mermaid svg")', 8000, 100)
await sleep(300)

// Neutral point inside the editor but off every hover zone / widget / gutter.
const neutral = await evalExpr(`(() => {
  for (let y = 40; y < window.innerHeight; y += 12) {
    for (let x = 40; x < window.innerWidth; x += 12) {
      const el = document.elementFromPoint(x, y)
      if (!el) continue
      if (el.closest('.cm-md-image-wrap, .cm-md-link, .cm-md-list, .render-float, .cm-md-img-resize')) continue
      if (el.closest('.cm-md-heading, .cm-md-fold-placeholder, .cm-gutters, .cm-fold-gutter, .cm-md-fold-gutter, .cm-md-fold-arrow')) continue
      if (el.closest('.cm-md-table, .cm-md-math-block, .cm-md-code-block, .cm-md-mermaid')) continue
      if (el.closest('.cm-editor')) return { x, y }
    }
  }
  const ed = document.querySelector('.cm-editor')
  const r = ed ? ed.getBoundingClientRect() : { left: 0, top: 0 }
  return { x: Math.round(r.left + 8), y: Math.round(r.top + 8) }
})()`)
results.neutral = neutral
console.log('neutral', JSON.stringify(neutral))

// ── S1: AC-FN-18 纯选中保护 ───────────────────────────────────────────────
{
  await moveTo(neutral.x, neutral.y)
  await sleep(500)
  const idle = await evalExpr(CHROME)
  const idleBad = unrelated(idle, [])
  check('S1 拖选前静息 0 chrome（基线）', Object.keys(idleBad).length === 0, idle)

  // Drag-select across the Alpha paragraph (press → move pressed → release).
  const alpha = await lineRectOf('Alpha plain paragraph')
  const beta = await lineRectOf('Beta adjacent paragraph')
  check('S1 夹具段落定位（Alpha/Beta）', !!alpha && !!beta, { alpha: alpha?.text, beta: beta?.text })
  await pressAt(alpha.xLeft + 4, alpha.y)
  await sleep(40)
  await moveToPressed(alpha.xLeft + alpha.w * 0.5, alpha.y)
  await sleep(40)
  await moveToPressed(beta.xLeft + beta.w * 0.6, beta.y)
  await sleep(60)
  const midChrome = await evalExpr(CHROME)
  const midBad = unrelated(midChrome, [])
  check('S1 拖动进行中 0 chrome（buttons!=0 hover 守卫）', Object.keys(midBad).length === 0, midChrome)
  await releaseAt(beta.xLeft + beta.w * 0.6, beta.y)
  await sleep(200)

  const sel = await evalExpr(SELECTION)
  check(
    'S1 拖选松开后选区非空且覆盖 Alpha 段（AC-FN-18 判据1 仅选区高亮）',
    sel && sel.empty === false && sel.text.includes('Alpha plain paragraph'),
    sel
  )
  const rest = await evalExpr(CHROME)
  const restBad = unrelated(rest, [])
  check(
    'S1 松开后无浮层/把手/chip（AC-FN-18 判据3）',
    Object.keys(restBad).length === 0,
    rest
  )
  check(
    'S1 松开后 .cm-md-selecting 守卫在位（CSS chrome 压零开关）',
    rest.selecting === true,
    { selecting: rest.selecting }
  )
  check(
    'S1 纯选中不进编辑（表格未激活/无 lightbox/无图浮层）',
    rest.tableEditing === 0 && rest.mermaidLightbox === 0 && rest.imageFloat === 0,
    rest
  )

  await pressCtrlC()
  await sleep(300)
  const clip = await evalExpr(`window.api.clipboardRead()`)
  check(
    'S1 剪贴板得选中文本（AC-FN-18 判据2）',
    typeof clip === 'string' && clip.includes('Alpha plain paragraph'),
    { clipLen: clip?.length, head: String(clip ?? '').slice(0, 60) }
  )

  // impl.png — 拖选文本后无浮层的静息截图（选区高亮保留）。
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  writeFileSync(`${OUT_DIR}/IT-03-FE-09-impl.png`, Buffer.from(shot.data, 'base64'))
  console.log(`impl screenshot → ${OUT_DIR}/IT-03-FE-09-impl.png`)
  check('S1 impl 截图落盘', !!shot.data, { bytes: shot.data?.length })

  // CSS guard while the selection is LIVE: hovering a code block must not
  // reveal the idle chip / block toolbar (.cm-md-selecting pins them down).
  const code = await centerOf('.cm-md-code-block')
  if (code) {
    await moveTo(code.x, code.y)
    await sleep(600) // past hover reveal timing
    const hoverChrome = await evalExpr(CHROME)
    check(
      'S1 选区存活时 hover 代码块 chip/toolbar 压零（CSS 守卫）',
      hoverChrome.idleChipsShown === 0 && hoverChrome.blockToolbarsShown === 0,
      hoverChrome
    )
    await moveTo(neutral.x, neutral.y)
    await sleep(200)
  } else {
    check('S1 选区存活时 hover 代码块 chip/toolbar 压零（CSS 守卫）', false, 'code block not found')
  }

  results.scenarios.s1 = { sel, rest, clipLen: clip?.length, midChrome, hoverKept: rest.selecting }
}

// ── S2: 陈旧选区不锁编辑入口（writer path first）─────────────────────────
{
  // Selection from S1 is still live — click the image WITHOUT clicking away.
  // Widget gestures pass selectionEmpty:true by construction (unselectable
  // content), so the edit float must still surface (AC-RULE-13 writer first).
  const img = await centerOf('.cm-md-image-wrap img')
  check('S2 图片定位', !!img, img)
  if (img) {
    await clickAt(img.x, img.y)
    await sleep(400)
    const ch = await evalExpr(CHROME)
    check(
      'S2 拖选后直接点图仍进编辑浮层（陈旧选区不锁写路径）',
      ch.imageFloat >= 1,
      ch
    )
    const bad = unrelated(ch, ['imageFloat', 'imageToolbar', 'imageSelected'])
    check('S2 点图不弹无关浮层', Object.keys(bad).length === 0, bad)
    // Cleanup: dismiss the float with a neutral click.
    await resetChrome(neutral)
    await sleep(300)
  }
  results.scenarios.s2 = { img }
}

// ── S3: AC-FN-17 逐元素点击路由 ───────────────────────────────────────────
{
  // a. text click → text edit (cursor at click, no floats)
  await resetChrome(neutral)
  const tail = await lineRectOf('Tail paragraph')
  check('S3 文本段定位', !!tail, tail?.text)
  if (tail) {
    await clickAt(tail.xLeft + 20, tail.y)
    await sleep(250)
    const sel = await evalExpr(SELECTION)
    const ch = await evalExpr(CHROME)
    const bad = unrelated(ch, [])
    const inLine = sel && sel.empty && sel.from > FIXTURE.indexOf('Tail paragraph') - 2
    check(
      'S3 点文本 → 文本编辑态（光标就位、不进其它编辑形态）',
      inLine && Object.keys(bad).length === 0 && ch.tableEditing === 0,
      { sel, bad }
    )
    check('S3 文本点击无任何浮层（AC-FN-17 判据1 text 路径）', Object.keys(bad).length === 0, bad)
  }

  // b. table cell click → table edit form (cell activate, no unrelated floats)
  await resetChrome(neutral)
  const cell = await cellPoint(1, 0)
  check('S3 表格单元格定位', !!cell, cell)
  if (cell) {
    await clickAt(cell.x, cell.y)
    await sleep(350)
    const active = await evalExpr(ACTIVE_CELL)
    const ch = await evalExpr(CHROME)
    const bad = unrelated(ch, ['tableEditing'])
    check(
      'S3 点表格单元格 → 表格编辑形态（cell 激活 + 编辑态，AC-FN-03 hit 路径）',
      active.nested === true && active.editing === 1 && active.row === '1' && active.col === '0',
      active
    )
    check('S3 表格点击无无关浮层（AC-FN-17 判据2）', Object.keys(bad).length === 0, bad)
    await resetChrome(neutral)
    await sleep(200)
  }

  // c. math click → source form (widget yields to source lines at the $$ range)
  await resetChrome(neutral)
  const math = await centerOf('.cm-md-math-block')
  check('S3 公式块定位', !!math, math)
  if (math) {
    await clickAt(math.x, math.y)
    await sleep(350)
    const sel = await evalExpr(SELECTION)
    const widgets = await evalExpr(`document.querySelectorAll('.cm-md-math-block').length`)
    const ch = await evalExpr(CHROME)
    const bad = unrelated(ch, [])
    check(
      'S3 点公式 → 源码形态（光标进 $$ 源范围、widget 让位）',
      sel && sel.empty && sel.from === MATH_FROM && widgets === 0,
      { from: sel?.from, expect: MATH_FROM, widgets }
    )
    check('S3 公式点击无浮层（AC-FN-17 判据3 math 路径）', Object.keys(bad).length === 0, bad)
  }

  // d. code click → source form (focused fence panel)
  await resetChrome(neutral)
  // cursor left the math block → math widget remounts; code widget is present.
  await waitFor('document.querySelector(".cm-md-code-block")', 5000, 50)
  const code = await centerOf('.cm-md-code-block')
  check('S3 代码块定位', !!code, code)
  if (code) {
    await clickAt(code.x, code.y)
    await sleep(350)
    const sel = await evalExpr(SELECTION)
    const state = await evalExpr(`({
      widgets: document.querySelectorAll('.cm-md-code-block').length,
      srcLines: document.querySelectorAll('.cm-line.cm-md-code-src').length
    })`)
    const ch = await evalExpr(CHROME)
    const bad = unrelated(ch, [])
    check(
      'S3 点代码 → 源码形态（光标进 fence 源范围 + 源码行可见）',
      sel && sel.empty && sel.from === CODE_FROM && state.widgets === 0 && state.srcLines > 0,
      { from: sel?.from, expect: CODE_FROM, ...state }
    )
    check('S3 代码点击无浮层（AC-FN-17 判据3 code 路径）', Object.keys(bad).length === 0, bad)
  }

  // e. image click → image edit float（图=编辑浮层）
  await resetChrome(neutral)
  await waitFor('document.querySelector(".cm-md-code-block")', 5000, 50)
  const img2 = await centerOf('.cm-md-image-wrap img')
  if (img2) {
    await clickAt(img2.x, img2.y)
    await sleep(400)
    const ch = await evalExpr(CHROME)
    const bad = unrelated(ch, ['imageFloat', 'imageToolbar', 'imageSelected'])
    check(
      'S3 点图 → 图编辑浮层（AC-FN-17 判据3 图=编辑浮层）',
      ch.imageFloat >= 1,
      ch
    )
    check('S3 图点击无无关浮层（AC-FN-17 判据4）', Object.keys(bad).length === 0, bad)
    await resetChrome(neutral)
    await sleep(300)
  }

  // f. mermaid svg click → mermaid preview form (lightbox)
  await resetChrome(neutral)
  const mer = await centerOf('.cm-md-mermaid svg')
  check('S3 mermaid svg 定位', !!mer, mer)
  if (mer) {
    await clickAt(mer.x, mer.y)
    await sleep(500)
    const ch = await evalExpr(CHROME)
    const bad = unrelated(ch, ['mermaidLightbox'])
    check(
      'S3 点 mermaid → 预览形态（lightbox，edit:mermaid）',
      ch.mermaidLightbox >= 1,
      ch
    )
    check('S3 mermaid 点击无无关浮层', Object.keys(bad).length === 0, bad)
    await pressEscape()
    await sleep(300)
    const closed = await evalExpr(CHROME)
    check('S3 Esc 关闭 lightbox 后清场', closed.mermaidLightbox === 0, closed)
  }

  results.scenarios.s3 = { mathFrom: MATH_FROM, codeFrom: CODE_FROM }
}

// ── S4: AC-RULE-13 判据 3 — 相邻处反复点击语义一致 ────────────────────────
{
  const cycle = async (i) => {
    // image → float only
    const img = await centerOf('.cm-md-image-wrap img')
    if (!img) return { i, ok: false, reason: 'no-image' }
    await clickAt(img.x, img.y)
    await sleep(400)
    const chImg = await evalExpr(CHROME)
    const imgOk = chImg.imageFloat >= 1 && chImg.tableEditing === 0 && chImg.linkFloat === 0

    // text near the image ("Image follows.") → text edit only; the float is
    // dismissed by the click-outside contract (ImageEditFloat outside-mousedown).
    const near = await clickLineClear('Image follows.')
    if (!near) return { i, ok: false, reason: 'no-clear-text-point' }
    await clickAt(near.x, near.y)
    await sleep(350)
    const chTxt = await evalExpr(CHROME)
    const selTxt = await evalExpr(SELECTION)
    const txtOk =
      chTxt.imageFloat === 0 && chTxt.tableEditing === 0 && chTxt.mermaidLightbox === 0 &&
      selTxt && selTxt.empty

    // table cell → table edit only
    const cell = await cellPoint(1, 1)
    await clickAt(cell.x, cell.y)
    await sleep(350)
    const active = await evalExpr(ACTIVE_CELL)
    const chTbl = await evalExpr(CHROME)
    const tblOk = active.nested === true && chTbl.imageFloat === 0 && chTbl.mermaidLightbox === 0

    // gap click → exit table (also the AC-FN-29 graded step-back path)
    await resetChrome(neutral)
    await sleep(200)
    return {
      i,
      ok: imgOk && txtOk && tblOk,
      imgOk,
      txtOk,
      tblOk,
      chImg,
      chTxt,
      selTxtFrom: selTxt?.from,
      active
    }
  }
  const c1 = await cycle(1)
  const c2 = await cycle(2)
  check('S4 相邻区点击循环 1 语义一致（图→浮层 / 文→文本 / 表→单元格）', c1.ok === true, c1)
  check('S4 相邻区点击循环 2 语义一致（重复点击确定性）', c2.ok === true, c2)
  results.scenarios.s4 = { c1, c2 }
}

// ── S5: FE-04/05/06 联调 ──────────────────────────────────────────────────
{
  // a. FE-04 image edit float form (align / width / done / resize handle)
  await resetChrome(neutral)
  const img = await centerOf('.cm-md-image-wrap img')
  if (img) {
    await clickAt(img.x, img.y)
    await sleep(400)
    const form = await evalExpr(`({
      float: !!document.querySelector('[data-testid="image-edit-float"]'),
      alignLeft: !!document.querySelector('[data-testid="image-align-left"]'),
      alignCenter: !!document.querySelector('[data-testid="image-align-center"]'),
      alignRight: !!document.querySelector('[data-testid="image-align-right"]'),
      widthSelect: !!document.querySelector('[data-testid="image-width-select"]'),
      done: !!document.querySelector('[data-testid="image-edit-done"]'),
      resize: !!document.querySelector('[data-testid="image-resize-handle"]')
    })`)
    check(
      'S5 点图进 FE-04 编辑浮层（对齐/宽度/完成/缩放把手全在）',
      form.float && form.alignLeft && form.alignCenter && form.alignRight &&
      form.widthSelect && form.done && form.resize,
      form
    )
    await resetChrome(neutral)
    await sleep(300)
  }

  // b. FE-05 link hover float vs click route
  const beta = await lineRectOf('Beta adjacent')
  const link = await centerOf('.cm-md-link')
  check('S5 链接定位', !!link, link)
  if (link && beta) {
    // (i) pure drag-select across the line that contains the link → no link float
    await pressAt(beta.xLeft + 4, beta.y)
    await sleep(40)
    await moveToPressed(beta.xRight - 8, beta.y)
    await sleep(60)
    await releaseAt(beta.xRight - 8, beta.y)
    await sleep(250)
    const chSel = await evalExpr(CHROME)
    check(
      'S5 拖选含链接文本不弹链接浮层（纯选中保护 + hover 守卫）',
      chSel.linkFloat === 0 && chSel.imageFloat === 0 && chSel.listHandle === 0,
      chSel
    )
    // (ii) hover the link → hover float surfaces (hover channel intact)
    await moveTo(neutral.x, neutral.y)
    await sleep(300)
    await clickAt(beta.xLeft + 10, beta.y) // clear selection via plain-text click
    await sleep(200)
    await moveTo(link.x, link.y)
    const appeared = await waitFor(
      `!!document.querySelector('[data-testid="link-hover-float"]')`,
      3000
    )
    check('S5 hover 链接浮层照常（FE-05 通道不回归）', appeared.value === true, appeared)
    // (iii) click routing on nearby plain text must not pop unrelated chrome
    await moveTo(beta.xLeft + 10, beta.y)
    await pressAt(beta.xLeft + 10, beta.y)
    await releaseAt(beta.xLeft + 10, beta.y)
    await sleep(350)
    const chNear = await evalExpr(CHROME)
    const nearBad = unrelated(chNear, ['linkFloat']) // link float may linger from hover
    check(
      'S5 点链接旁文本不弹无关浮层（点击路由不误触）',
      Object.keys(nearBad).length === 0 && chNear.imageFloat === 0,
      chNear
    )
    await moveTo(neutral.x, neutral.y)
    await sleep(500)
  }

  // c. FE-06: drag-select list text does NOT start a handle drag session.
  // Measure BOTH rows in one evaluate after a single scroll (per-line scroll
  // would invalidate the first row's rect).
  const rows = await evalExpr(`(() => {
    const la = [...document.querySelectorAll('.cm-editor .cm-line')].find((n) => (n.textContent ?? '').includes('list alpha row'))
    if (!la) return null
    la.scrollIntoView({ block: 'center', inline: 'nearest' })
    return true
  })()`)
  await sleep(250)
  const pair = await evalExpr(`(() => {
    const pick = (q) => {
      const el = [...document.querySelectorAll('.cm-editor .cm-line')].find((n) => (n.textContent ?? '').includes(q))
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        text: (el.textContent ?? '').trim(),
        xLeft: +(r.left + 6).toFixed(2),
        y: +Math.min(Math.max(r.top + r.height / 2, 48), window.innerHeight - 48).toFixed(2),
        x: +(r.left + Math.min(24, r.width / 4)).toFixed(2)
      }
    }
    return { la: pick('list alpha row'), lb: pick('list beta row') }
  })()`)
  const la = pair?.la ?? null
  const lb = pair?.lb ?? null
  check('S5 列表行定位', !!la && !!lb, { la: la?.text, lb: lb?.text })
  if (la && lb) {
    await pressAt(la.xLeft + 30, la.y)
    await sleep(40)
    await moveToPressed(la.xLeft + 60, la.y)
    await sleep(40)
    const midList = await evalExpr(CHROME)
    await moveToPressed(lb.xLeft + 60, lb.y)
    await sleep(60)
    await releaseAt(lb.xLeft + 60, lb.y)
    await sleep(250)
    const chList = await evalExpr(CHROME)
    const selList = await evalExpr(SELECTION)
    check(
      'S5 拖选列表文本不触发把手拖拽（无把手/ghost/指示线）',
      midList.listHandle === 0 && midList.dragGhost === 0 && midList.dropIndicator === 0 &&
      chList.listHandle === 0 && chList.dragGhost === 0 && chList.dropIndicator === 0,
      { midList, chList }
    )
    check(
      'S5 列表拖选得文本选区（纯选中语义）',
      selList && selList.empty === false && selList.text.includes('list alpha row'),
      selList
    )
    // d. FE-06 non-regression: hover still surfaces the handle. The prior
    // drag left a live selection — chromeAllowed(false) suppresses hover by
    // design (AC-FN-18), so clear the selection first, leave the row, then
    // re-enter it for a fresh mouseover.
    await resetChrome(neutral)
    await sleep(200)
    await moveTo(neutral.x, neutral.y)
    await sleep(300)
    const hoverPt = await evalExpr(`(() => {
      const el = [...document.querySelectorAll('.cm-editor .cm-line')].find((n) => (n.textContent ?? '').includes('list alpha row'))
      if (!el) return null
      el.scrollIntoView({ block: 'center', inline: 'nearest' })
      return true
    })()`)
    await sleep(250)
    const hoverAt = await evalExpr(`(() => {
      const el = [...document.querySelectorAll('.cm-editor .cm-line')].find((n) => (n.textContent ?? '').includes('list alpha row'))
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: +(r.left + 10).toFixed(2), y: +Math.min(Math.max(r.top + r.height / 2, 48), window.innerHeight - 48).toFixed(2) }
    })()`)
    if (hoverAt) await moveTo(hoverAt.x, hoverAt.y)
    const h = await waitFor(`!!document.querySelector('[data-testid="list-drag-handle"]')`, 3000)
    check('S5 hover 列表行把手照常（FE-06 通道不回归）', h.value === true, h)
    await moveTo(neutral.x, neutral.y)
    await sleep(500)
  }
  results.scenarios.s5 = {}
}

// ── S6: 表格零回归（AC-FN-03 / AC-FN-29 / AC-FN-32）───────────────────────
{
  await resetChrome(neutral)
  const cellA = await cellPoint(1, 0)
  await clickAt(cellA.x, cellA.y)
  await sleep(350)
  const a = await evalExpr(ACTIVE_CELL)
  check(
    'S6 单元格点击激活 + 编辑工具栏（AC-FN-03 零回归）',
    a.nested === true && a.editing === 1 && a.row === '1' && a.col === '0' && a.toolbar >= 1,
    a
  )

  // AC-FN-32 activation transfer A(1,0) → B(1,1)
  const cellB = await cellPoint(1, 1)
  await clickAt(cellB.x, cellB.y)
  await sleep(350)
  const b = await evalExpr(ACTIVE_CELL)
  check(
    'S6 A→B 激活转移（AC-FN-32）：B 激活、A 不再持有嵌套编辑器',
    b.nested === true && b.row === '1' && b.col === '1',
    b
  )

  // AC-FN-29 语义保持（零回归范围）：现状行为 = gap 点击整体退出单元格编辑并回表格源。
  // 注：AC-FN-29「分级退格」模型缺口（TableEditState 无编辑态无 active 模型）不属
  // FE-09 AC 覆盖（移交来源 IT-01/FE-09），仅登记不实现——见 self-test 跨任务缺口。
  const gap = await gapPoint()
  check('S6 表格 gap 定位', !!gap && gap.gapH >= 0, gap)
  if (gap) {
    await clickAt(gap.x, gap.y)
    await sleep(350)
    const after = await evalExpr(ACTIVE_CELL)
    const sel = await evalExpr(SELECTION)
    check(
      'S6 gap 空白点击退出编辑 + 光标回表格源（AC-FN-03/29 现状语义保持）',
      after.nested === false && after.editing === 0 && sel && sel.empty && sel.from === TABLE_FROM,
      { after, from: sel?.from, expect: TABLE_FROM }
    )
  }
  results.scenarios.s6 = { a, b, gap }
}

// ── S7: 收尾 — 缝 key 集不变 + 文档零写入 ─────────────────────────────────
{
  const keysNow = await evalExpr(SEAM_KEYS)
  const keysBase = results.meta.seamKeysBaseline
  // No seam may vanish; additions are allowed only for known lazy installs
  // (__veloxTableCellView mounts with the first nested cell session).
  const LAZY_SEAMS = ['__veloxTableCellView']
  const removed = (keysBase ?? []).filter((k) => !(keysNow ?? []).includes(k))
  const added = (keysNow ?? []).filter((k) => !(keysBase ?? []).includes(k))
  const unexpectedAdded = added.filter((k) => !LAZY_SEAMS.includes(k))
  const ok = removed.length === 0 && unexpectedAdded.length === 0
  check('S7 window.__velox* 缝零丢失（cdp 冒烟硬契约）', removed.length === 0, { removed })
  check('S7 缝新增仅限已知惰性缝', unexpectedAdded.length === 0, { added, unexpectedAdded })

  const doc = await evalExpr(DOC)
  check('S7 纯点击/拖选全程文档零写入', doc === FIXTURE, {
    len: doc?.length,
    expect: FIXTURE.length,
    equal: doc === FIXTURE
  })
  results.scenarios.s7 = { keysNow }
}

results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-03-FE-09-cdp-data.json`, JSON.stringify(results, null, 2), 'utf-8')

const failed = (results.checks ?? []).filter((c) => !c.ok)
console.log(`\n==== ${results.checks.length - failed.length}/${results.checks.length} checks passed ====`)
if (failed.length) {
  console.log('FAILED:')
  for (const f of failed) console.log(' -', f.name, JSON.stringify(f.detail))
  process.exit(1)
}
process.exit(0)
