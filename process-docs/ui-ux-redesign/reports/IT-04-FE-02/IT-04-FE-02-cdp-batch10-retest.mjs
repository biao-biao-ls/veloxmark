#!/usr/bin/env node
/**
 * IT-04 FE-02 批次 ⑩（batch10）缺陷修复复测 — 产品缺陷 #5/#6 修复后取证
 *
 * fix-list（业务流评审 business-review-IT04PATH02-defects，校准重测后 P2×2 first-touch 派修）：
 *  10.1  #5 toast 撤销按钮浅色主题对比度（AC-NF-09）：`.toast-undo-btn` 双主题 ≥4.5:1；
 *        toast 正文 `.toast-msg` 不降级（batch9 基线 13.37）。
 *        修复面：themes.css 新增 --toast-accent（双主题同值 #58a6ff，toast 面恒深
 *        #1f2328，ui_07「双主题一致」）+ toast.css 撤销钮 fg/outline 改走该 token。
 *  10.2  #6 弹层族 UA 原生 chrome 浅色块归零（AC-ERR-14 判据 2）：深色主题 5 处
 *        （TableInsertDialog input[type=number]×2 / button×2 + 图片工具栏
 *        input[type=range]×1）background 不再近白（r,g,b>220 && a>0.1）；
 *        浅色主题观感不回归（token 值如实留档）。
 *        修复面：number 挂 .prefs-input 皮肤、button 挂 .dialog-btn/.dialog-btn-primary
 *        （死类 .primary 清账）、range appearance:none + token track/thumb。
 *  10.3  `.primary` 死类清账：DOM 零 .primary 元素，确认钮持 .dialog-btn-primary；
 *        按钮 hover/active/disabled 态可用（computed style 实测三态）。
 *
 * 运行（Git Bash）：
 *   cd D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend
 *   npx electron-vite dev -- --remote-debugging-port=9571 --user-data-dir=D:/code/typora/temp/it04-fe02-batch10-userdata
 *   node D:/code/typora/process-docs/ui-ux-redesign/reports/IT-04-FE-02/IT-04-FE-02-cdp-batch10-retest.mjs
 *
 * 纪律（沿 batch9）：探针不得手工 remove() React 托管 DOM；草稿恢复对话框一律点
 * 「稍后」；overlay 收拢一律走 Escape；toast 撤销钮走 ⋮→insertRowBelow 结构操作
 * （键入+Ctrl+Z 的 toast 无钮）；⋮ 菜单直接点 td 进 cell-active。
 * 产物一律 batch10 前缀（batch1-9 留档一律不动）。
 */
import { writeFileSync, mkdirSync } from 'node:fs'

const PORT = Number(process.env.IT04_FE02_CDP_PORT ?? 9571)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-04-FE-02'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/it04-fe02-batch10.md`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT_DIR, { recursive: true })

const FIXTURE = [
  '# batch10 缺陷修复复测夹具',
  '',
  '正文段落文字（fg on bg）。',
  '',
  '![图片](./logo-master.png)',
  '',
  '| 表头 | 列二 |',
  '| :--- | :---: |',
  '| 单元格 | 居中 |',
  ''
].join('\n')
writeFileSync(FIXTURE_PATH, FIXTURE)

