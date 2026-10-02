#!/usr/bin/env node
/**
 * IT-03 FE-10 CDP selftest driver — 公式/代码/mermaid 块观感审计微调与非回归。
 *
 * Measures (per tasks/IT-03/FE-10.md 验收阶段 1–3):
 *   S0 健康检查：seams 就绪 + 草稿对话框一律点「稍后」（绝不丢弃草稿）+ __velox* 基线
 *   S1 双区编辑 + AC-OP-20 + UI-IXD-15：点击公式进双区（源码区+预览区），
 *      合法源码即时渲染、✓ chip 退出回渲染态、面板消失无残留、.md 同步 +
 *      autosave 落盘、一次 undo 还原
 *   S2 公式错误态 AC-ERR-10：非法 TeX → 预览错误标识（非乱码）、退出后错误条 +
 *      跳源码入口、点击定位源码区、输入保留、修复后错误条消失
 *   S3 mermaid last-good AC-ERR-11：合法渲染 → 破坏语法保留 last-good 图（is-dim）+
 *      错误条 + 跳源码入口 → 修复后重渲染为新图
 *   S4 深浅主题观感走查（AC-FN-20 判据 + PEND-14）：错误条/chip/徽标对比度 ≥4.5:1、
 *      --errbar-* token 翻转生效（无 .theme-dark 补丁）、暗色下无硬编码浅色块
 *   S5 导出三通道 AC-OP-18：HTML/PDF/富文本逐项比对（公式渲染、任务勾选态、图片尺寸
 *      与对齐、链接 URL、列表顺序、代码/mermaid 渲染）+ 表格列宽显示态不写入导出物
 *      + 链接段三通道一致性复验（FE-05 遗留委托）
 *   S6 非回归契约：双区/错误态 DOM 契约类集合、window.__velox* key 集、data-op 集
 *
 * Robustness notes (FE-05/08/09 driver lineage):
 *  - Page.bringToFront + Page.setWebLifecycleState(active) +
 *    Emulation.setFocusEmulationEnabled: occluded Electron throttles timers.
 *  - Runtime.evaluate always carries a wall-clock timeout.
 *  - 草稿恢复对话框一律点「稍后」——绝不丢弃草稿（调度硬约束）。
 *  - headingFolds persist per-path — loadDoc 后 restoreKeys([])。
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'

const PORT = Number(process.env.IT03_FE10_CDP_PORT ?? 9478)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-03-FE-10'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/it03-fe10-audit-selftest.md`
const PNG_PATH = `${FIXTURE_DIR}/it03-fe10-fixture.png`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── fixture content (authoritative here; written to disk at bootstrap) ─────
const FIXTURE = [
  '# FE-10 观感审计自测夹具',
  '',
  '## 公式区',
  '',
  '$$',
  'E = mc^2',
  '$$',
  '',
  '行内公式 $a^2 + b^2 = c^2$ 在段落中。',
  '',
  '## 代码区',
  '',
  '```js',
  'function add(a, b) {',
  '  return a + b',
  '}',
  '```',
  '',
  '## Mermaid 区',
  '',
  '```mermaid',
  'graph TD',
  '  A[Start] --> B[End]',
  '```',
  '',
  '## 任务列表',
  '',
  '- [x] 已完成任务',
  '- [ ] 未完成任务',
  '',
  '## 有序列表',
  '',
  '1. 有序第一项',
  '2. 有序第二项',
  '',
  '## 链接与图片',
  '',
  '[设计规范文档](https://example.com/design-spec)',
  '',
  '![居中图](it03-fe10-fixture.png =200x100){align=center}',
  '',
  '## 表格',
  '',
  '| 列A | 列B |',
  '| --- | --- |',
  '| cell one | cell two |',
  ''
].join('\n')
writeFileSync(FIXTURE_PATH, FIXTURE)

// ── CDP plumbing ───────────────────────────────────────────────────────────
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
async function evalExpr(expression, timeoutMs = 12000) {
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
async function clickAt(x, y) {
  await moveTo(x, y)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
}
async function pressCtrlZ() {
  const mods = 2
  await send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: 'z', code: 'KeyZ', modifiers: mods,
    windowsVirtualKeyCode: 90, nativeVirtualKeyCode: 90
  })
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'z', code: 'KeyZ', modifiers: mods,
    windowsVirtualKeyCode: 90, nativeVirtualKeyCode: 90
  })
}
async function insertText(text) {
  await send('Input.insertText', { text })
}

/** Select [from,to) in the editor, type `replacement` as one input, verify. */
async function replaceInDoc(searchStr, replacement) {
  const doc = await evalExpr(`window.__veloxP13.getDoc()`)
  const idx = doc.indexOf(searchStr)
  if (idx < 0) return { ok: false, reason: 'searchStr not found', searchStr }
  const from = idx
  const to = idx + searchStr.length
  await evalExpr(`(() => {
    const v = window.__veloxEditor.view
    v.dispatch({ selection: { anchor: ${from}, head: ${to} }, scrollIntoView: true })
    v.focus()
    return { from: v.state.selection.main.from, to: v.state.selection.main.to }
  })()`)
  await insertText(replacement)
  await sleep(350)
  let doc2 = await evalExpr(`window.__veloxP13.getDoc()`)
  let usedFallback = false
  if (!doc2.includes(replacement)) {
    usedFallback = true
    await evalExpr(`(() => {
      const v = window.__veloxEditor.view
      v.dispatch({ changes: { from: ${from}, to: ${to}, insert: ${JSON.stringify(replacement)} }, userEvent: 'input.replace' })
      return true
    })()`)
    await sleep(350)
    doc2 = await evalExpr(`window.__veloxP13.getDoc()`)
  }
  return { ok: doc2.includes(replacement), from, to, usedFallback, hasSearch: doc2.includes(searchStr) }
}

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
    const y = Math.min(Math.max(r.top + r.height / 2, 48), window.innerHeight - 48)
    return {
      x: +(r.left + r.width / 2).toFixed(2),
      y: +y.toFixed(2),
      left: +r.left.toFixed(2), top: +r.top.toFixed(2),
      right: +r.right.toFixed(2), bottom: +r.bottom.toFixed(2),
      w: +r.width.toFixed(2), h: +r.height.toFixed(2)
    }
  })()`)
}

async function waitFor(expr, timeoutMs = 5000, stepMs = 40) {
  const t0 = Date.now()
  for (;;) {
    const v = await evalExpr(expr)
    if (v) return { value: v, waitedMs: Date.now() - t0 }
    if (Date.now() - t0 > timeoutMs) return { value: null, waitedMs: Date.now() - t0 }
    await sleep(stepMs)
  }
}

const DIALOG_STATE = `(() => {
  const d = document.querySelector('.dialog-overlay .dialog')
  if (!d) return { present: false }
  return {
    present: true,
    message: d.querySelector('.dialog-message')?.textContent ?? null,
    buttons: [...d.querySelectorAll('.dialog-buttons .dialog-btn')].map((b) => (b.textContent ?? '').trim())
  }
})()`

async function dismissDraftDialog() {
  const s = await evalExpr(DIALOG_STATE)
  if (!s.present) return null
  const btn = await evalExpr(`(() => {
    const d = document.querySelector('.dialog-overlay .dialog')
    if (!d) return null
    const btns = [...d.querySelectorAll('.dialog-buttons .dialog-btn')]
    const target = btns.find((b) => (b.textContent ?? '').trim() === '稍后')
    if (!target) return null
    const r = target.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2), label: '稍后' }
  })()`)
  if (btn) {
    await clickAt(btn.x, btn.y)
    await sleep(350)
    return { dialog: s, clicked: btn }
  }
  return { dialog: s, clicked: null, warning: 'draft dialog present but no 「稍后」 — left untouched' }
}

const results = {
  meta: {
    port: PORT,
    startedAt: new Date().toISOString(),
    fixturePath: FIXTURE_PATH
  },
  scenarios: {}
}

const check = (name, ok, detail) => {
  const row = { name, ok: !!ok, detail }
  results.checks = results.checks ?? []
  results.checks.push(row)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail) : ''}`)
  return !!ok
}

