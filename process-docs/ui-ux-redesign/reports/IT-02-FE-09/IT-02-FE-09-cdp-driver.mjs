#!/usr/bin/env node
/**
 * IT-02 FE-09 CDP selftest driver — 折叠记忆口径统一
 * （headingFolds 跨重启持久 + 失效清洗 + 不写正文收口）。
 *
 * Measures (per tasks/IT-02/FE-09.md 验收阶段 2/3):
 *   S0 健康检查：e2e 缝可达 + 草稿对话框一律点「稍后」（绝不丢弃草稿）
 *   S1 基线：fixture 载入全展开、.md hash/getDoc 基线、可折叠章节有入口、
 *      空章节（紧邻标题、无正文行）无入口（collectFoldSections 空态）
 *   S2 折叠粒度（AC-FN-15 / UI-IXD-06）：正文三角折叠含全部子章节、标题行
 *      保留、三角指向切换、无 toast、.md 零字节变化
 *   S3 双向同步（AC-FN-30-1）：大纲折叠入口 ⇄ 正文三角互驱
 *   S4 存储 + tab 切换 + 键盘（AC-FN-30-2 / AC-FN-25 / 联调 FE-08）：
 *      headingFolds 快照 Record<filePath, string[]>、level:text 键、无平行键；
 *      tab 切走切回折叠保持；outline ←/→ 键盘折叠写回口径与点击一致
 *   S5 重启持久化（AC-FN-25）：同 user-data-dir 重启 → 折叠自动恢复、.md
 *      逐字节一致（AC-FN-25-2）
 *   S6 跳转自动展开联调（FE-07）：跳进折叠区自动展开、写回口径一致（不写正文）
 *   S7 失效清洗（NAV §3.3）：改名已折叠标题 → 旧 foldKey 清除、其余折叠不变；
 *      大纲点空章节折叠 → 幽灵 key 不入库；删除已折叠标题行 → key 清除
 *   S8 sanitizer 互操作（AC-NF-14）：污染 headingFolds（123/null/空串/ghost/
 *      非数组条目/空路径/坏形状）→ reload 后合法键恢复 UI、非法项剔除、无崩溃；
 *      键位整体缺失按默认值降级
 *   全程 .md 磁盘 sha256 恒等（不写正文收口）；改名/删标题为用户编辑，getDoc
 *   与「原文+编辑」逐字节比对（折叠簿记零附加写入）。
 *
 * Phases (env IT02_FE09_PHASE=1|2|3), each a fresh Electron process:
 *   1 = S0–S4（截图：折叠态 impl + 特写）
 *   2 = S5–S7（截图：重启后保持）
 *   3 = S8 sanitizer + 键位缺失降级（同进程内 location.reload 两轮）
 *
 * Robustness notes (FE-04…FE-08 driver lineage):
 *  - Page.bringToFront + setWebLifecycleState(active) +
 *    Emulation.setFocusEmulationEnabled（防遮挡拖慢定时器）
 *  - 装饰限 viewport：caret 清单取 top/mid/bottom 视口并集（FE-07 教训）
 *  - loadDoc 后 settle 循环（会话恢复可能切走 tab）
 *  - draft dialog → 一律点「稍后」，绝不丢弃草稿（本任务硬约束）
 *  - autoSaveMode=off：改名/删标题绝不落盘，磁盘 hash 全程恒等
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.IT02_FE09_CDP_PORT ?? 9473)
const PHASE = String(process.env.IT02_FE09_PHASE ?? '1')
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-02-FE-09'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/it02-fe09-fold-memory-selftest.md`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const sorted = (arr) => [...(arr ?? [])].sort()

// ── fixture content (must match the on-disk file byte-for-byte) ────────────
const FIXTURE = [
  '# 折叠记忆口径自测',
  '',
  '## Alpha 章节',
  '',
  'alpha 正文第一行',
  'alpha 正文第二行',
  '',
  '### Alpha 子节一',
  '',
  '子节一正文',
  '',
  '### Alpha 子节二',
  '',
  '子节二正文',
  '',
  '## Beta 章节',
  '',
  'beta 正文第一行',
  'beta 正文第二行',
  '',
  '## 空章节',
  '## 尾部章节',
  '',
  '尾部正文第一行',
  '尾部正文第二行',
  ''
].join('\n')

const KEY_H1 = '1:折叠记忆口径自测'
const KEY_ALPHA = '2:Alpha 章节'
const KEY_BETA = '2:Beta 章节'
const KEY_EMPTY = '2:空章节'
const KEY_TAIL = '2:尾部章节'
const KEY_GHOST = '2:ghost 章节'
const KEY_SUB1 = '3:Alpha 子节一'
const KEY_SUB2 = '3:Alpha 子节二'

const SESSION_KEYS = [
  'activePath',
  'headingFolds',
  'lastCursor',
  'lastFilePath',
  'lastFolderPath',
  'mermaidPreviewPin',
  'openTabs',
  'quoteFolds',
  'recentFiles',
  'sidebarMode',
  'sidebarVisible',
  'sidebarWidth',
  'tableColWidths'
]

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
async function pressKey(key, code, keyCode) {
  const base = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode }
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
}
async function pressCombo(key, code, keyCode, modifiers) {
  // modifiers: 1=Alt 2=Ctrl 4=Meta 8=Shift (CDP bitmask)
  const base = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers }
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
}

async function centerOf(selector) {
  return evalExpr(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
}

async function waitFor(expr, timeoutMs = 8000, stepMs = 40) {
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
  await sleep(280)
}

/** Bring `sel` on-screen (viewport-limited decorations may not have built it). */
async function ensureVisible(sel) {
  const state = await evalExpr(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)})
    if (!el) return { present: false }
    const r = el.getBoundingClientRect()
    const onScreen = r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight
    return { present: true, onScreen }
  })()`)
  if (state.present && state.onScreen) return true
  if (state.present) {
    await evalExpr(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center' })`)
    await sleep(280)
    return true
  }
  for (const where of ['top', 'mid', 'bottom']) {
    await scrollEditor(where)
    const ok = await evalExpr(`!!document.querySelector(${JSON.stringify(sel)})`)
    if (ok) {
      await evalExpr(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center' })`)
      await sleep(280)
      return true
    }
  }
  return false
}

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
// Parenthesized: `DOC === x` must compare the string, not parse as a ternary arm.
const DOC = `(window.__veloxP13 ? window.__veloxP13.getDoc() : null)`

