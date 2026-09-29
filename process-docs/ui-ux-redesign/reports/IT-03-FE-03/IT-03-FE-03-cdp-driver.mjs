#!/usr/bin/env node
/**
 * IT-03 FE-03 CDP selftest driver.
 *
 * Raw Chrome DevTools Protocol input with precise dwell timing — the
 * agent-browser CLI round-trip is too slow to produce a faithful <150ms
 * rapid pass-over (AC-NF-04). Measures:
 *   AC-FN-14  show ≥150ms / no anchor occlusion / hide ≥150ms / no residue
 *   AC-NF-04  rapid sweep flicker count = 0
 *   AC-NF-05  boundingClientRect displacement 0px / 0px
 *   AC-FN-21  Esc hush collapses immediately, zero residue
 *
 * Robustness notes (learned the hard way):
 *  - Page.bringToFront first: an occluded Electron window throttles timers
 *    and a 150ms setTimeout measures 350-560ms.
 *  - Anchor centers are re-measured immediately before every move: layout
 *    can shift under a long scenario and stale coords hit the wrong node.
 *  - Rapid sweep messages are sent fire-and-forget so consecutive moves land
 *    within a few ms of each other (awaiting each round-trip inflates dwell
 *    past the 150ms threshold and produces false flicker).
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = 9333
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-03-FE-03'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── CDP plumbing ──────────────────────────────────────────────────────────
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
/** Fire-and-forget: no round-trip wait — used by the rapid sweep. */
function fire(method, params = {}) {
  ws.send(JSON.stringify({ id: ++msgId, method, params }))
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

// ── input helpers ─────────────────────────────────────────────────────────
function moveParams(x, y) {
  return { type: 'mouseMoved', x, y, button: 'none', buttons: 0 }
}
async function moveTo(x, y) {
  await send('Input.dispatchMouseEvent', moveParams(x, y))
}
async function pressEscape() {
  await send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27
  })
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27
  })
}