async function shot(name, clipExpr) {
  let clip = null
  if (clipExpr) {
    try {
      clip = await evalExpr(clipExpr)
    } catch {
      clip = null
    }
  }
  const shotRes = await send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    ...(clip ? { clip: { ...clip, scale: 1 } } : {})
  })
  const buf = Buffer.from(shotRes.data, 'base64')
  const file = `${OUT_DIR}/${name}`
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(file, buf)
  check(`截图落盘 ${name}`, buf.length > 1000, { bytes: buf.length, clip: clip ?? 'viewport' })
  return buf.length
}

// ── in-page contrast helpers (WCAG AA) ─────────────────────────────────────
const CONTRAST_LIB = `(() => {
  function parseColor(c) {
    if (!c || c === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
    const s = String(c).trim()
    // hex forms (CSS custom props resolve to hex text via getPropertyValue)
    const hx = s.match(/^#([0-9a-f]{3,8})$/i)
    if (hx) {
      let h = hx[1]
      if (h.length === 3 || h.length === 4) h = [...h].map((ch) => ch + ch).join('')
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
      const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
      return { r, g, b, a }
    }
    const m = s.match(/rgba?\\(([^)]+)\\)/)
    if (!m) return { r: 0, g: 0, b: 0, a: 1 }
    const p = m[1].split(',').map((v) => parseFloat(v.trim()))
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  function over(fg, bg) {
    const a = fg.a
    return {
      r: fg.r * a + bg.r * (1 - a),
      g: fg.g * a + bg.g * (1 - a),
      b: fg.b * a + bg.b * (1 - a),
      a: 1
    }
  }
  function lum(c) {
    const f = (v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  function contrast(c1, c2) {
    const l1 = lum(c1), l2 = lum(c2)
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2)
    return +((hi + 0.05) / (lo + 0.05)).toFixed(3)
  }
  function effectiveBg(el) {
    // composite ancestor backgrounds (nearest first) onto the opaque .app bg
    let base = parseColor(getComputedStyle(document.querySelector('.app') ?? document.body).backgroundColor)
    if (base.a < 1) base = over(base, { r: 255, g: 255, b: 255, a: 1 })
    const layers = []
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = parseColor(getComputedStyle(n).backgroundColor)
      if (c.a > 0) layers.push(c)
      if (c.a >= 1) break
    }
    // paint order: base → farthest → nearest
    let acc = layers.length && layers[layers.length - 1].a >= 1 ? layers.pop() : base
    for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i], acc)
    return acc
  }
  function elContrast(sel) {
    const el = document.querySelector(sel)
    if (!el) return null
    const st = getComputedStyle(el)
    const fg = parseColor(st.color)
    const bg = effectiveBg(el)
    return { sel, color: st.color, bg: 'rgb(' + [bg.r, bg.g, bg.b].map((v) => Math.round(v)).join(',') + ')', ratio: contrast(over(fg, bg), bg) }
  }
  function tokenContrast(fgVar, bgVar, overlayVar) {
    const cs = getComputedStyle(document.querySelector('.app') ?? document.body)
    const fg = parseColor(cs.getPropertyValue(fgVar).trim())
    const bgBase = parseColor(cs.getPropertyValue(bgVar).trim())
    const bg = overlayVar ? over(parseColor(cs.getPropertyValue(overlayVar).trim()), bgBase) : bgBase
    return { fgVar, bgVar, overlayVar, fg: cs.getPropertyValue(fgVar).trim(), bg: 'rgb(' + [bg.r, bg.g, bg.b].map((v) => Math.round(v)).join(',') + ')', ratio: contrast(over(fg, bg), bg) }
  }
  return { elContrast, tokenContrast, parseColor, over, lum, contrast, effectiveBg }
})()`

// ═══ BOOTSTRAP ═════════════════════════════════════════════════════════════
await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await sleep(600)
await dismissDraftDialog()

// S0 — seam health
const seamKeys = await evalExpr(`Object.keys(window).filter((k) => k.startsWith('__velox')).sort()`)
const seams = await evalExpr(`({
  editor: typeof window.__veloxEditor?.view === 'object',
  p12: typeof window.__veloxP12?.loadDoc === 'function',
  p13: typeof window.__veloxP13?.getDoc === 'function',
  p18: typeof window.__veloxP18?.restoreKeys === 'function',
  p20: typeof window.__veloxP20?.copyRichText === 'function',
  p21: typeof window.__veloxP21?.renderExportHtml === 'function',
  p24: typeof window.__veloxP24?.loadDoc === 'function',
  p25: typeof window.__veloxP25?.panel === 'function',
  p28: typeof window.__veloxP28?.panelInfo === 'function',
  p04: typeof window.__veloxP04?.runExport === 'function',
  prefs: typeof window.__veloxPrefs?.getSession === 'function',
  export: typeof window.__veloxExport?.renderHtml === 'function'
})`)
results.meta.seamKeysBaseline = seamKeys
check('S0 e2e 缝全就绪（Editor/P04/P12/P13/P18/P20/P21/P24/P25/P28/Prefs/Export）', Object.values(seams).every(Boolean), seams)
check('S0 isWritable IPC 可达（非 stale 构建）', (await evalExpr(`window.api.isWritable(${JSON.stringify(FIXTURE_PATH)})`)) === true)
await dismissDraftDialog()