const FOLD_CARET = (key) =>
  `[data-testid="heading-fold-caret"][data-fold-key=${JSON.stringify(key)}]`

const ALL_SUMMARIES = `(() => [...document.querySelectorAll('[data-testid="heading-fold-summary"]')].map((el) => el.getAttribute('data-fold-key')))()`
const ALL_CARETS = `(() => [...document.querySelectorAll('[data-testid="heading-fold-caret"]')].map((el) => ({ key: el.getAttribute('data-fold-key'), text: el.textContent, title: el.getAttribute('title') })))()`
const OUTLINE_FOLDED = `(() => [...document.querySelectorAll('[data-testid^="outline-fold-"]')].filter((el) => el.classList.contains('is-folded')).map((el) => ({ text: el.parentElement?.textContent?.trim() ?? null, caret: el.textContent })))()`
const OUTLINE_ROWS = `(() => [...document.querySelectorAll('[data-testid^="outline-item-"]')].map((el) => {
  const i = el.getAttribute('data-testid').replace('outline-item-', '')
  const fold = el.querySelector('[data-testid="outline-fold-' + i + '"]')
  return {
    i: Number(i),
    text: (el.textContent ?? '').trim(),
    foldText: fold?.textContent ?? null,
    foldCls: fold?.className ?? null,
    hasFold: !!fold
  }
}))()`

/**
 * Dismiss a draft-recovery dialog by clicking 「稍后」 — NEVER 丢弃草稿.
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
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (btn) {
    await clickAt(btn.x, btn.y)
    await sleep(400)
    return { dialog: s, clicked: '稍后' }
  }
  return { dialog: s, clicked: null, warning: 'draft dialog present but no 「稍后」 — left untouched' }
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
  results.checks = results.checks ?? []
  results.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail) : ''}`)
  return !!ok
}

async function shot(name, clipExpr) {
  let clip = null
  if (clipExpr) {
    try {
      clip = await evalExpr(clipExpr)
    } catch {
      clip = null
    }
  }
  let shotRes
  try {
    shotRes = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      ...(clip
        ? {
            clip: {
              x: clip.x + (clip.scrollX ?? 0),
              y: clip.y + (clip.scrollY ?? 0),
              width: clip.width,
              height: clip.height,
              scale: 1
            }
          }
        : {})
    })
  } catch (e) {
    console.log('clip screenshot failed, falling back to full page:', String(e).slice(0, 200))
    shotRes = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  }
  const file = `${OUT_DIR}/${name}`
  writeFileSync(file, Buffer.from(shotRes.data, 'base64'))
  console.log('screenshot →', file)
  return file
}

/** Clip to the editor body around the first fold summary/caret. */
const EDITOR_CLIP = `(() => {
  const ed = document.querySelector('.cm-editor')
  const anchor =
    document.querySelector('[data-testid="heading-fold-summary"]') ??
    document.querySelector('[data-testid="heading-fold-caret"]') ??
    ed
  const er = ed?.getBoundingClientRect()
  const ar = anchor?.getBoundingClientRect() ?? er
  if (!er) return null
  const top = Math.max(er.top, (ar?.top ?? er.top) - 140)
  const bottom = Math.min(er.bottom, (ar?.bottom ?? er.bottom) + 240)
  return {
    x: +er.left.toFixed(2),
    y: +top.toFixed(2),
    width: +Math.max(1, er.width).toFixed(2),
    height: +Math.max(1, bottom - top).toFixed(2),
    scrollX: window.scrollX,
    scrollY: window.scrollY
  }
})()`