/** Center of the element matching `selector`, measured right now. */
async function centerOf(selector) {
  return evalExpr(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      x: +(r.left + r.width / 2).toFixed(2),
      y: +(r.top + r.height / 2).toFixed(2),
      left: +r.left.toFixed(2), top: +r.top.toFixed(2),
      right: +r.right.toFixed(2), bottom: +r.bottom.toFixed(2)
    }
  })()`)
}

/** Poll until predicate() is truthy or timeout; returns {value, waitedMs}. */
async function waitFor(expr, timeoutMs = 2000, stepMs = 20) {
  const t0 = Date.now()
  for (;;) {
    const v = await evalExpr(expr)
    if (v) return { value: v, waitedMs: Date.now() - t0 }
    if (Date.now() - t0 > timeoutMs) return { value: null, waitedMs: Date.now() - t0 }
    await sleep(stepMs)
  }
}

// ── in-page instrumentation ───────────────────────────────────────────────
const INSTALL = `(() => {
  if (window.__fe03) window.__fe03.obs.disconnect()
  const events = []
  const marks = []
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const list of [m.addedNodes, m.removedNodes]) {
        for (const node of list) {
          if (node.nodeType !== 1) continue
          const el = node
          const hit = el.classList?.contains('render-float')
            ? el
            : el.querySelector?.('.render-float')
          if (!hit) continue
          const inner = hit.querySelector('[data-testid]')
          events.push({
            t: performance.now(),
            state: list === m.addedNodes ? 'appear' : 'disappear',
            testId: inner?.getAttribute('data-testid') ?? null
          })
        }
      }
    }
  })
  obs.observe(document.body, { childList: true, subtree: true })
  const zoneOf = (target) => {
    if (!(target instanceof Element)) return null
    if (target.closest('.cm-md-image-wrap')) return 'image'
    if (target.closest('.cm-md-link')) return 'link'
    if (target.closest('.cm-md-list')) return 'list'
    return null
  }
  document.addEventListener('mouseover', (e) => {
    const z = zoneOf(e.target)
    if (z) marks.push({ kind: 'over', zone: z, t: performance.now() })
  }, true)
  document.addEventListener('mouseout', (e) => {
    const z = zoneOf(e.target)
    if (z) marks.push({ kind: 'out', zone: z, t: performance.now() })
  }, true)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') marks.push({ kind: 'escape', zone: null, t: performance.now() })
  }, true)
  window.__fe03 = {
    events,
    marks,
    obs,
    reset() { events.length = 0; marks.length = 0 },
    summarize() {
      return events.map((e) => {
        let ref = null
        for (const m of marks) if (m.t <= e.t) ref = m
        return {
          state: e.state,
          testId: e.testId,
          t: +e.t.toFixed(2),
          triggeredBy: ref ? ref.kind + ':' + (ref.zone ?? '-') + '@' + ref.t.toFixed(2) : 'n/a',
          dtMs: ref ? +(e.t - ref.t).toFixed(2) : null
        }
      })
    },
    markDwells() {
      // Real inter-zone dwell times from the raw marks (proof of sweep speed).
      const overs = marks.filter((m) => m.kind === 'over')
      const d = []
      for (let i = 1; i < overs.length; i++) {
        d.push(+(overs[i].t - overs[i - 1].t).toFixed(2))
      }
      return { overs: overs.map((m) => m.zone + '@' + m.t.toFixed(2)), dts: d }
    },
    measure() {
      const pack = (el) => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        return {
          left: +r.left.toFixed(2), top: +r.top.toFixed(2),
          right: +r.right.toFixed(2), bottom: +r.bottom.toFixed(2),
          width: +r.width.toFixed(2), height: +r.height.toFixed(2)
        }
      }
      const para = document.querySelector('.cm-md-link')?.closest('.cm-line')
      const row = document.querySelector('.cm-md-list')
      const trailing = [...document.querySelectorAll('.cm-line')]
        .find((l) => l.textContent.includes('trailing body text'))
      return { para: pack(para), row: pack(row), trailing: pack(trailing) }
    }
  }
  return true
})()`

const FLOAT_STATE = `(() => {
  const f = document.querySelector('.render-float')
  if (!f) return { present: false }
  const fr = f.getBoundingClientRect()
  const inner = f.querySelector('[data-testid]')
  return {
    present: true,
    testId: inner?.getAttribute('data-testid') ?? null,
    visibility: getComputedStyle(f).visibility,
    float: {
      left: +fr.left.toFixed(2), top: +fr.top.toFixed(2),
      right: +fr.right.toFixed(2), bottom: +fr.bottom.toFixed(2)
    }
  }
})()`

function overlaps(a, b) {
  if (!a || !b) return null
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)
}

const results = {
  meta: { port: PORT, startedAt: new Date().toISOString() },
  scenarios: {}
}

// ── setup ─────────────────────────────────────────────────────────────────
// Un-throttle timers and input: an occluded/hidden Electron window stretches
// a 150ms setTimeout to 400-900ms and defers mouseout dispatch by seconds,
// which both falsifies the debounce measurements and leaks a phantom float
// in the rapid sweep. Force the page to the active lifecycle + focus.
await send('Page.bringToFront')
await send('Page.enable')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })

await evalExpr(`(() => {
  const doc = [
    '# FE-03 hover discipline selftest',
    '',
    'A [design spec document](https://example.com/design-spec) inline in a paragraph of body text.',
    '',
    '- list item one with enough text to hover',
    '- list item two with enough text to hover',
    '- list item three with enough text to hover',
    '- list item four with enough text to hover',
    '- [ ] task item alpha unchecked',
    '- [x] task item beta checked',
    '',
    '![cover](logo-master.png)',
    '',
    'trailing body text'
  ].join('\\n')
  window.__veloxP12.loadDoc(
    doc,
    'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/fe03-hover-selftest.md'
  )
  return true
})()`)
await sleep(800)

await evalExpr(INSTALL)
results.meta.visibility = await evalExpr(
  '({ state: document.visibilityState, hidden: document.hidden })'
)
const geom = await evalExpr(`(() => {
  const pack = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      x: +(r.left + r.width / 2).toFixed(1), y: +(r.top + r.height / 2).toFixed(1),
      left: +r.left.toFixed(1), top: +r.top.toFixed(1),
      right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1),
      w: +r.width.toFixed(1), h: +r.height.toFixed(1)
    }
  }
  return {
    vw: window.innerWidth, vh: window.innerHeight,
    img: pack(document.querySelector('.cm-md-image-wrap:not(.cm-md-image-broken)')),
    link: pack(document.querySelector('.cm-md-link')),
    rows: [...document.querySelectorAll('.cm-md-list')].map(pack),
    counts: {
      img: document.querySelectorAll('.cm-md-image-wrap:not(.cm-md-image-broken)').length,
      broken: document.querySelectorAll('.cm-md-image-wrap.cm-md-image-broken').length,
      link: document.querySelectorAll('.cm-md-link').length,
      rows: document.querySelectorAll('.cm-md-list').length
    }
  }
})()`)
results.geom = geom
const neutral = await evalExpr(`(() => {
  for (let y = 40; y < window.innerHeight; y += 16) {
    for (let x = 40; x < window.innerWidth; x += 16) {
      const el = document.elementFromPoint(x, y)
      if (!el) continue
      if (el.closest('.cm-md-image-wrap, .cm-md-link, .cm-md-list, .render-float')) continue
      if (el.closest('.cm-editor')) return { x, y }
    }
  }
  // Deterministic fallback: top-left of the editor content minus padding.
  const ed = document.querySelector('.cm-editor')
  const r = ed ? ed.getBoundingClientRect() : { left: 0, top: 0 }
  return { x: Math.round(r.left + 8), y: Math.round(r.top + 8) }
})()`)
results.neutral = neutral
console.log('geom', JSON.stringify(geom.counts), 'neutral', JSON.stringify(neutral), 'vis', JSON.stringify(results.meta.visibility))
if (!geom.img || !geom.link || geom.rows.length < 4) {
  console.error('FATAL: hover zones missing', JSON.stringify(geom))
  process.exit(2)
}

const neutralDot = () => moveTo(neutral.x, neutral.y)

// ── S1: rapid pass-over ≥3 blocks → flicker count must be 0 (AC-NF-04) ───
{
  await neutralDot()
  await sleep(500)
  await evalExpr('window.__fe03.reset()')

  const selectors = [
    '.cm-md-link',
    '.cm-md-list:nth-of-type(1)',
    '.cm-md-list:nth-of-type(2)',
    '.cm-md-list:nth-of-type(3)',
    '.cm-md-list:nth-of-type(4)'
  ]
  // nth-of-type is unreliable across CM6 line mix — resolve rows by index.
  const points = await evalExpr(`(() => {
    const link = document.querySelector('.cm-md-link')
    const rows = [...document.querySelectorAll('.cm-md-list')].slice(0, 4)
    const pts = [link, ...rows].filter(Boolean).map((el) => {
      const r = el.getBoundingClientRect()
      return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
    })
    return pts
  })()`)

  // Fire all moves back-to-back with only 5ms of host-side pacing — the
  // browser sees a continuous rapid sweep, each zone dwelled well under 150ms.
  for (const p of points) {
    fire('Input.dispatchMouseEvent', moveParams(p.x, p.y))
    await sleep(5)
  }
  // Leave the zones before judging: resting on the last element would be a
  // legitimate hover show, not a pass-over flicker. Awaited so the mouseout
  // that cancels the last pending show is definitely processed (a fire-and-
  // forget leave raced the settle window and leaked one float).
  await moveTo(neutral.x, neutral.y)
  // Any erroneously scheduled show would land within this window.
  await sleep(500)

  const summary = await evalExpr('window.__fe03.summarize()')
  const dwell = await evalExpr('window.__fe03.markDwells()')
  const allMarks = await evalExpr('window.__fe03.marks.map((m) => m.kind + ":" + m.zone + "@" + m.t.toFixed(2))')
  const residue = await evalExpr('document.querySelectorAll(".render-float").length')
  const appears = summary.filter((e) => e.state === 'appear')
  results.scenarios.sweep = {
    ac: 'AC-NF-04',
    zonesCrossed: points.length,
    points,
    markOvers: dwell.overs,
    interZoneDwellMs: dwell.dts,
    allMarks,
    events: summary,
    flickerCount: appears.length,
    residueAfter: residue,
    pass: appears.length === 0 && residue === 0
  }
  console.log('S1 sweep flicker=', appears.length, 'residue=', residue, 'dwells=', JSON.stringify(dwell.dts), 'overs=', JSON.stringify(dwell.overs))
  await neutralDot()
  await sleep(600)
  await evalExpr('window.__fe03.reset()')
}

// ── S2/S3/S4: per-zone hover — AC-FN-14 4 judgments ──────────────────────
async function hoverZone(name, anchorSelector) {
  await neutralDot()
  await sleep(500)
  // Clean slate: no float may linger into the measurement.
  await waitFor('document.querySelectorAll(".render-float").length === 0 ? true : null', 1500)
  await evalExpr('window.__fe03.reset()')
  const before = await evalExpr('window.__fe03.measure()')

  const center = await centerOf(anchorSelector)
  if (!center) throw new Error('anchor not found: ' + anchorSelector)
  await moveTo(center.x, center.y)

  // Wait for the float to mount (poll); the MutationObserver holds the exact time.
  const shown = await waitFor(
    'document.querySelector(".render-float") ? window.__fe03.summarize().filter((e) => e.state === "appear").pop() : null',
    2500
  )
  const floatOn = await evalExpr(FLOAT_STATE)
  const anchorRect = await centerOf(anchorSelector)
  const during = await evalExpr('window.__fe03.measure()')

  await neutralDot()
  const gone = await waitFor(
    'document.querySelectorAll(".render-float").length === 0 ? window.__fe03.summarize().filter((e) => e.state === "disappear").pop() : null',
    2500
  )
  const residue = await evalExpr('document.querySelectorAll(".render-float").length')
  const after = await evalExpr('window.__fe03.measure()')

  const appear = shown.value
  const disappear = gone.value
  const occludes = overlaps(floatOn.float, anchorRect)
  const disp = {
    para: {
      dx: +(during.para.left - before.para.left).toFixed(2),
      dy: +(during.para.top - before.para.top).toFixed(2),
      dxa: +(after.para.left - before.para.left).toFixed(2),
      dya: +(after.para.top - before.para.top).toFixed(2)
    },
    row: {
      dx: +(during.row.left - before.row.left).toFixed(2),
      dy: +(during.row.top - before.row.top).toFixed(2),
      dxa: +(after.row.left - before.row.left).toFixed(2),
      dya: +(after.row.top - before.row.top).toFixed(2)
    },
    trailing: {
      dx: +(during.trailing.left - before.trailing.left).toFixed(2),
      dy: +(during.trailing.top - before.trailing.top).toFixed(2),
      dxa: +(after.trailing.left - before.trailing.left).toFixed(2),
      dya: +(after.trailing.top - before.trailing.top).toFixed(2)
    }
  }
  const row = {
    ac: 'AC-FN-14',
    hoverPoint: center,
    showDelayMs: appear ? appear.dtMs : null,
    showEvent: appear ?? null,
    showWaitedMs: shown.waitedMs,
    hideDelayMs: disappear ? disappear.dtMs : null,
    hideEvent: disappear ?? null,
    hideWaitedMs: gone.waitedMs,
    floatRect: floatOn.float ?? null,
    floatTestId: floatOn.testId ?? null,
    anchorRect,
    occludesAnchor: occludes,
    displacement: disp,
    residueAfter: residue,
    pass: {
      showAtLeast150: appear != null && appear.dtMs >= 150,
      noAnchorOcclusion: occludes === false,
      hideAtLeast150: disappear != null && disappear.dtMs >= 150,
      noResidue: residue === 0
    }
  }
  row.pass.all = Object.values(row.pass).every(Boolean)
  results.scenarios[name] = row
  console.log(
    name,
    'show=', row.showDelayMs,
    'hide=', row.hideDelayMs,
    'occludes=', occludes,
    'residue=', residue,
    'pass=', row.pass.all
  )
  return row
}

await hoverZone('imageFloat', '.cm-md-image-wrap:not(.cm-md-image-broken)')
await hoverZone('linkFloat', '.cm-md-link')
await hoverZone('listHandle', '.cm-md-list')

// ── S4b: list row hover + implementation screenshot ──────────────────────
{
  await neutralDot()
  await sleep(500)
  const center = await centerOf('.cm-md-list')
  await moveTo(center.x, center.y)
  await waitFor('document.querySelector(".render-float") ? true : null', 2500)
  await sleep(350) // chrome-duration animation finished — static frame
  const floatOn = await evalExpr(FLOAT_STATE)
  const clip = await evalExpr(`(() => {
    const row = document.querySelector('.cm-md-list')
    const f = document.querySelector('.render-float')
    const rr = row.getBoundingClientRect()
    const fr = f ? f.getBoundingClientRect() : rr
    const x = Math.max(0, Math.min(rr.left, fr.left) - 24)
    const y = Math.max(0, Math.min(rr.top, fr.top) - 24)
    const right = Math.min(window.innerWidth, Math.max(rr.right, fr.right) + 24)
    const bottom = Math.min(window.innerHeight, Math.max(rr.bottom, fr.bottom) + 24)
    return { x, y, width: right - x, height: bottom - y, scale: 1 }
  })()`)
  const shot = await send('Page.captureScreenshot', { format: 'png', clip })
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(`${OUT_DIR}/IT-03-FE-03-impl.png`, Buffer.from(shot.data, 'base64'))
  results.scenarios.listHandleScreenshot = {
    file: `${OUT_DIR}/IT-03-FE-03-impl.png`,
    clip,
    floatOn
  }
  console.log('screenshot wrote', `${OUT_DIR}/IT-03-FE-03-impl.png`, JSON.stringify(floatOn))
  await neutralDot()
  await waitFor('document.querySelectorAll(".render-float").length === 0 ? true : null', 1500)
  await evalExpr('window.__fe03.reset()')
}

// ── S5: AC-NF-05 displacement cross-check while link float is visible ────
{
  await neutralDot()
  await sleep(500)
  await waitFor('document.querySelectorAll(".render-float").length === 0 ? true : null', 1500)
  await evalExpr('window.__fe03.reset()')
  const m1 = await evalExpr('window.__fe03.measure()')
  const c = await centerOf('.cm-md-link')
  await moveTo(c.x, c.y)
  await waitFor('document.querySelector(".render-float") ? true : null', 2500)
  const m2 = await evalExpr('window.__fe03.measure()')
  await neutralDot()
  await waitFor('document.querySelectorAll(".render-float").length === 0 ? true : null', 1500)
  const m3 = await evalExpr('window.__fe03.measure()')
  const diff = (a, b) => ({
    dx: +(a.left - b.left).toFixed(2),
    dy: +(a.top - b.top).toFixed(2)
  })
  const scenario = {
    ac: 'AC-NF-05',
    before: m1,
    during: m2,
    after: m3,
    duringMinusBefore: { para: diff(m2.para, m1.para), row: diff(m2.row, m1.row), trailing: diff(m2.trailing, m1.trailing) },
    afterMinusBefore: { para: diff(m3.para, m1.para), row: diff(m3.row, m1.row), trailing: diff(m3.trailing, m1.trailing) }
  }
  const all = [scenario.duringMinusBefore, scenario.afterMinusBefore].flatMap((g) => Object.values(g))
  scenario.pass = all.every((d) => d.dx === 0 && d.dy === 0)
  results.scenarios.displacement = scenario
  console.log('S5 displacement pass=', scenario.pass, JSON.stringify(scenario.duringMinusBefore))
}

// ── S6: Esc hush — AC-FN-21 ──────────────────────────────────────────────
{
  await neutralDot()
  await sleep(500)
  await waitFor('document.querySelectorAll(".render-float").length === 0 ? true : null', 1500)
  await evalExpr('window.__fe03.reset()')
  const c = await centerOf('.cm-md-list')
  await moveTo(c.x, c.y)
  await waitFor('document.querySelector(".render-float") ? true : null', 2500)
  const visibleBefore = await evalExpr(FLOAT_STATE)
  await pressEscape()
  const gone = await waitFor(
    'document.querySelectorAll(".render-float").length === 0 ? window.__fe03.summarize().filter((e) => e.state === "disappear").pop() : null',
    1500
  )
  const afterEsc = await evalExpr(FLOAT_STATE)
  const residue = await evalExpr('document.querySelectorAll(".render-float").length')
  const disappear = gone.value
  const scenario = {
    ac: 'AC-FN-21',
    visibleBefore,
    afterEsc,
    disappear,
    hideLatencyMs: disappear ? disappear.dtMs : null,
    waitedMs: gone.waitedMs,
    residueAfter: residue,
    pass: {
      wasVisible: visibleBefore.present === true,
      collapsed: afterEsc.present === false,
      immediate: disappear != null && disappear.dtMs < 50,
      noResidue: residue === 0
    }
  }
  scenario.pass.all = Object.values(scenario.pass).every(Boolean)
  results.scenarios.escHush = scenario
  console.log('S6 esc hideLatency=', scenario.hideLatencyMs, 'pass=', scenario.pass.all)
  await neutralDot()
  await sleep(300)
}

// ── S7: e2e seam immutability spot-check (AC-RULE-17) ────────────────────
{
  results.scenarios.seams = await evalExpr(`(() => {
    const keys = Object.keys(window).filter((k) => k.startsWith('__velox')).sort()
    return {
      count: keys.length,
      keys,
      hasP12: typeof window.__veloxP12?.loadDoc === 'function',
      hasEditor: typeof window.__veloxEditor?.view === 'object'
    }
  })()`)
  console.log('S7 seams', results.scenarios.seams.count, 'hasP12=', results.scenarios.seams.hasP12)
}

results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-03-FE-03-cdp-data.json`, JSON.stringify(results, null, 2))
console.log('WROTE', `${OUT_DIR}/IT-03-FE-03-cdp-data.json`)

const verdict = {
  sweep: results.scenarios.sweep.pass,
  image: results.scenarios.imageFloat.pass.all,
  link: results.scenarios.linkFloat.pass.all,
  list: results.scenarios.listHandle.pass.all,
  displacement: results.scenarios.displacement.pass,
  esc: results.scenarios.escHush.pass.all
}
console.log('VERDICT', JSON.stringify(verdict))

ws.close()
process.exit(0)
