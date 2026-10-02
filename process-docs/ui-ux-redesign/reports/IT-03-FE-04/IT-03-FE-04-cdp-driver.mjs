#!/usr/bin/env node
/**
 * IT-03 FE-04 CDP selftest driver — 图片编辑浮层。
 *
 * Measures (per tasks/IT-03/FE-04.md 验收阶段 2):
 *   S1 hover 浮层：对齐三键 / 宽度下拉 / ✓ 完成 / 尺寸角柄齐备 + impl 截图
 *      UI-IXD-10 判据 2 — 浮层浮现前后正文 boundingClientRect 位移 0px
 *   S2 尺寸拖拽：.md 源码落新 =WxH、toast 含「（Ctrl+Z 可撤销）」、一次 Ctrl+Z 还原
 *   S3 对齐点击：按钮 .is-on、尺寸不变、.md 落 {align=…}、同格式 toast、一次 Ctrl+Z 还原
 *   S4 只读拦截 (AC-ERR-08)：文档逐字节不变、toast「文件为只读，无法修改，可另存后编辑」
 *      + 解除只读后同一操作可落盘
 *   S5 退出路径 (UI-IXD-10)：「✓ 完成」与点外部两条路径均无残留控件
 *
 * Robustness notes (inherited from IT-03-FE-03-cdp-driver.mjs):
 *  - Page.bringToFront first: an occluded Electron window throttles timers.
 *  - Emulation.setFocusEmulationEnabled keeps the page in the active lifecycle.
 *  - Anchor/handle centers are re-measured immediately before every move.
 */
import { chmodSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'

const PORT = Number(process.env.FE04_CDP_PORT ?? 9444)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-03-FE-04'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/fe04-image-edit-selftest.md`
const READONLY_PATH = `${FIXTURE_DIR}/fe04-readonly-selftest.md`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── CDP plumbing (same shape as FE-03 driver) ─────────────────────────────
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

async function waitFor(expr, timeoutMs = 3000, stepMs = 25) {
  const t0 = Date.now()
  for (;;) {
    const v = await evalExpr(expr)
    if (v) return { value: v, waitedMs: Date.now() - t0 }
    if (Date.now() - t0 > timeoutMs) return { value: null, waitedMs: Date.now() - t0 }
    await sleep(stepMs)
  }
}

const FLOAT_STATE = `(() => {
  const f = document.querySelector('.render-float')
  if (!f) return { present: false }
  const inner = f.querySelector('[data-testid]')
  return {
    present: true,
    testId: inner?.getAttribute('data-testid') ?? null,
    alignBtns: f.querySelectorAll('.cm-md-float-btn').length,
    hasSelect: !!f.querySelector('.cm-md-float-select select'),
    selectText: (() => {
      const box = f.querySelector('.cm-md-float-select')
      const sel = box?.querySelector('select')
      const lab = box?.querySelector('span')
      return {
        label: lab?.textContent ?? null,
        selected: sel?.selectedOptions?.[0]?.textContent ?? null,
        value: sel?.value ?? null
      }
    })(),
    hasDone: !!f.querySelector('.cm-md-float-primary'),
    doneText: f.querySelector('.cm-md-float-primary')?.innerText?.replace(/\\s+/g, ' ').trim() ?? null,
    onBtn: f.querySelector('.cm-md-float-btn.is-on')?.getAttribute('data-testid') ?? null
  }
})()`

const HANDLE_STATE = `(() => {
  const h = document.querySelector('.cm-md-img-resize')
  if (!h) return { present: false }
  const r = h.getBoundingClientRect()
  return {
    present: true,
    testId: h.getAttribute('data-testid'),
    title: h.getAttribute('title'),
    w: +r.width.toFixed(2), h: +r.height.toFixed(2)
  }
})()`

const TOAST = `document.querySelector('.sb-toast')?.textContent ?? null`

const DOC = `window.__veloxP13 ? window.__veloxP13.getDoc() : (window.__veloxEditor?.view.state.doc.toString() ?? null)`

const IMG_RECT = `(() => {
  const img = document.querySelector('.cm-md-image-wrap:not(.cm-md-image-broken) img.cm-md-image')
  if (!img) return null
  return { w: img.clientWidth, h: img.clientHeight, nw: img.naturalWidth, nh: img.naturalHeight }
})()`

/**
 * Every rendered body line's rect — the displacement proof for UI-IXD-10
 * 判据2. Viewport-limited CM6 rendering means a text marker line can be
 * missing from the DOM, so compare the whole visible prose column instead of
 * one paragraph. Zero tolerance: any delta is a layout shift.
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

const results = { meta: { port: PORT, startedAt: new Date().toISOString() }, scenarios: {} }

/**
 * Load the fixture into the editor and expand every heading fold first.
 * Two hazards make this a settle loop rather than a one-shot:
 *  1. Folds persist per path in the session store and survive Page.reload —
 *     a collapsed H1 hides the image line entirely (no widget, no grip).
 *  2. Session restore can re-activate the previous tab AFTER loadDoc lands,
 *     which flips filePathRef back — the read-only gate then probes the wrong
 *     path and refuses every write with the AC-ERR-08 toast.
 */
async function loadDocExpanded(path) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await evalExpr(`(() => {
      window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(path)})
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
      wraps: document.querySelectorAll('.cm-md-image-wrap').length
    })`)
    if (state.fp === path && state.folded === 0 && state.wraps > 0) return
  }
  const last = await evalExpr(`({
    fp: window.__veloxP12.getFilePath(),
    folded: window.__veloxP18 ? window.__veloxP18.getFoldedKeys().length : -1,
    wraps: document.querySelectorAll('.cm-md-image-wrap').length
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

// ── setup ─────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true })
await send('Page.bringToFront')
await send('Page.enable')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })

// The running instance may carry a pre-FE-04 bundle — reload so the page picks
// up the current out/renderer build (registerHoverContent registration lives in
// the new chunk).
await send('Page.reload', { ignoreCache: true })
await waitFor('window.__veloxP12 && window.__veloxP13', 15000, 100)

const FIXTURE = [
  '# FE-04 image edit float selftest',
  '',
  'Body paragraph for displacement measurement.',
  '',
  // Sized like ui_06 block A (360×200 placeholder) so the corner grip and the
  // below-the-image float both sit inside a 1200×800 viewport. A natural-size
  // 1024×1024 render pushes the grip past the fold and makes the drag target
  // unreachable in automation — and in the product the float placement ladder
  // already flips above in that case.
  '![cover](logo-master.png =360x240)',
  '',
  'trailing body text'
].join('\n')
writeFileSync(FIXTURE_PATH, FIXTURE, 'utf-8')

await loadDocExpanded(FIXTURE_PATH)

const geom = await evalExpr(`(() => {
  const pack = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(1), y: +(r.top + r.height / 2).toFixed(1),
             left: +r.left.toFixed(1), top: +r.top.toFixed(1),
             right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }
  }
  return {
    img: pack(document.querySelector('.cm-md-image-wrap:not(.cm-md-image-broken)')),
    imgTag: ${IMG_RECT},
    counts: {
      img: document.querySelectorAll('.cm-md-image-wrap:not(.cm-md-image-broken)').length,
      broken: document.querySelectorAll('.cm-md-image-wrap.cm-md-image-broken').length
    }
  }
})()`)
results.geom = geom
console.log('geom', JSON.stringify(geom))
if (!geom.img || geom.counts.img < 1) {
  console.error('FATAL: image widget missing — logo-master.png did not resolve', JSON.stringify(geom))
  process.exit(2)
}

// Neutral point inside the editor but off every hover zone.
const neutral = await evalExpr(`(() => {
  for (let y = 40; y < window.innerHeight; y += 12) {
    for (let x = 40; x < window.innerWidth; x += 12) {
      const el = document.elementFromPoint(x, y)
      if (!el) continue
      if (el.closest('.cm-md-image-wrap, .cm-md-link, .cm-md-list, .render-float, .cm-md-img-resize')) continue
      // Headings, fold placeholders and the fold gutter all toggle folds on
      // click — a stray "neutral" click on any of them collapses the body.
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

// ── S1: hover 浮层结构 + 正文位移 0px + impl 截图 ─────────────────────────
{
  await moveTo(neutral.x, neutral.y)
  await sleep(400)
  const before = await evalExpr(BODY_RECTS)

  const c = await centerOf('.cm-md-image-wrap:not(.cm-md-image-broken)')
  await moveTo(c.x, c.y)
  const appeared = await waitFor(`!!document.querySelector('.render-float [data-testid="image-edit-float"]')`, 3000)
  const float = await evalExpr(FLOAT_STATE)
  const handle = await evalExpr(HANDLE_STATE)
  const after = await evalExpr(BODY_RECTS)

  check('S1 浮层随 hover 浮现', appeared.value != null, { waitedMs: appeared.waitedMs })
  check('S1 对齐三键齐备 (◧▣◨)', float.alignBtns === 3, float.alignBtns)
  check('S1 宽度下拉齐备且文案「宽度 N%」',
    float.hasSelect && float.selectText?.label === '宽度' && /^\d+%$/.test(float.selectText?.selected ?? ''),
    float.selectText)
  check('S1 ✓ 完成按钮齐备', float.hasDone && (float.doneText ?? '').includes('完成'), float.doneText)
  check('S1 尺寸角柄齐备 (img-resize-handle)', handle.present && handle.testId === 'image-resize-handle', handle)
  check('S1 角柄 title「拖拽调整尺寸」', handle.title === '拖拽调整尺寸', handle.title)
  const shift = maxShift(before, after)
  check('S1 正文位移 0px (UI-IXD-10 判据2)', shift === 0, { lines: before?.length, shift })

  // Impl screenshot: float fully visible, same region as the design block A.
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  writeFileSync(`${OUT_DIR}/IT-03-FE-04-impl.png`, Buffer.from(shot.data, 'base64'))
  results.scenarios.s1 = { appeared: appeared.waitedMs, float, handle, before, after, shift }
  console.log('impl screenshot →', `${OUT_DIR}/IT-03-FE-04-impl.png`)
}

// ── S2: 尺寸拖拽写 .md + 回执 + 一次 Ctrl+Z 还原 (AC-OP-13 拖拽分支) ──────
{
  const docBefore = await evalExpr(DOC)
  const imgBefore = await evalExpr(IMG_RECT)
  const h = await centerOf('.cm-md-img-resize')
  if (!h) {
    check('S2 角柄存在', false, 'no handle')
  } else {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: h.x, y: h.y, button: 'left', buttons: 1, clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: h.x + 80, y: h.y + 20, button: 'left', buttons: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: h.x + 120, y: h.y + 30, button: 'left', buttons: 1 })
    const during = await evalExpr(IMG_RECT)
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: h.x + 120, y: h.y + 30, button: 'left', buttons: 0, clickCount: 1 })
    await sleep(400)

    const toast = await evalExpr(TOAST)
    const docAfter = await evalExpr(DOC)
    const imgAfter = await evalExpr(IMG_RECT)
    const sizeBefore = /=\d+x\d+/.exec(docBefore ?? '')?.[0] ?? null
    const sizeInDoc = /=\d+x\d+/.exec(docAfter ?? '')

    check('S2 拖拽中预览尺寸连续跟随', during && imgBefore && during.w > imgBefore.w, { imgBefore, during })
    check('S2 松开后 .md 尺寸已改变并落 =WxH',
      sizeInDoc != null && sizeInDoc[0] !== sizeBefore,
      { sizeBefore, sizeAfter: sizeInDoc?.[0] })
    check('S2 .md 尺寸与渲染尺寸一致',
      sizeInDoc != null && imgAfter && Number(sizeInDoc[0].slice(1).split('x')[0]) === imgAfter.w,
      { src: sizeInDoc?.[0], rendered: imgAfter })
    check('S2 toast 含「（Ctrl+Z 可撤销）」', (toast ?? '').includes('（Ctrl+Z 可撤销）'), toast)
    check('S2 toast 为尺寸回执', (toast ?? '').includes('已调整图片尺寸'), toast)

    // One Ctrl+Z must restore the exact pre-drag source (AC-OP-13 undo 边界).
    await evalExpr(`window.__veloxEditor.view.focus(); true`)
    await pressCtrlZ()
    await sleep(400)
    const docUndone = await evalExpr(DOC)
    check('S2 一次 Ctrl+Z 还原编辑前尺寸', docUndone === docBefore, {
      before: docBefore, after: docUndone
    })
    results.scenarios.s2 = { docBefore, docAfter, docUndone, toast, imgBefore, during, imgAfter }
  }
}