// ── scenario helpers ───────────────────────────────────────────────────────

/** Click the body fold caret of `key` (fold toggle, never moves the cursor). */
async function clickBodyCaret(key) {
  const sel = FOLD_CARET(key)
  if (!(await ensureVisible(sel))) return false
  const c = await centerOf(sel)
  if (!c) return false
  await moveTo(c.x, c.y)
  await sleep(80)
  await clickAt(c.x, c.y)
  await sleep(220)
  return true
}

/** Click the outline fold span of the row whose text contains `snippet`. */
async function clickOutlineFold(snippet) {
  const c = await evalExpr(`(() => {
    const spans = [...document.querySelectorAll('[data-testid^="outline-fold-"]')]
    const el = spans.find((s) => (s.parentElement?.textContent ?? '').includes(${JSON.stringify(snippet)}))
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      x: +(r.left + r.width / 2).toFixed(2),
      y: +(r.top + r.height / 2).toFixed(2),
      row: el.closest('[data-testid^="outline-item-"]')?.getAttribute('data-testid') ?? null
    }
  })()`)
  if (!c) return null
  await moveTo(c.x, c.y)
  await sleep(80)
  await clickAt(c.x, c.y)
  await sleep(220)
  return c
}

/** DOM-focus an outline row (roving tabindex path) — no body jump. */
async function focusOutlineRow(snippet) {
  const ok = await evalExpr(`(() => {
    const rows = [...document.querySelectorAll('[data-testid^="outline-item-"]')]
    const el = rows.find((r) => (r.textContent ?? '').includes(${JSON.stringify(snippet)}))
    el?.focus()
    return !!el
  })()`)
  await sleep(120)
  return ok
}

const sessionHeadingFolds = () => evalExpr(`(() => {
  const s = window.__veloxPrefs.getSession()
  return { headingFolds: s.headingFolds ?? null, keys: Object.keys(s).sort() }
})()`)
/** Raw localStorage session blob (pre-normalize evidence for restart tests). */
const rawSession = () =>
  evalExpr(`(() => { try { return JSON.parse(localStorage.getItem('veloxmark.session') ?? 'null') } catch { return null } })()`)
const diskHash = () => sha256(readFileSync(FIXTURE_PATH))

/** Place the cursor inside a visible body heading text (click). Scrolls the
 *  line into view first — off-viewport rects make dispatchMouseEvent hit the
 *  wrong UI and leave the editor cursor untouched (S7d pitfall). */
async function clickHeadingText(snippet) {
  const c = await evalExpr(`(() => {
    const walker = document.createTreeWalker(document.querySelector('.cm-content'), NodeFilter.SHOW_TEXT)
    let n
    while ((n = walker.nextNode())) {
      const v = n.nodeValue ?? ''
      const idx = v.indexOf(${JSON.stringify(snippet)})
      if (idx < 0) continue
      if (n.parentElement?.closest('.cm-md-fold-summary')) continue
      n.parentElement?.closest('.cm-line')?.scrollIntoView({ block: 'center' })
      const range = document.createRange()
      range.setStart(n, idx + 1)
      range.setEnd(n, idx + 1)
      const r = range.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      if (r.bottom < 0 || r.top > window.innerHeight) continue
      return { x: +(r.left + 1).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
    }
    return null
  })()`)
  if (!c) return false
  await moveTo(c.x, c.y)
  await sleep(80)
  await clickAt(c.x, c.y)
  await sleep(150)
  return true
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
      await evalExpr(`(() => { window.__veloxP18.restoreKeys([]); return true })()`)
      await sleep(250)
    }
    const state = await evalExpr(`({
      fp: window.__veloxP12.getFilePath(),
      folded: window.__veloxP18.getFoldedKeys(),
      carets: ${ALL_CARETS}.length
    })`)
    const foldedOk = allowFolded || (state.folded ?? []).length === 0
    if (state.fp === FIXTURE_PATH && foldedOk && state.carets >= 1) return state
  }
  const last = await evalExpr(`({
    fp: window.__veloxP12.getFilePath(),
    folded: window.__veloxP18.getFoldedKeys(),
    carets: ${ALL_CARETS}.length
  })`)
  throw new Error(`loadFixtureExpanded did not settle: ${JSON.stringify(last)}`)
}

/** Caret keys currently rendered (viewport union helper). */
async function caretKeysUnion() {
  const keys = new Set()
  const carets = []
  for (const where of ['top', 'mid', 'bottom']) {
    await scrollEditor(where)
    const cs = await evalExpr(ALL_CARETS)
    for (const c of cs ?? []) {
      if (!keys.has(c.key)) {
        keys.add(c.key)
        carets.push(c)
      }
    }
  }
  await scrollEditor('top')
  return { keys: [...keys], carets }
}

