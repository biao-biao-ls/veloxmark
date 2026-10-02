#!/usr/bin/env node
/**
 * IT-03 FE-07 CDP selftest driver — 标题折叠/展开（全部子章节 + 大纲双向同步 + headingFolds）。
 *
 * Measures (per tasks/IT-03/FE-07.md 验收阶段 2-4):
 *   S0 健康检查：e2e 缝可达 + 草稿对话框一律点「稍后」（绝不丢弃草稿）+ fixture 零字节装载
 *   S1 展开态：每个可折叠标题一个 ▾ 入口（title 折叠本节）、空章节无入口、无占位行（UI-IXD-06）
 *   S2 折叠粒度：点标题三角 → 全部子章节内容隐藏、标题行保留、三角 ▸/title 展开本节、
 *      占位行「（N 行内容已折叠 · 与大纲双向同步）」、光标不变、无 toast、.md 字节不变（AC-FN-15 / PEND-15）
 *   S3 展开还原：点占位行 / 点三角 ▸ → 内容全回、getDoc() 零字节差（AC-FN-15）
 *   S4 大纲双向同步（AC-FN-30）：大纲侧折叠入口 ⇄ 正文三角互驱、session headingFolds 写入、
 *      tab 切换后折叠保持（AC-RULE-14）；收尾截「正文折叠 + 大纲同步」同屏图
 *   S5 重启持久化：同 user-data-dir 重启 → 折叠自动恢复 + 大纲镜像（AC-RULE-14）
 *   S6 与 FE-08 长引用折叠共存：headingFolds ⟂ quoteFolds 互不污染（集成验收）
 *   S7 大纲跳转自动展开（NAV §3.5）：目标在折叠区内 → 先展开祖先折叠再落光标
 *   S8 e2e 缝契约未破坏：__veloxP18 形状（AC-RULE-17）
 *
 * Phases (env IT03_FE07_PHASE=1|2), each against a fresh CDP instance:
 *   1 = S0-S4（含展开态/折叠同屏截图）→ 收尾折叠 Alpha + Beta（供 S5）
 *   2 = S5 重启恢复 + S6 共存 + S7 跳转 + S8 缝形状
 *
 * Robustness notes (FE-04/FE-05/FE-08 driver lineage):
 *  - Page.bringToFront first: an occluded Electron window throttles timers.
 *  - Emulation.setFocusEmulationEnabled keeps the page active.
 *  - draft dialog → 一律点「稍后」，绝不丢弃草稿（本任务硬约束）。
 *  - headingFolds persist per-path — scenarios前 restoreKeys([]) 清场（S5 除外）。
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'

const PORT = Number(process.env.IT03_FE07_CDP_PORT ?? 9470)
const PHASE = String(process.env.IT03_FE07_PHASE ?? '1')
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-03-FE-07'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/it03-fe07-heading-fold-selftest.md`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

// ── fixture content (must match the on-disk file byte-for-byte) ────────────
const FIXTURE = [
  '# 标题折叠自测',
  '',
  'Intro 段落一行。',
  '',
  '## Alpha 章节',
  '',
  'Alpha 正文一行',
  '',
  '### Alpha 子节 A',
  '',
  '子节 A 正文一行',
  '',
  '#### Alpha 孙节',
  '',
  '孙节正文一行',
  '',
  '### Alpha 子节 B',
  '',
  '子节 B 正文一行',
  '',
  '## Beta 章节',
  '',
  'Beta 正文一行',
  'Beta 正文二行',
  '',
  '## 引用章节',
  '',
  '> 引用一',
  '> 引用二',
  '> 引用三',
  '> 引用四',
  '> 引用五',
  '> 引用六',
  '',
  '## 空章节',
  '## 仅空行',
  '',
  '## 尾部章节',
  '',
  '尾部正文一行',
  ''
].join('\n')

// foldKey(level, text) identities + outline row indices (document order)
const K_H1 = '1:标题折叠自测'
const K_ALPHA = '2:Alpha 章节'
const K_SUBA = '3:Alpha 子节 A'
const K_SUN = '4:Alpha 孙节'
const K_SUBB = '3:Alpha 子节 B'
const K_BETA = '2:Beta 章节'
const K_QUOTE = '2:引用章节'
const K_EMPTY = '2:空章节'
const K_BLANK = '2:仅空行'
const K_TAIL = '2:尾部章节'
const ALL_KEYS = [K_H1, K_ALPHA, K_SUBA, K_SUN, K_SUBB, K_BETA, K_QUOTE, K_EMPTY, K_BLANK, K_TAIL]
const FOLDABLE_KEYS = ALL_KEYS.filter((k) => k !== K_EMPTY) // empty section: lines=0, no caret
const IDX = {
  [K_H1]: 0,
  [K_ALPHA]: 1,
  [K_SUBA]: 2,
  [K_SUN]: 3,
  [K_SUBB]: 4,
  [K_BETA]: 5,
  [K_QUOTE]: 6,
  [K_EMPTY]: 7,
  [K_BLANK]: 8,
  [K_TAIL]: 9
}
const ALPHA_BODY_SNIPPETS = [
  'Alpha 正文一行',
  'Alpha 子节 A',
  '子节 A 正文一行',
  'Alpha 孙节',
  '孙节正文一行',
  'Alpha 子节 B',
  '子节 B 正文一行'
]
const Q_KEY = 'q:1:引用一'

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

async function waitFor(expr, timeoutMs = 5000, stepMs = 25) {
  const t0 = Date.now()
  for (;;) {
    const v = await evalExpr(expr)
    if (v) return { value: v, waitedMs: Date.now() - t0 }
    if (Date.now() - t0 > timeoutMs) return { value: null, waitedMs: Date.now() - t0 }
    await sleep(stepMs)
  }
}

/**
 * Decorations are viewport-limited (CLAUDE.md) — off-screen headings carry no
 * caret widget at all. Scroll the editor scroller before inventorying or
 * clicking a caret, and let the rebuild settle.
 */