// ── CDP 底座（沿 batch9 口径）────────────────────────────────────────────────
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) {
  console.error('NO_PAGE_TARGET', JSON.stringify(targets).slice(0, 300))
  process.exit(2)
}
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
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evalExpr(expression, timeoutMs = 20000) {
  let timer
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error('evaluate timeout')), timeoutMs)
  })
  try {
    const r = await Promise.race([
      send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
      timeout
    ])
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  } finally { clearTimeout(timer) }
}
async function clickAt(x, y, button = 'left') {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, buttons: button === 'right' ? 2 : 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, buttons: 0, clickCount: 1 })
}
async function moveTo(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
}
/** 两步 hover（先偏移再落点）——触发 mousemove 派发。 */
async function hoverAt(x, y) {
  await moveTo(Math.max(2, x - 24), Math.max(2, y - 12))
  await sleep(80)
  await moveTo(x, y)
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
/** 草稿恢复对话框一律点「稍后」——绝不丢弃草稿。 */
async function dismissAllDialogs(max = 6) {
  for (let i = 0; i < max; i++) {
    const btn = await evalExpr(`(() => {
      const d = document.querySelector('.dialog-overlay')
      if (!d) return null
      const btns = [...d.querySelectorAll('.dialog-buttons button, .dialog-buttons .dialog-btn, .dialog-btn')]
      const byText = (t) => btns.find((b) => (b.textContent ?? '').trim() === t)
      const target = byText('稍后') ?? byText('取消') ?? btns[0] ?? null
      if (!target) return null
      const r = target.getBoundingClientRect()
      return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2), text: (target.textContent ?? '').trim() }
    })()`)
    if (!btn) break
    await clickAt(btn.x, btn.y)
    await sleep(400)
  }
}
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT_DIR}/${name}`, Buffer.from(shot.data, 'base64'))
  return name
}
/** HMR 杀缝防护（batch9）：缝缺失则 reload 恢复。 */
async function ensureSeams(tag) {
  const ok = await evalExpr(`!!(window.__veloxP20 && window.__veloxP12)`)
  if (ok) return true
  console.log(`SEAMS_DOWN at ${tag} → Page.reload`)
  await send('Page.reload')
  await sleep(4000)
  const ok2 = await evalExpr(`!!(window.__veloxP20 && window.__veloxP12)`)
  if (!ok2) {
    console.error(`SEAMS_UNRECOVERED after reload at ${tag}`)
    return false
  }
  await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
  await sleep(1800)
  await dismissAllDialogs()
  console.log(`SEAMS_RECOVERED at ${tag}`)
  return true
}
async function rectAt(sel) {
  return evalExpr(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)})
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    return {
      x: +(r.left + r.width / 2).toFixed(2),
      y: +(r.top + r.height / 2).toFixed(2),
      inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
      rect: [+r.left.toFixed(1), +r.top.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)]
    }
  })()`)
}

const results = {
  meta: {
    batch: 'batch10-缺陷修复复测',
    port: PORT,
    startedAt: new Date().toISOString(),
    purpose: 'business-review-IT04PATH02-defects：#5 toast 撤销钮对比度 + #6 原生控件 UA 浅色块 修复后复测',
    probeRev: 'batch10-rev1（沿 batch9 WCAG 合成/disabled 祖先过滤/scrollIntoView/clickAt 图片/td 直点 ⋮/undo-toast 路径/ensureSeams）'
  },
  checks: []
}
const check = (name, ok, detail) => {
  results.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 900) : ''}`)
  return !!ok
}

// ── in-page WCAG 助手（batch9 同源：parse/alpha合成/相对亮度/对比度）─────────
const WCAG = `
  const parse = (c) => {
    const m = (c ?? '').match(/rgba?\\(([^)]+)\\)/)
    if (!m) return null
    const p = m[1].split(',').map((s) => parseFloat(s.trim()))
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1
  })
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b)
    return +((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2)
  }
  const rgbStr = (c) => 'rgb(' + c.r.toFixed(0) + ',' + c.g.toFixed(0) + ',' + c.b.toFixed(0) + ')'
  const bgOf = (el) => {
    let node = el
    let acc = null
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node)
      const c = parse(cs.backgroundColor)
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c
        if (c.a >= 1) return acc
      }
      node = node.parentElement
    }
    return acc ?? { r: 255, g: 255, b: 255, a: 1 }
  }