// ── setup ──────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(FIXTURE_PATH, FIXTURE, 'utf-8') // driver text is the source of truth
await send('Page.bringToFront')
await send('Page.enable')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })

await waitFor('window.__veloxP12 && window.__veloxP13 && window.__veloxP18 && window.__veloxP26 && window.__veloxPrefs', 20000, 100)
const startupDialog = await dismissDraftDialog()
if (startupDialog) console.log('startup dialog:', JSON.stringify(startupDialog))
await sleep(500)
results.meta.startupDialog = startupDialog
await evalExpr(`(() => {
  window.__veloxPrefs.setPreferences({ autoSaveMode: 'off', crashRecoveryEnabled: true })
  window.__veloxP14?.setLanguage?.('zh')
  return true
})()`)

const hashBefore = diskHash()
results.meta.fixtureHashBefore = hashBefore
results.meta.fixtureMatchesDriverText = readFileSync(FIXTURE_PATH, 'utf-8') === FIXTURE

// ── S0 health ──────────────────────────────────────────────────────────────
{
  const seams = await evalExpr(`({
    p12: typeof window.__veloxP12?.loadDoc === 'function',
    p13: typeof window.__veloxP13?.getDoc === 'function',
    p18: typeof window.__veloxP18?.toggleKey === 'function',
    p18session: typeof window.__veloxP18?.getSessionFolds === 'function',
    p26: typeof window.__veloxP26?.tabs === 'function',
    prefs: typeof window.__veloxPrefs?.getSession === 'function'
  })`)
  check('S0 e2e 缝可达（P12/P13/P18/P26/__veloxPrefs）', Object.values(seams).every(Boolean), seams)
  results.meta.seams = seams
}