async function scrollEditor(where) {
  await evalExpr(`(() => {
    const s = document.querySelector('.cm-scroller')
    if (!s) return false
    const max = s.scrollHeight - s.clientHeight
    const top =
      ${JSON.stringify(where)} === 'top' ? 0 :
      ${JSON.stringify(where)} === 'bottom' ? max :
      ${JSON.stringify(where)} === 'mid' ? Math.round(max / 2) :
      Number(${JSON.stringify(where)}) || 0
    s.scrollTop = Math.max(0, Math.min(max, top))
    return true
  })()`)
  await sleep(300)
}

/** Caret keys currently rendered (viewport union helper). */
const CARET_KEYS = `[...document.querySelectorAll('[data-testid="heading-fold-caret"]')].map((el) => el.getAttribute('data-fold-key'))`

const DIALOG_STATE = `(() => {
  const d = document.querySelector('.dialog-overlay .dialog')
  if (!d) return { present: false }
  return {
    present: true,
    message: d.querySelector('.dialog-message')?.textContent ?? null,
    buttons: [...d.querySelectorAll('.dialog-buttons .dialog-btn')].map((b) => (b.textContent ?? '').trim())
  }
})()`

const TOAST = `document.querySelector('.sb-toast')?.textContent ?? window.__veloxP26?.getToast?.() ?? null`
const DOC = `window.__veloxP13 ? window.__veloxP13.getDoc() : null`

const HEADING_CARETS = `(() => {
  return [...document.querySelectorAll('[data-testid="heading-fold-caret"]')].map((el) => ({
    key: el.getAttribute('data-fold-key'),
    title: el.getAttribute('title'),
    text: el.textContent ?? '',
    cls: el.className
  }))
})()`

const SUMMARIES = `(() => {
  return [...document.querySelectorAll('[data-testid="heading-fold-summary"]')].map((el) => ({
    key: el.getAttribute('data-fold-key'),
    text: el.textContent ?? '',
    cls: el.className
  }))
})()`

const OUTLINE_ROWS = `(() => {
  return [...document.querySelectorAll('[data-testid^="outline-item-"]')].map((el) => {
    const i = el.getAttribute('data-testid').replace('outline-item-', '')
    const fold = el.querySelector('[data-testid="outline-fold-' + i + '"]')
    return {
      i: Number(i),
      text: (el.textContent ?? '').trim(),
      foldText: fold?.textContent ?? null,
      foldTitle: fold?.getAttribute('title') ?? null,
      foldCls: fold?.className ?? null,
      hasFold: !!fold
    }
  })
})()`

const EDITOR_TEXT = `document.querySelector('.cm-editor')?.innerText ?? ''`

/**
 * Dismiss a draft-recovery dialog by clicking 「稍后」 — NEVER 丢弃草稿
 * (task hard constraint). Other dialogs are left alone and reported.
 */
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
  return { dialog: s, clicked: null, warning: 'draft dialog present but no 「稍后」 button — left untouched' }
}

const results = {
  meta: {
    port: PORT,
    phase: PHASE,
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

async function shot(name) {
  // Full window: sidebar outline + editor must share the frame (同屏截图).
  const shotRes = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  const file = `${OUT_DIR}/${name}`
  writeFileSync(file, Buffer.from(shotRes.data, 'base64'))
  console.log('screenshot →', file)
  return file
}

/** Bring `sel` on-screen (viewport-limited decorations may not have built it). */
async function ensureVisible(sel) {
  const state = await evalExpr(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)})
    if (!el) return { present: false }
    const r = el.getBoundingClientRect()
    const onScreen =
      r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight
    return { present: true, onScreen }
  })()`)
  if (state.present && state.onScreen) return true
  if (state.present) {
    await evalExpr(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center' })`)
    await sleep(300)
    return true
  }
  for (const where of ['top', 'mid', 'bottom']) {
    await scrollEditor(where)
    const ok = await evalExpr(`!!document.querySelector(${JSON.stringify(sel)})`)
    if (ok) {
      await evalExpr(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center' })`)
      await sleep(300)
      return true
    }
  }
  return false
}

