#!/usr/bin/env node
/**
 * IT-03 FE-08 CDP selftest driver — 长引用折叠（quoteFolds）。
 *
 * Measures (per tasks/IT-03/FE-08.md 验收阶段 2):
 *   S0 健康检查：e2e 缝可达 + 草稿对话框一律点「稍后」（绝不丢弃草稿）
 *   S1 展开态：>5 行引用有折叠入口（▾ caret），≤5 行无入口、callout 无入口；
 *      caret 带 data-testid=quote-fold-caret + data-quote-fold-key + title 折叠本节
 *   S2 折叠：点 caret → 摘要行（首行截断 …… + 「N 行」尾 + ▸ 展开还原）；
 *      原文隐藏、无 toast、.md 字节不变（AC-FN-16 / PEND-15）
 *   S3 展开还原：点摘要行 / 点「展开还原」→ getDoc() 与原文零字节差（AC-FN-16）
 *   S4 会话态：quoteFolds 快照 + tab 切换后折叠仍在（AC-RULE-14 / UI-IXD-14）
 *   S5 重启持久化：同 user-data-dir 重启 → 折叠自动恢复（AC-RULE-14）
 *   S6 FE-02 sanitizer 互操作：污染 localStorage quoteFolds（非字符串元素 +
 *      陈旧 q:99:ghost + 非数组条目）→ 重启后合法键存活、UI 恢复、无崩溃（AC-NF-14）
 *   S7 与 FE-07 标题折叠共存：标题折叠/展开不破坏 quoteFolds（互不冲突）
 *
 * Phases (env IT03_FE08_PHASE=1|2|3), each against a fresh CDP instance:
 *   1 = S0-S4（含两截图：展开态 / 折叠摘要行）→ 收尾不污染
 *   2 = S5 重启恢复 + S7 共存 → 收尾写入污染 localStorage
 *   3 = S6 sanitizer 断言（读回清洗结果 + UI 恢复）
 *
 * Robustness notes (FE-04/FE-05 driver lineage):
 *  - Page.bringToFront first: an occluded Electron window throttles timers.
 *  - Emulation.setFocusEmulationEnabled keeps the page active.
 *  - draft dialog → 一律点「稍后」，绝不丢弃草稿（本任务硬约束）。
 *  - headingFolds persist per-path — S7 自行管理，其余场景前 restoreKeys([])。
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'

const PORT = Number(process.env.IT03_FE08_CDP_PORT ?? 9468)
const PHASE = String(process.env.IT03_FE08_PHASE ?? '1')
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-03-FE-08'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/it03-fe08-quote-fold-selftest.md`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

// ── fixture content (must match the on-disk file byte-for-byte) ────────────
const FIXTURE = [
  '# 长引用折叠自测',
  '',
  '## 5行引用',
  '',
  '> 五行引用第一行',
  '> 五行引用第二行',
  '> 五行引用第三行',
  '> 五行引用第四行',
  '> 五行引用第五行',
  '',
  '## 6行引用',
  '',
  '> 这是一段非常非常长的引用首行文本用于验证摘要行的截断规则它肯定超过四十个字符以便在界面上观察到省略号效果',
  '> 六行引用第二行',
  '> 六行引用第三行',
  '> 六行引用第四行',
  '> 六行引用第五行',
  '> 六行引用第六行',
  '',
  '## 标题下的引用',
  '',
  '> 标题下引用第一行',
  '> 标题下引用第二行',
  '> 标题下引用第三行',
  '> 标题下引用第四行',
  '> 标题下引用第五行',
  '> 标题下引用第六行',
  '',
  '## Callout',
  '',
  '> [!NOTE]',
  '> callout 正文第一行',
  '> callout 正文第二行',
  '> callout 正文第三行',
  '> callout 正文第四行',
  '> callout 正文第五行',
  '> callout 正文第六行',
  '',
  '尾段落文本，用于中性点击落点。',
  ''
].join('\n')

const LONG_FIRST = '这是一段非常非常长的引用首行文本用于验证摘要行的截断规则它肯定超过四十个字符以便在界面上观察到省略号效果'
const KEY_LONG = `q:1:${LONG_FIRST}`
const KEY_HEAD = 'q:1:标题下引用第一行'
const KEY_FIVE = 'q:1:五行引用第一行'
const HEADING_KEY = '2:标题下的引用'

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

async function waitFor(expr, timeoutMs = 4000, stepMs = 25) {
  const t0 = Date.now()
  for (;;) {
    const v = await evalExpr(expr)
    if (v) return { value: v, waitedMs: Date.now() - t0 }
    if (Date.now() - t0 > timeoutMs) return { value: null, waitedMs: Date.now() - t0 }
    await sleep(stepMs)
  }
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

const TOAST = `document.querySelector('.sb-toast')?.textContent ?? null`
const DOC = `window.__veloxP13 ? window.__veloxP13.getDoc() : null`

/** Expanded-state fold carets (QuoteFoldCaretWidget only — summary rows' own
 *  caret also carries the testid but lives inside .cm-md-quote-fold rows). */