// ── S3: 对齐点击写 .md + 回执 + 一次 Ctrl+Z (AC-OP-13 对齐分支) ───────────
{
  await moveTo(neutral.x, neutral.y)
  await sleep(400)
  const c = await centerOf('.cm-md-image-wrap:not(.cm-md-image-broken)')
  await moveTo(c.x, c.y)
  await waitFor(`!!document.querySelector('.render-float [data-testid="image-edit-float"]')`, 3000)

  const docBefore = await evalExpr(DOC)
  const imgBefore = await evalExpr(IMG_RECT)
  const btn = await centerOf('[data-testid="image-align-center"]')
  await clickAt(btn.x, btn.y)
  await sleep(400)

  const toast = await evalExpr(TOAST)
  const docAfter = await evalExpr(DOC)
  const imgAfter = await evalExpr(IMG_RECT)
  const floatAfter = await evalExpr(FLOAT_STATE)

  check('S3 对齐键进入激活态 (.is-on)', floatAfter.onBtn === 'image-align-center', floatAfter.onBtn)
  check('S3 .md 落 {align=center}', (docAfter ?? '').includes('{align=center}'), docAfter)
  check('S3 尺寸字段不变（对齐改写保尺寸）',
    (/\s+=\s*\d+x\d+/.exec(docBefore ?? '')?.[0] ?? null) === (/\s+=\s*\d+x\d+/.exec(docAfter ?? '')?.[0] ?? null),
    { before: /\s+=\s*\d+x\d+/.exec(docBefore ?? '')?.[0], after: /\s+=\s*\d+x\d+/.exec(docAfter ?? '')?.[0] })
  check('S3 渲染尺寸不变', imgBefore && imgAfter && imgBefore.w === imgAfter.w && imgBefore.h === imgAfter.h, { imgBefore, imgAfter })
  check('S3 toast 含「（Ctrl+Z 可撤销）」', (toast ?? '').includes('（Ctrl+Z 可撤销）'), toast)
  check('S3 toast 为对齐回执', (toast ?? '').includes('已设置图片对齐'), toast)

  await evalExpr(`window.__veloxEditor.view.focus(); true`)
  await pressCtrlZ()
  await sleep(400)
  const docUndone = await evalExpr(DOC)
  check('S3 一次 Ctrl+Z 还原编辑前对齐', docUndone === docBefore, { before: docBefore, after: docUndone })
  results.scenarios.s3 = { docBefore, docAfter, docUndone, toast, floatAfter, imgBefore, imgAfter }
}