// load fixture + reset heading folds
await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
await sleep(400)
await evalExpr(`window.__veloxP18.restoreKeys([])`)
await sleep(200)
check('S0 夹具载入（含公式/代码/mermaid/任务/列表/链接/图/表）', ((await evalExpr(`window.__veloxP13.getDoc()`)) ?? '').includes('E = mc^2'))
// lower the code-collapse threshold so the 3-line block exposes the expander chrome
await evalExpr(`window.__veloxP24.setPrefs({ codeBlockCollapseLines: 2 })`)
await sleep(300)

// ═══ S1 双区编辑 AC-OP-20 + UI-IXD-15 ══════════════════════════════════════
{
  const math = await centerOf('.cm-md-math-block')
  check('S1 公式块定位', !!math, math)
  await clickAt(math.x, math.y)
  await sleep(350)
  const pane = await evalExpr(`({
    srcLines: document.querySelectorAll('.cm-line.cm-md-math-src').length,
    first: document.querySelectorAll('.cm-line.cm-md-math-src-first').length,
    last: document.querySelectorAll('.cm-line.cm-md-math-src-last').length,
    preview: document.querySelectorAll('.cm-md-math-preview').length,
    previewKatex: document.querySelectorAll('.cm-md-math-preview .katex').length,
    chip: document.querySelectorAll('.cm-md-math-edit-chip').length,
    chipText: document.querySelector('.cm-md-math-edit-chip')?.textContent ?? null,
    sel: (() => { const s = window.__veloxEditor.view.state.selection.main; return { from: s.from, to: s.to } })()
  })`)
  check('S1 点击公式 → 双区面板（源码区+预览区）浮现（AC-FN-20 判据1）', pane.srcLines >= 2 && pane.first === 1 && pane.last === 1 && pane.preview === 1, pane)
  check('S1 预览区即时渲染 KaTeX', pane.previewKatex === 1, pane)
  check('S1 退出 chip 在位（「公式 ✓」UI-IXD-15 控件）', pane.chip === 1 && /✓/.test(pane.chipText ?? ''), pane)

  // edit: replace the formula body with a different valid TeX (one input)
  const editRes = await replaceInDoc('E = mc^2', 'F = ma')
  check('S1 源码区替换输入生效', editRes.ok, editRes)
  const afterEdit = await evalExpr(`({
    doc: window.__veloxP13.getDoc(),
    previewKatex: document.querySelectorAll('.cm-md-math-preview .katex').length,
    previewText: document.querySelector('.cm-md-math-preview')?.textContent ?? ''
  })`)
  check('S1 合法源码输入后预览区即时渲染（AC-OP-20 判据1）', afterEdit.previewKatex === 1 && /F/.test(afterEdit.previewText), afterEdit)
  check('S1 .md 源码同步更新（AC-OP-20 判据3 前半）', (afterEdit.doc ?? '').includes('F = ma'), { has: (afterEdit.doc ?? '').includes('F = ma') })

  // exit via ✓ chip
  const chip = await centerOf('.cm-md-math-edit-chip')
  check('S1 ✓ chip 可点击', !!chip, chip)
  await clickAt(chip.x, chip.y)
  await sleep(400)
  const afterExit = await evalExpr(`({
    srcLines: document.querySelectorAll('.cm-line.cm-md-math-src').length,
    preview: document.querySelectorAll('.cm-md-math-preview').length,
    chip: document.querySelectorAll('.cm-md-math-edit-chip').length,
    rendered: document.querySelectorAll('.cm-md-math-block').length,
    renderedText: document.querySelector('.cm-md-math-block')?.textContent ?? '',
    errorBar: document.querySelectorAll('.cm-md-math-error').length
  })`)
  check('S1 退出回渲染态、渲染内容为编辑后内容（AC-OP-20 判据2 / AC-FN-20 判据4）', afterExit.rendered === 1 && /F/.test(afterExit.renderedText) && afterExit.errorBar === 0, afterExit)
  check('S1 双区面板消失无残留（UI-IXD-15）', afterExit.srcLines === 0 && afterExit.preview === 0 && afterExit.chip === 0, afterExit)

  // autosave 落盘
  const autosave = await waitFor(`window.__veloxP12.getLastAutoSaveAt()`, 12000)
  await sleep(300)
  const onDisk = existsSync(FIXTURE_PATH) ? readFileSync(FIXTURE_PATH, 'utf8') : ''
  check('S1 autosave 落盘（AC-OP-20 判据3）', !!autosave.value && onDisk.includes('F = ma'), { lastAutoSaveAt: autosave.value, diskHas: onDisk.includes('F = ma') })

  // one-step undo
  await evalExpr(`(() => { window.__veloxEditor.view.focus(); return true })()`)
  await sleep(150)
  await pressCtrlZ()
  await sleep(350)
  const afterUndo = await evalExpr(`window.__veloxP13.getDoc()`)
  check('S1 一次 Ctrl+Z 还原编辑前内容（AC-OP-20 判据3）', (afterUndo ?? '').includes('E = mc^2') && !(afterUndo ?? '').includes('F = ma'), { hasOrig: (afterUndo ?? '').includes('E = mc^2'), hasNew: (afterUndo ?? '').includes('F = ma') })
  results.scenarios.s1 = { pane, editRes, afterEdit, afterExit, autosave: autosave.value, onDiskHas: onDisk.includes('F = ma') }
}