// ═══ PHASE 1: S1–S4 ════════════════════════════════════════════════════════
if (PHASE === '1') {
  // ---- S1 baseline --------------------------------------------------------
  await loadFixtureExpanded()
  const doc0 = await evalExpr(DOC)
  check('S1 getDoc 与 fixture 逐字节一致', doc0 === FIXTURE, { equal: doc0 === FIXTURE })
  results.scenarios.s1 = { doc0Equal: doc0 === FIXTURE, hashBefore }

  const inv0 = await caretKeysUnion()
  const caretKeys0 = inv0.keys
  check(
    'S1 可折叠章节均有正文折叠入口（视口并集）',
    [KEY_ALPHA, KEY_BETA, KEY_TAIL, KEY_SUB1, KEY_SUB2].every((k) => caretKeys0.includes(k)),
    caretKeys0
  )
  check('S1 空章节（无正文行）无折叠入口（空态）', !caretKeys0.includes(KEY_EMPTY), {
    emptyPresent: caretKeys0.includes(KEY_EMPTY)
  })
  const rows1 = await evalExpr(OUTLINE_ROWS)
  check('S1 大纲行含空章节（正文侧空态对照）', (rows1 ?? []).some((r) => r.text.includes('空章节')), (rows1 ?? []).map((r) => r.text))
  results.scenarios.s1.carets = caretKeys0

  // ---- S2 body fold granularity (AC-FN-15 / UI-IXD-06) --------------------
  const clickedAlpha = await clickBodyCaret(KEY_ALPHA)
  check('S2 点击正文三角（Alpha 章节）', clickedAlpha)
  const summaries2 = await evalExpr(ALL_SUMMARIES)
  const carets2 = await evalExpr(ALL_CARETS)
  check('S2 折叠为单行摘要（Alpha）', summaries2.includes(KEY_ALPHA), summaries2)
  check(
    'S2 折叠含全部子章节（Alpha 子节一/二入口随父折叠隐藏）',
    !carets2.some((c) => c.key === KEY_SUB1 || c.key === KEY_SUB2),
    carets2.map((c) => c.key)
  )
  const alphaCaret = carets2.find((c) => c.key === KEY_ALPHA)
  check(
    'S2 标题行保留 + 三角指向切换为展开（▸ 展开本节）',
    alphaCaret && alphaCaret.text === '▸' && (alphaCaret.title ?? '').includes('展开'),
    alphaCaret
  )
  const doc2 = await evalExpr(DOC)
  check('S2 折叠后 getDoc 零字节变化（AC-FN-15-4）', doc2 === FIXTURE)
  check('S2 磁盘 .md hash 不变（不写正文）', diskHash() === hashBefore)
  check('S2 折叠无 toast（PEND-15）', (await evalExpr(TOAST)) == null, await evalExpr(TOAST))
  results.scenarios.s2 = { summaries: summaries2, caret: alphaCaret }

  // ---- S3 bidirectional (AC-FN-30-1) --------------------------------------
  const ob = await clickOutlineFold('Beta 章节')
  check('S3 大纲侧点击折叠入口（Beta）', !!ob, ob)
  const summaries3a = await evalExpr(ALL_SUMMARIES)
  check('S3 大纲折叠 → 正文同步折叠', summaries3a.includes(KEY_BETA), summaries3a)
  const outlineFolded3a = await evalExpr(OUTLINE_FOLDED)
  check('S3 大纲三角指向折叠态（▸）', outlineFolded3a.some((o) => (o.text ?? '').includes('Beta 章节') && o.caret === '▸'), outlineFolded3a)
  const bodyClicked = await clickBodyCaret(KEY_BETA)
  check('S3 正文侧点击三角展开（Beta）', bodyClicked)
  const summaries3b = await evalExpr(ALL_SUMMARIES)
  const outlineFolded3b = await evalExpr(OUTLINE_FOLDED)
  check(
    'S3 正文展开 → 大纲同步展开',
    !summaries3b.includes(KEY_BETA) && !outlineFolded3b.some((o) => (o.text ?? '').includes('Beta 章节')),
    { summaries: summaries3b, outline: outlineFolded3b }
  )
  // re-fold Beta via outline for the storage + screenshot state
  await clickOutlineFold('Beta 章节')
  await sleep(150)
  check('S3 双向往返后 .md 零字节变化（AC-FN-30-3）', (await evalExpr(DOC)) === FIXTURE && diskHash() === hashBefore)

  // ---- screenshots (折叠态) ------------------------------------------------
  await shot('IT-02-FE-09-impl-folded.png', EDITOR_CLIP)
  await shot('IT-02-FE-09-impl.png')

  // ---- S4 storage shape + tab switch + keyboard ---------------------------
  const snap4 = await sessionHeadingFolds()
  const entry4 = snap4.headingFolds?.[FIXTURE_PATH]
  check('S4 headingFolds 按 filePath 写入 Record<string, string[]>', Array.isArray(entry4) && entry4.every((x) => typeof x === 'string'), entry4)
  check('S4 折叠键为 level:text 口径', sorted(entry4).join() === sorted([KEY_ALPHA, KEY_BETA]).join(), sorted(entry4))
  check('S4 SessionState 键集无平行键', sorted(snap4.keys).join() === SESSION_KEYS.join(), snap4.keys)
  results.scenarios.s4 = { snapshot: snap4, entry: entry4 }

  // tab switch away → back (AC-FN-25-1 first leg)
  await evalExpr(`(() => { window.__veloxP26.newUntitled(); return true })()`)
  await sleep(600)
  const away = await evalExpr(`({ fp: window.__veloxP12.getFilePath(), summaries: ${ALL_SUMMARIES} })`)
  await evalExpr(`(() => {
    const tabs = window.__veloxP26.tabs()
    const i = tabs.findIndex((t) => (t.path ?? '') === ${JSON.stringify(FIXTURE_PATH)})
    if (i >= 0) window.__veloxP26.activateIndex(i)
    return i
  })()`)
  await sleep(500)
  const back = await evalExpr(`({
    fp: window.__veloxP12.getFilePath(),
    folded: window.__veloxP18.getFoldedKeys(),
    summaries: ${ALL_SUMMARIES},
    docEq: ${DOC} === ${JSON.stringify(FIXTURE)}
  })`)
  check(
    'S4 tab 切走再切回折叠保持（AC-FN-25-1）',
    back.fp === FIXTURE_PATH &&
      sorted(back.folded).join() === sorted([KEY_ALPHA, KEY_BETA]).join() &&
      back.summaries.includes(KEY_ALPHA) &&
      back.summaries.includes(KEY_BETA),
    back
  )
  check('S4 切换后 getDoc 零字节变化', back.docEq === true)
  const snap4b = await sessionHeadingFolds()
  check('S4 切换不清 headingFolds', sorted(snap4b.headingFolds?.[FIXTURE_PATH]).join() === sorted([KEY_ALPHA, KEY_BETA]).join(), snap4b.headingFolds)
  results.scenarios.s4.tabSwitch = { away, back }

  // keyboard fold path (联调 IT-02/FE-08): ← fold / → unfold a parent section
  const focusOk1 = await focusOutlineRow('折叠记忆口径自测')
  check('S4 键盘：大纲行获得 DOM 焦点', focusOk1)
  await pressKey('ArrowLeft', 'ArrowLeft', 37)
  await sleep(300)
  const snapK1 = await sessionHeadingFolds()
  const k1 = snapK1.headingFolds?.[FIXTURE_PATH] ?? []
  check('S4 键盘 ← 折叠写回 headingFolds（口径与点击一致）', k1.includes(KEY_H1), sorted(k1))
  check('S4 键盘折叠不影响既有折叠键', sorted(k1.filter((k) => k !== KEY_H1)).join() === sorted([KEY_ALPHA, KEY_BETA]).join(), sorted(k1))
  const focusOk2 = await focusOutlineRow('折叠记忆口径自测')
  check('S4 键盘：重新聚焦大纲行', focusOk2)
  await pressKey('ArrowRight', 'ArrowRight', 39)
  await sleep(300)
  const snapK2 = await sessionHeadingFolds()
  const k2 = snapK2.headingFolds?.[FIXTURE_PATH] ?? []
  check('S4 键盘 → 展开移除 foldKey', !k2.includes(KEY_H1) && sorted(k2).join() === sorted([KEY_ALPHA, KEY_BETA]).join(), sorted(k2))
  check('S4 键盘往返后 getDoc 零字节变化', (await evalExpr(DOC)) === FIXTURE)
  results.scenarios.s4.keyboard = { afterFold: sorted(k1), afterUnfold: sorted(k2) }

  // Pre-kill evidence: what the browser process has queued for disk (restart test input).
  results.scenarios.s4.rawSessionAtExit = await rawSession()

  const pass = (results.checks ?? []).filter((c) => c.ok).length
  const total = (results.checks ?? []).length
  results.meta.summary = { pass, total }
  writeFileSync(`${OUT_DIR}/IT-02-FE-09-cdp-data-phase1.json`, JSON.stringify(results, null, 2))
  console.log(`\nPHASE 1 DONE: ${pass}/${total} checks passed`)
}