// ── S4: 只读拦截 (AC-ERR-08) ──────────────────────────────────────────────
{
  // A prior crashed run can leave the fixture at 0o444 — release it first so
  // the rewrite itself cannot EPERM before the readonly scenario starts.
  try { chmodSync(READONLY_PATH, 0o666) } catch { /* absent */ }
  writeFileSync(READONLY_PATH, FIXTURE, 'utf-8')
  chmodSync(READONLY_PATH, 0o444)
  await loadDocExpanded(READONLY_PATH)

  const docBefore = await evalExpr(DOC)
  const writableProbe = await evalExpr(`window.api.isWritable(${JSON.stringify(READONLY_PATH)})`)
  check('S4 只读探针报告不可写', writableProbe === false, writableProbe)

  await moveTo(neutral.x, neutral.y)
  await sleep(400)
  const c = await centerOf('.cm-md-image-wrap:not(.cm-md-image-broken)')
  await moveTo(c.x, c.y)
  await waitFor(`!!document.querySelector('.render-float [data-testid="image-edit-float"]')`, 3000)

  const btn = await centerOf('[data-testid="image-align-right"]')
  await clickAt(btn.x, btn.y)
  await sleep(400)
  const toastAlign = await evalExpr(TOAST)
  const docAfterAlign = await evalExpr(DOC)
  check('S4 只读下对齐被拦截、文档逐字节不变', docAfterAlign === docBefore, { before: docBefore, after: docAfterAlign })
  check('S4 只读 toast 文案精确', toastAlign === '文件为只读，无法修改，可另存后编辑', toastAlign)

  // Drag path too.
  const h = await centerOf('.cm-md-img-resize')
  if (h) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: h.x, y: h.y, button: 'left', buttons: 1, clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: h.x + 90, y: h.y + 20, button: 'left', buttons: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: h.x + 90, y: h.y + 20, button: 'left', buttons: 0, clickCount: 1 })
    await sleep(400)
  }
  const toastDrag = await evalExpr(TOAST)
  const docAfterDrag = await evalExpr(DOC)
  check('S4 只读下拖拽被拦截、文档逐字节不变', docAfterDrag === docBefore, { before: docBefore, after: docAfterDrag })
  check('S4 拖拽只读 toast 文案精确', toastDrag === '文件为只读，无法修改，可另存后编辑', toastDrag)

  // 「另存为副本后重复操作可落盘」— release the attribute on the same path
  // (save-as copies are writable) and confirm the identical op now lands.
  chmodSync(READONLY_PATH, 0o666)
  await loadDocExpanded(READONLY_PATH)
  await moveTo(neutral.x, neutral.y)
  await sleep(400)
  const c2 = await centerOf('.cm-md-image-wrap:not(.cm-md-image-broken)')
  await moveTo(c2.x, c2.y)
  await waitFor(`!!document.querySelector('.render-float [data-testid="image-edit-float"]')`, 3000)
  const btn2 = await centerOf('[data-testid="image-align-right"]')
  await clickAt(btn2.x, btn2.y)
  await sleep(400)
  const docAfterWritable = await evalExpr(DOC)
  check('S4 解除只读后同一操作可落盘', (docAfterWritable ?? '').includes('{align=right}'), docAfterWritable)

  results.scenarios.s4 = {
    docBefore, docAfterAlign, docAfterDrag, toastAlign, toastDrag, docAfterWritable, writableProbe
  }
}