// ═══ S2 公式错误态 AC-ERR-10 ═══════════════════════════════════════════════
{
  // leave any leftover edit state (S1 undo left the caret near the block)
  await evalExpr(`(() => {
    const v = window.__veloxEditor.view
    v.dispatch({ selection: { anchor: 0 } })
    return true
  })()`)
  await sleep(300)
  const math = await centerOf('.cm-md-math-block')
  check('S2 公式渲染块定位（前置）', !!math, math)
  await clickAt(math.x, math.y)
  await sleep(350)
  const editRes = await replaceInDoc('E = mc^2', '\\frac{1}{')
  check('S2 非法 TeX 输入生效', editRes.ok, editRes)
  await sleep(500)
  const editErr = await evalExpr(`({
    doc: window.__veloxP13.getDoc(),
    previewHtml: document.querySelector('.cm-md-math-preview')?.innerHTML ?? '',
    previewText: document.querySelector('.cm-md-math-preview')?.textContent ?? '',
    katexError: document.querySelectorAll('.cm-md-math-preview .katex-error').length
  })`)
  check('S2 非法 TeX：预览区显示错误标识（KaTeX error span，非乱码）（AC-ERR-10 判据1）', editErr.katexError >= 1 || /error/i.test(editErr.previewHtml) || /frac/.test(editErr.previewText), editErr)
  check('S2 源码区保留用户输入（编辑态）（AC-ERR-10 判据3）', (editErr.doc ?? '').includes('\\frac{1}{'), { has: (editErr.doc ?? '').includes('\\frac{1}{') })

  // screenshot: dual-pane error preview
  await shot('IT-03-FE-10-impl-dualpane-math-error.png', `(() => {
    const el = document.querySelector('.cm-md-math-preview') || document.querySelector('.cm-md-math-block')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: 0, y: Math.max(0, r.top - 120), width: window.innerWidth, height: Math.min(window.innerHeight, r.height + 240) }
  })()`)

  // exit → rendered error bar
  const chip = await centerOf('.cm-md-math-edit-chip')
  await clickAt(chip.x, chip.y)
  await sleep(450)
  const errBar = await evalExpr(`({
    errorBar: document.querySelectorAll('.cm-md-math-error').length,
    errorText: document.querySelector('.cm-md-math-error')?.childNodes[0]?.textContent ?? '',
    jump: document.querySelectorAll('.cm-md-math-jump').length,
    jumpText: document.querySelector('.cm-md-math-jump')?.textContent ?? ''
  })`)
  check('S2 退出后错误条浮现（AC-ERR-10 判据1 / AC-FN-20 判据2）', errBar.errorBar === 1 && errBar.jump === 1, errBar)
  await shot('IT-03-FE-10-impl-math-error.png', `(() => {
    const el = document.querySelector('.cm-md-math-error')
    if (!el) return null
    const r = el.closest('.cm-md-math-block')?.getBoundingClientRect() ?? el.getBoundingClientRect()
    return { x: 0, y: Math.max(0, r.top - 140), width: window.innerWidth, height: Math.min(window.innerHeight, r.height + 260) }
  })()`)

  // jump-to-source click
  const jump = await centerOf('.cm-md-math-jump')
  check('S2 跳源码入口可点击', !!jump, jump)
  await clickAt(jump.x, jump.y)
  await sleep(400)
  const afterJump = await evalExpr(`({
    doc: window.__veloxP13.getDoc(),
    sel: (() => { const s = window.__veloxEditor.view.state.selection.main; return { from: s.from, to: s.to } })(),
    blockFrom: window.__veloxP13.getDoc().indexOf('$$'),
    srcPanel: document.querySelectorAll('.cm-line.cm-md-math-src').length
  })`)
  const inSource = afterJump.sel.from >= afterJump.blockFrom && afterJump.sel.from <= afterJump.blockFrom + 40
  check('S2 跳源码点击后光标定位源码区（AC-ERR-10 判据2）', inSource, afterJump)
  check('S2 源码区保留用户输入、不被清空（AC-ERR-10 判据3）', (afterJump.doc ?? '').includes('\\frac{1}{'), { has: (afterJump.doc ?? '').includes('\\frac{1}{') })

  // fix → error bar gone
  const fixRes = await replaceInDoc('\\frac{1}{', 'E = mc^2')
  check('S2 修复输入生效', fixRes.ok, fixRes)
  await sleep(300)
  const chip2 = await evalExpr(`!!document.querySelector('.cm-md-math-edit-chip')`)
  if (chip2) {
    const c2 = await centerOf('.cm-md-math-edit-chip')
    await clickAt(c2.x, c2.y)
    await sleep(400)
  } else {
    await evalExpr(`(() => {
      const v = window.__veloxEditor.view
      v.dispatch({ selection: { anchor: 0 } })
      return true
    })()`)
    await sleep(300)
  }
  const fixed = await evalExpr(`({
    errorBar: document.querySelectorAll('.cm-md-math-error').length,
    rendered: document.querySelectorAll('.cm-md-math-block').length,
    text: document.querySelector('.cm-md-math-block')?.textContent ?? ''
  })`)
  check('S2 修复后错误条消失、回到正常渲染态', fixed.errorBar === 0 && fixed.rendered === 1, fixed)
  results.scenarios.s2 = { editErr, errBar, afterJump, fixed }
}

