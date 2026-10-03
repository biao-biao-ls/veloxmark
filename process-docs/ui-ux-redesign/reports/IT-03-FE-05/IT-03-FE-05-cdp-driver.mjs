#!/usr/bin/env node
/**
 * IT-03 FE-05 CDP selftest driver — 链接 hover 浮层。
 *
 * Measures (per tasks/IT-03/FE-05.md 验收阶段 2):
 *   S1 hover 浮层：url-box + 三入口（编辑/外开/复制）齐备、浮层不遮挡链接文本、
 *      浮现前后正文位移 0px + impl 截图（UI-IXD-07）
 *   S2 复制 (AC-FN-19)：剪贴板 === 完整 URL、toast「链接地址已复制」
 *   S3 外开 (AC-FN-19)：seam 捕获 URL；非 http(s) → dialog「仅支持打开 http(s) 链接」
 *   S4 编辑 URL 写回 (AC-OP-14)：.md href 落新值保锚文本、toast 回执、一次 Ctrl+Z
 *      还原、再编辑后外开对新 URL 生效
 *   S5 只读拦截 (AC-ERR-08)：文档逐字节不变、toast 冻结文案
 *   S6 hover 纪律 (AC-FN-14 / UI-IXD-07)：快速掠过 0 闪现、移出 ~600ms 内消失且
 *      无残留、点外部即隐、显隐循环正文位移 0px
 *
 * Robustness notes (inherited from IT-03-FE-04-cdp-driver.mjs):
 *  - Page.bringToFront first: an occluded Electron window throttles timers.
 *  - Emulation.setFocusEmulationEnabled keeps the page in the active lifecycle.
 *  - Link centers are re-measured immediately before every move.
 *  - headingFolds persist per-path in the session store — loadDoc 后必须
 *    __veloxP18.restoreKeys([]) 并断言，否则折叠体会藏起链接行。
 */
import { chmodSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'

const PORT = Number(process.env.FE05_CDP_PORT ?? 9444)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-03-FE-05'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/fe05-link-float-selftest.md`
const READONLY_PATH = `${FIXTURE_DIR}/fe05-link-readonly-selftest.md`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── CDP plumbing (same shape as FE-04 driver) ─────────────────────────────
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
async function evalExpr(expression) {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  })
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

