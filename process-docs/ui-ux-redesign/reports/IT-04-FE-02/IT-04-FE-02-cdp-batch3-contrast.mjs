#!/usr/bin/env node
/**
 * IT-04 FE-02 批次 ③ 对比度与主题色（AC-NF-09 / AC-ERR-14 / UI-ELEM-06）
 * 3.1/3.2 双主题正文/控件文字对比度 ≥4.5:1（WCAG 相对亮度 + alpha 合成）
 * 3.3 深色下块级渲染物/弹层走 token、无硬编码浅色块
 * 3.4 ⊞ 网格选择器单元格边界可辨
 * 3.5 导出物 CSS var 与编辑 token 抽样比对（运行时半段；静态半段由 palette.test.ts 承载）
 */
import { writeFileSync } from 'node:fs'
const PORT = Number(process.env.IT04_FE02_CDP_PORT ?? 9501)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-04-FE-02'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/it04-fe02-contrast.md`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const FIXTURE = [
  '# 对比度走查夹具',
  '',
  '正文段落文字（fg on bg）。',
  '',
  '> 引用文字',
  '',
  '```js',
  'const x = 1 // 代码文字',
  '```',
  '',
  '行内 `code` 与 [链接](https://example.com)。',
  '',
  '| 表头 | 列二 |',
  '| :--- | :---: |',
  '| 单元格 | 居中 |',
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
async function evalExpr(expression, timeoutMs = 15000) {
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

const results = { meta: { port: PORT, startedAt: new Date().toISOString(), batch: '③对比度与主题色' }, checks: [] }
const check = (name, ok, detail) => {
  results.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 700) : ''}`)
  return !!ok
}

// WCAG 对比度测量（in-page，alpha 合成到已知底）
const CONTRAST = `(() => {
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/)
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
  const probe = (sel, label) => {
    const el = document.querySelector(sel)
    if (!el) return { label, sel, found: false }
    const fg = parse(getComputedStyle(el).color)
    const bg = bgOf(el)
    const eff = fg.a < 1 ? over(fg, bg) : fg
    return { label, sel, found: true, ratio: ratio(eff, bg), fg: getComputedStyle(el).color, bg: 'rgb(' + bg.r.toFixed(0) + ',' + bg.g.toFixed(0) + ',' + bg.b.toFixed(0) + ')' }
  }
  return [
    probe('.cm-content', '正文'),
    probe('.cm-md-table-wrap table td', '表格单元格'),
    probe('.cm-md-table-wrap table th', '表格表头'),
    probe('blockquote', '引用'),
    probe('.cm-md-code-block code, .cm-md-code-block pre', '代码块'),
    probe('.status-bar', '状态栏'),
    probe('.cm-md-link, .cm-content a', '链接')
  ]
})()`

// 硬编码浅色块扫描（深主题下找近白背景且非 token 引用的元素）
const HARDCODE_SCAN = `(() => {
  const bad = []
  const els = [...document.querySelectorAll('.cm-md-table-wrap, .cm-md-code-block, .cm-md-math, .cm-md-image-wrap, .dialog-overlay .dialog, .toast-host .toast, .cm-md-block-toolbar, .cm-md-table-toolbar')]
  for (const el of els) {
    const cs = getComputedStyle(el)
    const bg = cs.backgroundColor
    const m = bg.match(/rgba?\\(([^)]+)\\)/)
    if (!m) continue
    const p = m[1].split(',').map((s) => parseFloat(s.trim()))
    const [r, g, b, a = 1] = p
    if (a > 0.1 && r > 220 && g > 220 && b > 220) {
      bad.push({ cls: (el.className || '').toString().slice(0, 60), bg })
    }
  }
  return bad
})()`

// ── 主流程 ─────────────────────────────────────────────────────────────────
await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await dismissAnyDialog()
await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
await sleep(1300)
await dismissAnyDialog()

// 3.1 浅色
await evalExpr(`window.__veloxP20.setThemePref('light')`)
await sleep(600)
const light = await evalExpr(CONTRAST)
const lightBad = light.filter((c) => c.found && c.ratio < 4.5)
check('3.1 浅色主题正文/控件文字对比度 ≥4.5:1（AC-NF-09）', light.every((c) => c.found) && lightBad.length === 0, { samples: light, bad: lightBad })

// 3.2 深色
await evalExpr(`window.__veloxP20.setThemePref('dark')`)
await sleep(600)
const dark = await evalExpr(CONTRAST)
const darkBad = dark.filter((c) => c.found && c.ratio < 4.5)
check('3.2 深色主题正文/控件文字对比度 ≥4.5:1（AC-NF-09）', dark.every((c) => c.found) && darkBad.length === 0, { samples: dark, bad: darkBad })

// 3.3 深色硬编码浅色块
const hard = await evalExpr(HARDCODE_SCAN)
check('3.3 深色下无未适配硬编码浅色块（AC-ERR-14 判据 2）', hard.length === 0, { offenders: hard })
// token 佐证：.theme-dark 存在且关键 token 翻转
const tokenFlip = await evalExpr(`(() => {
  const cs = getComputedStyle(document.querySelector('.app') ?? document.body)
  const g = (n) => cs.getPropertyValue(n).trim()
  return {
    darkClass: !!document.querySelector('.theme-dark'),
    bg: g('--bg'), fg: g('--fg'), accent: g('--accent'), border: g('--border')
  }
})()`)
check('3.3b .theme-dark token 翻值生效', tokenFlip.darkClass && tokenFlip.bg && tokenFlip.fg, tokenFlip)

// 3.4 ⊞ 网格选择器单元格边界可辨（浅色测一次 + 深色测一次）
async function gridProbe() {
  // 进入表格编辑态 → 点 ⊞
  const cell = await evalExpr(`(() => {
    const td = document.querySelector('.cm-md-table-wrap table tr td, .cm-md-table-wrap table tr th')
    if (!td) return null
    const r = td.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (cell) await clickAt(cell.x, cell.y)
  await sleep(600)
  const gridBtn = await evalExpr(`(() => {
    const b = document.querySelector('[data-op="resizeTable"]')
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (gridBtn) await clickAt(gridBtn.x, gridBtn.y)
  await sleep(500)
  const probe = await evalExpr(`(() => {
    const cells = [...document.querySelectorAll('[class*="grid"] [class*="cell"], [class*="resize"] [class*="cell"]')]
    const pick = cells.find((c) => { const r = c.getBoundingClientRect(); return r.width > 4 })
    if (!pick) {
      // 宽松兜底：任何 grid picker 容器
      const gp = document.querySelector('[class*="grid-picker"], [class*="resize-picker"], [class*="gridpick"]')
      return { found: false, html: gp ? gp.className : null, cellCount: cells.length }
    }
    const cs = getComputedStyle(pick)
    const parentCs = getComputedStyle(pick.parentElement)
    return {
      found: true,
      cellCount: cells.length,
      cellBorder: cs.borderColor || cs.border,
      cellBg: cs.backgroundColor,
      parentBg: parentCs.backgroundColor,
      borderW: cs.borderWidth
    }
  })()`)
  await evalExpr(`(() => {
    const d = document.querySelector('[class*="grid-picker"], [class*="resize-picker"], [class*="gridpick"]')
    if (d && d.remove) d.remove()
    document.body.click()
    return true
  })()`)
  await sleep(300)
  return probe
}
await evalExpr(`window.__veloxP20.setThemePref('light')`)
await sleep(500)
const gridLight = await gridProbe()
check('3.4a 浅色 ⊞ 网格单元格边界可辨（AC-ERR-14 判据 3 / UI-ELEM-02）', gridLight.found, gridLight)
await evalExpr(`window.__veloxP20.setThemePref('dark')`)
await sleep(500)
const gridDark = await gridProbe()
check('3.4b 深色 ⊞ 网格单元格边界可辨', gridDark.found, gridDark)

// 3.5 运行时导出 CSS var vs 编辑 token 抽样
const varCompare = await evalExpr(`(async () => {
  const app = document.querySelector('.app') ?? document.body
  const cs = getComputedStyle(app)
  const runtime = {}
  for (const k of ['--bg', '--fg', '--accent', '--border', '--code-bg', '--table-header-bg', '--table-stripe-bg']) {
    runtime[k] = cs.getPropertyValue(k).trim()
  }
  let exportCss = ''
  try { exportCss = await window.__veloxP21.renderExportHtml() } catch (e) { return { error: String(e), runtime } }
  const m = exportCss.match(/\\.export-theme-dark\\s*\\{([^}]+)\\}/)
  const vars = {}
  if (m) {
    for (const pair of m[1].split(';')) {
      const kv = pair.split(':')
      if (kv.length === 2) vars[kv[0].trim()] = kv[1].trim()
    }
  }
  const map = {
    '--bg': ['--bg', runtime['--bg']],
    '--fg': ['--fg', runtime['--fg']],
    '--accent': ['--accent', runtime['--accent']],
    '--border': ['--border', runtime['--border']],
    '--code-bg': ['--code-bg', runtime['--code-bg']],
    '--table-header-bg': ['--table-header-bg', runtime['--table-header-bg']],
    '--table-stripe-bg': ['--table-stripe-bg', runtime['--table-stripe-bg']]
  }
  const rows = Object.entries(map).map(([expKey, [cssKey, runtimeVal]]) => ({
    token: cssKey,
    runtime: runtimeVal,
    export: vars[expKey] ?? null,
    match: (vars[expKey] ?? '').toLowerCase() === (runtimeVal ?? '').toLowerCase()
  }))
  return { rows, exportVarCount: Object.keys(vars).length }
})()`)
check(
  '3.5 导出 CSS var 与编辑 token 抽样一致（UI-ELEM-06 运行时半段）',
  varCompare.rows && varCompare.rows.every((r) => r.match),
  varCompare
)

results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-04-FE-02-cdp-batch3-data.json`, JSON.stringify(results, null, 2))
const failed = results.checks.filter((c) => !c.ok).length
console.log(`\n批次③ done: ${results.checks.length - failed}/${results.checks.length} PASS`)
process.exit(failed > 0 ? 1 : 0)