// ═══ PHASE 2: S5–S7 ════════════════════════════════════════════════════════
if (PHASE === '2') {
  // ---- S5 restart persistence (AC-FN-25) ----------------------------------
  // Boot evidence BEFORE any driver-driven state changes: the session blob the
  // restart actually loaded (was phase-1's write flushed and read back?).
  results.meta.bootRawSession = await rawSession()
  results.meta.bootGetSession = await sessionHeadingFolds()
  const fpWait = await waitFor('window.__veloxP12 && window.__veloxP12.getFilePath()', 20000, 150)
  results.meta.bootFilePathWaitedMs = fpWait.waitedMs
  await sleep(800)
  await dismissDraftDialog()
  const s5 = await evalExpr(`({
    fp: window.__veloxP12.getFilePath(),
    folded: window.__veloxP18.getFoldedKeys(),
    summaries: ${ALL_SUMMARIES},
    docEq: ${DOC} === ${JSON.stringify(FIXTURE)}
  })`)
  check('S5 重启后自动恢复上次文件', s5.fp === FIXTURE_PATH, s5.fp)
  check(
    'S5 重启后折叠保持（AC-FN-25-1）',
    sorted(s5.folded).join() === sorted([KEY_ALPHA, KEY_BETA]).join() &&
      s5.summaries.includes(KEY_ALPHA) &&
      s5.summaries.includes(KEY_BETA),
    { folded: sorted(s5.folded), summaries: s5.summaries }
  )
  check('S5 重启后 getDoc 与原文逐字节一致（AC-FN-25-2）', s5.docEq === true)
  check('S5 磁盘 .md hash 恒等（不写正文）', diskHash() === hashBefore, diskHash())
  results.scenarios.s5 = s5
  await shot('IT-02-FE-09-impl-restart.png')

  // ---- S6 联调 FE-07: jump auto-expand write-back -------------------------
  // Click the outline ROW (jump path) of a section inside the folded Alpha.
  await evalExpr(`(() => {
    const rows = [...document.querySelectorAll('[data-testid^="outline-item-"]')]
    const el = rows.find((r) => (r.textContent ?? '').includes('Alpha 子节一'))
    if (!el) return false
    el.click()
    return true
  })()`)
  await sleep(700)
  const s6 = await evalExpr(`({
    folded: window.__veloxP18.getFoldedKeys(),
    summaries: ${ALL_SUMMARIES},
    docEq: ${DOC} === ${JSON.stringify(FIXTURE)}
  })`)
  const snap6 = await sessionHeadingFolds()
  const entry6 = snap6.headingFolds?.[FIXTURE_PATH] ?? []
  check(
    'S6 跳转进入折叠区自动展开（FE-07 联调）',
    !s6.folded.includes(KEY_ALPHA) && !s6.summaries.includes(KEY_ALPHA),
    { folded: s6.folded, summaries: s6.summaries }
  )
  check('S6 自动展开写回移除 foldKey、不写正文', !entry6.includes(KEY_ALPHA) && s6.docEq === true, { entry: sorted(entry6) })
  check('S6 其余折叠不变', sorted(entry6).join() === sorted([KEY_BETA]).join(), sorted(entry6))
  results.scenarios.s6 = { state: s6, entry: sorted(entry6) }

  // ---- S7 失效清洗：改名 / 幽灵键 / 删除 ------------------------------------
  // 7a. fold 尾部章节 via outline so we have a second folded key to protect
  await clickOutlineFold('尾部章节')
  await sleep(250)
  const pre7 = (await sessionHeadingFolds()).headingFolds?.[FIXTURE_PATH] ?? []
  check('S7 改名前折叠键就位', sorted(pre7).join() === sorted([KEY_BETA, KEY_TAIL]).join(), sorted(pre7))

  // 7b. rename the folded heading 「Beta 章节」→「Beta 章节改名」 (user edit)
  const renamePos = await evalExpr(`(() => {
    const doc = window.__veloxP13.getDoc()
    return doc.indexOf('## Beta 章节') + '## Beta 章节'.length
  })()`)
  await evalExpr(`(() => { window.__veloxP26.insertText(${renamePos}, '改名'); return true })()`)
  await sleep(500)
  const doc7b = await evalExpr(DOC)
  const expected7b = FIXTURE.replace('## Beta 章节', '## Beta 章节改名')
  const entry7b = (await sessionHeadingFolds()).headingFolds?.[FIXTURE_PATH] ?? []
  check('S7 改名后旧 foldKey 被清洗', !entry7b.includes(KEY_BETA), sorted(entry7b))
  check('S7 其余折叠不变（尾部章节保留）', sorted(entry7b).join() === sorted([KEY_TAIL]).join(), sorted(entry7b))
  check('S7 改名 getDoc == 原文+用户编辑（折叠簿记零附加写入）', doc7b === expected7b, { equal: doc7b === expected7b })
  check('S7 改名后磁盘 hash 恒等（折叠不写正文）', diskHash() === hashBefore, diskHash())
  results.scenarios.s7b = { entry: sorted(entry7b), docEq: doc7b === expected7b }

  // 7c. ghost key: outline click on the empty section must not persist
  await clickOutlineFold('空章节')
  await sleep(350)
  const entry7c = (await sessionHeadingFolds()).headingFolds?.[FIXTURE_PATH] ?? []
  check('S7 空章节折叠点击不产生幽灵 key（FE-07 移交清理）', !entry7c.includes(KEY_EMPTY), sorted(entry7c))
  check('S7 幽灵键操作后其余折叠不变', sorted(entry7c).join() === sorted([KEY_TAIL]).join(), sorted(entry7c))
  results.scenarios.s7c = { entry: sorted(entry7c) }

  // 7d. delete the folded heading 「尾部章节」line text (user edit)
  // Click to focus, then hard-set the cursor to the heading-line end via P26 —
  // a missed click leaves the caret at lastCursor and Backspace eats line 0.
  const tailClicked = await clickHeadingText('尾部章节')
  check('S7 点击已折叠标题行（尾部章节）', tailClicked)
  const delPos = await evalExpr(`(() => {
    const doc = window.__veloxP13.getDoc()
    const i = doc.indexOf('## 尾部章节')
    return i < 0 ? null : i + '## 尾部章节'.length
  })()`)
  check('S7 删除目标行可定位', delPos != null, delPos)
  await evalExpr(`(() => { window.__veloxP26.setCursor(${delPos}); return true })()`)
  await sleep(150)
  const curBeforeDel = await evalExpr(`window.__veloxP26.getCursor()`)
  check('S7 删除前光标就位于标题行末', curBeforeDel === delPos, { curBeforeDel, delPos })
  await pressKey('End', 'End', 35)
  await sleep(80)
  await pressCombo('Home', 'Home', 36, 8) // shift+Home → select to line start
  await sleep(80)
  await pressKey('Backspace', 'Backspace', 8)
  await sleep(500)
  const doc7d = await evalExpr(DOC)
  const expected7d = expected7b.replace('## 尾部章节', '')
  const entry7d = (await sessionHeadingFolds()).headingFolds?.[FIXTURE_PATH] ?? []
  check('S7 删除已折叠标题后 foldKey 被清洗', !entry7d.includes(KEY_TAIL), sorted(entry7d))
  check(
    'S7 清洗后存储无脏 key 残留',
    entry7d.filter((k) => [KEY_ALPHA, KEY_BETA, KEY_TAIL, KEY_H1, KEY_EMPTY].includes(k)).length === 0,
    sorted(entry7d)
  )
  check('S7 删除 getDoc == 原文+用户编辑', doc7d === expected7d, {
    equal: doc7d === expected7d,
    gotHead: doc7d?.slice(0, 60),
    gotTail: doc7d?.slice(-40)
  })
  check('S7 删除后磁盘 hash 恒等', diskHash() === hashBefore, diskHash())
  results.scenarios.s7d = { entry: sorted(entry7d), docEq: doc7d === expected7d, curBeforeDel, delPos }

  const pass = (results.checks ?? []).filter((c) => c.ok).length
  const total = (results.checks ?? []).length
  results.meta.summary = { pass, total }
  results.meta.fixtureHashFinal = diskHash()
  writeFileSync(`${OUT_DIR}/IT-02-FE-09-cdp-data-phase2.json`, JSON.stringify(results, null, 2))
  console.log(`\nPHASE 2 DONE: ${pass}/${total} checks passed`)
}