/** Center of the first .cm-md-link whose text contains `snippet`. */
async function centerOfLink(snippet) {
  return evalExpr(`(() => {
    const el = [...document.querySelectorAll('.cm-editor .cm-md-link')]
      .find((n) => (n.textContent ?? '').includes(${JSON.stringify(snippet)}))
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

async function waitFor(expr, timeoutMs = 3000, stepMs = 25) {
  const t0 = Date.now()
  for (;;) {
    const v = await evalExpr(expr)
    if (v) return { value: v, waitedMs: Date.now() - t0 }
    if (Date.now() - t0 > timeoutMs) return { value: null, waitedMs: Date.now() - t0 }
    await sleep(stepMs)
  }
}

const FLOAT_PRESENT = `!!document.querySelector('.render-float [data-testid="link-hover-float"]')`

const FLOAT_STATE = `(() => {
  const f = document.querySelector('.render-float')
  if (!f) return { present: false }
  const inner = f.querySelector('[data-testid="link-hover-float"]')
  const urlBox = inner?.querySelector('[data-testid="link-url-box"]')
  return {
    present: true,
    hostTestId: f.getAttribute('data-testid'),
    testId: inner?.getAttribute('data-testid') ?? null,
    urlBox: urlBox ? { text: urlBox.textContent ?? '', title: urlBox.getAttribute('title') } : null,
    btns: {
      edit: !!inner?.querySelector('[data-testid="link-edit-url-btn"]'),
      open: !!inner?.querySelector('[data-testid="link-open-btn"]'),
      copy: !!inner?.querySelector('[data-testid="link-copy-btn"]')
    },
    editMode: {
      input: !!inner?.querySelector('[data-testid="link-url-input"]'),
      confirm: !!inner?.querySelector('[data-testid="link-url-confirm-btn"]'),
      cancel: !!inner?.querySelector('[data-testid="link-url-cancel-btn"]')
    },
    rect: (() => {
      const r = f.getBoundingClientRect()
      return { left: +r.left.toFixed(2), top: +r.top.toFixed(2), right: +r.right.toFixed(2), bottom: +r.bottom.toFixed(2) }
    })()
  }
})()`

const DIALOG_STATE = `(() => {
  const d = document.querySelector('.dialog-overlay .dialog')
  if (!d) return { present: false }
  return {
    present: true,
    message: d.querySelector('.dialog-message')?.textContent ?? null,
    buttons: [...d.querySelectorAll('.dialog-buttons .dialog-btn')].map((b) => b.textContent ?? '')
  }
})()`

const TOAST = `document.querySelector('.sb-toast')?.textContent ?? null`

const DOC = `window.__veloxP13 ? window.__veloxP13.getDoc() : (window.__veloxEditor?.view.state.doc.toString() ?? null)`

/**
 * Every rendered body line's rect — the displacement proof for UI-IXD-07
 * (浮层绝对定位覆盖层零布局位移). Zero tolerance: any delta is a layout shift.
 */
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

const results = { meta: { port: PORT, startedAt: new Date().toISOString() }, scenarios: {} }

/**
 * Load doc content under `path` and expand every heading fold first.
 * Two hazards make this a settle loop rather than a one-shot (FE-04 note):
 *  1. Folds persist per path in the session store — a collapsed heading hides
 *     the link line entirely (no .cm-md-link, no hover).
 *  2. Session restore can re-activate the previous tab AFTER loadDoc lands,
 *     which flips filePathRef back — the read-only gate then probes the wrong
 *     path and silently fails open/closed.
 */
async function loadDocExpanded(path, content, minLinks = 3) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    // A modal dialog (draft recovery) would block hover/dispatch — clear it.
    await dismissAnyDialog()
    await evalExpr(`(() => {
      window.__veloxP12.loadDoc(${JSON.stringify(content)}, ${JSON.stringify(path)})
      return true
    })()`)
    await sleep(900)
    await evalExpr(`(() => {
      window.__veloxP18?.restoreKeys([])
      return true
    })()`)
    await sleep(300)
    const state = await evalExpr(`({
      fp: window.__veloxP12.getFilePath(),
      folded: window.__veloxP18 ? window.__veloxP18.getFoldedKeys().length : -1,
      links: document.querySelectorAll('.cm-editor .cm-md-link').length
    })`)
    if (state.fp === path && state.folded === 0 && state.links >= minLinks) return state
  }
  const last = await evalExpr(`({
    fp: window.__veloxP12.getFilePath(),
    folded: window.__veloxP18 ? window.__veloxP18.getFoldedKeys().length : -1,
    links: document.querySelectorAll('.cm-editor .cm-md-link').length
  })`)
  throw new Error(`loadDocExpanded(${path}) did not settle: ${JSON.stringify(last)}`)
}

const check = (name, ok, detail) => {
  const row = { name, ok: !!ok, detail }
  results.checks = results.checks ?? []
  results.checks.push(row)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail) : ''}`)
  return !!ok
}

/** Hover a link by text, wait for the float, return its state. */
async function hoverLinkFloat(snippet) {
  await moveTo(neutral.x, neutral.y)
  await sleep(400)
  const c = await centerOfLink(snippet)
  if (!c) return { center: null, float: null, appeared: null }
  await moveTo(c.x, c.y)
  // Hover debounce floor is 150ms (HOVER_DELAY_MS) — wait well past it.
  const appeared = await waitFor(FLOAT_PRESENT, 3000)
  await sleep(120) // settle ≥250ms total hover for the acceptance wording
  const float = await evalExpr(FLOAT_STATE)
  return { center: c, float, appeared }
}

/** Click a float button by testid (button is measured right before the click). */
async function clickFloatBtn(testid) {
  const btn = await centerOf(`[data-testid="${testid}"]`)
  if (!btn) return null
  await moveTo(btn.x, btn.y)
  await sleep(60)
  await clickAt(btn.x, btn.y)
  return btn
}

/** React controlled input write-back (native setter + input event). */
async function setUrlInput(value) {
  return evalExpr(`(() => {
    const el = document.querySelector('[data-testid="link-url-input"]')
    if (!el) return null
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return el.value
  })()`)
}

/**
 * Force-clear any hover chrome via the click-outside path (hideNow — the only
 * exit that bypasses the pin/retain gates). Needed after an edit session that
 * was refused (read-only): confirmEdit keeps editing=true on refusal, which
 * pins the channel and makes debounced hide() a no-op by design.
 */
async function clearFloat() {
  await clickAt(neutral.x, neutral.y)
  await sleep(350)
  return evalExpr(`({
    floats: document.querySelectorAll('.render-float').length,
    linkPops: document.querySelectorAll('.cm-md-link-pop').length
  })`)
}

/**
 * Dismiss any modal dialog left over from a prior crashed run (draft-recovery
 * choose dialog blocks every hover — S1 would time out behind it). Prefer
 * 「丢弃草稿」 so the leftover autosave draft is cleaned up for good.
 */