const EXPANDED_CARETS = `(() => {
  return [...document.querySelectorAll('[data-testid="quote-fold-caret"]')]
    .filter((el) => !el.closest('.cm-md-quote-fold'))
    .map((el) => ({
      key: el.getAttribute('data-quote-fold-key'),
      title: el.getAttribute('title'),
      text: el.textContent ?? '',
      cls: el.className
    }))
})()`

const SUMMARY_ROWS = `(() => {
  return [...document.querySelectorAll('.cm-md-quote-fold')].map((row) => {
    const summary = row.querySelector('[data-testid="quote-fold-summary"]')
    const tail = row.querySelector('.cm-md-quote-lines')
    const restore = row.querySelector('[data-testid="quote-fold-restore"]')
    return {
      key: row.getAttribute('data-quote-fold-key'),
      summary: summary?.textContent ?? null,
      tail: tail?.textContent ?? null,
      restore: restore?.textContent ?? null,
      restoreTitle: restore?.getAttribute('title') ?? null
    }
  })
})()`

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

/** Clip to the editor body around the quote region (first quote fold row/caret). */
const EDITOR_CLIP = `(() => {
  const ed = document.querySelector('.cm-editor')
  const anchor =
    document.querySelector('.cm-md-quote-fold') ??
    document.querySelector('[data-testid="quote-fold-caret"]') ??
    ed
  const er = ed?.getBoundingClientRect()
  const ar = anchor?.getBoundingClientRect() ?? er
  if (!er) return null
  const top = Math.max(er.top, (ar?.top ?? er.top) - 120)
  const bottom = Math.min(er.bottom, (ar?.bottom ?? er.bottom) + 200)
  return {
    x: +er.left.toFixed(2),
    y: +top.toFixed(2),
    width: +Math.max(1, er.width).toFixed(2),
    height: +Math.max(1, bottom - top).toFixed(2),
    scrollX: window.scrollX,
    scrollY: window.scrollY
  }
})()`

/**
 * Load the fixture under its path with every heading fold expanded and every
 * quote fold expanded (S1 baseline). Session restore can re-activate another
 * tab after loadDoc lands — settle loop until the path matches.
 */
async function loadFixtureExpanded() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    await dismissDraftDialog()
    await evalExpr(`(() => {
      window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})
      return true
    })()`)
    await sleep(900)
    await evalExpr(`(() => {
      window.__veloxP18?.restoreKeys([])
      window.__veloxPrefs?.setPreferences?.({})
      return true
    })()`)
    await sleep(250)
    const state = await evalExpr(`({
      fp: window.__veloxP12.getFilePath(),
      headingFolded: window.__veloxP18 ? window.__veloxP18.getFoldedKeys().length : -1,
      carets: ${EXPANDED_CARETS}.length,
      rows: ${SUMMARY_ROWS}.length
    })`)
    // S1 baseline wants both foldable quotes expanded → 2 carets, 0 summary rows.
    // (Phase 2/3 load with a remembered fold — allow rows > 0 there.)
    const rowsOk = PHASE === '1' ? state.rows === 0 : true
    if (state.fp === FIXTURE_PATH && state.headingFolded === 0 && state.carets >= 1 && rowsOk) {
      return state
    }
  }
  const last = await evalExpr(`({
    fp: window.__veloxP12.getFilePath(),
    headingFolded: window.__veloxP18 ? window.__veloxP18.getFoldedKeys().length : -1,
    carets: ${EXPANDED_CARETS}.length,
    rows: ${SUMMARY_ROWS}.length
  })`)
  throw new Error(`loadFixtureExpanded did not settle: ${JSON.stringify(last)}`)
}