`

// ── 10.1 toast 撤销钮 + 正文对比度（双主题）────────────────────────────────
const TOAST_PROBE = `(() => {
  ${WCAG}
  const btn = document.querySelector('.toast-undo-btn')
  const msg = document.querySelector('.toast-msg')
  const toast = document.querySelector('.toast')
  const sample = (el) => {
    if (!el) return null
    const cs = getComputedStyle(el)
    const fg = parse(cs.color)
    const bg = bgOf(el)
    const eff = fg.a < 1 ? over(fg, bg) : fg
    return {
      text: (el.textContent ?? '').trim().slice(0, 18),
      color: cs.color,
      bg: rgbStr(bg),
      ratio: ratio(eff, bg),
      bgRaw: cs.backgroundColor,
      border: cs.borderTopColor
    }
  }
  return {
    undoBtnPresent: !!btn,
    msgPresent: !!msg,
    toastBg: toast ? getComputedStyle(toast).backgroundColor : null,
    toastAccentToken: btn ? getComputedStyle(btn).getPropertyValue('--toast-accent').trim() : null,
    undo: sample(btn),
    msg: sample(msg)
  }
})()`

// ── 10.2/10.3 五处原生控件 chrome + .primary 清账 + 三态 ─────────────────────
const NATIVE_PROBE = `(() => {
  ${WCAG}
  const nearWhite = (bg) => {
    const m = (bg ?? '').match(/rgba?\\(([^)]+)\\)/)
    if (!m) return false
    const p = m[1].split(',').map((s) => parseFloat(s.trim()))
    const [r, g, b, a = 1] = p
    return a > 0.1 && r > 220 && g > 220 && b > 220
  }
  const describe = (el, key) => {
    if (!el) return { key, found: false }
    const cs = getComputedStyle(el)
    return {
      key,
      found: true,
      tag: el.tagName,
      testid: el.dataset?.testid ?? null,
      className: String(el.className ?? ''),
      bg: cs.backgroundColor,
      color: cs.color,
      border: cs.borderTopColor,
      borderWidth: cs.borderTopWidth,
      radius: cs.borderTopLeftRadius,
      nearWhite: nearWhite(cs.backgroundColor),
      hasPrimaryDeadClass: el.classList.contains('primary') && !el.classList.contains('dialog-btn-primary') && !el.classList.contains('btn-primary'),
      hasDialogBtnPrimary: el.classList.contains('dialog-btn-primary'),
      hasDialogBtn: el.classList.contains('dialog-btn'),
      hasPrefsInput: el.classList.contains('prefs-input')
    }
  }
  const rows = document.querySelector('[data-testid="table-rows"]')
  const cols = document.querySelector('[data-testid="table-cols"]')
  const cancel = document.querySelector('[data-testid="table-insert-cancel"]')
    ?? [...document.querySelectorAll('.dialog-buttons button')].find((b) => /取消|Cancel/i.test(b.textContent ?? ''))
  const confirm = document.querySelector('[data-testid="table-insert-confirm"]')
    ?? [...document.querySelectorAll('.dialog-buttons button')].find((b) => /插入|Insert|确认|OK/i.test(b.textContent ?? ''))
  const range = document.querySelector('.cm-md-image-toolbar input[type="range"]')
  // track/thumb 伪元素（Chromium 允许 getComputedStyle 带伪元素选择器读 UA shadow 内伪元素）
  let track = null
  if (range) {
    try {
      const tcs = getComputedStyle(range, '::-webkit-slider-runnable-track')
      track = { bg: tcs.backgroundColor, height: tcs.height, border: tcs.borderTopColor }
    } catch (e) { track = { error: String(e).slice(0, 120) } }
    try {
      const th = getComputedStyle(range, '::-webkit-slider-thumb')
      track = { ...track, thumbBg: th.backgroundColor, thumbSize: th.width + 'x' + th.height }
    } catch (e) { track = { ...track, thumbError: String(e).slice(0, 120) } }
  }
  return {
    spots: [
      describe(rows, 'table-rows input[type=number]'),
      describe(cols, 'table-cols input[type=number]'),
      describe(cancel, 'dialog cancel button'),
      describe(confirm, 'dialog confirm button'),
      describe(range, 'image-toolbar input[type=range]')
    ],
    rangeTrack: track,
    primaryDeadCount: document.querySelectorAll('.primary').length,
    primaryDeadDetail: [...document.querySelectorAll('.primary')].map((e) => String(e.className)),
    dialogBtnPrimaryCount: document.querySelectorAll('.dialog-btn-primary').length
  }
})()`

const BTN_STATES_PROBE = (phase) => `(() => {
  const el = document.querySelector('[data-testid="table-insert-confirm"]')
    ?? [...document.querySelectorAll('.dialog-buttons button')].find((b) => /插入|Insert|确认|OK/i.test(b.textContent ?? ''))
  if (!el) return { phase: ${JSON.stringify(phase)}, found: false }
  const cs = getComputedStyle(el)
  return {
    phase: ${JSON.stringify(phase)},
    found: true,
    matchesHover: el.matches(':hover'),
    matchesActive: el.matches(':active'),
    bg: cs.backgroundColor,
    color: cs.color,
    filter: cs.filter,
    opacity: cs.opacity,
    cursor: cs.cursor,
    border: cs.borderTopColor
  }
})()`

async function triggerUndoToast() {
  // ⋮ 菜单 → 「下方插入行」结构操作 → toastReceipt 挂 undoAction 撤销钮
  await evalExpr(`(() => { window.__veloxEditor?.view?.focus?.(); return true })()`)
  const tdPt = await rectAt('.cm-md-table-wrap table tr td')
  if (tdPt) await clickAt(tdPt.x, tdPt.y)
  await sleep(800)
  const moreBtn = await rectAt('[data-op="TBL-MOR-OPN"]')
  if (!moreBtn) return { opened: false, reason: 'no TBL-MOR-OPN' }
  await clickAt(moreBtn.x, moreBtn.y)
  await sleep(600)
  const insRow = await evalExpr(`(() => {
    const b = document.querySelector('[data-op="insertRowBelow"]')
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2), disabled: b.disabled === true || b.getAttribute('aria-disabled') === 'true' }
  })()`)
  if (!insRow || insRow.disabled) return { opened: true, fired: false, insRow }
  await clickAt(insRow.x, insRow.y)
  await sleep(900)
  const seen = await evalExpr(`!!document.querySelector('.toast-undo-btn')`)
  return { opened: true, fired: true, undoToastSeen: seen }
}

// ── 9.3 同源硬编码浅色块扫描（batch9 HARDCODE_SCAN 原样，深色）──────────────
const HARDCODE_SCAN = `(() => {
  const roots = ['.menu-dropdown', '.velox-ctx-menu', '.editor-context-menu', '.table-grid-picker', '.sidebar', '.cm-md-float', '.cm-md-image-toolbar', '.toast', '.dialog-overlay .dialog']
  const idOf = (el) => String(el.className ?? '').slice(0, 70) + (el.dataset?.testid ? '|testid:' + el.dataset.testid : '')
  const bad = []
  for (const sel of roots) {
    for (const root of document.querySelectorAll(sel)) {
      const els = [root, ...root.querySelectorAll('*')]
      for (const el of els) {
        const cs = getComputedStyle(el)
        const bg = cs.backgroundColor
        const m = bg.match(/rgba?\\(([^)]+)\\)/)
        if (m) {
          const p = m[1].split(',').map((s) => parseFloat(s.trim()))
          const [r, g, b, a = 1] = p
          if (a > 0.1 && r > 220 && g > 220 && b > 220) {
            bad.push({
              family: sel, tag: el.tagName, cls: idOf(el), prop: 'background', value: bg,
              uaChrome: (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'SELECT') && !String(el.className).trim()
            })
          }
        }
        if (/sep|separator|divider|bar|grip|resizer/i.test(String(el.className))) {
          for (const prop of ['borderTopColor', 'borderLeftColor', 'borderBottomColor']) {
            const bm = (cs[prop] ?? '').match(/rgba?\\(([^)]+)\\)/)
            if (!bm) continue
            const p = bm[1].split(',').map((s) => parseFloat(s.trim()))
            const [r, g, b, a = 1] = p
            if (a > 0.1 && r > 220 && g > 220 && b > 220) {
              bad.push({ family: sel, tag: el.tagName, cls: idOf(el), prop, value: cs[prop], uaChrome: false })
            }
          }
        }
      }
    }
  }
  return bad
})()`

// ── 主流程 ─────────────────────────────────────────────────────────────────
await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await dismissAllDialogs()
if (!(await ensureSeams('boot'))) {
  console.error('seams unavailable at boot — abort')
  process.exit(3)
}

async function setTheme(theme) {
  await ensureSeams(`setTheme(${theme})`)
  await evalExpr(`window.__veloxP20.setThemePref('${theme}')`)
  await sleep(500)
  await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
  await sleep(1300)
  await dismissAllDialogs()
}

results.toast = {}
results.native = {}
results.btnStates = {}
results.hardcode = {}

for (const theme of ['light', 'dark']) {
  await setTheme(theme)

  // ── 10.1 toast 撤销钮对比度 ───────────────────────────────────────────────
  const toastPath = await triggerUndoToast()
  const toastProbe = await evalExpr(TOAST_PROBE)
  results.toast[theme] = { path: toastPath, ...toastProbe }
  const shotToast = await screenshot(`IT-04-FE-02-cdp-batch10-toast-${theme}.png`)
  results.toast[theme].screenshot = shotToast
  const undoRatio = toastProbe.undo?.ratio ?? null
  const msgRatio = toastProbe.msg?.ratio ?? null
  check(
    `10.1-${theme} toast 撤销钮 ≥4.5:1（AC-NF-09，#5 修复复测）+ 正文不降级`,
    toastProbe.undoBtnPresent && undoRatio != null && undoRatio >= 4.5 && msgRatio != null && msgRatio >= 4.5,
    {
      path: toastPath,
      undoRatio,
      undoColor: toastProbe.undo?.color,
      undoBg: toastProbe.undo?.bg,
      msgRatio,
      msgColor: toastProbe.msg?.color,
      msgBg: toastProbe.msg?.bg,
      toastBg: toastProbe.toastBg,
      toastAccentToken: toastProbe.toastAccentToken,
      shot: shotToast,
      note: '正文基线 batch9 13.37:1；判定口径 msg ≥4.5 即不降级'
    }
  )
  await pressKey('Escape', 'Escape')
  await sleep(300)

  // ── 10.2/10.3 五处原生控件 + 死类清账 + 三态 ─────────────────────────────
  // 对话框（P22 表格插入，安全 seam）
  await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
  await sleep(1200)
  await dismissAllDialogs()
  await evalExpr(`(() => { window.__veloxP22?.openDialog?.('insert'); return true })()`)
  await sleep(700)

  // hover/active 态：先把确认钮 scrollIntoView（prefs-dialog 76vh，底部按钮常在
  // 视口外——batch10 三跑不滚动则 hover/press 打空）；标题释放点在该滚动**之后**
  // 现取且不再滚动（再滚会把按钮移出鼠标落点，:hover/:active 双丢——二跑根因）。
  const restState = await evalExpr(BTN_STATES_PROBE('rest'))
  const confirmRect = await rectAt('[data-testid="table-insert-confirm"]')
  const titleRect = await evalExpr(`(() => {
    const el = document.querySelector('.table-insert-dialog .dialog-title, .dialog .dialog-title')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (confirmRect) { await hoverAt(confirmRect.x, confirmRect.y); await sleep(350) }
  const hoverState = await evalExpr(BTN_STATES_PROBE('hover'))
  // active 态：按住左键读 computed。释放点取对话框标题（click 冒泡到 .dialog
  // 被 stopPropagation 吃掉）——释放在按钮上=onConfirm 关框、释放在 overlay 上
  // =onClose 关框，两者都是 batch10 首跑根因。
  if (confirmRect) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: confirmRect.x, y: confirmRect.y, button: 'left', buttons: 1, clickCount: 1 })
    await sleep(200)
  }
  const activeState = await evalExpr(BTN_STATES_PROBE('active'))
  const releasePt = titleRect ?? confirmRect
  if (releasePt) {
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: releasePt.x, y: releasePt.y, button: 'left', buttons: 0, clickCount: 1 })
    await sleep(200)
  }
  // 保险：显式重开对话框再采样 disabled / 五处皮肤（万一上面的 click 仍关了框）
  await evalExpr(`(() => { window.__veloxP22?.openDialog?.('insert'); return true })()`)
  await sleep(500)
  // disabled 态：临时置 .disabled（React 未托管该属性）→ 读 → 立即还原
  const disabledState = await evalExpr(`(() => {
    const el = document.querySelector('[data-testid="table-insert-confirm"]')
      ?? [...document.querySelectorAll('.dialog-buttons button')].find((b) => /插入|Insert|确认|OK/i.test(b.textContent ?? ''))
    if (!el) return { phase: 'disabled', found: false }
    el.disabled = true
    const cs = getComputedStyle(el)
    const snap = {
      phase: 'disabled', found: true,
      bg: cs.backgroundColor, color: cs.color, filter: cs.filter,
      opacity: cs.opacity, cursor: cs.cursor, border: cs.borderTopColor
    }
    el.disabled = false
    return snap
  })()`)

  // 鼠标移开再取静息皮肤（避免 hover 态混入 background 采样）
  await moveTo(8, 8)
  await sleep(250)
  const nativeProbe = await evalExpr(NATIVE_PROBE)
  const shotDlg = await screenshot(`IT-04-FE-02-cdp-batch10-dialog-${theme}.png`)
  results.native[theme] = { ...nativeProbe, screenshot: shotDlg }
  results.btnStates[theme] = { rest: restState, hover: hoverState, active: activeState, disabled: disabledState }
  await dismissAllDialogs()
  await sleep(300)

  // 图片浮层（clickAt 图片，batch2/9 口径）
  await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
  await sleep(1200)
  await dismissAllDialogs()
  const imgPt = await rectAt('.cm-md-image')
  if (imgPt) { await clickAt(imgPt.x, imgPt.y); await sleep(800) }
  // 截图前把工具栏滚进视口（logo 夹具图巨大，工具栏在图下方易出画）
  await evalExpr(`(() => {
    const tb = document.querySelector('.cm-md-image-toolbar')
    if (tb) tb.scrollIntoView({ block: 'center' })
    return !!tb
  })()`)
  await sleep(300)
  const nativeWithImg = await evalExpr(NATIVE_PROBE)
  // 合并：对话框两点 + 图片 range（nativeProbe 在对话框关闭后测不到 range——分步合并）
  results.native[theme].rangeSpot = nativeWithImg.spots.find((s) => s.key.includes('range'))
  results.native[theme].rangeTrack = nativeWithImg.rangeTrack
  const shotImg = await screenshot(`IT-04-FE-02-cdp-batch10-image-${theme}.png`)
  results.native[theme].imageScreenshot = shotImg

  const five = [
    results.native[theme].spots.find((s) => s.key.includes('table-rows')),
    results.native[theme].spots.find((s) => s.key.includes('table-cols')),
    results.native[theme].spots.find((s) => s.key.includes('cancel')),
    results.native[theme].spots.find((s) => s.key.includes('confirm')),
    results.native[theme].rangeSpot
  ]
  const nearWhiteOffenders = five.filter((s) => s && s.found && s.nearWhite).map((s) => s.key)
  const missing = five.map((s, i) => (s && s.found ? null : i)).filter((v) => v != null)

  if (theme === 'dark') {
    check(
      '10.2-dark 五处原生控件无未适配近白背景（AC-ERR-14 判据 2，#6 修复复测）',
      missing.length === 0 && nearWhiteOffenders.length === 0,
      {
        five: five.map((s) => (s ? {
          key: s.key, found: s.found, bg: s.bg, color: s.color, border: s.border,
          nearWhite: s.nearWhite, className: s.className, testid: s.testid,
          hasDialogBtnPrimary: s.hasDialogBtnPrimary, hasPrefsInput: s.hasPrefsInput
        } : null)),
        nearWhiteOffenders,
        missing,
        rangeTrack: results.native[theme].rangeTrack,
        note: '近白判据同 batch9：r,g,b>220 && a>0.1；range input 本体 background=transparent（appearance:none 后可见 chrome 走 ::-webkit-slider-* token 皮肤）'
      }
    )
  } else {
    check(
      '10.2-light 五处原生控件 token 皮肤在位（观感不回归，如实留档）',
      missing.length === 0,
      {
        five: five.map((s) => (s ? {
          key: s.key, found: s.found, bg: s.bg, color: s.color, border: s.border,
          className: s.className, hasDialogBtnPrimary: s.hasDialogBtnPrimary, hasPrefsInput: s.hasPrefsInput
        } : null)),
        missing,
        note: '浅色 --bg=#ffffff 本即近白（对话面色）——浅色主题不套近白判据，只验皮肤类/token 值在位'
      }
    )
  }

  // ── 10.3 死类清账 + 三态判定 ────────────────────────────────────────────
  const dead = results.native[theme].primaryDeadCount ?? -1
  const confirmSpot = five[3]
  const states = results.btnStates[theme]
  // 三态判定：matches(':hover'/':active') 为主信号（computed style 对 primary 的
  // hover 是 filter 变化），computed 差分兜底
  const hoverChanged = states.hover?.found && (
    states.hover.matchesHover === true ||
    (states.rest?.found && (states.hover.bg !== states.rest.bg || states.hover.filter !== states.rest.filter))
  )
  const activeChanged = states.active?.found && (
    states.active.matchesActive === true ||
    (states.rest?.found && (states.active.filter !== states.rest.filter || states.active.bg !== states.hover.bg))
  )
  const disabledDimmed = states.disabled?.found && (
    Number(states.disabled.opacity) < 1 || states.disabled.cursor === 'default'
  )
  check(
    `10.3-${theme} .primary 死类清账 + 按钮 hover/active/disabled 三态可用`,
    dead === 0 && !!confirmSpot?.hasDialogBtnPrimary && !!confirmSpot?.hasDialogBtn && hoverChanged && activeChanged && disabledDimmed,
    {
      primaryDeadCount: dead,
      primaryDeadDetail: results.native[theme].primaryDeadDetail,
      dialogBtnPrimaryCount: results.native[theme].dialogBtnPrimaryCount,
      confirmClass: confirmSpot?.className,
      states,
      hoverChanged,
      activeChanged,
      disabledDimmed
    }
  )

  // ── 9.3 同源弹层族硬编码扩扫（深色全子孙）────────────────────────────────
  if (theme === 'dark') {
    await pressKey('Escape', 'Escape')
    await sleep(300)
    await evalExpr(`(() => { window.__veloxP22?.openDialog?.('insert'); return true })()`)
    await sleep(600)
    const dlgHard = await evalExpr(HARDCODE_SCAN)
    await dismissAllDialogs()
    await sleep(300)
    const imgPt2 = await rectAt('.cm-md-image')
    if (imgPt2) { await clickAt(imgPt2.x, imgPt2.y); await sleep(700) }
    const imgHard = await evalExpr(HARDCODE_SCAN)
    await triggerUndoToast()
    const toastHard = await evalExpr(HARDCODE_SCAN)
    await pressKey('Escape', 'Escape')
    await sleep(300)
    const sideHard = await evalExpr(HARDCODE_SCAN)
    const seen = new Set()
    const uniq = [...dlgHard, ...imgHard, ...toastHard, ...sideHard].filter((o) => {
      const k = `${o.family}|${o.cls}|${o.prop}|${o.value}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    results.hardcode.dark = {
      perPhase: { dialog: dlgHard.length, image: imgHard.length, toast: toastHard.length, sidebar: sideHard.length },
      offenders: uniq
    }
    check(
      '10.4 深色弹层族无硬编码近白色块（AC-ERR-14 判据 2 扩扫面，batch9 同源）',
      uniq.length === 0,
      { offenders: uniq, perPhase: results.hardcode.dark.perPhase }
    )
  }
  await pressKey('Escape', 'Escape')
  await sleep(300)
}

// ── 静态口径注记（token 面）─────────────────────────────────────────────────
results.tokenNote = {
  newToken: '--toast-accent',
  declaredAt: 'themes.css .theme-light + .theme-dark（同值 #58a6ff；toast 面双主题恒深 #1f2328）',
  consumers: 'styles/toast.css .toast-undo-btn（color + border）',
  guard: 'styles/tokens.test.ts THEME_SPLIT_OVERLAY_TOKENS 已收录（双侧声明 + 零影子声明守护）',
  globalAccentUntouched: '--accent 未动（浅 #0969da / 深 #58a6ff 原值）',
  fourCopyScope: '仅 renderer CSS token 面（toast/对话框观感）——未触达四副本面（exportCss.ts / palette.ts / hljsTokens.ts 零改动）'
}

results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-04-FE-02-cdp-batch10-data.json`, JSON.stringify(results, null, 2))
const failed = results.checks.filter((c) => !c.ok).length
console.log(`\nbatch10 done: ${results.checks.length - failed}/${results.checks.length} PASS`)
console.log('data → ' + `${OUT_DIR}/IT-04-FE-02-cdp-batch10-data.json`)
process.exit(failed > 0 ? 1 : 0)
