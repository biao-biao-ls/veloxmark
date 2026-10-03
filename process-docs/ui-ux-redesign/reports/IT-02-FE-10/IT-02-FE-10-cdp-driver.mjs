#!/usr/bin/env node
/**
 * IT-02 FE-10 CDP walkthrough driver — 侧栏视觉 token 化审计（深浅主题走查）.
 *
 * Measures (per tasks/IT-02/FE-10.md 验收阶段 1–3):
 *   S0 token 解析 + 几何溯源：--tree-row-h/width/indent 计算值、行高/缩进/命中盒
 *   S1 三态可区分（文件树 + 大纲，深浅各一遍）：hover 填充 / active 强调 /
 *      kbd-focus 焦点环（焦点环走真实键盘 ArrowDown 导航）
 *   S2 对比度 ≥4.5:1（正文类文本，两主题）
 *   S3 Titlebar 主题键即时翻转（点击后同一轮测量无 sleep）
 *   S4 impl 截图：深浅主题侧栏各一张（全窗 files 页 + 大纲补充图）
 *
 * Robustness notes (inherited from IT-03-FE-04-cdp-driver.mjs):
 *  - Page.bringToFront first: an occluded Electron window throttles timers.
 *  - Emulation.setFocusEmulationEnabled keeps the page in the active lifecycle.
 *  - Runtime.evaluate wrapped in a timeout race (user rule).
 *  - Draft-recovery dialog: always click「稍后」, never「丢弃草稿」.
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.FE10_CDP_PORT ?? 9555)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-02-FE-10'
const FIXTURE = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/fe10-fixture'
const INTRO = `${FIXTURE}/intro.md`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
async function evalExpr(expression, timeoutMs = 15000) {
  const run = send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  })
  const r = await Promise.race([
    run,
    sleep(timeoutMs).then(() => {
      throw new Error(`Runtime.evaluate timeout ${timeoutMs}ms`)
    })
  ])
  if (r.exceptionDetails) {
    throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails))
  }
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
  const code = key
  const vk = key === 'ArrowDown' ? 40 : key === 'ArrowUp' ? 38 : key === 'ArrowLeft' ? 37 : 39
  await send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk
  })
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk
  })
}

async function centerOfSelector(selector) {
  return evalExpr(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
}
async function clickSelector(selector) {
  const c = await centerOfSelector(selector)
  if (!c) throw new Error('selector not found: ' + selector)
  await clickAt(c.x, c.y)
  return c
}

// ── helper expressions (injected into the page) ────────────────────────────
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
  const contrast = (fg, bg) => {
    const a = parseColor(fg), b = parseColor(bg)
    if (!a || !b) return null
    const L1 = lum(a), L2 = lum(b)
    const hi = Math.max(L1, L2), lo = Math.min(L1, L2)
    return +(((hi + 0.05) / (lo + 0.05))).toFixed(2)
  }
  const effectiveBg = (el) => {
    let n = el
    while (n) {
      const cs = getComputedStyle(n)
      const c = parseColor(cs.backgroundColor)
      if (c && c.a >= 0.95) return cs.backgroundColor
      n = n.parentElement
    }
    return 'rgb(255, 255, 255)'
  }
  const styleOf = (el) => {
    if (!el) return null
    const cs = getComputedStyle(el)
    return {
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      fontWeight: cs.fontWeight,
      fontSize: cs.fontSize,
      outlineWidth: cs.outlineWidth,
      outlineStyle: cs.outlineStyle,
      outlineColor: cs.outlineColor,
      outlineOffset: cs.outlineOffset,
      boxShadow: cs.boxShadow,
      height: cs.height,
      width: cs.width,
      paddingLeft: cs.paddingLeft,
      paddingRight: cs.paddingRight,
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      borderRadius: cs.borderRadius,
      borderRightWidth: cs.borderRightWidth
    }
  }
  window.__fe10 = { parseColor, lum, contrast, effectiveBg, styleOf }
  return true
})()`

/** Full measurement sweep for the currently visible theme. */
const MEASURE = `(() => {
  const { contrast, effectiveBg, styleOf } = window.__fe10
  const app = document.querySelector('.app')
  const rootCs = getComputedStyle(app)
  const tok = (n) => rootCs.getPropertyValue(n).trim()
  const sidebar = document.querySelector('.sidebar')
  const rows = Array.from(document.querySelectorAll('.filetree-item'))
  const depthOf = (el) => Number(el.style.getPropertyValue('--tree-depth') || 0)
  const findRow = (pred) => rows.find(pred)
  const outlineRows = Array.from(document.querySelectorAll('.outline-item'))

  const rowByDepth = {}
  for (const r of rows) {
    const d = depthOf(r)
    if (rowByDepth[d] === undefined) rowByDepth[d] = r
  }

  // ── three-state: file tree (a non-active file row) ──
  const hoverRow = findRow((r) => !r.classList.contains('filetree-dir-label') && !r.classList.contains('filetree-active'))
    || rows[0]
  const activeRow = document.querySelector('.filetree-item.filetree-active')
  const kbdRow = document.querySelector('.filetree-item.filetree-kbd-focus')

  // ── three-state: outline ──
  const oHover = outlineRows.find((r) => !r.classList.contains('outline-active')) || outlineRows[0]
  const oActive = document.querySelector('.outline-item.outline-active')
  const oKbd = document.querySelector('.outline-item.outline-kbd-focus')

  const pairs = []
  const push = (label, fg, bg) => pairs.push({ label, fg, bg, ratio: contrast(fg, bg) })

  // text contrast (criterion ≥ 4.5)
  const sidebarBg = effectiveBg(sidebar || app)
  const rowCs = hoverRow ? getComputedStyle(hoverRow) : null
  if (rowCs) {
    push('树行正文 fg / bg-sidebar', rowCs.color, sidebarBg)
    const dir = document.querySelector('.filetree-dir-label')
    if (dir) push('目录名 fg-dim / bg-sidebar', getComputedStyle(dir).color, sidebarBg)
  }
  if (activeRow) push('活动文件 accent / bg-sidebar', getComputedStyle(activeRow).color, sidebarBg)
  if (oHover) push('大纲行 fg / bg-sidebar', getComputedStyle(oHover).color, sidebarBg)
  if (oActive) push('大纲活动 accent / bg-sidebar', getComputedStyle(oActive).color, sidebarBg)
  const tab = document.querySelector('.sidebar-tab')
  const tabA = document.querySelector('.sidebar-tab.is-active')
  if (tab) push('tab 默认 fg-dim / bg-sidebar', getComputedStyle(tab).color, sidebarBg)
  if (tabA) push('tab 激活 accent / bg-sidebar', getComputedStyle(tabA).color, sidebarBg)
  const header = document.querySelector('.sidebar-header')
  if (header) push('侧栏头 fg-dim / bg-sidebar', getComputedStyle(header).color, sidebarBg)
  if (hoverRow) {
    // hover text against hover fill (measured with forced hover elsewhere; here
    // report fg vs --code-bg token value for the nominal hover pair)
    push('树行 hover fg / code-bg', getComputedStyle(hoverRow).color, tok('--code-bg') || 'rgb(0,0,0)')
  }
  if (kbdRow) push('焦点行 fg / bg-inset', getComputedStyle(kbdRow).color, effectiveBg(kbdRow))

  return {
    themeClass: app.className,
    tokens: {
      '--sidebar-width': tok('--sidebar-width'),
      '--tree-row-h': tok('--tree-row-h'),
      '--tree-indent': tok('--tree-indent'),
      '--tree-accent-bar': tok('--tree-accent-bar'),
      '--focus-ring-width': tok('--focus-ring-width'),
      '--focus-ring-offset': tok('--focus-ring-offset'),
      '--space-3': tok('--space-3'),
      '--space-half': tok('--space-half'),
      '--hit-box-md': tok('--hit-box-md'),
      '--text-ui': tok('--text-ui'),
      '--bg': tok('--bg'),
      '--bg-sidebar': tok('--bg-sidebar'),
      '--bg-inset': tok('--bg-inset'),
      '--code-bg': tok('--code-bg'),
      '--accent': tok('--accent'),
      '--fg': tok('--fg'),
      '--fg-dim': tok('--fg-dim'),
      '--border-width': tok('--border-width')
    },
    geometry: {
      sidebarWidth: sidebar ? getComputedStyle(sidebar).width : null,
      sidebarBorderRight: sidebar ? getComputedStyle(sidebar).borderRightWidth : null,
      fixedRowH: document.querySelector('.filetree-item-fixed')
        ? getComputedStyle(document.querySelector('.filetree-item-fixed')).height
        : null,
      rowPadLeftByDepth: Object.fromEntries(
        Object.entries(rowByDepth).map(([d, el]) => [d, getComputedStyle(el).paddingLeft])
      ),
      outlinePadLeft: outlineRows.slice(0, 6).map((r) => ({
        cls: r.className.replace('outline-item', '').trim(),
        padLeft: getComputedStyle(r).paddingLeft
      })),
      outlineFold: styleOf(document.querySelector('.outline-fold')),
      sidebarAction: styleOf(document.querySelector('.sidebar-action')),
      barBtn: styleOf(document.querySelector('.filetree-bar-btn')),
      rowRadius: hoverRow ? getComputedStyle(hoverRow).borderRadius : null
    },
    threeStates: {
      filetree: {
        hoverRow: hoverRow ? { cls: hoverRow.className, style: styleOf(hoverRow), depth: depthOf(hoverRow) } : null,
        activeRow: activeRow ? { cls: activeRow.className, style: styleOf(activeRow) } : null,
        kbdRow: kbdRow ? {
          cls: kbdRow.className,
          style: styleOf(kbdRow),
          hasNavFocus: kbdRow.hasAttribute('data-nav-focus')
        } : null
      },
      outline: {
        hoverRow: oHover ? { cls: oHover.className, style: styleOf(oHover) } : null,
        activeRow: oActive ? { cls: oActive.className, style: styleOf(oActive) } : null,
        kbdRow: oKbd ? {
          cls: oKbd.className,
          style: styleOf(oKbd),
          hasNavFocus: oKbd.hasAttribute('data-nav-focus')
        } : null
      }
    },
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

// dismiss draft-recovery dialog if any — ALWAYS「稍后」, never 丢弃
const dismissed = await evalExpr(`(() => {
  const btns = Array.from(document.querySelectorAll('button'))
  const later = btns.find((b) => b.textContent.trim() === '稍后')
  if (later) { later.click(); return true }
  return false
})()`)
await sleep(200)

// load fixture folder via e2e seam (no native dialog)
const folderLoaded = await evalExpr(`(async () => {
  if (!window.__veloxP13) return 'no-seam'
  await window.__veloxP13.openFolder(${JSON.stringify(FIXTURE)})
  return true
})()`)
await sleep(400)

// switch to files tab (default session mode may be outline)
await evalExpr(`(() => {
  const tabs = document.querySelectorAll('.sidebar-tabs .sidebar-tab')
  if (tabs[0]) tabs[0].click()
  return tabs.length
})()`)
await sleep(200)

// expand docs / docs/deep for depth-1/depth-2 rows
for (const dirName of ['docs', 'nested']) {
  await evalExpr(`(() => {
    const row = Array.from(document.querySelectorAll('.filetree-dir-label'))
      .find((r) => r.querySelector('.filetree-dir-name')?.textContent === ${JSON.stringify(dirName)})
    if (row) { row.click(); return true }
    return false
  })()`)
  await sleep(250)
}

// open intro.md (active file state + outline headings)
await evalExpr(`(async () => {
  if (!window.__veloxP26) return 'no-seam'
  return await window.__veloxP26.openPath(${JSON.stringify(INTRO)})
})()`)
await sleep(500)

// deterministic start theme: light
await evalExpr(`(() => {
  if (window.__veloxP26) window.__veloxP26.setPrefs({ theme: 'light' })
  return true
})()`)
await sleep(300)

// ── LIGHT theme ────────────────────────────────────────────────────────────
// hover measurement via real mouse move onto a file row (not the active one)
const hoverRect = await evalExpr(`(() => {
  const row = Array.from(document.querySelectorAll('.filetree-item'))
    .find((r) => !r.classList.contains('filetree-dir-label') && !r.classList.contains('filetree-active'))
  if (!row) return null
  row.scrollIntoView({ block: 'nearest' })
  const r = row.getBoundingClientRect()
  return {
    x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2),
    bg: getComputedStyle(row).backgroundColor
  }
})()`)
if (hoverRect) await moveTo(hoverRect.x, hoverRect.y)
await sleep(150)
const lightHoverBg = await evalExpr(`(() => {
  const row = Array.from(document.querySelectorAll('.filetree-item'))
    .find((r) => !r.classList.contains('filetree-dir-label') && !r.classList.contains('filetree-active'))
  return row ? getComputedStyle(row).backgroundColor : null
})()`)

// keyboard nav on file tree: click a row to focus (pointer clears kbdNav), then ArrowDown ×2
const ftFocus = await evalExpr(`(() => {
  const row = Array.from(document.querySelectorAll('.filetree-item'))
    .find((r) => !r.classList.contains('filetree-kbd-focus'))
  if (!row) return null
  row.scrollIntoView({ block: 'nearest' })
  row.focus()
  const r = row.getBoundingClientRect()
  return { x: +(r.left + 8).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
if (ftFocus) await clickAt(ftFocus.x, ftFocus.y)
await sleep(100)
await pressArrow('ArrowDown')
await sleep(80)
await pressArrow('ArrowDown')
await sleep(150)

const light = await evalExpr(MEASURE)
light.hoverFill = lightHoverBg
light.hoverPreMoveBg = hoverRect ? hoverRect.bg : null
light.seams = { folderLoaded, draftDialogDismissed: dismissed }

// screenshot: full window, files tab
await moveTo(5, 5)
await sleep(100)
const shotLight = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(`${OUT_DIR}/IT-02-FE-10-impl-light.png`, Buffer.from(shotLight.data, 'base64'))

// supplementary: outline tab view (light)
await evalExpr(`(() => {
  const tabs = document.querySelectorAll('.sidebar-tabs .sidebar-tab')
  if (tabs[1]) tabs[1].click()
  return true
})()`)
await sleep(250)
// keyboard nav on outline
const oFocus = await evalExpr(`(() => {
  const row = document.querySelectorAll('.outline-item')[0]
  if (!row) return null
  row.focus()
  const r = row.getBoundingClientRect()
  return { x: +(r.left + 8).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
if (oFocus) await clickAt(oFocus.x, oFocus.y)
await sleep(100)
await pressArrow('ArrowDown')
await sleep(150)
const lightOutlineKbd = await evalExpr(`(() => {
  const k = document.querySelector('.outline-item.outline-kbd-focus')
  return k ? {
    cls: k.className,
    hasNavFocus: k.hasAttribute('data-nav-focus'),
    outlineWidth: getComputedStyle(k).outlineWidth,
    outlineStyle: getComputedStyle(k).outlineStyle,
    outlineColor: getComputedStyle(k).outlineColor,
    outlineOffset: getComputedStyle(k).outlineOffset,
    backgroundColor: getComputedStyle(k).backgroundColor
  } : null
})()`)
light.threeStates.outline.kbdRowLive = lightOutlineKbd
// click an outline item → active state
await evalExpr(`(() => {
  const rows = document.querySelectorAll('.outline-item')
  if (rows[1]) rows[1].click()
  return rows.length
})()`)
await sleep(250)
light.threeStates.outline.activeAfterClick = await evalExpr(`(() => {
  const a = document.querySelector('.outline-item.outline-active')
  return a ? { cls: a.className, style: window.__fe10.styleOf(a) } : null
})()`)
const shotLightOutline = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(`${OUT_DIR}/IT-02-FE-10-impl-light-outline.png`, Buffer.from(shotLightOutline.data, 'base64'))

// back to files tab for the theme-flip demo (sidebar files view is the primary impl shot subject)
await evalExpr(`(() => {
  const tabs = document.querySelectorAll('.sidebar-tabs .sidebar-tab')
  if (tabs[0]) tabs[0].click()
  return true
})()`)
await sleep(200)

// ── theme flip via Titlebar button (instant check, no sleep) ───────────────
const themeBtn = await evalExpr(`(() => {
  const btns = Array.from(document.querySelectorAll('.titlebar .tb-btn'))
  const el = btns[btns.length - 1]
  if (!el) return null
  el.scrollIntoView({ block: 'nearest' })
  const r = el.getBoundingClientRect()
  return {
    x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2),
    title: el.title
  }
})()`)
const beforeFlip = await evalExpr(`(() => {
  const app = document.querySelector('.app')
  return { cls: app.className, bg: getComputedStyle(app).getPropertyValue('--bg').trim() }
})()`)
if (themeBtn) await clickAt(themeBtn.x, themeBtn.y)
// immediate — no sleep: token flip must already be applied
const afterFlip = await evalExpr(`(() => {
  const app = document.querySelector('.app')
  return { cls: app.className, bg: getComputedStyle(app).getPropertyValue('--bg').trim() }
})()`)
await sleep(150)

// ── DARK theme ─────────────────────────────────────────────────────────────
const darkHoverRect = await evalExpr(`(() => {
  const row = Array.from(document.querySelectorAll('.filetree-item'))
    .find((r) => !r.classList.contains('filetree-dir-label') && !r.classList.contains('filetree-active'))
  if (!row) return null
  row.scrollIntoView({ block: 'nearest' })
  const r = row.getBoundingClientRect()
  return {
    x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2),
    bg: getComputedStyle(row).backgroundColor
  }
})()`)
if (darkHoverRect) await moveTo(darkHoverRect.x, darkHoverRect.y)
await sleep(150)
const darkHoverBg = await evalExpr(`(() => {
  const row = Array.from(document.querySelectorAll('.filetree-item'))
    .find((r) => !r.classList.contains('filetree-dir-label') && !r.classList.contains('filetree-active'))
  return row ? getComputedStyle(row).backgroundColor : null
})()`)

const darkFtFocus = await evalExpr(`(() => {
  const row = Array.from(document.querySelectorAll('.filetree-item'))
    .find((r) => !r.classList.contains('filetree-kbd-focus'))
  if (!row) return null
  row.scrollIntoView({ block: 'nearest' })
  row.focus()
  const r = row.getBoundingClientRect()
  return { x: +(r.left + 8).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
if (darkFtFocus) await clickAt(darkFtFocus.x, darkFtFocus.y)
await sleep(100)
await pressArrow('ArrowDown')
await sleep(80)
await pressArrow('ArrowDown')
await sleep(150)

const dark = await evalExpr(MEASURE)
dark.hoverFill = darkHoverBg
dark.hoverPreMoveBg = darkHoverRect ? darkHoverRect.bg : null

await moveTo(5, 5)
await sleep(100)
const shotDark = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(`${OUT_DIR}/IT-02-FE-10-impl-dark.png`, Buffer.from(shotDark.data, 'base64'))

// supplementary dark outline
await evalExpr(`(() => {
  const tabs = document.querySelectorAll('.sidebar-tabs .sidebar-tab')
  if (tabs[1]) tabs[1].click()
  return true
})()`)
await sleep(250)
const darkOFocus = await evalExpr(`(() => {
  const row = document.querySelectorAll('.outline-item')[0]
  if (!row) return null
  row.focus()
  const r = row.getBoundingClientRect()
  return { x: +(r.left + 8).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
if (darkOFocus) await clickAt(darkOFocus.x, darkOFocus.y)
await sleep(100)
await pressArrow('ArrowDown')
await sleep(150)
dark.threeStates.outline.kbdRowLive = await evalExpr(`(() => {
  const k = document.querySelector('.outline-item.outline-kbd-focus')
  return k ? {
    cls: k.className,
    hasNavFocus: k.hasAttribute('data-nav-focus'),
    outlineWidth: getComputedStyle(k).outlineWidth,
    outlineStyle: getComputedStyle(k).outlineStyle,
    outlineColor: getComputedStyle(k).outlineColor,
    outlineOffset: getComputedStyle(k).outlineOffset,
    backgroundColor: getComputedStyle(k).backgroundColor
  } : null
})()`)
await evalExpr(`(() => {
  const rows = document.querySelectorAll('.outline-item')
  if (rows[1]) rows[1].click()
  return rows.length
})()`)
await sleep(250)
dark.threeStates.outline.activeAfterClick = await evalExpr(`(() => {
  const a = document.querySelector('.outline-item.outline-active')
  return a ? { cls: a.className, style: window.__fe10.styleOf(a) } : null
})()`)
const shotDarkOutline = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(`${OUT_DIR}/IT-02-FE-10-impl-dark-outline.png`, Buffer.from(shotDarkOutline.data, 'base64'))

const results = {
  meta: {
    port: PORT,
    fixture: FIXTURE,
    pageUrl: page.url,
    themeBtnTitle: themeBtn ? themeBtn.title : null
  },
  themeFlip: { before: beforeFlip, after: afterFlip },
  light,
  dark
}

writeFileSync(`${OUT_DIR}/IT-02-FE-10-cdp-data.json`, JSON.stringify(results, null, 2))
console.log(JSON.stringify({
  ok: true,
  themeFlip: results.themeFlip,
  lightTokens: light.tokens,
  darkTokens: dark.tokens,
  lightContrast: light.contrast.map((p) => `${p.label}: ${p.ratio}`),
  darkContrast: dark.contrast.map((p) => `${p.label}: ${p.ratio}`),
  lightHoverFill: light.hoverFill,
  darkHoverFill: dark.hoverFill,
  lightKbd: light.threeStates.filetree.kbdRow,
  lightOutlineKbdLive: light.threeStates.outline.kbdRowLive,
  darkKbd: dark.threeStates.filetree.kbdRow,
  darkOutlineKbdLive: dark.threeStates.outline.kbdRowLive
}, null, 2))
ws.close()
process.exit(0)