/** Click the heading fold caret / summary / outline triangle for `key`. */
async function clickHeadingPart(key, testid) {
  const sel =
    testid === 'outline-fold'
      ? `[data-testid="outline-fold-${IDX[key]}"]`
      : `[data-testid="${testid}"][data-fold-key="${key}"]`
  if (!(await ensureVisible(sel))) return null
  const c = await centerOf(sel)
  if (!c) return null
  await moveTo(c.x, c.y)
  await sleep(80)
  await clickAt(c.x, c.y)
  return { key, sel, ...c }
}

async function clickOutlineItem(key) {
  const sel = `[data-testid="outline-item-${IDX[key]}"]`
  if (!(await ensureVisible(sel))) return null
  const c = await centerOf(sel)
  if (!c) return null
  await moveTo(c.x, c.y)
  await sleep(80)
  await clickAt(c.x, c.y)
  return { key, ...c }
}

/**
 * Load the fixture under its path with every heading fold expanded (S1 baseline).
 * Session restore can re-activate another tab after loadDoc lands — settle loop.
 */
async function loadFixtureExpanded({ allowFolded = false } = {}) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    await dismissDraftDialog()
    await evalExpr(`(() => {
      window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})
      return true
    })()`)
    await sleep(900)
    if (!allowFolded) {
      await evalExpr(`(() => { window.__veloxP18?.restoreKeys([]); return true })()`)
      await sleep(250)
    }
    const state = await evalExpr(`({
      fp: window.__veloxP12.getFilePath(),
      folded: window.__veloxP18 ? window.__veloxP18.getFoldedKeys() : null,
      carets: ${HEADING_CARETS}.length,
      rows: ${SUMMARIES}.length
    })`)
    const foldedOk = allowFolded || (state.folded ?? []).length === 0
    if (state.fp === FIXTURE_PATH && foldedOk && state.carets >= 1) return state
  }
  const last = await evalExpr(`({
    fp: window.__veloxP12.getFilePath(),
    folded: window.__veloxP18 ? window.__veloxP18.getFoldedKeys() : null,
    carets: ${HEADING_CARETS}.length,
    rows: ${SUMMARIES}.length
  })`)
  throw new Error(`loadFixtureExpanded did not settle: ${JSON.stringify(last)}`)
}

// ── setup ──────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true })
await send('Page.bringToFront')
await send('Page.enable')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })

await waitFor('window.__veloxP12 && window.__veloxP13 && window.__veloxP18 && window.__veloxP26', 15000, 100)

const startupDialog = await dismissDraftDialog()
if (startupDialog) {
  console.log('startup dialog:', JSON.stringify(startupDialog))
  results.meta.startupDialog = startupDialog
}
await sleep(600)
const lateDialog = await dismissDraftDialog()
if (lateDialog) {
  console.log('late dialog:', JSON.stringify(lateDialog))
  results.meta.lateDialog = lateDialog
}

// Pin UI language so the summary/caret copy assertions are deterministic.
await evalExpr(`(() => { window.__veloxP14?.setLanguage?.('zh'); return true })()`)
await sleep(200)

// On-disk fixture must exist and match FIXTURE exactly (the .md hash target).
if (!existsSync(FIXTURE_PATH)) writeFileSync(FIXTURE_PATH, FIXTURE, 'utf-8')
const fileBytes = readFileSync(FIXTURE_PATH)
const hashBefore = sha256(fileBytes)
results.meta.fixtureHashBefore = hashBefore
results.meta.fixtureMatchesDriverText = fileBytes.toString('utf-8') === FIXTURE

// ── S0 health ──────────────────────────────────────────────────────────────
{
  const seams = await evalExpr(`({
    p12: typeof window.__veloxP12?.loadDoc === 'function',
    p13: typeof window.__veloxP13?.getDoc === 'function',
    p18: typeof window.__veloxP18?.toggleKey === 'function',
    p18ranges: typeof window.__veloxP18?.getRanges === 'function',
    p18session: typeof window.__veloxP18?.getSessionFolds === 'function',
    p26: typeof window.__veloxP26?.tabs === 'function',
    p26cursor: typeof window.__veloxP26?.getCursor === 'function',
    prefs: typeof window.__veloxPrefs?.getSession === 'function'
  })`)
  check('S0 e2e 缝可达（P12/P13/P18/P26/__veloxPrefs）', Object.values(seams).every(Boolean), seams)
  results.meta.seams = seams

  if (PHASE === '1') {
    await loadFixtureExpanded()
  } else {
    // Phase 2 boots into the restored session — do NOT clear folds here
    // (S5 measures the restart restore; restoreKeys([]) would wipe it first).
    const fp0 = await evalExpr(`window.__veloxP12.getFilePath()`)
    if (fp0 !== FIXTURE_PATH) await loadFixtureExpanded({ allowFolded: true })
  }
  const doc0 = await evalExpr(DOC)
  check('S0 fixture 装载后 getDoc() 与原文零字节差', doc0 === FIXTURE, {
    len: doc0?.length,
    expected: FIXTURE.length,
    equal: doc0 === FIXTURE
  })
}