// ── S5: 两条退出路径均无残留 (UI-IXD-10) ──────────────────────────────────
{
  // Path A: 「✓ 完成」
  await moveTo(neutral.x, neutral.y)
  await sleep(400)
  const c = await centerOf('.cm-md-image-wrap:not(.cm-md-image-broken)')
  await moveTo(c.x, c.y)
  await waitFor(`!!document.querySelector('.render-float [data-testid="image-edit-float"]')`, 3000)
  const beforeA = await evalExpr(BODY_RECTS)
  const done = await centerOf('[data-testid="image-edit-done"]')
  await clickAt(done.x, done.y)
  await sleep(500)
  const residueA = await evalExpr(`({
    floats: document.querySelectorAll('.render-float').length,
    handles: document.querySelectorAll('.cm-md-img-resize').length
  })`)
  const afterA = await evalExpr(BODY_RECTS)
  const shiftA = maxShift(beforeA, afterA)
  check('S5-A「✓ 完成」退出无残留控件', residueA.floats === 0 && residueA.handles === 0, residueA)
  check('S5-A 退出后正文位移 0px', shiftA === 0, { lines: beforeA?.length, shiftA })

  // Path B: click outside
  await moveTo(c.x, c.y)
  await waitFor(`!!document.querySelector('.render-float [data-testid="image-edit-float"]')`, 3000)
  const beforeB = await evalExpr(BODY_RECTS)
  await clickAt(neutral.x, neutral.y)
  await sleep(500)
  const residueB = await evalExpr(`({
    floats: document.querySelectorAll('.render-float').length,
    handles: document.querySelectorAll('.cm-md-img-resize').length
  })`)
  const afterB = await evalExpr(BODY_RECTS)
  const shiftB = maxShift(beforeB, afterB)
  check('S5-B 点外部退出无残留控件', residueB.floats === 0 && residueB.handles === 0, residueB)
  check('S5-B 退出后正文位移 0px', shiftB === 0, { lines: beforeB?.length, shiftB })

  results.scenarios.s5 = { residueA, residueB, shiftA, shiftB, beforeA, afterA, beforeB, afterB }
}

// ── teardown: drop the read-only fixture so the tree stays clean ──────────
try {
  chmodSync(READONLY_PATH, 0o666)
  rmSync(READONLY_PATH, { force: true })
} catch { /* best-effort */ }
// Leave the editor unfolded — the session store persists fold keys per path
// and the next run's Page.reload would restore a collapsed body.
try {
  await evalExpr(`(() => { window.__veloxP18?.restoreKeys([]); return true })()`)
} catch { /* best-effort */ }

results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-03-FE-04-cdp-data.json`, JSON.stringify(results, null, 2))

const failed = (results.checks ?? []).filter((c) => !c.ok)
console.log(`\n==== ${results.checks.length - failed.length}/${results.checks.length} checks passed ====`)
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' | '))
  process.exitCode = 1
}
ws.close()
