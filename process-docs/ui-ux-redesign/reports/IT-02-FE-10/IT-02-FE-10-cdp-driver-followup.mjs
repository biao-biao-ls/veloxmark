#!/usr/bin/env node
/**
 * IT-02 FE-10 CDP follow-up — fills gaps from the main driver sweep:
 *  - filetree active row (openPath alone left activePath unset on the tree row)
 *  - depth-2 indent (fixture dir is `deep`, main run expanded the wrong name)
 *  - .filetree-item-fixed height provenance (tiny fixture never virtualizes)
 *  - outline geometry (fold triangle / per-level indent) — measured on the
 *    outline tab, which the main sweep reached only after MEASURE
 *  - hover contrast with proper alpha compositing over the parent fill
 * Both themes re-measured.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.FE10_CDP_PORT ?? 9555)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-02-FE-10'
const FIXTURE = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/fe10-fixture'
const INTRO = `${FIXTURE}/intro.md`

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
async function pressArrow(key) {
  const vk = 40
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code: key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
}

const HELPERS = `(() => {
  if (window.__fe10) return true
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
    if (a.a >= 1) return 'rgb(' + a.r + ',' + a.g + ',' + a.b + ')'
    const base = b || { r: 255, g: 255, b: 255, a: 1 }
    return 'rgb(' + Math.round(a.r * a.a + base.r * (1 - a.a)) + ',' +
      Math.round(a.g * a.a + base.g * (1 - a.a)) + ',' +
      Math.round(a.b * a.a + base.b * (1 - a.a)) + ')'
  }
  const contrast = (fg, bg) => {
    const a = parseColor(fg), b = parseColor(bg)
    if (!a || !b) return null
    const L1 = lum(a), L2 = lum(b)
    const hi = Math.max(L1, L2), lo = Math.min(L1, L2)
    return +(((hi + 0.05) / (lo + 0.05))).toFixed(2)
  }
  const effectiveBg = (el) => {
    let n = el, acc = null
    const stack = []
    while (n) {
      const c = parseColor(getComputedStyle(n).backgroundColor)
      stack.push({ c, raw: getComputedStyle(n).backgroundColor })
      if (c && c.a >= 0.95) { acc = getComputedStyle(n).backgroundColor; break }
      n = n.parentElement
    }
    // composite translucent layers bottom-up
    let result = acc || 'rgb(255,255,255)'
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].c && stack[i].c.a < 1 && stack[i].c.a > 0) {
        result = over(stack[i].raw, result)
      }
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
  return true
})()`

const GAP_SWEEP = `(() => {
  const { contrast, effectiveBg, styleOf, over } = window.__fe10
  const rows = Array.from(document.querySelectorAll('.filetree-item'))
  const depthOf = (el) => Number(el.style.getPropertyValue('--tree-depth') || 0)
  const byDepth = {}
  for (const r of rows) {
    const d = depthOf(r)
    if (byDepth[d] === undefined) byDepth[d] = { padLeft: getComputedStyle(r).paddingLeft, name: (r.querySelector('.filetree-dir-name') || r.querySelector('.filetree-list-name') || r).textContent.trim().slice(0, 30) }
  }

  // .filetree-item-fixed rule provenance (tiny fixture never virtualizes —
  // force the class for one frame to prove height = var(--tree-row-h))
  let fixedRowH = null
  const probe = rows.find((r) => !r.classList.contains('filetree-item-fixed'))
  if (probe) {
    probe.classList.add('filetree-item-fixed')
    fixedRowH = getComputedStyle(probe).height
    probe.classList.remove('filetree-item-fixed')
  }

  const activeRow = document.querySelector('.filetree-item.filetree-active')
  const kbdRow = document.querySelector('.filetree-item.filetree-kbd-focus')
  const plainRow = rows.find((r) => !r.classList.contains('filetree-kbd-focus') && !r.classList.contains('filetree-active') && !r.classList.contains('filetree-dir-label'))
  const dirRow = document.querySelector('.filetree-dir-label')

  // hover contrast: plainRow's translucent hover fill composited over sidebar
  const sidebar = document.querySelector('.sidebar')
  const sidebarBg = effectiveBg(sidebar)
  const hoverFill = plainRow ? getComputedStyle(plainRow).backgroundColor : null
  const hoverBg = plainRow ? effectiveBg(plainRow) : sidebarBg
  const pairs = []
  const push = (label, fg, bg) => pairs.push({ label, fg, bg, ratio: contrast(fg, bg) })
  if (plainRow) {
    push('树行正文 fg / bg-sidebar(合成)', getComputedStyle(plainRow).color, sidebarBg)
    push('树行 hover fg / hover填充(合成)', getComputedStyle(plainRow).color, hoverBg)
  }
  if (dirRow) push('目录名 fg-dim / bg-sidebar', getComputedStyle(dirRow).color, sidebarBg)
  if (activeRow) push('活动文件 accent / bg-sidebar', getComputedStyle(activeRow).color, sidebarBg)
  if (kbdRow) push('焦点行 fg / bg-inset', getComputedStyle(kbdRow).color, effectiveBg(kbdRow))

  return {
    byDepth, fixedRowH,
    activeRow: activeRow ? { cls: activeRow.className, style: styleOf(activeRow) } : null,
    hoverFillRaw: hoverFill, hoverBgComposited: hoverBg, sidebarBg,
    contrast: pairs
  }
})()`

const OUTLINE_SWEEP = `(() => {
  const { contrast, effectiveBg, styleOf } = window.__fe10
  const rows = Array.from(document.querySelectorAll('.outline-item'))
  const sidebar = document.querySelector('.sidebar')
  const sidebarBg = effectiveBg(sidebar)
  const pairs = []
  const push = (label, fg, bg) => pairs.push({ label, fg, bg, ratio: contrast(fg, bg) })
  const plain = rows.find((r) => !r.classList.contains('outline-kbd-focus') && !r.classList.contains('outline-active'))
  const active = document.querySelector('.outline-item.outline-active')
  const kbd = document.querySelector('.outline-item.outline-kbd-focus')
  if (plain) {
    push('大纲行 fg / bg-sidebar', getComputedStyle(plain).color, sidebarBg)
    push('大纲 hover 前 fg / bg-sidebar', getComputedStyle(plain).color, sidebarBg)
  }
  if (active) push('大纲活动 accent / bg-sidebar', getComputedStyle(active).color, sidebarBg)
  if (kbd) push('大纲焦点 fg / bg-inset', getComputedStyle(kbd).color, effectiveBg(kbd))
  return {
    padLeft: rows.slice(0, 6).map((r) => ({
      cls: r.className.replace('outline-item', '').trim(),
      padLeft: getComputedStyle(r).paddingLeft
    })),
    fold: styleOf(document.querySelector('.outline-fold')),
    foldCount: document.querySelectorAll('.outline-fold').length,
    plain: plain ? { cls: plain.className, style: styleOf(plain) } : null,
    active: active ? { cls: active.className, style: styleOf(active) } : null,
    kbd: kbd ? { cls: kbd.className, hasNavFocus: kbd.hasAttribute('data-nav-focus'), style: styleOf(kbd) } : null,
    contrast: pairs
  }
})()`

// ── run ────────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true })
await send('Page.enable')
await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await evalExpr(HELPERS)

// ensure deterministic light start
await evalExpr(`(() => {
  if (window.__veloxP26) window.__veloxP26.setPrefs({ theme: 'light' })
  return document.querySelector('.app')?.className
})()`)
await sleep(250)

async function runTheme(label) {
  // files tab
  await evalExpr(`(() => {
    const tabs = document.querySelectorAll('.sidebar-tabs .sidebar-tab')
    if (tabs[0]) tabs[0].click()
    return true
  })()`)
  await sleep(200)

  // expand docs + deep (depth 0/1/2 rows visible) — click only when collapsed
  // (an already-expanded dir toggles shut on a second click)
  for (const dirName of ['docs', 'deep']) {
    await evalExpr(`(() => {
      const row = Array.from(document.querySelectorAll('.filetree-dir-label'))
        .find((r) => r.querySelector('.filetree-dir-name')?.textContent === ${JSON.stringify(dirName)})
      if (!row) return false
      const dirDepth = Number(row.style.getPropertyValue('--tree-depth') || 0)
      const dirPath = row.title
      const hasChild = Array.from(document.querySelectorAll('.filetree-item')).some((c) => {
        const d = Number(c.style.getPropertyValue('--tree-depth') || 0)
        return d > dirDepth && c.title.startsWith(dirPath)
      })
      if (!hasChild) row.click()
      return true
    })()`)
    await sleep(250)
  }

  // open intro.md and click its tree row so filetree-active lands on a row
  await evalExpr(`(async () => {
    if (window.__veloxP26) await window.__veloxP26.openPath(${JSON.stringify(INTRO)})
    return true
  })()`)
  await sleep(400)
  await evalExpr(`(() => {
    const row = Array.from(document.querySelectorAll('.filetree-item'))
      .find((r) => r.title === ${JSON.stringify(INTRO)})
    if (row) { row.click(); return true }
    return false
  })()`)
  await sleep(300)

  // keyboard nav filetree (focus ring evidence)
  const ft = await evalExpr(`(() => {
    const row = Array.from(document.querySelectorAll('.filetree-item'))
      .find((r) => !r.classList.contains('filetree-kbd-focus'))
    if (!row) return null
    row.focus()
    const r = row.getBoundingClientRect()
    return { x: +(r.left + 8).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (ft) await clickAt(ft.x, ft.y)
  await sleep(100)
  await pressArrow('ArrowDown')
  await sleep(120)

  // hover a non-kbd row with the real mouse
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
  const hoverLive = await evalExpr(`(() => {
    const row = Array.from(document.querySelectorAll('.filetree-item'))
      .find((r) => !r.classList.contains('filetree-kbd-focus') && !r.classList.contains('filetree-active') && !r.classList.contains('filetree-dir-label'))
    return row ? getComputedStyle(row).backgroundColor : null
  })()`)

  const filetree = await evalExpr(GAP_SWEEP)
  filetree.hoverLiveBg = hoverLive

  // outline tab
  await evalExpr(`(() => {
    const tabs = document.querySelectorAll('.sidebar-tabs .sidebar-tab')
    if (tabs[1]) tabs[1].click()
    return true
  })()`)
  await sleep(250)
  const o = await evalExpr(`(() => {
    const row = document.querySelectorAll('.outline-item')[0]
    if (!row) return null
    row.focus()
    const r = row.getBoundingClientRect()
    return { x: +(r.left + 8).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (o) await clickAt(o.x, o.y)
  await sleep(100)
  await pressArrow('ArrowDown')
  await sleep(120)
  // click second outline item → outline-active
  await evalExpr(`(() => {
    const rows = document.querySelectorAll('.outline-item')
    if (rows[1]) rows[1].click()
    return true
  })()`)
  await sleep(250)
  const outline = await evalExpr(OUTLINE_SWEEP)

  return { label, filetree, outline }
}

const light = await runTheme('light')

// flip to dark via Titlebar
const themeBtn = await evalExpr(`(() => {
  const btns = Array.from(document.querySelectorAll('.titlebar .tb-btn'))
  const el = btns[btns.length - 1]
  const r = el.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
await clickAt(themeBtn.x, themeBtn.y)
await sleep(200)
const dark = await runTheme('dark')
dark.clsAfter = await evalExpr(`document.querySelector('.app')?.className`)

const results = { light, dark }
writeFileSync(`${OUT_DIR}/IT-02-FE-10-cdp-data-followup.json`, JSON.stringify(results, null, 2))

// merge into the main data file for a single evidence artifact
try {
  const mainPath = `${OUT_DIR}/IT-02-FE-10-cdp-data.json`
  const main = JSON.parse(readFileSync(mainPath, 'utf8'))
  main.followup = results
  writeFileSync(mainPath, JSON.stringify(main, null, 2))
} catch { /* keep followup file standalone */ }

console.log(JSON.stringify(results, null, 2))
ws.close()
process.exit(0)