// ═══ PHASE 1: S1-S4 ════════════════════════════════════════════════════════
if (PHASE === '1') {
  // ── S1 expanded UI (AC-FN-15 empty state / UI-IXD-06 caret direction) ─────
  // Caret inventory is a viewport union (decorations are viewport-limited).
  const invKeys = new Set()
  const invCarets = []
  for (const where of ['top', 'mid', 'bottom']) {
    await scrollEditor(where)
    const cs = await evalExpr(HEADING_CARETS)
    for (const c of cs ?? []) {
      if (!invKeys.has(c.key)) {
        invKeys.add(c.key)
        invCarets.push(c)
      }
    }
  }
  await scrollEditor('top')
  const rows0 = await evalExpr(SUMMARIES)
  const keys0 = [...invKeys].sort()
  const expect0 = [...FOLDABLE_KEYS].sort()
  check('S1 每个可折叠标题一个 ▾ 入口（视口并集）', JSON.stringify(keys0) === JSON.stringify(expect0), keys0)
  check('S1 空章节无折叠入口（空态）', !invKeys.has(K_EMPTY), keys0)
  check(
    'S1 入口属性：▾ + title 折叠本节 + testid（UI-IXD-06）',
    invCarets.every((c) => c.text === '▾' && c.title === '折叠本节' && (c.cls ?? '').includes('cm-md-heading-fold-caret')),
    invCarets.map((c) => c.key)
  )
  check('S1 展开态无折叠占位行', rows0.length === 0, rows0)

  const outline0 = await evalExpr(OUTLINE_ROWS)
  check('S1 大纲 10 行全渲染（含空章节行）', (outline0 ?? []).length === 10, (outline0 ?? []).map((r) => r.i))
  check(
    'S1 大纲三角与正文态镜像（全 ▾）',
    outline0.every((r) => r.foldText === '▾' && !(r.foldCls ?? '').includes('is-folded')),
    outline0
  )

  await shot('IT-03-FE-07-impl-expanded.png')
  results.scenarios.s1 = { carets: invCarets, rows: rows0, outline: outline0 }

  // ── S2 fold granularity: ALL sub-sections hidden, heading row kept ────────
  const cursor0 = await evalExpr(`window.__veloxP26.getCursor()`)
  const clickedAlpha = await clickHeadingPart(K_ALPHA, 'heading-fold-caret')
  check('S2 点击 Alpha 标题三角折叠', !!clickedAlpha, clickedAlpha)
  await sleep(450)

  const folded1 = await evalExpr(`window.__veloxP18.getFoldedKeys()`)
  check('S2 折叠键写入 foldField（含 Alpha）', folded1.includes(K_ALPHA), folded1)

  const carets1 = await evalExpr(HEADING_CARETS)
  const alphaCaret = (carets1 ?? []).find((c) => c.key === K_ALPHA)
  check(
    'S2 三角指向切换 ▸ + title 展开本节（UI-IXD-06）',
    alphaCaret?.text === '▸' && alphaCaret?.title === '展开本节',
    alphaCaret
  )
  const nestedGone = [K_SUBA, K_SUN, K_SUBB].every((k) => !(carets1 ?? []).some((c) => c.key === k))
  check('S2 子章节入口随折叠隐藏（全部子章节）', nestedGone, (carets1 ?? []).map((c) => c.key))

  const edText1 = await evalExpr(EDITOR_TEXT)
  const hidden = ALPHA_BODY_SNIPPETS.filter((s) => edText1.includes(s))
  check('S2 全部子章节内容折叠隐藏（含孙级标题）', hidden.length === 0, hidden)
  check('S2 标题行保留可见', edText1.includes('Alpha 章节'), null)

  const ranges1 = await evalExpr(`window.__veloxP18.getRanges()`)
  const rAlpha = (ranges1 ?? []).find((r) => r.key === K_ALPHA)
  const summaries1 = await evalExpr(SUMMARIES)
  const sumAlpha = (summaries1 ?? []).find((s) => s.key === K_ALPHA)
  check('S2 折叠范围覆盖全部子章节（getRanges 命中）', !!rAlpha && rAlpha.lines > 3, rAlpha)
  check(
    'S2 占位行文案「（N 行内容已折叠 · 与大纲双向同步）」',
    !!sumAlpha && rAlpha && sumAlpha.text === `（${rAlpha.lines} 行内容已折叠 · 与大纲双向同步）`,
    { summary: sumAlpha, lines: rAlpha?.lines }
  )
  check('S2 占位行样式类 cm-md-fold-summary', (sumAlpha?.cls ?? '').includes('cm-md-fold-summary'), sumAlpha)

  const otherCarets = (carets1 ?? []).filter((c) => c.key !== K_ALPHA)
  check(
    'S2 其余章节不受牵连（Beta 仍 ▾）',
    otherCarets.some((c) => c.key === K_BETA && c.text === '▾'),
    otherCarets.map((c) => `${c.key}${c.text}`)
  )
  await scrollEditor('bottom')
  const caretsBottom = await evalExpr(HEADING_CARETS)
  const tailCaret = (caretsBottom ?? []).find((c) => c.key === K_TAIL)
  check('S2 尾部章节不受牵连（▾）', tailCaret?.text === '▾', tailCaret)

  const cursor1 = await evalExpr(`window.__veloxP26.getCursor()`)
  check('S2 点三角不移动光标（PEND 交互契约）', cursor1 === cursor0, { before: cursor0, after: cursor1 })
  const toast2 = await evalExpr(TOAST)
  check('S2 折叠无 toast（PEND-15）', !toast2, toast2)
  const doc2 = await evalExpr(DOC)
  check('S2 折叠后 getDoc() 零字节变化', doc2 === FIXTURE, { equal: doc2 === FIXTURE })
  const hash2 = sha256(readFileSync(FIXTURE_PATH))
  check('S2 折叠后磁盘 .md hash 不变', hash2 === hashBefore, { before: hashBefore, after: hash2 })
  results.scenarios.s2 = {
    folded: folded1,
    caret: alphaCaret,
    range: rAlpha,
    summary: sumAlpha,
    hidden,
    cursor: { before: cursor0, after: cursor1 },
    hash: hash2
  }

  // ── S3 expand restore (AC-FN-15) ─────────────────────────────────────────
  await clickHeadingPart(K_ALPHA, 'heading-fold-summary')
  await sleep(450)
  let edText = await evalExpr(EDITOR_TEXT)
  const backFromSummary = ALPHA_BODY_SNIPPETS.every((s) => edText.includes(s))
  check('S3 点占位行展开（内容全回）', backFromSummary, null)
  const doc3a = await evalExpr(DOC)
  check('S3 展开后 getDoc() 零字节差', doc3a === FIXTURE, { equal: doc3a === FIXTURE })

  await clickHeadingPart(K_ALPHA, 'heading-fold-caret')
  await sleep(400)
  const foldedAgain = await evalExpr(`window.__veloxP18.getFoldedKeys()`)
  check('S3 再次折叠成功', foldedAgain.includes(K_ALPHA), foldedAgain)
  await clickHeadingPart(K_ALPHA, 'heading-fold-caret')
  await sleep(400)
  edText = await evalExpr(EDITOR_TEXT)
  check('S3 点三角 ▸ 展开还原', ALPHA_BODY_SNIPPETS.every((s) => edText.includes(s)), null)
  const toast3 = await evalExpr(TOAST)
  check('S3 展开无 toast（PEND-15）', !toast3, toast3)
  const hash3 = sha256(readFileSync(FIXTURE_PATH))
  check('S3 展开后磁盘 .md hash 不变', hash3 === hashBefore, { before: hashBefore, after: hash3 })

  // ── S4 outline ⇄ body bidirectional sync (AC-FN-30) ───────────────────────
  // (a) outline side drives body: fold Beta from the outline triangle.
  await clickHeadingPart(K_BETA, 'outline-fold')
  await sleep(450)
  let summaries = await evalExpr(SUMMARIES)
  check('S4 大纲侧折叠 → 正文 Beta 折叠', (summaries ?? []).some((s) => s.key === K_BETA), summaries)
  let outline = await evalExpr(OUTLINE_ROWS)
  const betaRow = (outline ?? []).find((r) => r.i === IDX[K_BETA])
  check(
    'S4 大纲入口态镜像（Beta ▸ is-folded）',
    betaRow?.foldText === '▸' && (betaRow?.foldCls ?? '').includes('is-folded'),
    betaRow
  )

  // (b) body side drives outline: fold Tail from the body caret.
  await clickHeadingPart(K_TAIL, 'heading-fold-caret')
  await sleep(450)
  outline = await evalExpr(OUTLINE_ROWS)
  const tailRow = (outline ?? []).find((r) => r.i === IDX[K_TAIL])
  check(
    'S4 正文侧折叠 → 大纲 Tail 镜像（▸ is-folded）',
    tailRow?.foldText === '▸' && (tailRow?.foldCls ?? '').includes('is-folded'),
    tailRow
  )

  // (c) outline side unfolds too.
  await clickHeadingPart(K_BETA, 'outline-fold')
  await sleep(450)
  summaries = await evalExpr(SUMMARIES)
  check('S4 大纲侧展开 → 正文 Beta 还原', !(summaries ?? []).some((s) => s.key === K_BETA), summaries)

  // (d) body fold mirrors into the outline (Alpha).
  await clickHeadingPart(K_ALPHA, 'heading-fold-caret')
  await sleep(450)
  outline = await evalExpr(OUTLINE_ROWS)
  const alphaRow = (outline ?? []).find((r) => r.i === IDX[K_ALPHA])
  check(
    'S4 正文 Alpha 折叠 → 大纲镜像（▸）',
    alphaRow?.foldText === '▸' && (alphaRow?.foldCls ?? '').includes('is-folded'),
    alphaRow
  )
  await clickHeadingPart(K_ALPHA, 'outline-fold')
  await sleep(450)
  const foldedAfterOutlineExpand = await evalExpr(`window.__veloxP18.getFoldedKeys()`)
  check('S4 大纲侧展开 Alpha → 正文还原', !foldedAfterOutlineExpand.includes(K_ALPHA), foldedAfterOutlineExpand)

  // (e) degenerate blank-body section still folds (point widget path).
  await clickHeadingPart(K_BLANK, 'heading-fold-caret')
  await sleep(400)
  summaries = await evalExpr(SUMMARIES)
  const sumBlank = (summaries ?? []).find((s) => s.key === K_BLANK)
  check('S4 仅空行章节折叠出占位行（退化点位）', !!sumBlank, summaries)
  await clickHeadingPart(K_BLANK, 'heading-fold-summary')
  await sleep(400)

  // (f) session write-back: fold Alpha + Beta, snapshot headingFolds.
  await clickHeadingPart(K_ALPHA, 'heading-fold-caret')
  await sleep(400)
  await clickHeadingPart(K_BETA, 'outline-fold')
  await sleep(500)
  const session1 = await evalExpr(`({
    headingFolds: window.__veloxPrefs.getSession().headingFolds ?? null,
    p18: window.__veloxP18.getSessionFolds()
  })`)
  const entry1 = session1.headingFolds?.[FIXTURE_PATH]
  check('S4 headingFolds 按 filePath 写入 session', Array.isArray(entry1), entry1)
  check(
    'S4 session 含 Alpha + Beta 折叠键',
    Array.isArray(entry1) && entry1.includes(K_ALPHA) && entry1.includes(K_BETA),
    entry1
  )

  // Outline triangle click must not move the cursor either.
  const cursorA = await evalExpr(`window.__veloxP26.getCursor()`)
  await clickHeadingPart(K_TAIL, 'outline-fold')
  await sleep(400)
  const cursorB = await evalExpr(`window.__veloxP26.getCursor()`)
  check('S4 大纲三角点击不移动光标', cursorB === cursorA, { before: cursorA, after: cursorB })
  await clickHeadingPart(K_TAIL, 'outline-fold') // unfold Tail again
  await sleep(400)

  // Tab switch away and back — folds survive (AC-RULE-14).
  await evalExpr(`(() => { window.__veloxP26.newUntitled(); return true })()`)
  await sleep(700)
  const away = await evalExpr(`({ fp: window.__veloxP12.getFilePath(), rows: ${SUMMARIES}.length })`)
  results.scenarios.s4Away = away
  const backIdx = await evalExpr(`(() => {
    const tabs = window.__veloxP26.tabs()
    return tabs.findIndex((t) => t.path === ${JSON.stringify(FIXTURE_PATH)})
  })()`)
  check('S4 fixture 标签仍在标签栏', backIdx >= 0, backIdx)
  if (backIdx >= 0) {
    await evalExpr(`(() => { window.__veloxP26.activateIndex(${backIdx}); return true })()`)
    await sleep(700)
    await dismissDraftDialog()
  }
  const back = await evalExpr(`({
    fp: window.__veloxP12.getFilePath(),
    folded: window.__veloxP18.getFoldedKeys(),
    rows: ${SUMMARIES},
    doc: ${DOC}
  })`)
  check(
    'S4 tab 切回后折叠仍在（AC-RULE-14）',
    back.folded.includes(K_ALPHA) && back.folded.includes(K_BETA),
    back.folded
  )
  check('S4 tab 切回后 getDoc() 仍 === 原文', back.doc === FIXTURE, { equal: back.doc === FIXTURE })
  const session2 = await evalExpr(`window.__veloxP18.getSessionFolds()`)
  check(
    'S4 tab 切换未清空 session headingFolds',
    Array.isArray(session2) && session2.includes(K_ALPHA) && session2.includes(K_BETA),
    session2
  )
  const toast4 = await evalExpr(TOAST)
  check('S4 同步全程无 toast（PEND-15）', !toast4, toast4)
  const hash4 = sha256(readFileSync(FIXTURE_PATH))
  check('S4 全程磁盘 .md hash 不变', hash4 === hashBefore, { before: hashBefore, after: hash4 })

  // Same-screen evidence: body folded (Alpha+Beta) + outline mirror both ▸.
  await shot('IT-03-FE-07-impl-folded.png')
  await shot('IT-03-FE-07-impl.png')

  results.scenarios.s4 = {
    session1,
    entry1,
    cursorOutline: { before: cursorA, after: cursorB },
    away,
    back: { folded: back.folded, rows: back.rows },
    session2,
    hash: hash4
  }

  const finalFolded = await evalExpr(`window.__veloxP18.getFoldedKeys()`)
  check('S4 收尾：Alpha + Beta 处折叠态（供 S5 重启恢复）', finalFolded.includes(K_ALPHA) && finalFolded.includes(K_BETA), finalFolded)
}