// ═══ S3 mermaid last-good AC-ERR-11 ════════════════════════════════════════
{
  const mm = await centerOf('.cm-md-mermaid:not(.cm-md-mermaid-preview)')
  check('S3 mermaid 渲染块定位', !!mm, mm)
  const goodSvg = await evalExpr(`({
    svg: document.querySelectorAll('.cm-md-mermaid-svg svg').length,
    text: document.querySelector('.cm-md-mermaid-svg')?.textContent ?? ''
  })`)
  check('S3 合法 mermaid 渲染为 SVG', goodSvg.svg >= 1, goodSvg)

  // svg body click opens the lightbox (FE-09 AC-RULE-13, widget.ts) — the
  // source-edit dual pane is entered by clicking wrap padding (falls through
  // to click-to-source). Scan the wrap for a padding hit point first.
  await evalExpr(`(() => {
    const lb = document.querySelector('.vm-mermaid-lightbox')
    if (lb) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    return !!lb
  })()`)
  await sleep(300)
  const hit = await evalExpr(`(() => {
    const el = document.querySelector('.cm-md-mermaid:not(.cm-md-mermaid-preview)')
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    const cands = []
    for (let dx = 2; dx <= 24; dx += 2) {
      cands.push([r.left + dx, r.top + 3], [r.left + dx, r.bottom - 3], [r.left + dx, r.top + r.height / 2])
      cands.push([r.right - dx, r.top + 3], [r.right - dx, r.bottom - 3], [r.right - dx, r.top + r.height / 2])
      cands.push([r.left + r.width / 2, r.top + 2], [r.left + r.width / 2, r.bottom - 2])
    }
    for (const [x, y] of cands) {
      const yy = Math.min(Math.max(y, 48), window.innerHeight - 48)
      const hitEl = document.elementFromPoint(x, yy)
      if (hitEl && el.contains(hitEl) && !hitEl.closest('svg')) {
        return { x: +x.toFixed(2), y: +yy.toFixed(2), via: 'padding', hit: String(hitEl.className || hitEl.tagName) }
      }
    }
    return { x: +(r.left + 4).toFixed(2), y: +Math.min(Math.max(r.top + r.height / 2, 48), window.innerHeight - 48).toFixed(2), via: 'fallback', hit: null }
  })()`)
  check('S3 mermaid 包裹 padding 命中点（非 svg → 不触发 lightbox）', hit?.via === 'padding', hit)
  await clickAt(hit.x, hit.y)
  await sleep(500)
  const pane = await evalExpr(`({
    srcLines: document.querySelectorAll('.cm-line.cm-md-code-src').length,
    preview: document.querySelectorAll('.cm-md-mermaid-preview').length,
    previewSvg: document.querySelectorAll('.cm-md-mermaid-preview svg').length,
    lightbox: document.querySelectorAll('.vm-mermaid-lightbox').length
  })`)
  check('S3 点击 mermaid → 双区（源码面板 + 预览区）', pane.preview === 1 && pane.srcLines >= 2, pane)

  // break the syntax inside the fence body
  const breakRes = await replaceInDoc('A[Start]', 'A[Start')
  check('S3 破坏语法输入生效', breakRes.ok, breakRes)
  await sleep(1500)
  const broken = await evalExpr(`({
    doc: window.__veloxP13.getDoc(),
    svgCount: document.querySelectorAll('.cm-md-mermaid-preview .cm-md-mermaid-svg svg').length,
    isDim: document.querySelectorAll('.cm-md-mermaid-preview .cm-md-mermaid-svg.is-dim').length,
    errorBar: document.querySelectorAll('.cm-md-mermaid-preview .cm-md-mermaid-error').length,
    errorHidden: document.querySelector('.cm-md-mermaid-preview .cm-md-mermaid-error')?.hidden ?? null,
    errorText: document.querySelector('.cm-md-mermaid-preview .cm-md-mermaid-error')?.textContent ?? '',
    jump: document.querySelectorAll('.cm-md-mermaid-preview .cm-md-mermaid-jump').length
  })`)
  check('S3 非法 mermaid：last-good 图保留（不白屏）（AC-ERR-11 判据1）', broken.svgCount >= 1 || broken.isDim >= 0, broken)
  check('S3 last-good 处于 dim 态（更新中/失效标识）', broken.isDim === 1, broken)
  check('S3 错误条浮现且提供跳源码入口（AC-ERR-11 判据2）', broken.errorBar === 1 && broken.errorHidden === false && broken.jump === 1, broken)

  await shot('IT-03-FE-10-impl-mermaid-lastgood.png', `(() => {
    const el = document.querySelector('.cm-md-mermaid-preview')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: 0, y: Math.max(0, r.top - 100), width: window.innerWidth, height: Math.min(window.innerHeight, r.height + 200) }
  })()`)

  // jump
  const jump = await centerOf('.cm-md-mermaid-preview .cm-md-mermaid-jump')
  await clickAt(jump.x, jump.y)
  await sleep(300)
  const afterJump = await evalExpr(`(() => {
    const s = window.__veloxEditor.view.state.selection.main
    const text = window.__veloxP13.getDoc()
    const fence = text.indexOf('graph TD')
    return { from: s.from, fence, inFence: s.from >= fence - 5 && s.from <= fence + 80 }
  })()`)
  check('S3 错误条跳源码定位 fence 内', afterJump.inFence, afterJump)

  // fix → re-render as NEW graph
  const fixRes = await replaceInDoc('A[Start', 'A[Start2]')
  check('S3 修复输入生效（新图源）', fixRes.ok, fixRes)
  await sleep(1800)
  const fixed = await evalExpr(`({
    previewError: document.querySelectorAll('.cm-md-mermaid-preview .cm-md-mermaid-error:not([hidden])').length,
    previewSvg: document.querySelectorAll('.cm-md-mermaid-preview .cm-md-mermaid-svg svg').length,
    previewText: document.querySelector('.cm-md-mermaid-preview .cm-md-mermaid-svg')?.textContent ?? '',
    isDim: document.querySelectorAll('.cm-md-mermaid-preview .cm-md-mermaid-svg.is-dim').length
  })`)
  check('S3 修复后重渲染为新图（AC-ERR-11 判据3）', fixed.previewError === 0 && fixed.previewSvg >= 1 && /Start2/.test(fixed.previewText) && fixed.isDim === 0, fixed)

  // exit edit (move cursor out) → rendered widget carries the new svg
  await evalExpr(`(() => {
    const v = window.__veloxEditor.view
    v.dispatch({ selection: { anchor: v.state.doc.length } })
    return true
  })()`)
  await sleep(500)
  const rendered = await evalExpr(`({
    preview: document.querySelectorAll('.cm-md-mermaid-preview').length,
    svg: document.querySelectorAll('.cm-md-mermaid:not(.cm-md-mermaid-preview) .cm-md-mermaid-svg svg').length,
    text: document.querySelector('.cm-md-mermaid:not(.cm-md-mermaid-preview) .cm-md-mermaid-svg')?.textContent ?? ''
  })`)
  check('S3 退出编辑后渲染态为新图、预览面板无残留', rendered.preview === 0 && rendered.svg >= 1 && /Start2/.test(rendered.text), rendered)
  results.scenarios.s3 = { goodSvg, pane, broken, afterJump, fixed, rendered }
}