async function dismissAnyDialog() {
  const s = await evalExpr(DIALOG_STATE)
  if (!s.present) return null
  const btn = await evalExpr(`(() => {
    const d = document.querySelector('.dialog-overlay .dialog')
    if (!d) return null
    const btns = [...d.querySelectorAll('.dialog-buttons .dialog-btn')]
    const byText = (t) => btns.find((b) => (b.textContent ?? '').trim() === t)
    const target = byText('丢弃草稿') ?? byText('确定') ?? btns[0]
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

// ── setup ─────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true })
await send('Page.bringToFront')
await send('Page.enable')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })

// Reload so the page picks up the current out/renderer build (LinkHoverFloat
// registration + hoverDiscipline channel live in the new chunks).
await send('Page.reload', { ignoreCache: true })
await waitFor('window.__veloxP12 && window.__veloxP13 && window.__veloxP17 && window.__veloxP18', 15000, 100)

// A crashed prior run can leave an autosave draft → recovery choose dialog on
// startup. It modal-blocks the page; dismiss (discard) before any scenario.
const startupDialog = await dismissAnyDialog()
if (startupDialog) {
  console.log('startup dialog dismissed:', JSON.stringify(startupDialog))
  results.meta.startupDialog = startupDialog
}

// Root-kill: the draft-recovery dialog is spawned by the async draft check on
// boot. Discard every leftover draft of our fixture paths BEFORE it fires
// (and again after a settle beat, covering the late-arriving case).
async function discardFe05Drafts() {
  return evalExpr(`(async () => {
    const list = await window.__veloxP12.draftList()
    const mine = (list ?? []).filter((d) => /fe05-/.test(d.path ?? ''))
    for (const d of mine) await window.__veloxP12.draftDiscard(d.path)
    return mine.map((d) => d.path)
  })()`)
}
const discarded0 = await discardFe05Drafts()
await sleep(700) // let the boot draft-check finish (or find nothing)
const discarded1 = await discardFe05Drafts()
const lateDialog = await dismissAnyDialog()
results.meta.draftsDiscarded = [...(discarded0 ?? []), ...(discarded1 ?? [])]
if (lateDialog) {
  console.log('late dialog dismissed:', JSON.stringify(lateDialog))
  results.meta.lateDialog = lateDialog
}
console.log('drafts discarded:', JSON.stringify(results.meta.draftsDiscarded))

const FIXTURE = [
  'See [设计规范文档](https://example.com/design-spec) for details.',
  '',
  'Also visit [OpenAI](https://openai.com) and [MDN](https://developer.mozilla.org).',
  '',
  'Try [Local file](./rel.md) too.',
  '',
  'Another line of body text for neutral clicking.'
].join('\n')

writeFileSync(FIXTURE_PATH, FIXTURE, 'utf-8')

// ── e2e seam 前置自检：isWritable 必须可达 ────────────────────────────────
{
  const probe = await evalExpr(`window.api.isWritable(${JSON.stringify(FIXTURE_PATH)}).then(
    (v) => ({ ok: true, v }),
    (e) => ({ ok: false, err: String(e) })
  )`)
  results.meta.isWritableProbe = probe
  if (!probe.ok && /No handler registered/i.test(probe.err ?? '')) {
    console.error('LAUNCH_ERROR: window.api.isWritable has no handler — the running Electron build is stale (pre-AC-ERR-08 IPC).')
    console.error('  probe error:', probe.err)
    results.meta.LAUNCH_ERROR = probe.err
    results.meta.finishedAt = new Date().toISOString()
    writeFileSync(`${OUT_DIR}/IT-03-FE-05-cdp-data.json`, JSON.stringify(results, null, 2))
    process.exit(3)
  }
  if (!probe.ok) {
    console.error('LAUNCH_ERROR: window.api.isWritable rejected:', probe.err)
    results.meta.LAUNCH_ERROR = probe.err
    results.meta.finishedAt = new Date().toISOString()
    writeFileSync(`${OUT_DIR}/IT-03-FE-05-cdp-data.json`, JSON.stringify(results, null, 2))
    process.exit(3)
  }
  check('S0 isWritable IPC 可达（非 stale 构建）', probe.ok === true, probe)
}

// 剪贴板读通道可用性（S2 断言路径选择）。
const clipboardReadAvailable = await evalExpr(`typeof window.api.clipboardRead === 'function'`)
results.meta.clipboardReadAvailable = clipboardReadAvailable

await loadDocExpanded(FIXTURE_PATH, FIXTURE, 4)
await dismissAnyDialog()

const geom = await evalExpr(`(() => {
  const links = [...document.querySelectorAll('.cm-editor .cm-md-link')].map((el) => ({
    text: (el.textContent ?? '').slice(0, 24),
    w: +el.getBoundingClientRect().width.toFixed(1)
  }))
  return {
    links,
    count: links.length,
    firstLinkText: links[0]?.text ?? null
  }
})()`)
results.geom = geom
console.log('geom', JSON.stringify(geom))
if (!geom || geom.count < 4) {
  console.error('FATAL: link marks missing — live-preview link decoration not applied', JSON.stringify(geom))
  process.exit(2)
}

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

// ── S1: hover 浮层结构 + 不遮挡链接文本 + 正文位移 0px + impl 截图 ─────────
{
  await moveTo(neutral.x, neutral.y)
  await sleep(400)
  const before = await evalExpr(BODY_RECTS)

  const c = await centerOfLink('设计规范文档')
  await moveTo(c.x, c.y)
  const appeared = await waitFor(FLOAT_PRESENT, 3000)
  await sleep(120) // 总悬停 ≥250ms（debounce 150ms 之上留裕量）
  const float = await evalExpr(FLOAT_STATE)
  const after = await evalExpr(BODY_RECTS)

  const linkRect = await evalExpr(`(() => {
    const el = [...document.querySelectorAll('.cm-editor .cm-md-link')]
      .find((n) => (n.textContent ?? '').includes('设计规范文档'))
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { left: +r.left.toFixed(2), top: +r.top.toFixed(2), right: +r.right.toFixed(2), bottom: +r.bottom.toFixed(2) }
  })()`)
  const overlap = rectsOverlap(float.rect, linkRect)

  check('S1 浮层随 hover 浮现', appeared.value != null, { waitedMs: appeared.waitedMs })
  check('S1 浮层根 testid 为 link-hover-float', float.testId === 'link-hover-float', float.testId)
  check('S1 link-url-box 存在且文本含完整 URL',
    !!float.urlBox && float.urlBox.text.includes('https://example.com/design-spec'),
    float.urlBox)
  const btns = float.btns ?? {}
  check('S1 三入口齐备（编辑 URL / 外开 / 复制）',
    !!(btns.edit && btns.open && btns.copy),
    btns)
  check('S1 三入口 + url-box = 「三入口 + url-box」',
    !!float.urlBox && !!(btns.edit && btns.open && btns.copy),
    { urlBox: !!float.urlBox, ...btns })
  check('S1 浮层不遮挡链接文本 (UI-IXD-07)', overlap === false, { float: float.rect, link: linkRect, overlap })
  const shift = maxShift(before, after)
  check('S1 正文位移 0px (UI-IXD-07)', shift === 0, { lines: before?.length, shift })

  // The P17 linkNav tooltip (vm-link-tooltip) stacks over the float while the
  // pointer is on the link text. Step onto the url-box inside the float (not
  // the link text) — FE-03 retain keeps the float visible while linkNav's
  // mousemove handler hides the tooltip because the hit target is no longer a
  // .cm-md-link — then capture a clean impl shot of url-box + three buttons.
  const urlBoxCenter = await centerOf('[data-testid="link-url-box"]')
  const shotPark = urlBoxCenter ?? (await centerOf('.render-float'))
  if (shotPark) {
    await moveTo(shotPark.x, shotPark.y)
    await sleep(350)
  }
  const shotPrep = await evalExpr(`({
    float: !!document.querySelector('.render-float [data-testid="link-hover-float"]'),
    tooltipVisible: (() => {
      const tip = document.querySelector('.vm-link-tooltip')
      return !!tip && !tip.hidden
    })()
  })`)
  results.scenarios.s1 = results.scenarios.s1 ?? {}
  results.scenarios.s1.shotPrep = shotPrep
  check('S1 截图准备：浮层保持可见（retain）', shotPrep.float === true, shotPrep)
  check('S1 截图准备：linkNav tooltip 已隐去', shotPrep.tooltipVisible === false, shotPrep)

  // Impl screenshot: clip to the float + first link + surrounding body.
  const clip = await evalExpr(`(() => {
    const f = document.querySelector('.render-float')
    const link = [...document.querySelectorAll('.cm-editor .cm-md-link')]
      .find((n) => (n.textContent ?? '').includes('设计规范文档'))
    const fr = f?.getBoundingClientRect()
    const lr = link?.getBoundingClientRect()
    const pad = 60
    const left = Math.max(0, Math.min(fr?.left ?? 1e9, lr?.left ?? 1e9) - pad)
    const top = Math.max(0, Math.min(fr?.top ?? 1e9, lr?.top ?? 1e9) - pad)
    const right = Math.min(document.documentElement.clientWidth, Math.max(fr?.right ?? 0, lr?.right ?? 0) + pad)
    const bottom = Math.min(document.documentElement.clientHeight, Math.max(fr?.bottom ?? 0, lr?.bottom ?? 0) + pad)
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
  writeFileSync(`${OUT_DIR}/IT-03-FE-05-impl.png`, Buffer.from(shot.data, 'base64'))
  results.scenarios.s1 = { ...(results.scenarios.s1 ?? {}), appeared: appeared.waitedMs, float, linkRect, overlap, before, after, shift, clip }
  console.log('impl screenshot →', `${OUT_DIR}/IT-03-FE-05-impl.png`)
}

// ── S2: 复制完整 URL (AC-FN-19) ──────────────────────────────────────────
{
  // Sentinel first — a stale clipboard from a prior run must not fake the assert.
  await evalExpr(`window.api.clipboardWrite('__fe05_sentinel__')`)
  // Float still visible from S1 — re-measure the copy button and click it.
  await clickFloatBtn('link-copy-btn')
  await sleep(400)

  const toast = await evalExpr(TOAST)
  check('S2 toast 含「链接地址已复制」(toast.copiedLink)', (toast ?? '').includes('链接地址已复制'), toast)

  let clipValue = null
  if (clipboardReadAvailable) {
    clipValue = await evalExpr(`window.api.clipboardRead()`)
    check('S2 复制确实写入剪贴板（覆盖 sentinel）', clipValue !== '__fe05_sentinel__', clipValue)
    check('S2 剪贴板 === 完整 URL https://example.com/design-spec', clipValue === 'https://example.com/design-spec', clipValue)
  } else {
    check('S2 剪贴板断言（clipboardRead 未暴露 → 以 toast 代替）', (toast ?? '').includes('链接地址已复制'), {
      gap: 'window.api.clipboardRead not exposed',
      toast
    })
  }
  results.scenarios.s2 = { toast, clipboardReadAvailable, clipValue }
}

// ── S3: 外开 (AC-FN-19) + 非 http(s) 拦截 ─────────────────────────────────
{
  // Capture seam BEFORE clicking — skip confirm dialog, record the URL.
  await evalExpr(`(() => {
    window.__fe05OpenCapture = null
    window.__veloxP17.setExternalConfirm(false)
    window.__veloxP17.setOpenExternalImpl(async (url) => {
      window.__fe05OpenCapture = url
      return true
    })
    return true
  })()`)

  // Re-hover the first link (float may have hidden after S2's click-outside path).
  const h1 = await hoverLinkFloat('设计规范文档')
  check('S3 外开前浮层可见', h1.appeared?.value != null, h1.appeared)

  await clickFloatBtn('link-open-btn')
  const captured = await waitFor(`window.__fe05OpenCapture`, 3000)
  check('S3 外开捕获 URL === https://example.com/design-spec',
    captured.value === 'https://example.com/design-spec',
    captured.value)

  // 非 http(s)：同一文档内 [Local file](./rel.md) 外开 → dialog 拦截（不换文档）。
  const h2 = await hoverLinkFloat('Local file')
  check('S3 非 http 链接浮层可见', h2.appeared?.value != null, h2.appeared)
  await clickFloatBtn('link-open-btn')
  const dialog = await waitFor(DIALOG_STATE.includes('present') ? `(() => { const s = ${DIALOG_STATE}; return s.present ? s : null })()` : DIALOG_STATE, 3000)
  const dialogState = dialog.value ?? (await evalExpr(DIALOG_STATE))
  check('S3 非 http(s) 外开弹出 dialog（link.otherProtocol）',
    dialogState.present === true && (dialogState.message ?? '').includes('仅支持打开 http(s)'),
    dialogState)
  check('S3 非 http(s) 分支未触发外开捕获', captured.value === 'https://example.com/design-spec' && (await evalExpr(`window.__fe05OpenCapture`)) === 'https://example.com/design-spec',
    await evalExpr(`window.__fe05OpenCapture`))
  // Dismiss the alert (single 确定 button).
  const okBtn = await centerOf('.dialog-buttons .dialog-btn-primary')
  if (okBtn) {
    await clickAt(okBtn.x, okBtn.y)
    await sleep(300)
  }
  const dialogAfter = await evalExpr(DIALOG_STATE)
  check('S3 dialog 已关闭', dialogAfter.present === false, dialogAfter)
  results.scenarios.s3 = { captured: captured.value, dialogState, dialogAfter }
}

// ── S4: 编辑 URL 写回 (AC-OP-14) ─────────────────────────────────────────
{
  // Reload the clean fixture (S3 non-http variant is no longer wanted).
  await loadDocExpanded(FIXTURE_PATH, FIXTURE, 4)

  const h = await hoverLinkFloat('设计规范文档')
  check('S4 编辑前浮层可见', h.appeared?.value != null, h.appeared)

  await clickFloatBtn('link-edit-url-btn')
  await sleep(200)
  const editState = await evalExpr(FLOAT_STATE)
  check('S4 编辑态 input/确认/取消齐备',
    editState.editMode.input && editState.editMode.confirm && editState.editMode.cancel,
    editState.editMode)
  const inputCenter = await centerOf('[data-testid="link-url-input"]')
  check('S4 link-url-input 可见', inputCenter != null, inputCenter)
  const oldValue = await evalExpr(`document.querySelector('[data-testid="link-url-input"]')?.value ?? null`)
  check('S4 input 预填旧 URL https://example.com/design-spec',
    oldValue === 'https://example.com/design-spec', oldValue)

  const NEW_URL = 'https://example.com/design-spec-v2'
  const typed = await setUrlInput(NEW_URL)
  check('S4 输入新 URL 生效', typed === NEW_URL, typed)

  const docBefore = await evalExpr(DOC)
  await clickFloatBtn('link-url-confirm-btn')
  await sleep(400)

  const toast = await evalExpr(TOAST)
  check('S4 toast 精确为「已更新链接地址（Ctrl+Z 可撤销）」',
    toast === '已更新链接地址（Ctrl+Z 可撤销）', toast)

  const docAfter = await evalExpr(DOC)
  check('S4 .md href 已落新 URL', (docAfter ?? '').includes(NEW_URL), docAfter)
  // 旧 URL 是新 URL 的前缀——只能按完整 destination 槽断言旧值已不在。
  check('S4 旧 URL 已不在 .md 中（按完整 dest 槽比对）',
    !(docAfter ?? '').includes('](https://example.com/design-spec)') &&
      !(docAfter ?? '').includes('<https://example.com/design-spec>'),
    docAfter)
  check('S4 锚文本「设计规范文档」不变（仅替换 href）',
    (docAfter ?? '').includes('[设计规范文档](') && (docBefore ?? '').includes('[设计规范文档](https://example.com/design-spec)'),
    { before: docBefore, after: docAfter })

  // One Ctrl+Z must restore the pre-edit URL (AC-OP-14 undo 边界).
  await evalExpr(`window.__veloxEditor.view.focus(); true`)
  await pressCtrlZ()
  await sleep(400)
  const docUndone = await evalExpr(DOC)
  check('S4 一次 Ctrl+Z 还原旧 URL',
    (docUndone ?? '').includes('https://example.com/design-spec') && !(docUndone ?? '').includes('design-spec-v2'),
    docUndone)
  check('S4 undo 后文档逐字节还原编辑前', docUndone === docBefore, { before: docBefore, after: docUndone })

  // Re-apply the same edit (redo not required) and verify 外开 on the NEW URL.
  const h2 = await hoverLinkFloat('设计规范文档')
  check('S4 再编辑前浮层可见', h2.appeared?.value != null, h2.appeared)
  await clickFloatBtn('link-edit-url-btn')
  await sleep(200)
  await setUrlInput(NEW_URL)
  await clickFloatBtn('link-url-confirm-btn')
  await sleep(400)
  const docReapplied = await evalExpr(DOC)
  check('S4 再次编辑后 .md 落新 URL', (docReapplied ?? '').includes(NEW_URL), docReapplied)

  // 外开对新 URL 生效 — reinstall the capture seam and click 外开.
  await evalExpr(`(() => {
    window.__fe05OpenCapture = null
    window.__veloxP17.setExternalConfirm(false)
    window.__veloxP17.setOpenExternalImpl(async (url) => {
      window.__fe05OpenCapture = url
      return true
    })
    return true
  })()`)
  const h3 = await hoverLinkFloat('设计规范文档')
  check('S4 外开新 URL 前浮层可见', h3.appeared?.value != null, h3.appeared)
  await clickFloatBtn('link-open-btn')
  const captured2 = await waitFor(`window.__fe05OpenCapture`, 3000)
  check('S4 外开捕获 === 新 URL https://example.com/design-spec-v2',
    captured2.value === NEW_URL, captured2.value)

  results.scenarios.s4 = {
    oldValue,
    newUrl: NEW_URL,
    typed,
    toast,
    docBefore,
    docAfter,
    docUndone,
    docReapplied,
    openCaptureAfterReapply: captured2.value
  }
}

// ── S5: 只读拦截 (AC-ERR-08) ──────────────────────────────────────────────
{
  // A prior crashed run can leave the fixture at 0o444 — release it first so
  // the rewrite itself cannot EPERM before the readonly scenario starts.
  try { chmodSync(READONLY_PATH, 0o666) } catch { /* absent */ }
  writeFileSync(READONLY_PATH, FIXTURE, 'utf-8')
  chmodSync(READONLY_PATH, 0o444)
  await loadDocExpanded(READONLY_PATH, FIXTURE, 3)

  const docBefore = await evalExpr(DOC)
  const writableProbe = await evalExpr(`window.api.isWritable(${JSON.stringify(READONLY_PATH)}).then(
    (v) => ({ ok: true, v }), (e) => ({ ok: false, err: String(e) })
  )`)
  check('S5 只读探针报告不可写', writableProbe.ok === true && writableProbe.v === false, writableProbe)
  if (!writableProbe.ok && /No handler registered/i.test(writableProbe.err ?? '')) {
    console.error('LAUNCH_ERROR: window.api.isWritable has no handler — stale Electron build')
    results.meta.LAUNCH_ERROR = writableProbe.err
    results.meta.finishedAt = new Date().toISOString()
    writeFileSync(`${OUT_DIR}/IT-03-FE-05-cdp-data.json`, JSON.stringify(results, null, 2))
    process.exit(3)
  }

  const h = await hoverLinkFloat('设计规范文档')
  check('S5 只读下浮层仍可见', h.appeared?.value != null, h.appeared)
  await clickFloatBtn('link-edit-url-btn')
  await sleep(200)
  await setUrlInput('https://example.com/design-spec-readonly')
  await clickFloatBtn('link-url-confirm-btn')
  await sleep(400)

  const toast = await evalExpr(TOAST)
  check('S5 只读 toast 精确为「文件为只读，无法修改，可另存后编辑」',
    toast === '文件为只读，无法修改，可另存后编辑', toast)

  const docAfter = await evalExpr(DOC)
  check('S5 只读拦截文档逐字节不变', docAfter === docBefore, { before: docBefore, after: docAfter })

  // Documented product intent: on refusal confirmEdit stays in edit mode
  // (LinkHoverFloat「Refused … stay in edit mode」), which pins the channel —
  // S6 must therefore force-clear via the click-outside (hideNow) path first.
  const floatAfterRefuse = await evalExpr(FLOAT_STATE)
  check('S5 只读拒绝后浮层保留编辑态（stay-in-edit 设计意图）',
    floatAfterRefuse.present === true && floatAfterRefuse.editMode.input === true,
    floatAfterRefuse.editMode)

  results.scenarios.s5 = { docBefore, docAfter, toast, writableProbe, floatAfterRefuse }
}

// ── S6: hover 纪律 (AC-FN-14 / UI-IXD-07) ────────────────────────────────
{
  // Back to the clean writable fixture so links are known-good.
  await loadDocExpanded(FIXTURE_PATH, FIXTURE, 4)

  // S5 left the float pinned in edit mode (refused confirm keeps editing=true).
  // Click-outside is the only exit that bypasses pin — use it, then assert a
  // clean slate so the swipe below starts with zero hover chrome.
  const preclean = await clearFloat()
  check('S6 前置：残留浮层已清零', preclean.floats === 0 && preclean.linkPops === 0, preclean)

  const docBefore = await evalExpr(DOC)
  const rectsStart = await evalExpr(BODY_RECTS)

  // (a) Fast swipe across ≥3 blocks — 0 flashes with <150ms dwell per point.
  // Points deliberately include every link center (hover zones) plus body-text
  // midpoints on the other lines — a pass-over must never flash the float.
  const linkCenters = await evalExpr(`[...document.querySelectorAll('.cm-editor .cm-md-link')].map((el) => {
    const r = el.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2), text: (el.textContent ?? '').slice(0, 16) }
  })`)
  const bodyPoints = await evalExpr(`(() => {
    const out = []
    for (const snippet of ${JSON.stringify(['See', 'for details', 'Another line'])}) {
      const line = [...document.querySelectorAll('.cm-line')].find((l) => (l.textContent ?? '').includes(snippet))
      if (!line) continue
      const r = line.getBoundingClientRect()
      out.push({ x: +(r.left + 8).toFixed(2), y: +(r.top + r.height / 2).toFixed(2), text: snippet })
    }
    return out
  })()`)
  const swipeTargets = [...linkCenters, ...bodyPoints]
  check('S6 快速掠过目标 ≥3 个块', swipeTargets.length >= 3, swipeTargets.length)

  let flashes = 0
  const swipeSamples = []
  await moveTo(neutral.x, neutral.y)
  await sleep(50) // keep any prior channel from merging into the swipe
  for (const pt of swipeTargets) {
    await moveTo(pt.x, pt.y)
    // Sample immediately — the eval round-trip is the only dwell and stays
    // well under the 150ms show debounce, so a pass-over must never flash.
    const present = await evalExpr(FLOAT_PRESENT)
    swipeSamples.push({ x: pt.x, y: pt.y, present })
    if (present) flashes++
  }
  check('S6 快速掠过 0 闪现（每点采样 <150ms 驻留）', flashes === 0, { flashes, swipeSamples })

  // (b) Hover ≥250ms → appears; move away → hides within ~600ms, zero residue.
  const c = await centerOfLink('设计规范文档')
  await moveTo(c.x, c.y)
  const appeared = await waitFor(FLOAT_PRESENT, 3000)
  await sleep(120)
  check('S6 悬停 ≥250ms 浮层出现', appeared.value === true, appeared)

  await moveTo(neutral.x, neutral.y)
  const tHide0 = Date.now()
  const hidden = await waitFor(`!document.querySelector('.render-float')`, 800, 20)
  const hideMs = hidden.waitedMs
  check('S6 移出后 ~600ms 内浮层消失', hidden.value === true && hideMs <= 600 + 25, { hideMs })
  const residue1 = await evalExpr(`({
    floats: document.querySelectorAll('.render-float').length,
    linkPops: document.querySelectorAll('.cm-md-link-pop').length
  })`)
  check('S6 移出后无残留（render-float=0 且无 cm-md-link-pop）',
    residue1.floats === 0 && residue1.linkPops === 0, residue1)

  // (c) Click-outside while visible → immediate hide, zero residue.
  await moveTo(c.x, c.y)
  const appeared2 = await waitFor(FLOAT_PRESENT, 3000)
  check('S6 点外部前浮层可见', appeared2.value === true, appeared2)
  await clickAt(neutral.x, neutral.y)
  await sleep(300)
  const residue2 = await evalExpr(`({
    floats: document.querySelectorAll('.render-float').length,
    linkPops: document.querySelectorAll('.cm-md-link-pop').length
  })`)
  check('S6 点外部即隐且无残留', residue2.floats === 0 && residue2.linkPops === 0, residue2)

  // (d) Full show/hide cycles must not displace body text (UI-IXD-07).
  const rectsEnd = await evalExpr(BODY_RECTS)
  const shift = maxShift(rectsStart, rectsEnd)
  check('S6 显隐循环正文位移 0px', shift === 0, { lines: rectsStart?.length, shift })

  const docAfter = await evalExpr(DOC)
  check('S6 过程中 .md 无改动', docAfter === docBefore, { before: docBefore, after: docAfter })

  results.scenarios.s6 = {
    swipeSamples, flashes, appeared: appeared.waitedMs, hideMs,
    residue1, residue2, shift, hideT0: tHide0
  }
}

// ── teardown: drop fixtures so the tree stays clean ───────────────────────
// Discard leftover autosave drafts first — a stale draft triggers the
// recovery dialog on the next reload and modal-blocks the page.
try {
  await evalExpr(`Promise.all([
    window.__veloxP12.draftDiscard(${JSON.stringify(FIXTURE_PATH)}),
    window.__veloxP12.draftDiscard(${JSON.stringify(READONLY_PATH)})
  ]).then(() => true)`)
} catch { /* best-effort */ }
try {
  chmodSync(READONLY_PATH, 0o666)
  rmSync(READONLY_PATH, { force: true })
} catch { /* best-effort */ }
try {
  chmodSync(FIXTURE_PATH, 0o666)
  rmSync(FIXTURE_PATH, { force: true })
} catch { /* best-effort */ }
// Leave the editor unfolded — the session store persists fold keys per path.
try {
  await evalExpr(`(() => { window.__veloxP18?.restoreKeys([]); return true })()`)
} catch { /* best-effort */ }
// Drop the openExternal capture seam so a human session keeps real 外开.
try {
  await evalExpr(`(() => {
    window.__veloxP17?.setOpenExternalImpl(null)
    window.__veloxP17?.setExternalConfirm(true)
    return true
  })()`)
} catch { /* best-effort */ }

results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-03-FE-05-cdp-data.json`, JSON.stringify(results, null, 2))

const failed = (results.checks ?? []).filter((c) => !c.ok)
console.log(`\n==== ${results.checks.length - failed.length}/${results.checks.length} checks passed ====`)
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' | '))
  process.exitCode = 1
}
ws.close()