// ═══ PHASE 2: S5 restart + S6 coexistence + S7 jump + S8 seam shape ════════
if (PHASE === '2') {
  await sleep(800)
  await dismissDraftDialog()
  let fp = await evalExpr(`window.__veloxP12.getFilePath()`)
  if (fp !== FIXTURE_PATH) {
    await loadFixtureExpanded({ allowFolded: true })
    await sleep(400)
  }
  fp = await evalExpr(`window.__veloxP12.getFilePath()`)
  check('S5 重启后 fixture 路径就位', fp === FIXTURE_PATH, fp)

  // Give the filePath restore effect one more beat.
  await sleep(500)
  const folded5 = await evalExpr(`window.__veloxP18.getFoldedKeys()`)
  check(
    'S5 重启后折叠自动恢复（AC-RULE-14）',
    folded5.includes(K_ALPHA) && folded5.includes(K_BETA),
    folded5
  )
  const rows5 = await evalExpr(SUMMARIES)
  check(
    'S5 重启后占位行出现（Alpha + Beta）',
    (rows5 ?? []).some((r) => r.key === K_ALPHA) && (rows5 ?? []).some((r) => r.key === K_BETA),
    (rows5 ?? []).map((r) => r.key)
  )
  const outline5 = await evalExpr(OUTLINE_ROWS)
  const a5 = (outline5 ?? []).find((r) => r.i === IDX[K_ALPHA])
  const b5 = (outline5 ?? []).find((r) => r.i === IDX[K_BETA])
  check(
    'S5 重启后大纲镜像同步（Alpha/Beta ▸）',
    a5?.foldText === '▸' && b5?.foldText === '▸',
    { a5, b5 }
  )
  const doc5 = await evalExpr(DOC)
  check('S5 恢复折叠未改 .md（getDoc() === 原文）', doc5 === FIXTURE, { equal: doc5 === FIXTURE })
  const hash5 = sha256(readFileSync(FIXTURE_PATH))
  check('S5 重启后磁盘 .md hash 不变', hash5 === results.meta.fixtureHashBefore, {
    before: results.meta.fixtureHashBefore,
    after: hash5
  })
  const toast5 = await evalExpr(TOAST)
  check('S5 恢复过程无 toast（PEND-15）', !toast5, toast5)
  const session5 = await evalExpr(`window.__veloxP18.getSessionFolds()`)
  check(
    'S5 session 读回折叠键',
    Array.isArray(session5) && session5.includes(K_ALPHA) && session5.includes(K_BETA),
    session5
  )
  results.scenarios.s5 = { folded: folded5, rows: rows5, session: session5, hash: hash5 }

  // ── S6 heading-fold ⟂ quote-fold coexistence (FE-08 集成) ─────────────────
  // Reset heading folds first so the quote chrome is visible.
  await evalExpr(`window.__veloxP18.restoreKeys([])`)
  await sleep(450)
  const quoteCarets = await evalExpr(`(() => {
    return [...document.querySelectorAll('[data-testid="quote-fold-caret"]')]
      .filter((el) => !el.closest('.cm-md-quote-fold'))
      .map((el) => el.getAttribute('data-quote-fold-key'))
  })()`)
  check('S6 长引用折叠入口存在（FE-08）', quoteCarets.includes(Q_KEY), quoteCarets)

  const qClicked = await evalExpr(`(() => {
    const el = [...document.querySelectorAll('[data-testid="quote-fold-caret"]')]
      .find((n) => !n.closest('.cm-md-quote-fold') && n.getAttribute('data-quote-fold-key') === ${JSON.stringify(Q_KEY)})
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    return true
  })()`)
  await sleep(350)
  const qPoint = qClicked
    ? await evalExpr(`(() => {
        const el = [...document.querySelectorAll('[data-testid="quote-fold-caret"]')]
          .find((n) => !n.closest('.cm-md-quote-fold') && n.getAttribute('data-quote-fold-key') === ${JSON.stringify(Q_KEY)})
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
      })()`)
    : null
  if (qPoint) {
    await moveTo(qPoint.x, qPoint.y)
    await sleep(80)
    await clickAt(qPoint.x, qPoint.y)
  }
  await sleep(450)
  const qRows = await evalExpr(`(() => {
    return [...document.querySelectorAll('.cm-md-quote-fold')].map((r) => r.getAttribute('data-quote-fold-key'))
  })()`)
  check('S6 引用折叠生效（摘要行出现）', qRows.includes(Q_KEY), qRows)

  await clickHeadingPart(K_QUOTE, 'heading-fold-caret')
  await sleep(450)
  const session6 = await evalExpr(`({
    headingFolds: window.__veloxP18.getSessionFolds(),
    quoteFolds: window.__veloxPrefs.getSession().quoteFolds?.[${JSON.stringify(FIXTURE_PATH)}] ?? null,
    folded: window.__veloxP18.getFoldedKeys()
  })`)
  check(
    'S6 标题折叠写 headingFolds（不污染 quoteFolds）',
    session6.headingFolds.includes(K_QUOTE) && !session6.quoteFolds?.includes(K_QUOTE),
    session6
  )
  check(
    'S6 引用折叠写 quoteFolds（不污染 headingFolds）',
    (session6.quoteFolds ?? []).includes(Q_KEY) && !session6.headingFolds.includes(Q_KEY),
    session6
  )

  await clickHeadingPart(K_QUOTE, 'heading-fold-caret') // expand heading again
  await sleep(450)
  const qRowsAfter = await evalExpr(`(() => {
    return [...document.querySelectorAll('.cm-md-quote-fold')].map((r) => r.getAttribute('data-quote-fold-key'))
  })()`)
  check('S6 标题展开后引用折叠独立存活', qRowsAfter.includes(Q_KEY), qRowsAfter)

  // Expand the quote back via its summary row (scroll into view first).
  await evalExpr(`(() => {
    const el = document.querySelector('.cm-md-quote-fold [data-testid="quote-fold-summary"]')
    if (el) el.scrollIntoView({ block: 'center' })
    return true
  })()`)
  await sleep(350)
  const qSum = await evalExpr(`(() => {
    const el = document.querySelector('.cm-md-quote-fold [data-testid="quote-fold-summary"]')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (qSum) {
    await moveTo(qSum.x, qSum.y)
    await sleep(80)
    await clickAt(qSum.x, qSum.y)
  }
  await sleep(450)
  const qRowsFinal = await evalExpr(`(() => {
    return [...document.querySelectorAll('.cm-md-quote-fold')].map((r) => r.getAttribute('data-quote-fold-key'))
  })()`)
  check('S6 引用展开还原（隔离验证收尾）', !qRowsFinal.includes(Q_KEY), qRowsFinal)
  const doc6 = await evalExpr(DOC)
  check('S6 共存验证未改 .md', doc6 === FIXTURE, { equal: doc6 === FIXTURE })
  results.scenarios.s6 = {
    quoteCarets,
    qRows,
    session: session6,
    qRowsAfter,
    qRowsFinal
  }

  // ── S7 outline jump auto-expand (NAV §3.5) ────────────────────────────────
  await evalExpr(`window.__veloxP18.restoreKeys([])`)
  await sleep(400)
  await clickHeadingPart(K_ALPHA, 'heading-fold-caret')
  await sleep(450)
  const foldedBeforeJump = await evalExpr(`window.__veloxP18.getFoldedKeys()`)
  check('S7 前置：Alpha 已折叠', foldedBeforeJump.includes(K_ALPHA), foldedBeforeJump)

  await clickOutlineItem(K_SUBA)
  await sleep(900) // smooth-scroll settle
  const afterJump = await evalExpr(`({
    folded: window.__veloxP18.getFoldedKeys(),
    cursor: window.__veloxP26.getCursor(),
    text: ${EDITOR_TEXT}
  })`)
  check(
    'S7 跳转目标在折叠区 → 自动展开祖先折叠（NAV §3.5）',
    !afterJump.folded.includes(K_ALPHA),
    afterJump.folded
  )
  check('S7 跳转后目标标题可见', afterJump.text.includes('Alpha 子节 A'), null)
  // Cursor lands on the target heading (jump = click semantics).
  const subaLine = await evalExpr(`(() => {
    // heading pos of「### Alpha 子节 A」— compute from the doc text
    const doc = window.__veloxP13.getDoc()
    const idx = doc.indexOf('### Alpha 子节 A')
    return idx
  })()`)
  check('S7 光标落在目标标题（jump 语义）', afterJump.cursor === subaLine, {
    cursor: afterJump.cursor,
    expected: subaLine
  })
  results.scenarios.s7 = {
    foldedBeforeJump,
    afterJump: { folded: afterJump.folded, cursor: afterJump.cursor, expected: subaLine }
  }

  // ── S8 e2e seam shape (AC-RULE-17) ───────────────────────────────────────
  const shape = await evalExpr(`({
    ranges: window.__veloxP18.getRanges(),
    keys: window.__veloxP18.getHeadingKeys(),
    folded: window.__veloxP18.getFoldedKeys(),
    session: window.__veloxP18.getSessionFolds(),
    bench: window.__veloxP18.benchToggle(${JSON.stringify(K_BETA)}, 2)
  })`)
  const rangeShapeOk =
    Array.isArray(shape.ranges) &&
    shape.ranges.every((r) => typeof r.key === 'string' && typeof r.from === 'number' && typeof r.to === 'number' && typeof r.lines === 'number')
  check('S8 __veloxP18.getRanges 形状未破坏（{key,from,to,lines}）', rangeShapeOk, shape.ranges)
  check(
    'S8 getHeadingKeys 返回全部标题 foldKey',
    Array.isArray(shape.keys) && shape.keys.length === 10 && shape.keys.includes(K_EMPTY),
    shape.keys
  )
  check('S8 getSessionFolds/benchToggle 可用', Array.isArray(shape.session) && typeof shape.bench?.ms === 'number', {
    session: shape.session,
    bench: shape.bench
  })
  const toast8 = await evalExpr(TOAST)
  check('S8 收尾无 toast', !toast8, toast8)
  results.scenarios.s8 = shape
}

results.meta.finishedAt = new Date().toISOString()
const passed = (results.checks ?? []).filter((c) => c.ok).length
const total = (results.checks ?? []).length
results.meta.passed = passed
results.meta.total = total
writeFileSync(`${OUT_DIR}/IT-03-FE-07-cdp-data-phase${PHASE}.json`, JSON.stringify(results, null, 2))
console.log(`\nPHASE ${PHASE}: ${passed}/${total} checks passed`)
if (passed !== total) {
  console.log('FAILED CHECKS:')
  for (const c of results.checks ?? []) if (!c.ok) console.log(' -', c.name, JSON.stringify(c.detail))
}
process.exit(passed === total ? 0 : 1)