// ═══ PHASE 3: S8 sanitizer + missing-key degrade ═══════════════════════════
if (PHASE === '3') {
  await waitFor('window.__veloxP12 && window.__veloxP18 && window.__veloxPrefs', 20000, 150)
  await sleep(800)
  await dismissDraftDialog()
  const alive = await evalExpr(`({
    p12: typeof window.__veloxP12?.loadDoc === 'function',
    p18: typeof window.__veloxP18?.getFoldedKeys === 'function'
  })`)
  check('S8 应用不崩溃、缝照常可用（AC-NF-14）', alive.p12 && alive.p18, alive)

  // S8 prep: write polluted headingFolds and reload in the same tick so the
  // debounced session persist cannot overwrite the pollution first.
  await evalExpr(`(() => {
    const s = JSON.parse(localStorage.getItem('veloxmark.session') ?? '{}')
    s.headingFolds = {
      ${JSON.stringify(FIXTURE_PATH)}: [${JSON.stringify(KEY_ALPHA)}, 123, null, '', ${JSON.stringify(KEY_GHOST)}],
      'other/path.md': 'not-an-array',
      '': ['stale-empty-path'],
      'bad/shape.md': { nested: true }
    }
    localStorage.setItem('veloxmark.session', JSON.stringify(s))
    location.reload()
    return true
  })()`)
  await sleep(2500)
  await waitFor('window.__veloxPrefs && window.__veloxP18 && window.__veloxP12', 20000, 150)
  await dismissDraftDialog()
  await sleep(600)

  const s8 = await evalExpr(`(() => {
    const s = window.__veloxPrefs.getSession()
    return {
      headingFolds: s.headingFolds ?? null,
      entry: s.headingFolds?.[${JSON.stringify(FIXTURE_PATH)}] ?? null,
      paths: Object.keys(s.headingFolds ?? {})
    }
  })()`)
  const entry8 = Array.isArray(s8.entry) ? s8.entry : []
  check('S8 非数组条目/空路径/坏形状剔除', s8.paths.every((p) => p !== '' && p !== 'other/path.md' && p !== 'bad/shape.md'), s8.paths)
  check('S8 元素类型清洗（123/null/空串滤除）', entry8.every((x) => typeof x === 'string' && x !== ''), entry8)
  check('S8 合法键存活', entry8.includes(KEY_ALPHA), entry8)
  results.scenarios.s8 = s8

  // UI restore of the legal key (fold memory re-applies to the restored file)
  const ui8 = await evalExpr(`({
    fp: window.__veloxP12.getFilePath(),
    folded: window.__veloxP18.getFoldedKeys(),
    summaries: ${ALL_SUMMARIES},
    docEq: ${DOC} === ${JSON.stringify(FIXTURE)}
  })`)
  check('S8 合法键恢复折叠 UI', ui8.summaries.includes(KEY_ALPHA) || ui8.folded.includes(KEY_ALPHA), ui8)
  check('S8 陈旧 ghost 键不生效', !ui8.summaries.includes(KEY_GHOST), ui8.summaries)
  check('S8 恢复不改 .md（getDoc 逐字节一致）', ui8.docEq === true)
  check('S8 磁盘 hash 恒等', diskHash() === hashBefore, diskHash())
  results.scenarios.s8ui = ui8

  // one fold toggle forces a write-back → any residual ghost must leave storage
  await clickOutlineFold('Beta 章节')
  await sleep(400)
  const entry8b = (await sessionHeadingFolds()).headingFolds?.[FIXTURE_PATH] ?? []
  check('S8 写回漏斗清洗幽灵 key', !entry8b.includes(KEY_GHOST) && entry8b.every((x) => typeof x === 'string' && x !== ''), sorted(entry8b))
  results.scenarios.s8writeback = sorted(entry8b)

  // missing-key degrade (AC-NF-14 新键缺失按默认值降级) — reload with the key gone
  await evalExpr(`(() => {
    const s = JSON.parse(localStorage.getItem('veloxmark.session') ?? '{}')
    delete s.headingFolds
    localStorage.setItem('veloxmark.session', JSON.stringify(s))
    location.reload()
    return true
  })()`)
  await sleep(2500)
  await waitFor('window.__veloxPrefs && window.__veloxP18', 20000, 150)
  await dismissDraftDialog()
  const s10 = await evalExpr(`(() => {
    const s = window.__veloxPrefs.getSession()
    return { headingFolds: s.headingFolds, p18: typeof window.__veloxP18?.getFoldedKeys === 'function' }
  })()`)
  check('S10 headingFolds 键位缺失按默认值降级（{} 不抛错）', s10.p18 && s10.headingFolds && Object.keys(s10.headingFolds).length === 0, s10)
  results.scenarios.s10 = s10

  const pass = (results.checks ?? []).filter((c) => c.ok).length
  const total = (results.checks ?? []).length
  results.meta.summary = { pass, total }
  writeFileSync(`${OUT_DIR}/IT-02-FE-09-cdp-data-phase3.json`, JSON.stringify(results, null, 2))
  console.log(`\nPHASE 3 DONE: ${pass}/${total} checks passed`)
}

ws.close()
process.exit(0)