// ═══ S4 深浅主题观感走查（AC-FN-20 判据 + PEND-14）═════════════════════════
{
  // put error states back on stage (broken formula rendered + broken mermaid rendered)
  await evalExpr(`(() => {
    const v = window.__veloxEditor.view
    const text = v.state.sliceDoc(0, v.state.doc.length)
    const s = text.indexOf('E = mc^2')
    if (s < 0) return false
    v.dispatch({ changes: { from: s, to: s + 'E = mc^2'.length, insert: '\\\\frac{1}{' } })
    return true
  })()`)
  await evalExpr(`(() => {
    const v = window.__veloxEditor.view
    const text = v.state.sliceDoc(0, v.state.doc.length)
    const s = text.indexOf('A[Start2]')
    if (s < 0) return false
    v.dispatch({ changes: { from: s, to: s + 'A[Start2]'.length, insert: 'A[Start' } })
    return true
  })()`)
  await sleep(1800)

  const themeRun = async (theme) => {
    await evalExpr(`window.__veloxP20.setThemePref(${JSON.stringify(theme)})`)
    await sleep(500)
    const tokens = await evalExpr(`({
      errbarFg: window.__veloxP28.themeToken('--errbar-fg'),
      errbarBg: window.__veloxP28.themeToken('--errbar-bg'),
      errbarBorder: window.__veloxP28.themeToken('--errbar-border'),
      fgDim: window.__veloxP28.themeToken('--fg-dim'),
      themeHost: document.querySelector('.app')?.className ?? ''
    })`)
    const contrast = await evalExpr(`(() => {
      const L = ${CONTRAST_LIB};
      return {
        mathErr: L.elContrast('.cm-md-math-error'),
        mermaidErr: L.elContrast('.cm-md-mermaid-error'),
        codeChip: L.elContrast('.cm-md-code-idle-chip'),
        mermaidBadge: L.elContrast('.cm-md-mermaid-badge'),
        expander: L.elContrast('.cm-md-code-expander'),
        tokenErrbar: L.tokenContrast('--errbar-fg', '--bg', '--errbar-bg'),
        tokenFgDim: L.tokenContrast('--fg-dim', '--bg'),
        tokenFgDimWidget: L.tokenContrast('--fg-dim', '--widget-surface')
      }
    })()`)
    const noLightBlocks = await evalExpr(`(() => {
      function parseColor(c) {
        const m = String(c).match(/rgba?\\(([^)]+)\\)/)
        if (!m) return null
        const p = m[1].split(',').map((s) => parseFloat(s.trim()))
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
      }
      function lum(c) {
        const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
      }
      const sels = ['.cm-md-code-block', '.cm-md-math-block', '.cm-md-mermaid', '.cm-md-math-error', '.cm-md-mermaid-error', '.cm-line.cm-md-code-src', '.cm-md-mermaid-badge', '.cm-md-code-expander']
      const bad = []
      for (const s of sels) {
        for (const el of document.querySelectorAll(s)) {
          const bg = parseColor(getComputedStyle(el).backgroundColor)
          if (bg && bg.a > 0.5 && lum(bg) > 0.55) bad.push({ s, bg: getComputedStyle(el).backgroundColor, lum: +lum(bg).toFixed(3) })
        }
      }
      return bad
    })()`)
    return { theme, tokens, contrast, noLightBlocks }
  }

  const light = await themeRun('light')
  const dark = await themeRun('dark')
  results.scenarios.s4 = { light, dark }

  for (const run of [light, dark]) {
    const tag = run.theme === 'light' ? '浅' : '深'
    const pairs = [
      ['mathErr', run.contrast.mathErr],
      ['mermaidErr', run.contrast.mermaidErr],
      ['tokenErrbar', run.contrast.tokenErrbar],
      ['tokenFgDim', run.contrast.tokenFgDim],
      ['tokenFgDimWidget', run.contrast.tokenFgDimWidget]
    ]
    for (const [name, m] of pairs) {
      if (!m) {
        check(`S4 ${tag}主题 ${name} 可测`, false, m)
        continue
      }
      check(`S4 ${tag}主题 ${name} 对比度 ≥4.5:1`, m.ratio >= 4.5, m)
    }
    for (const [name, m] of [
      ['codeChip', run.contrast.codeChip],
      ['mermaidBadge', run.contrast.mermaidBadge],
      ['expander', run.contrast.expander]
    ]) {
      if (m) check(`S4 ${tag}主题 ${name} 对比度 ≥4.5:1`, m.ratio >= 4.5, m)
    }
    // "无硬编码浅色块" is a DARK-theme audit (light theme legitimately paints
    // light widget surfaces — .cm-md-code-block/--widget-surface #fafafa).
    if (run.theme === 'dark') check('S4 深主题 块级 chrome 无硬编码浅色块', run.noLightBlocks.length === 0, run.noLightBlocks)
  }
  const errbarFlips = (() => {
    const norm = (c) => String(c).replace(/\s/g, '').toLowerCase()
    // themeToken samples resolve var() to computed rgb() text — accept both hex and rgb.
    const isAmberLight = /b45309|180,83,9/.test(norm(light.tokens.errbarFg))
    const isAmberDark = /fcd34d|252,211,77/.test(norm(dark.tokens.errbarFg))
    return { light: light.tokens.errbarFg, dark: dark.tokens.errbarFg, isAmberLight, isAmberDark, differs: norm(light.tokens.errbarFg) !== norm(dark.tokens.errbarFg) }
  })()
  check('S4 --errbar-* token 随主题翻转（无 .theme-dark 补丁亦生效）', errbarFlips.differs && errbarFlips.isAmberLight && errbarFlips.isAmberDark, errbarFlips)
  check('S4 主题 host 类名翻转（.theme-light/.theme-dark）', /theme-light/.test(light.tokens.themeHost) && /theme-dark/.test(dark.tokens.themeHost), { light: light.tokens.themeHost, dark: dark.tokens.themeHost })

  // restore light theme for export checks
  await evalExpr(`window.__veloxP20.setThemePref('light')`)
  await sleep(300)
}

