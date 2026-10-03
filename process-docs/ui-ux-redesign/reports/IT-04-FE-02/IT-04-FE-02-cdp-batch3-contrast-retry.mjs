#!/usr/bin/env node
/** 批次③ 3.1/3.2 复测：修正引用选择器 .cm-md-quote（非 blockquote）。 */
import { writeFileSync } from 'node:fs'
const PORT = 9501
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-04-FE-02'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
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
async function evalExpr(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 200))
  return r.result.value
}

const CONTRAST = `(() => {
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/)
    if (!m) return null
    const p = m[1].split(',').map((s) => parseFloat(s.trim()))
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 })
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b) }
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return +((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2) }
  const bgOf = (el) => {
    let node = el, acc = null
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node)
      const c = parse(cs.backgroundColor)
      if (c && c.a > 0) { acc = acc ? over(acc, c) : c; if (c.a >= 1) return acc }
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
    probe('.cm-md-quote', '引用'),
    probe('.cm-md-code-block code, .cm-md-code-block pre', '代码块'),
    probe('.status-bar', '状态栏'),
    probe('.cm-md-link, .cm-content a', '链接')
  ]
})()`

const out = {}
for (const theme of ['light', 'dark']) {
  await evalExpr(`window.__veloxP20.setThemePref('${theme}')`)
  await sleep(500)
  const rows = await evalExpr(CONTRAST)
  out[theme] = rows
  const bad = rows.filter((r) => r.found && r.ratio < 4.5)
  const missing = rows.filter((r) => !r.found)
  console.log(theme.toUpperCase(), 'bad:', JSON.stringify(bad), 'missing:', JSON.stringify(missing))
}
writeFileSync(`${OUT_DIR}/IT-04-FE-02-cdp-batch3-contrast-retry.json`, JSON.stringify(out, null, 2))
process.exit(0)
