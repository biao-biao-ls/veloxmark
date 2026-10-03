#!/usr/bin/env node
/**
 * IT-02 FE-10 CDP final gap-fill.
 *
 * Two harness quirks found in followup run, fixed here (not product bugs):
 *  1. tree node.path is Windows-backslash; openPath fixture arg used forward
 *     slashes → activePath === node.path never matched → .filetree-active never
 *     lit. Real usage (click tree row to open) passes node.path through and
 *     matches. Click the tree row by title-suffix here.
 *  2. keyboard-nav step clicked the first row (docs dir) and collapsed the
 *     tree. Expand after nav prep, and target a file row.
 * Also re-measures hover contrast with verified alpha compositing, and
 * depth 0/1/2 indent (expand deep).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.FE10_CDP_PORT ?? 9555)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-02-FE-10'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
async function evalExpr(expression, timeoutMs = 15000) {
  const run = send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  const r = await Promise.race([
    run,
    sleep(timeoutMs).then(() => {
      throw new Error(`Runtime.evaluate timeout ${timeoutMs}ms`)
    })
  ])
  if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails))
  return r.result.value
}
async function moveTo(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
}
async function clickAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
}
async function pressArrow() {
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40 })
}

await send('Page.enable')
await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })

const HELPERS = `(() => {
  if (window.__fe10?.over) return 'reused'
  const parseColor = (c) => {
    const m = String(c).match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/)
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null
  }
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const over = (fg, bg) => {
    const a = parseColor(fg), b = parseColor(bg)
    if (!a) return bg
    if (a.a >= 1) return 'rgb(' + Math.round(a.r) + ',' + Math.round(a.g) + ',' + Math.round(a.b) + ')'
    const base = b || { r: 255, g: 255, b: 255, a: 1 }
    return 'rgb(' + Math.round(a.r * a.a + base.r * (1 - a.a)) + ',' +
      Math.round(a.g * a.a + base.g * (1 - a.a)) + ',' +
      Math.round(a.b * a.a + base.b * (1 - a.a)) + ')'
  }
  const contrast = (fg, bg) => {
    const a = parseColor(fg), b = parseColor(bg)
    if (!a || !b) return null
    const L1 = lum(a), L2 = lum(b)
    return +(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05))).toFixed(2)
  }
  const effectiveBg = (el) => {
    // composite every translucent layer from the element up to the first opaque
    const layers = []
    let n = el
    while (n) {
      const raw = getComputedStyle(n).backgroundColor
      const c = parseColor(raw)
      layers.push({ raw, c })
      if (c && c.a >= 0.95) break
      n = n.parentElement
    }
    let result = layers.length ? layers[layers.length - 1].raw : 'rgb(255,255,255)'
    for (let i = layers.length - 2; i >= 0; i--) {
      if (layers[i].c && layers[i].c.a > 0) result = over(layers[i].raw, result)
    }
    return result
  }
  const styleOf = (el) => {
    if (!el) return null
    const cs = getComputedStyle(el)
    return {
      color: cs.color, backgroundColor: cs.backgroundColor, fontWeight: cs.fontWeight,
      fontSize: cs.fontSize, outlineWidth: cs.outlineWidth, outlineStyle: cs.outlineStyle,
      outlineColor: cs.outlineColor, outlineOffset: cs.outlineOffset, boxShadow: cs.boxShadow,
      height: cs.height, width: cs.width, paddingLeft: cs.paddingLeft, borderRadius: cs.borderRadius
    }
  }
  window.__fe10 = { parseColor, lum, over, contrast, effectiveBg, styleOf }
  return 'installed'
})()`
await evalExpr(HELPERS)

// compositing sanity
const overSanity = await evalExpr(`(() => {
  const { over, contrast } = window.__fe10
  const c = over('rgba(175, 184, 193, 0.2)', 'rgb(250, 250, 250)')
  return { composited: c, ratioWith333: contrast('rgb(51,51,51)', c) }
})()`)

async function runTheme(label) {
  // files tab
  await evalExpr(`(() => {
    const tabs = document.querySelectorAll('.sidebar-tabs .sidebar-tab')
    if (tabs[0]) tabs[0].click()
    return true
  })()`)
  await sleep(200)

  // expand docs + deep (toggle-safe)
  for (const dirName of ['docs', 'deep']) {
    await evalExpr(`(() => {
      const row = Array.from(document.querySelectorAll('.filetree-dir-label'))
        .find((r) => r.querySelector('.filetree-dir-name')?.textContent === ${JSON.stringify(dirName)})
      if (!row) return 'missing'
      const dirDepth = Number(row.style.getPropertyValue('--tree-depth') || 0)
      const dirPath = row.title
      const hasChild = Array.from(document.querySelectorAll('.filetree-item')).some((c) => {
        const d = Number(c.style.getPropertyValue('--tree-depth') || 0)
        return d > dirDepth && c.title.startsWith(dirPath)
      })
      if (!hasChild) row.click()
      return 'clicked=' + !hasChild
    })()`)
    await sleep(250)
  }

  // click intro.md TREE ROW (backslash title) → filetree-active via real open path
  const clicked = await evalExpr(`(() => {
    const row = Array.from(document.querySelectorAll('.filetree-item'))
      .find((r) => r.title.endsWith('intro.md') && !r.classList.contains('filetree-dir-label'))
    if (!row) return false
    row.click()
    return true
  })()`)
  await sleep(350)

  // keyboard nav: focus the active intro row, ArrowDown once → ring on next row
  const ft = await evalExpr(`(() => {
    const row = document.querySelector('.filetree-item.filetree-active')
      || Array.from(document.querySelectorAll('.filetree-item')).find((r) => !r.classList.contains('filetree-dir-label'))
    if (!row) return null
    row.focus()
    const r = row.getBoundingClientRect()
    return { x: +(r.left + 8).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (ft) await clickAt(ft.x, ft.y)
  await sleep(100)
  await pressArrow()
  await sleep(120)

  // hover a plain file row (not kbd, not active)
  const hov = await evalExpr(`(() => {
    const row = Array.from(document.querySelectorAll('.filetree-item'))
      .find((r) => !r.classList.contains('filetree-kbd-focus') && !r.classList.contains('filetree-active') && !r.classList.contains('filetree-dir-label'))
    if (!row) return null
    row.scrollIntoView({ block: 'nearest' })
    const r = row.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (hov) await moveTo(hov.x, hov.y)
  await sleep(150)

  const sweep = await evalExpr(`(() => {
    const { contrast, effectiveBg, styleOf } = window.__fe10
    const rows = Array.from(document.querySelectorAll('.filetree-item'))
    const depthOf = (el) => Number(el.style.getPropertyValue('--tree-depth') || 0)
    const byDepth = {}
    for (const r of rows) {
      const d = depthOf(r)
      if (byDepth[d] === undefined) {
        byDepth[d] = {
          padLeft: getComputedStyle(r).paddingLeft,
          name: (r.querySelector('.filetree-dir-name') || r.querySelector('.filetree-list-name') || r).textContent.trim().slice(0, 20)
        }
      }
    }
    const activeRow = document.querySelector('.filetree-item.filetree-active')
    const kbdRow = document.querySelector('.filetree-item.filetree-kbd-focus')
    const hoverRow = Array.from(document.querySelectorAll('.filetree-item'))
      .find((r) => !r.classList.contains('filetree-kbd-focus') && !r.classList.contains('filetree-active') && !r.classList.contains('filetree-dir-label'))
    const dirRow = document.querySelector('.filetree-dir-label')
    const sidebarBg = effectiveBg(document.querySelector('.sidebar'))
    const pairs = []
    const push = (label, fg, bg) => pairs.push({ label, fg, bg, ratio: contrast(fg, bg) })
    if (hoverRow) {
      push('树行正文 fg / bg-sidebar', getComputedStyle(hoverRow).color, sidebarBg)
      push('树行 hover fg / hover填充(合成)', getComputedStyle(hoverRow).color, effectiveBg(hoverRow))
    }
    if (dirRow) push('目录名 fg-dim / bg-sidebar', getComputedStyle(dirRow).color, sidebarBg)
    if (activeRow) push('活动文件 accent / bg-sidebar', getComputedStyle(activeRow).color, sidebarBg)
    if (kbdRow) push('焦点行 fg / bg-inset', getComputedStyle(kbdRow).color, effectiveBg(kbdRow))
    return {
      byDepth,
      activeRow: activeRow ? { cls: activeRow.className, style: styleOf(activeRow) } : null,
      kbdRow: kbdRow ? {
        cls: kbdRow.className, hasNavFocus: kbdRow.hasAttribute('data-nav-focus'), style: styleOf(kbdRow)
      } : null,
      hoverRowStyle: hoverRow ? styleOf(hoverRow) : null,
      contrast: pairs
    }
  })()`)

  return { label, clickedIntro: clicked, ...sweep }
}

await evalExpr(`(() => {
  if (window.__veloxP26) window.__veloxP26.setPrefs({ theme: 'light' })
  return true
})()`)
await sleep(250)
const light = await runTheme('light')

const themeBtn = await evalExpr(`(() => {
  const btns = Array.from(document.querySelectorAll('.titlebar .tb-btn'))
  const el = btns[btns.length - 1]
  const r = el.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
await clickAt(themeBtn.x, themeBtn.y)
await sleep(200)
const dark = await runTheme('dark')

// final impl screenshots on files tab with full tree + active row (both themes)
async function shoot(name) {
  await evalExpr(`(() => {
    const tabs = document.querySelectorAll('.sidebar-tabs .sidebar-tab')
    if (tabs[0]) tabs[0].click()
    return true
  })()`)
  await sleep(200)
  await moveTo(5, 5)
  await sleep(100)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT_DIR}/${name}`, Buffer.from(shot.data, 'base64'))
}
await shoot('IT-02-FE-10-impl-dark.png')
// back to light for its final shot
await clickAt(themeBtn.x, themeBtn.y)
await sleep(250)
await shoot('IT-02-FE-10-impl-light.png')

const results = { overSanity, light, dark }
writeFileSync(`${OUT_DIR}/IT-02-FE-10-cdp-data-final.json`, JSON.stringify(results, null, 2))
try {
  const mainPath = `${OUT_DIR}/IT-02-FE-10-cdp-data.json`
  const main = JSON.parse(readFileSync(mainPath, 'utf8'))
  main.final = results
  writeFileSync(mainPath, JSON.stringify(main, null, 2))
} catch { /* standalone */ }

console.log(JSON.stringify(results, null, 2))
ws.close()
process.exit(0)