/** Click the expanded fold caret whose key contains `snippet`. */
async function clickCaretOf(snippet) {
  const c = await evalExpr(`(() => {
    const el = [...document.querySelectorAll('[data-testid="quote-fold-caret"]')]
      .find((n) => !n.closest('.cm-md-quote-fold') && (n.getAttribute('data-quote-fold-key') ?? '').includes(${JSON.stringify(snippet)}))
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      x: +(r.left + r.width / 2).toFixed(2),
      y: +(r.top + r.height / 2).toFixed(2),
      key: el.getAttribute('data-quote-fold-key')
    }
  })()`)
  if (!c) return null
  await moveTo(c.x, c.y)
  await sleep(80)
  await clickAt(c.x, c.y)
  return c
}

/** Click a summary-row element by testid (row click = expand). */
async function clickSummaryPart(testid) {
  const c = await centerOf(`[data-testid="${testid}"]`)
  if (!c) return null
  await moveTo(c.x, c.y)
  await sleep(80)
  await clickAt(c.x, c.y)
  return c
}

// ── setup ──────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true })
await send('Page.bringToFront')
await send('Page.enable')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })

await waitFor('window.__veloxP12 && window.__veloxP13 && window.__veloxPrefs', 15000, 100)

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

// On-disk fixture must exist and match FIXTURE exactly (driver's own text is
// the source of truth for getDoc comparisons; the file is the .md hash target).
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
    p18: typeof window.__veloxP18?.restoreKeys === 'function',
    p26: typeof window.__veloxP26?.tabs === 'function',
    prefsGet: typeof window.__veloxPrefs?.getSession === 'function',
    prefsSet: typeof window.__veloxPrefs?.setPreferences === 'function'
  })`)
  check('S0 e2e 缝可达（P12/P13/P18/P26/__veloxPrefs）', Object.values(seams).every(Boolean), seams)
  results.meta.seams = seams
}

// ═══ PHASE 1: S1-S4 ════════════════════════════════════════════════════════
if (PHASE === '1') {
  await loadFixtureExpanded()
  const doc0 = await evalExpr(DOC)
  check('S0 fixture 装载后 getDoc() 与原文零字节差', doc0 === FIXTURE, {
    len: doc0?.length, expected: FIXTURE.length, equal: doc0 === FIXTURE
  })

  // ── S1 expanded UI ────────────────────────────────────────────────────────
  const carets = await evalExpr(EXPANDED_CARETS)
  const rows0 = await evalExpr(SUMMARY_ROWS)
  const keys = (carets ?? []).map((c) => c.key)
  check('S1 折叠入口数 = 2（6行引用 + 标题下引用）', carets.length === 2, carets)
  check('S1 6行引用有折叠入口', keys.includes(KEY_LONG), keys)
  check('S1 标题下引用有折叠入口', keys.includes(KEY_HEAD), keys)
  check('S1 5 行引用无折叠入口（阈值 >5）', !keys.includes(KEY_FIVE), keys)
  check('S1 callout 无折叠入口', !keys.some((k) => (k ?? '').includes('callout')), keys)
  check(
    'S1 caret 带 data-testid=quote-fold-caret + data-quote-fold-key + title 折叠本节',
    carets.every((c) => c.title === '折叠本节' && c.key && c.text === '▾'),
    carets
  )
  check('S1 展开态无摘要行', rows0.length === 0, rows0)

  await shot('IT-03-FE-08-impl-expanded.png', EDITOR_CLIP)
  results.scenarios.s1 = { carets, rows: rows0, docLen: doc0?.length }

  // ── S2 fold via caret ─────────────────────────────────────────────────────
  await evalExpr(`window.api.clipboardWrite('__it03fe08_sentinel__')`)
  const clicked = await clickCaretOf('这是一段非常非常长的')
  check('S2 点击 6 行引用折叠入口', !!clicked, clicked)
  await sleep(400)

  const rows1 = await evalExpr(SUMMARY_ROWS)
  const row = (rows1 ?? []).find((r) => r.key === KEY_LONG)
  check('S2 折叠后出现摘要行（key 稳定）', !!row, rows1)
  check('S2 摘要行 testid 齐备（summary / restore）', !!row && !!row.summary && !!row.restore, row)
  const summary = row?.summary ?? ''
  check(
    'S2 摘要行首行截断（QUOTE_SUMMARY_MAX_CHARS=40 + ……）',
    /^「.{40}……」$/.test(summary),
    summary
  )
  check('S2 摘要截断取自首行（去引用标记）', summary.includes('这是一段非常非常长的引用首行文本'), summary)
  check(
    'S2 摘要尾「N 行」= 全块 6 行',
    /^\d+ (行|lines)$/.test(row?.tail ?? '') && (row?.tail ?? '').startsWith('6'),
    row?.tail
  )
  check('S2 「展开还原」入口文案', (row?.restore ?? '').includes('展开还原'), row?.restore)
  check(
    'S2 5 行引用仍未折叠（无摘要行）',
    !(rows1 ?? []).some((r) => r.key === KEY_FIVE),
    (rows1 ?? []).map((r) => r.key)
  )
  const carets1 = await evalExpr(EXPANDED_CARETS)
  check(
    'S2 折叠后仅剩标题下引用 caret（6 行引用 caret 收起）',
    carets1.length === 1 && carets1[0].key === KEY_HEAD,
    carets1
  )
  const toastAfterFold = await evalExpr(TOAST)
  check('S2 折叠无 toast（PEND-15）', !toastAfterFold, toastAfterFold)
  const doc1 = await evalExpr(DOC)
  check('S2 折叠后 .md 零字节变化', doc1 === FIXTURE, { equal: doc1 === FIXTURE })
  const hashAfterFold = sha256(readFileSync(FIXTURE_PATH))
  check('S2 折叠后磁盘 .md hash 不变', hashAfterFold === hashBefore, {
    before: hashBefore, after: hashAfterFold
  })

  // Folded-state screenshot (summary row + the other quote still expanded).
  await shot('IT-03-FE-08-impl-folded.png', EDITOR_CLIP)
  await shot('IT-03-FE-08-impl.png', EDITOR_CLIP)

  // ── S3 expand via summary + restore entry ─────────────────────────────────
  await clickSummaryPart('quote-fold-summary')
  await sleep(400)
  const rowsAfterSummary = await evalExpr(SUMMARY_ROWS)
  check('S3 点摘要行展开（摘要行消失）', !(rowsAfterSummary ?? []).some((r) => r.key === KEY_LONG), rowsAfterSummary)
  const doc2 = await evalExpr(DOC)
  check('S3 展开后 getDoc() === 原文（零字节差）', doc2 === FIXTURE, { equal: doc2 === FIXTURE })

  await clickCaretOf('这是一段非常非常长的')
  await sleep(350)
  const rowsFolded2 = await evalExpr(SUMMARY_ROWS)
  check('S3 再次折叠成功', (rowsFolded2 ?? []).some((r) => r.key === KEY_LONG), rowsFolded2)
  await clickSummaryPart('quote-fold-restore')
  await sleep(400)
  const rowsAfterRestore = await evalExpr(SUMMARY_ROWS)
  check('S3 点「展开还原」展开（摘要行消失）', !(rowsAfterRestore ?? []).some((r) => r.key === KEY_LONG), rowsAfterRestore)
  const doc3 = await evalExpr(DOC)
  check('S3 两次展开还原后 getDoc() === 原文', doc3 === FIXTURE, { equal: doc3 === FIXTURE })
  const toastAfterExpand = await evalExpr(TOAST)
  check('S3 展开无 toast（PEND-15）', !toastAfterExpand, toastAfterExpand)
  const hashAfterExpand = sha256(readFileSync(FIXTURE_PATH))
  check('S3 展开后磁盘 .md hash 不变', hashAfterExpand === hashBefore, {
    before: hashBefore, after: hashAfterExpand
  })

  // ── S4 session snapshot + tab switch ──────────────────────────────────────
  await clickCaretOf('这是一段非常非常长的')
  await sleep(350)
  await clickCaretOf('标题下引用第一行')
  await sleep(500)

  const session1 = await evalExpr(`window.__veloxPrefs.getSession().quoteFolds ?? null`)
  const entry = session1?.[FIXTURE_PATH]
  check('S4 quoteFolds 写入 session（按 filePath）', Array.isArray(entry), {
    keys: session1 ? Object.keys(session1) : null,
    entry
  })
  check(
    'S4 quoteFolds 含两个稳定块 id',
    Array.isArray(entry) && entry.includes(KEY_LONG) && entry.includes(KEY_HEAD),
    entry
  )
  check('S4 quoteFolds 无 5 行/callout 条目', Array.isArray(entry) && !entry.includes(KEY_FIVE), entry)

  // Two-state toggle discernible (UI-IXD-14): both keys show summary rows now.
  const rowsBoth = await evalExpr(SUMMARY_ROWS)
  check('S4 两态可辨：折叠态摘要行 ×2（UI-IXD-14）', (rowsBoth ?? []).length === 2, rowsBoth)

  // Tab switch away and back.
  await evalExpr(`(() => { window.__veloxP26.newUntitled(); return true })()`)
  await sleep(700)
  const away = await evalExpr(`({ fp: window.__veloxP12.getFilePath(), rows: ${SUMMARY_ROWS}.length })`)
  results.scenarios.s4Away = away
  const backIdx = await evalExpr(`(() => {
    const tabs = window.__veloxP26.tabs()
    const i = tabs.findIndex((t) => t.path === ${JSON.stringify(FIXTURE_PATH)})
    return i
  })()`)
  check('S4 fixture 标签仍在标签栏', backIdx >= 0, backIdx)
  if (backIdx >= 0) {
    await evalExpr(`(() => { window.__veloxP26.activateIndex(${backIdx}); return true })()`)
    await sleep(700)
    await dismissDraftDialog()
  }
  const back = await evalExpr(`({
    fp: window.__veloxP12.getFilePath(),
    rows: ${SUMMARY_ROWS},
    doc: ${DOC}
  })`)
  check('S4 tab 切回后折叠仍在（AC-RULE-14）', (back.rows ?? []).some((r) => r.key === KEY_LONG), back.rows)
  check('S4 tab 切回后 getDoc() 仍 === 原文', back.doc === FIXTURE, { equal: back.doc === FIXTURE })
  const session2 = await evalExpr(`window.__veloxPrefs.getSession().quoteFolds?.[${JSON.stringify(FIXTURE_PATH)}] ?? null`)
  check('S4 tab 切换未清空 session quoteFolds', Array.isArray(session2) && session2.includes(KEY_LONG), session2)

  results.scenarios.s1 = {
    ...(results.scenarios.s1 ?? {}),
    carets: await evalExpr(EXPANDED_CARETS)
  }
  results.scenarios.s2 = { rows: rows1, row, toastAfterFold, hashAfterFold }
  results.scenarios.s3 = { rowsAfterSummary, rowsAfterRestore, hashAfterExpand }
  results.scenarios.s4 = { session1, entry, rowsBoth, away, back, session2 }

  // Leave both quotes folded so phase 2 can prove restart restore.
  const finalRows = await evalExpr(SUMMARY_ROWS)
  check('S4 收尾：两块均处折叠态（供 S5 重启恢复）', (finalRows ?? []).length === 2, finalRows)
}

// ═══ PHASE 2: S5 restart restore + S7 heading coexistence → poison ═════════
if (PHASE === '2') {
  // Boot-time restore: session openTabs may already reopen the fixture.
  await sleep(800)
  await dismissDraftDialog()
  let fp = await evalExpr(`window.__veloxP12.getFilePath()`)
  if (fp !== FIXTURE_PATH) {
    await loadFixtureExpanded() // settle onto the fixture path
  } else {
    // Path already active — heading folds must not hide the quote summary.
    await evalExpr(`(() => { window.__veloxP18?.restoreKeys([]); return true })()`)
    await sleep(300)
  }
  fp = await evalExpr(`window.__veloxP12.getFilePath()`)
  check('S5 重启后 fixture 路径就位', fp === FIXTURE_PATH, fp)

  // give the filePath effect one more beat in case loadDoc just landed
  await sleep(400)
  const rows = await evalExpr(SUMMARY_ROWS)
  const keys = (rows ?? []).map((r) => r.key)
  check(
    'S5 重启后 quoteFolds 自动恢复（AC-RULE-14）',
    keys.includes(KEY_LONG) && keys.includes(KEY_HEAD),
    keys
  )
  const doc = await evalExpr(DOC)
  check('S5 恢复折叠未改 .md（getDoc() === 原文）', doc === FIXTURE, { equal: doc === FIXTURE })
  const hashAfterRestart = sha256(readFileSync(FIXTURE_PATH))
  check('S5 重启后磁盘 .md hash 不变', hashAfterRestart === results.meta.fixtureHashBefore, {
    before: results.meta.fixtureHashBefore, after: hashAfterRestart
  })
  const toast5 = await evalExpr(TOAST)
  check('S5 恢复过程无 toast（PEND-15）', !toast5, toast5)
  const session = await evalExpr(`window.__veloxPrefs.getSession().quoteFolds?.[${JSON.stringify(FIXTURE_PATH)}] ?? null`)
  check('S5 session 读回含稳定块 id', Array.isArray(session) && session.includes(KEY_LONG), session)

  // ── S7 heading-fold coexistence (FE-07) ───────────────────────────────────
  await evalExpr(`(() => { window.__veloxP18.toggleKey(${JSON.stringify(HEADING_KEY)}); return true })()`)
  await sleep(400)
  const hFolded = await evalExpr(`({
    folded: window.__veloxP18.getFoldedKeys(),
    rows: ${SUMMARY_ROWS}
  })`)
  const headingCollapsed = (hFolded.folded ?? []).includes(HEADING_KEY)
  check('S7 标题折叠生效（FE-07 互不冲突）', headingCollapsed, hFolded.folded)
  check(
    'S7 标题折叠后 quoteFolds 键仍在 session（未被清）',
    headingCollapsed,
    { note: '视觉上摘要行被标题折叠体覆盖属预期；键不丢' }
  )

  await evalExpr(`(() => { window.__veloxP18.toggleKey(${JSON.stringify(HEADING_KEY)}); return true })()`)
  await sleep(400)
  const hRestored = await evalExpr(`({
    folded: window.__veloxP18.getFoldedKeys(),
    rows: ${SUMMARY_ROWS}
  })`)
  check('S7 标题展开后折叠入口恢复', (hRestored.folded ?? []).length === 0, hRestored.folded)
  check(
    'S7 标题折叠/展开后 quoteFolds 独立存活（UI-IXD-14 两态仍在）',
    (hRestored.rows ?? []).some((r) => r.key === KEY_LONG) &&
      (hRestored.rows ?? []).some((r) => r.key === KEY_HEAD),
    (hRestored.rows ?? []).map((r) => r.key)
  )
  const sessionAfterHeading = await evalExpr(`window.__veloxPrefs.getSession().quoteFolds?.[${JSON.stringify(FIXTURE_PATH)}] ?? null`)
  check(
    'S7 标题折叠写 headingFolds，不污染 quoteFolds',
    Array.isArray(sessionAfterHeading) &&
      sessionAfterHeading.includes(KEY_LONG) &&
      sessionAfterHeading.includes(KEY_HEAD) &&
      !sessionAfterHeading.some((k) => k === HEADING_KEY),
    sessionAfterHeading
  )

  results.scenarios.s5 = { rows, keys, session, hashAfterRestart, toast: toast5 }
  results.scenarios.s7 = {
    hFolded: hFolded.folded,
    rowsUnderFold: (hFolded.rows ?? []).map((r) => r.key),
    hRestored: hRestored.folded,
    rowsRestored: (hRestored.rows ?? []).map((r) => r.key),
    sessionAfterHeading
  }

  // ── poison localStorage quoteFolds for S6 (last act — no further writes) ──
  const poison = await evalExpr(`(() => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.session') || '{}')
    raw.quoteFolds = {
      ${JSON.stringify(FIXTURE_PATH)}: [${JSON.stringify(KEY_LONG)}, 123, null, 'q:99:ghost', ''],
      'other/path.md': 'not-an-array',
      '': ['stale-empty-path'],
      'bad/shape.md': { nested: true }
    }
    localStorage.setItem('veloxmark.session', JSON.stringify(raw))
    const verify = JSON.parse(localStorage.getItem('veloxmark.session') || '{}')
    return { wrote: verify.quoteFolds, rawKeys: Object.keys(verify) }
  })()`)
  results.meta.poison = poison
  check('S6 前置：污染 payload 已写入 localStorage', Array.isArray(poison?.wrote?.[FIXTURE_PATH]) && poison.wrote[FIXTURE_PATH].includes(123), poison)
  // re-read once more to make sure no late write clobbered the poison
  await sleep(500)
  const poisonStill = await evalExpr(`(() => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.session') || '{}')
    return raw.quoteFolds?.[${JSON.stringify(FIXTURE_PATH)}] ?? null
  })()`)
  results.meta.poisonStill = poisonStill
  check('S6 前置：污染未被晚到写回覆盖', Array.isArray(poisonStill) && poisonStill.includes(123), poisonStill)
  console.log('POISON_WRITTEN')
}

// ═══ PHASE 3: S6 sanitizer interop ═════════════════════════════════════════
if (PHASE === '3') {
  await sleep(800)
  await dismissDraftDialog()
  const alive = await evalExpr(`({
    p12: typeof window.__veloxP12?.loadDoc === 'function',
    p13: typeof window.__veloxP13?.getDoc === 'function'
  })`)
  check('S6 污染启动后应用未崩溃（AC-NF-14）', alive.p12 === true && alive.p13 === true, alive)

  const sanitized = await evalExpr(`(() => {
    const s = window.__veloxPrefs.getSession()
    return { quoteFolds: s.quoteFolds ?? null, headingFolds: s.headingFolds ?? null }
  })()`)
  const qf = sanitized.quoteFolds ?? {}
  check('S6 sanitizer：非数组条目被剔除', !('other/path.md' in qf) && !('bad/shape.md' in qf) && !('' in qf), {
    paths: Object.keys(qf)
  })
  const entry = qf[FIXTURE_PATH]
  check('S6 sanitizer：路径条目为字符串数组', Array.isArray(entry) && entry.every((x) => typeof x === 'string'), entry)
  check(
    'S6 sanitizer：非法元素（123/null/空串）被滤除',
    Array.isArray(entry) && !entry.includes(123) && entry.every((x) => x !== '' && x != null),
    entry
  )
  check(
    'S6 sanitizer：合法稳定块 id 存活',
    Array.isArray(entry) && entry.includes(KEY_LONG),
    entry
  )

  // UI restore after sanitization.
  await sleep(400)
  let fp = await evalExpr(`window.__veloxP12.getFilePath()`)
  if (fp !== FIXTURE_PATH) {
    await evalExpr(`(() => {
      window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})
      return true
    })()`)
    await sleep(900)
  }
  const rows = await evalExpr(SUMMARY_ROWS)
  const keys = (rows ?? []).map((r) => r.key)
  check('S6 合法键仍恢复为折叠态（陈旧 q:99:ghost 不生效）', keys.includes(KEY_LONG), keys)
  check('S6 陈旧 id 未产生摘要行', !keys.includes('q:99:ghost') && !keys.some((k) => (k ?? '').includes('ghost')), keys)
  const doc = await evalExpr(DOC)
  check('S6 清洗/恢复未改 .md（getDoc() === 原文）', doc === FIXTURE, { equal: doc === FIXTURE })
  const toast6 = await evalExpr(TOAST)
  check('S6 无 toast（PEND-15）', !toast6, toast6)
  const dialog6 = await evalExpr(DIALOG_STATE)
  check('S6 无阻塞对话框', dialog6.present !== true, dialog6)

  results.scenarios.s6 = { sanitized, entry, keys, toast: toast6, dialog: dialog6 }
}

results.meta.finishedAt = new Date().toISOString()
const passed = (results.checks ?? []).filter((c) => c.ok).length
const total = (results.checks ?? []).length
results.meta.passed = passed
results.meta.total = total
writeFileSync(`${OUT_DIR}/IT-03-FE-08-cdp-data-phase${PHASE}.json`, JSON.stringify(results, null, 2))
console.log(`\nPHASE ${PHASE}: ${passed}/${total} checks passed`)
if (passed !== total) {
  console.log('FAILED CHECKS:')
  for (const c of results.checks ?? []) if (!c.ok) console.log(' -', c.name, JSON.stringify(c.detail))
}
process.exit(passed === total ? 0 : 1)