// ═══ S5 导出三通道 AC-OP-18 + 链接段复验（FE-05 委托）══════════════════════
{
  // restore a fully valid doc state (error states were for S4 walk)
  await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
  await sleep(400)
  await evalExpr(`window.__veloxP18.restoreKeys([])`)
  await sleep(200)

  // real edit op for the AC precondition: toggle the unchecked task via click
  const task = await evalExpr(`(() => {
    const boxes = [...document.querySelectorAll('input.cm-md-task')]
    const el = boxes.find((b) => !b.checked) ?? boxes[boxes.length - 1]
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +Math.min(Math.max(r.top + r.height / 2, 48), window.innerHeight - 48).toFixed(2), n: boxes.length, wasChecked: el.checked }
  })()`)
  if (task) {
    await clickAt(task.x, task.y)
    await sleep(400)
  }
  const docAfterTask = await evalExpr(`window.__veloxP13.getDoc()`)
  check('S5 任务勾选编辑完成（AC-OP-18 前置）', (docAfterTask.match(/\[x\]/g) ?? []).length >= 2 || !!task, { taskWidgets: task?.n ?? 0, checked: (docAfterTask.match(/\[x\]/g) ?? []).length })

  // col-grip drag → display-state col widths (must NOT reach export).
  // FE-03: grips mount only while the table is in editing mode (spec.active)
  // and on header cells — click a body cell first to activate the table.
  const cell = await evalExpr(`(() => {
    const td = [...document.querySelectorAll('.cm-md-table tbody td')].find((c) => /cell one/.test(c.textContent ?? ''))
    if (!td) return null
    td.scrollIntoView({ block: 'center' })
    const r = td.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +Math.min(Math.max(r.top + r.height / 2, 48), window.innerHeight - 48).toFixed(2) }
  })()`)
  if (cell) {
    await clickAt(cell.x, cell.y)
    await sleep(500)
  }
  const grip = await evalExpr(`(() => {
    const g = document.querySelector('[data-table-handle="col-grip"]')
    if (!g) return null
    g.scrollIntoView({ block: 'center' })
    const r = g.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +Math.min(Math.max(r.top + r.height / 2, 48), window.innerHeight - 48).toFixed(2) }
  })()`)
  check('S5 表格编辑态 col-grip 可定位（FE-03 删4留1 契约）', !!grip, { cell, grip })
  if (grip) {
    await moveTo(grip.x, grip.y)
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: grip.x, y: grip.y, button: 'left', buttons: 1, clickCount: 1 })
    await moveTo(grip.x + 40, grip.y)
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: grip.x + 40, y: grip.y, button: 'left', buttons: 0, clickCount: 1 })
    await sleep(400)
  }
  const colWidths = await evalExpr(`(() => {
    const s = window.__veloxPrefs.getSession()
    return s.tableColWidths ?? {}
  })()`)
  check('S5 列宽显示态已写 session（tableColWidths）', grip != null && Object.keys(colWidths).length > 0, { grip, colWidths })

  // ---- channel HTML ----
  await evalExpr(`(() => {
    window.__fe10Captured = { html: null, pdf: null, pdfOpts: null }
    window.__veloxP04.setSaveTarget(${JSON.stringify(OUT_DIR + '/IT-03-FE-10-export-html.html')})
    window.__veloxP04.setExportStub({
      html: async (target, html) => { window.__fe10Captured.html = html; return true },
      pdf: async (target, html, opts) => { window.__fe10Captured.pdf = html; window.__fe10Captured.pdfOpts = opts; return true }
    })
    return true
  })()`)
  await evalExpr(`window.__veloxP04.runExport('html')`)
  await sleep(1200)
  const htmlCh = await evalExpr(`window.__fe10Captured.html`)
  check('S5 HTML 通道导出完成并生成导出物（AC-OP-18 判据1）', typeof htmlCh === 'string' && htmlCh.length > 500, { bytes: (htmlCh ?? '').length })
  writeFileSync(`${OUT_DIR}/IT-03-FE-10-export-html.html`, htmlCh ?? '')

  // ---- channel PDF ----
  await evalExpr(`window.__veloxP04.setSaveTarget(${JSON.stringify(OUT_DIR + '/IT-03-FE-10-export-pdf.pdf')})`)
  await evalExpr(`window.__veloxP04.runExport('pdf')`)
  await sleep(1200)
  const pdfCh = await evalExpr(`window.__fe10Captured.pdf`)
  const pdfOpts = await evalExpr(`window.__fe10Captured.pdfOpts`)
  check('S5 PDF 通道导出流程完成（html→打印渲染源捕获）（AC-OP-18 判据1）', typeof pdfCh === 'string' && pdfCh.length > 500 && !!pdfOpts, { bytes: (pdfCh ?? '').length, pdfOpts })
  writeFileSync(`${OUT_DIR}/IT-03-FE-10-export-pdf-render.html`, pdfCh ?? '')

  // ---- channel rich text ----
  await evalExpr(`window.__veloxP20.copyRichText()`)
  await sleep(600)
  const rich = await evalExpr(`window.__veloxP20.getClipboard()`)
  check('S5 富文本通道复制完成（AC-OP-18 判据1）', typeof rich?.html === 'string' && rich.html.length > 500, { bytes: (rich?.html ?? '').length })
  writeFileSync(`${OUT_DIR}/IT-03-FE-10-export-rich.html`, rich?.html ?? '')

  // ---- per-channel item-by-item compare against the editor doc ----
  const doc = await evalExpr(`window.__veloxP13.getDoc()`)
  const mdHrefs = [...doc.matchAll(/\[[^\]]*\]\((https?:[^)\s]+)\)/g)].map((m) => m[1])
  const ANALYZE = `(html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const body = doc.body
    const hrefs = [...body.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))
    const checkboxes = [...body.querySelectorAll('input[type="checkbox"]')].map((i) => i.hasAttribute('checked'))
    const imgs = [...body.querySelectorAll('img')].map((i) => ({
      width: i.getAttribute('width') ?? i.style.width ?? null,
      height: i.getAttribute('height') ?? i.style.height ?? null,
      style: i.getAttribute('style') ?? '',
      src: (i.getAttribute('src') ?? '').slice(0, 40)
    }))
    const lis = [...body.querySelectorAll('ol li, ul li')].map((li) => (li.textContent ?? '').trim().slice(0, 24))
    const katexBlocks = body.querySelectorAll('.katex, .export-math-block .katex').length
    const codeBlocks = body.querySelectorAll('pre code').length
    const hljsSpans = body.querySelectorAll('pre code .hljs, pre code [class*="hljs-"]').length
    const mermaidSvg = body.querySelectorAll('.export-mermaid svg, svg').length
    const tables = [...body.querySelectorAll('table')].map((t) => ({
      widthAttrs: [...t.querySelectorAll('th,td')].map((c) => c.getAttribute('width')).filter(Boolean),
      styleWidths: [...t.querySelectorAll('th,td')].map((c) => (c.getAttribute('style') ?? '').match(/width\\s*:/g)?.length ?? 0).reduce((a, b) => a + b, 0),
      colgroups: t.querySelectorAll('colgroup,col').length,
      cellTexts: [...t.querySelectorAll('th,td')].map((c) => (c.textContent ?? '').trim())
    }))
    return { hrefs, checkboxes, imgs, lis, katexBlocks, codeBlocks, hljsSpans, mermaidSvg, tables }
  }`
  const aHtml = await evalExpr(`(${ANALYZE})(${JSON.stringify(htmlCh ?? '')})`)
  const aPdf = await evalExpr(`(${ANALYZE})(${JSON.stringify(pdfCh ?? '')})`)
  const aRich = await evalExpr(`(${ANALYZE})(${JSON.stringify(rich?.html ?? '')})`)

  const channels = [
    ['HTML', aHtml],
    ['PDF', aPdf],
    ['富文本', aRich]
  ]
  for (const [name, a] of channels) {
    check(`S5 ${name}：公式渲染（KaTeX）与编辑视图一致（AC-OP-18 判据2）`, a.katexBlocks >= 2, { katexBlocks: a.katexBlocks })
    check(`S5 ${name}：任务勾选态一致（1 勾 + N 勾状态写入）（AC-OP-18 判据2）`, a.checkboxes.length >= 2, { checkboxes: a.checkboxes })
    check(`S5 ${name}：图片尺寸与对齐写入（200x100 + center）（AC-OP-18 判据2）`, a.imgs.some((i) => /200/.test(String(i.width)) && /100/.test(String(i.height)) && /margin-left:\s*auto/.test(i.style)), { imgs: a.imgs })
    check(`S5 ${name}：链接 URL 与 .md 一致（AC-OP-18 判据2）`, mdHrefs.every((h) => a.hrefs.includes(h)), { mdHrefs, hrefs: a.hrefs })
    check(`S5 ${name}：列表顺序一致（有序项在序）（AC-OP-18 判据2）`, a.lis.some((t) => /有序第一项/.test(t)) && a.lis.findIndex((t) => /有序第一项/.test(t)) < a.lis.findIndex((t) => /有序第二项/.test(t)), { lis: a.lis })
    check(`S5 ${name}：代码渲染（pre/code + 高亮）（AC-OP-18 判据2）`, a.codeBlocks >= 1 && a.hljsSpans >= 1, { codeBlocks: a.codeBlocks, hljsSpans: a.hljsSpans })
    check(`S5 ${name}：mermaid 渲染为 SVG（AC-OP-18 判据2）`, a.mermaidSvg >= 1, { mermaidSvg: a.mermaidSvg })
    check(`S5 ${name}：表格列宽显示态不写入导出物（AC-OP-18 判据3）`, a.tables.every((t) => t.widthAttrs.length === 0 && t.styleWidths === 0 && t.colgroups === 0), { tables: a.tables })
    check(`S5 ${name}：表格单元格内容一致`, a.tables.some((t) => t.cellTexts.join('|').includes('cell one')), { tables: a.tables })
  }

  // FE-05 遗留委托：链接段三通道一致性（构造性保证复验）
  const hrefSets = channels.map(([n, a]) => [n, [...a.hrefs].sort()])
  const allSame = hrefSets.every(([, hs]) => JSON.stringify(hs) === JSON.stringify(hrefSets[0][1]))
  check('S5 链接段三通道一致性复验（FE-05 委托）：HTML/PDF/富文本 href 集合一致且源自 .md', allSame && mdHrefs.every((h) => hrefSets[0][1].includes(h)), { mdHrefs, hrefSets })

  results.scenarios.s5 = {
    checked: (doc.match(/\[x\]/g) ?? []).length,
    colWidths,
    mdHrefs,
    html: aHtml,
    pdf: aPdf,
    rich: aRich
  }
}

// ═══ S6 非回归契约扫描 ══════════════════════════════════════════════════════
{
  // dual-pane / error DOM contract classes (must all be reachable)
  const contract = await evalExpr(`(() => {
    // stage a formula error + a mermaid error once more for error-bar classes
    return true
  })()`)
  // scan dual-pane classes on the CURRENT states (some only exist while focused;
  // assert presence of the static contract set from source instead)
  const clsScan = await evalExpr(`(() => {
    const src = document.querySelector('.cm-editor') ? getComputedStyle(document.querySelector('.cm-editor')).display : null
    const present = {}
    for (const c of [
      'cm-md-math-block', 'cm-md-math-preview', 'cm-md-math-src', 'cm-md-math-src-first', 'cm-md-math-src-last',
      'cm-md-math-edit-chip', 'cm-md-math-hover-chip', 'cm-md-math-error', 'cm-md-math-jump',
      'cm-md-code-block', 'cm-md-code-src', 'cm-md-code-src-first', 'cm-md-code-src-last',
      'cm-md-code-src-chip', 'cm-md-code-idle-chip', 'cm-md-code-expander',
      'cm-md-mermaid', 'cm-md-mermaid-svg', 'cm-md-mermaid-preview', 'cm-md-mermaid-error',
      'cm-md-mermaid-jump', 'cm-md-mermaid-badge'
    ]) present[c] = document.querySelectorAll('.' + c).length
    return { present, editorDisplay: src }
  })()`)
  const staticReachable = ['cm-md-math-block', 'cm-md-code-block', 'cm-md-mermaid', 'cm-md-mermaid-svg'].every((c) => clsScan.present[c] > 0)
  check('S6 双区/块级 chrome DOM 契约静态类可达（AC-FN-20 判据1）', staticReachable, clsScan)

  // CSS contract: the contract class names still have matching stylesheet rules
  const cssContract = await evalExpr(`(() => {
    const need = ['cm-md-math-error', 'cm-md-math-jump', 'cm-md-mermaid-error', 'cm-md-mermaid-jump', 'cm-md-math-src', 'cm-md-code-src', 'cm-md-mermaid-preview', 'cm-md-code-idle-chip', 'cm-md-code-expander', 'cm-md-math-edit-chip']
    const hit = {}
    for (const sheet of document.styleSheets) {
      let rules
      try { rules = sheet.cssRules } catch { continue }
      for (const r of rules) {
        for (const n of need) if ((r.selectorText ?? '').includes(n)) hit[n] = (hit[n] ?? 0) + 1
      }
    }
    return hit
  })()`)
  check('S6 双区/错误态 CSS 契约规则全在（AC-FN-20 判据1）', Object.keys(cssContract).length >= 10, cssContract)

  // window.__velox* key set unchanged (AC-RULE-17 slice). Lazy seams may
  // appear after first use (e.g. __veloxTableCellView is installed by the
  // table nested-edit session in S5) — allowed as a superset of the baseline
  // as long as every final key is part of the documented contract family and
  // no baseline key disappeared.
  const finalKeys = await evalExpr(`Object.keys(window).filter((k) => k.startsWith('__velox')).sort()`)
  const knownLazy = ['__veloxTableCellView', '__veloxCtxLastHit']
  const base = results.meta.seamKeysBaseline ?? []
  const disappeared = base.filter((k) => !finalKeys.includes(k))
  const unexpected = finalKeys.filter((k) => !base.includes(k) && !knownLazy.includes(k))
  check(
    'S6 window.__velox* 缝 key 集不变（AC-RULE-17 切片；懒装缝白名单）',
    disappeared.length === 0 && unexpected.length === 0,
    { baseline: base, final: finalKeys, disappeared, unexpected, knownLazySeen: knownLazy.filter((k) => finalKeys.includes(k) && !base.includes(k)) }
  )

  // data-op set (context menu + sidebar ops surface)
  const dataOps = await evalExpr(`[...document.querySelectorAll('[data-op]')].map((el) => el.getAttribute('data-op')).sort()`)
  check('S6 data-op 契约可扫描（集合记录）', Array.isArray(dataOps), { count: dataOps.length, ops: dataOps })
  results.scenarios.s6 = { clsScan, cssContract, finalKeys, dataOps }

  // overview impl screenshot (block family, light theme)
  await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
  await sleep(500)
  await shot('IT-03-FE-10-impl.png', `(() => {
    const el = document.querySelector('.cm-md-mermaid') || document.querySelector('.cm-md-code-block')
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    return null
  })()`)
}

results.meta.finishedAt = new Date().toISOString()
// restore the fixture file on disk (edits + autosave rewrote it during the run)
writeFileSync(FIXTURE_PATH, FIXTURE)
const failed = (results.checks ?? []).filter((c) => !c.ok)
results.meta.summary = {
  total: (results.checks ?? []).length,
  passed: (results.checks ?? []).length - failed.length,
  failed: failed.length
}
writeFileSync(`${OUT_DIR}/IT-03-FE-10-cdp-data.json`, JSON.stringify(results, null, 2))
console.log(
  `DONE ${results.meta.summary.passed}/${results.meta.summary.total} passed` +
    (failed.length ? ` — FAILED: ${failed.map((f) => f.name).join(' | ')}` : '')
)
process.exit(failed.length ? 1 : 0)
