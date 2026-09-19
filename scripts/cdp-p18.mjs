// CDP e2e test for P18 (Heading fold). Port 9235.
//   npm run build && node scripts/cdp-p18.mjs
//
// Acceptance coverage (docs/requirements/P18-heading-fold.md)
//   ① gutter click folds H2 → ⋯ 13 行 placeholder; unfold restores in place
//   ② fold H2 hides H3/H4; unfold H2 keeps the previously folded H3 folded
//   ③ search jump / selection into a folded section auto-expands it
//   ④ outline triangle syncs (cursor unmoved); title jump unfolds target;
//      session headingFolds restore after clear + after file round-trip
//   ⑤ source mode: body visible, fold keys retained; live restores the fold
//   ⑥ 5k-line doc: fold toggle avg stays well under a perceptible delay
import { existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9235
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))
const TMP = join(ROOT, 'scripts', 'tmp-p18')
mkdirSync(TMP, { recursive: true })

// Same fixture as fold.test.ts — Beta fold hides lines 6..18 → 13 lines.
const DOC = [
  '# H1 Alpha',
  '',
  'intro alpha',
  '',
  '## H2 Beta',
  '',
  'beta body 1',
  'beta body 2',
  'beta body 3',
  '',
  '### H3 Gamma',
  '',
  'gamma body',
  '',
  '### H3 Delta',
  '',
  'delta body',
  '',
  '## H2 Epsilon',
  '',
  'epsilon body',
  '',
  '# H1 Zeta',
  '',
  'zeta body',
  ''
].join('\n')
const OTHER_DOC = ['# Other doc', '', '## Only section', '', 'only body', ''].join('\n')
const FOLD_PATH = join(TMP, 'fold.md')
const OTHER_PATH = join(TMP, 'other.md')
const BENCH_PATH = join(TMP, 'bench.md')

const KEY_BETA = '2:H2 Beta'
const KEY_GAMMA = '3:H3 Gamma'
const ALL_HEADING_KEYS = [
  '1:H1 Alpha',
  '2:H2 Beta',
  '3:H3 Gamma',
  '3:H3 Delta',
  '2:H2 Epsilon',
  '1:H1 Zeta'
]

let app = null
let ws = null
const failures = []

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) failures.push(name)
}

function launch() {
  console.log('launching electron on port', CDP_PORT)
  const logPath = join(TMP, 'app-main.log')
  appendFileSync(logPath, `\n=== launch ${new Date().toISOString()} ===\n`)
  const child = spawn(ELECTRON_BIN, ['.', `--remote-debugging-port=${CDP_PORT}`], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false
  })
  child.stdout.on('data', (d) => appendFileSync(logPath, d))
  child.stderr.on('data', (d) => appendFileSync(logPath, d))
  return child
}

async function getTarget(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${CDP}/json`)
      const list = await res.json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('no CDP page target')
}

async function main() {
  if (!ELECTRON_BIN) throw new Error('electron binary not found')

  let id = 0
  const session = { send: null, evaluate: null }

  async function connect() {
    const target = await getTarget()
    ws = new WebSocket(target.webSocketDebuggerUrl)
    const pending = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id)
        pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      }
    })
    ws.addEventListener('close', () => {
      for (const { reject } of pending.values()) reject(new Error('CDP websocket closed'))
      pending.clear()
    })
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('CDP websocket open timeout')), 12000)
      ws.addEventListener('open', () => {
        clearTimeout(t)
        resolve()
      })
      ws.addEventListener('error', (e) => {
        clearTimeout(t)
        reject(e)
      })
    })
    id = 0
    session.send = (method, params = {}) => {
      const msgId = ++id
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          pending.delete(msgId)
          reject(new Error(`CDP timeout: ${method}`))
        }, 20000)
        pending.set(msgId, {
          resolve: (v) => {
            clearTimeout(t)
            resolve(v)
          },
          reject: (e) => {
            clearTimeout(t)
            reject(e)
          }
        })
        try {
          ws.send(JSON.stringify({ id: msgId, method, params }))
        } catch (e) {
          pending.delete(msgId)
          reject(e)
        }
      })
    }
    session.evaluate = async (expr) => {
      const r = await session.send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      })
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
      return r.result.value
    }
    await session.send('Page.enable')
    await session.send('Runtime.enable')
  }

  const evaluate = (expr) => session.evaluate(expr)
  const waitFor = async (expr, ms = 15000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      try {
        if (await evaluate(expr)) return true
      } catch {}
      await new Promise((r) => setTimeout(r, 150))
    }
    return false
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  const getKeys = () => evaluate(`window.__veloxP18.getFoldedKeys()`)
  const keysInclude = (key) => evaluate(`window.__veloxP18.getFoldedKeys().includes(${JSON.stringify(key)})`)
  const contentHas = (text) =>
    evaluate(`(document.querySelector('.cm-content')?.textContent || '').includes(${JSON.stringify(text)})`)
  const contentLacks = (text) =>
    evaluate(`!(document.querySelector('.cm-content')?.textContent || '').includes(${JSON.stringify(text)})`)
  const placeholderFor = (key) =>
    evaluate(`(() => {
      const el = [...document.querySelectorAll('.cm-md-fold-placeholder')]
        .find((e) => e.dataset.foldKey === ${JSON.stringify(key)})
      return el ? el.textContent : null
    })()`)
  const selHead = () => evaluate(`window.__veloxEditor.view.state.selection.main.head`)

  /** mousedown on the fold-gutter arrow marker for `key` (bubbles → gutter handler). */
  const clickGutterArrow = (key) =>
    evaluate(`(() => {
      const el = [...document.querySelectorAll('.cm-md-fold-arrow')]
        .find((e) => e.dataset.foldKey === ${JSON.stringify(key)})
      if (!el) return 'no-arrow:' + [...document.querySelectorAll('.cm-md-fold-arrow')]
        .map((e) => e.dataset.foldKey).join('|')
      const r = el.getBoundingClientRect()
      el.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true, cancelable: true,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2
      }))
      return true
    })()`)

  const clickPlaceholder = (key) =>
    evaluate(`(() => {
      const el = [...document.querySelectorAll('.cm-md-fold-placeholder')]
        .find((e) => e.dataset.foldKey === ${JSON.stringify(key)})
      if (!el) return 'no-placeholder'
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      return true
    })()`)

  /** Click the outline triangle (or, with part='title', the item button) for a heading. */
  const clickOutline = (textPart, mode = 'fold') =>
    evaluate(`(() => {
      const items = [...document.querySelectorAll('.outline-item')]
      const btn = items.find((b) => (b.title || b.textContent || '').includes(${JSON.stringify(textPart)}))
      if (!btn) return 'no-item:' + items.map((b) => b.title).join('|')
      const el = ${mode === 'fold'} ? btn.querySelector('.outline-fold') : btn
      if (!el) return 'no-el'
      el.click()
      return true
    })()`)

  // ---- boot: English pin + sidebar/outline + clean folds + reload ------------
  app = launch()
  await connect()
  await waitFor(`typeof window.__veloxPrefs === 'object' && typeof window.__veloxEditor === 'object'`, 30000)
  await evaluate(`(async () => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') || '{}')
    localStorage.setItem('veloxmark.preferences', JSON.stringify({
      ...raw,
      language: 'en',
      crashRecoveryEnabled: false,
      autoSaveMode: 'off',
      restoreLastSession: false,
      showStatusBar: true,
      theme: 'light',
      focusMode: false,
      typewriterMode: false,
      sourceMode: false,
      externalLinkConfirm: true
    }))
    const sess = JSON.parse(localStorage.getItem('veloxmark.session') || '{}')
    localStorage.setItem('veloxmark.session', JSON.stringify({
      ...sess,
      sidebarVisible: true,
      sidebarMode: 'outline',
      headingFolds: {}
    }))
    try {
      const drafts = await window.api.draftList()
      for (const d of drafts ?? []) await window.api.draftDiscard(d.path)
    } catch {}
    return true
  })()`)
  await evaluate(`location.reload()`)
  await wait(1500)
  const hookReady = await waitFor(`typeof window.__veloxP18 === 'object' && window.__veloxP18 !== null`, 30000)
  await waitFor(`document.querySelector('.status-bar') !== null`)
  check('__veloxP18 hook ready', hookReady, String(await evaluate(`typeof window.__veloxP18`)))

  // ---- load fixture doc --------------------------------------------------------
  await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify(DOC)}, ${JSON.stringify(FOLD_PATH)})`)
  const pathOk = await waitFor(`window.__veloxP13.getFilePath() === ${JSON.stringify(FOLD_PATH)}`, 8000)
  check('loadDoc sets fold.md', pathOk, String(await evaluate(`window.__veloxP13.getFilePath()`)))
  const headsOk = await waitFor(`window.__veloxP18.getHeadingKeys().length === 6`, 8000)
  check('six heading keys extracted', headsOk, String(await evaluate(`window.__veloxP18.getHeadingKeys()`)))

  await wait(300)
  const arrowKeys = await evaluate(`[...document.querySelectorAll('.cm-md-fold-arrow')].map((e) => e.dataset.foldKey).sort()`)
  check(
    'gutter arrows on every heading line',
    JSON.stringify(arrowKeys) === JSON.stringify([...ALL_HEADING_KEYS].sort()),
    JSON.stringify(arrowKeys)
  )
  const arrowsOpen = await evaluate(
    `[...document.querySelectorAll('.cm-md-fold-arrow')].every((e) => !e.classList.contains('is-folded') && e.textContent === '▸')`
  )
  check('arrows start unfolded (▸)', arrowsOpen === true)

  // ---- ① gutter fold / unfold --------------------------------------------------
  await evaluate(`window.__veloxEditor.view.dispatch({ selection: { anchor: 0 } })`)
  const selBefore = await selHead()
  const clickRes = await clickGutterArrow(KEY_BETA)
  check('gutter arrow click dispatched', clickRes === true, String(clickRes))
  const foldedAfterClick = await waitFor(`window.__veloxP18.getFoldedKeys().includes(${JSON.stringify(KEY_BETA)})`, 8000)
  check('gutter click folds H2 Beta', foldedAfterClick, JSON.stringify(await getKeys()))

  const ranges = await evaluate(`window.__veloxP18.getRanges()`)
  check(
    'fold range spans heading end → next H2 (13 lines)',
    ranges.length === 1 && ranges[0].key === KEY_BETA && ranges[0].lines === 13,
    JSON.stringify(ranges)
  )
  const phText = await placeholderFor(KEY_BETA)
  check(
    'placeholder chip shows ⋯ 13 lines',
    typeof phText === 'string' && phText.includes('13'),
    String(phText)
  )
  check('folded body hidden from DOM', (await contentLacks('gamma body')) && (await contentLacks('beta body 1')))
  // Live preview hides heading hashes (P09 headerMark) — assert on heading text.
  check('next section still visible', (await contentHas('H2 Epsilon')) && (await contentHas('epsilon body')))
  const arrowState = await evaluate(`(() => {
    const el = [...document.querySelectorAll('.cm-md-fold-arrow')]
      .find((e) => e.dataset.foldKey === ${JSON.stringify(KEY_BETA)})
    return el ? { folded: el.classList.contains('is-folded'), glyph: el.textContent } : null
  })()`)
  check(
    'Beta arrow flips to ▾ is-folded',
    arrowState && arrowState.folded === true && arrowState.glyph === '▾',
    JSON.stringify(arrowState)
  )
  const outlineTri = await waitFor(`document.querySelectorAll('.outline-fold.is-folded').length === 1`, 5000)
  check('outline triangle synced to folded', outlineTri)
  const selAfter = await selHead()
  check('cursor unmoved by gutter fold', selBefore === selAfter, `${selBefore} → ${selAfter}`)
  const sessFolds = await waitFor(
    `window.__veloxPrefs.getSession().headingFolds[${JSON.stringify(FOLD_PATH)}]?.includes(${JSON.stringify(KEY_BETA)}) === true`,
    5000
  )
  check('session recorded headingFolds[path]', sessFolds, JSON.stringify(await evaluate(`window.__veloxPrefs.getSession().headingFolds`)))

  const click2 = await clickGutterArrow(KEY_BETA)
  check('gutter arrow click dispatched (unfold)', click2 === true, String(click2))
  const unfolded = await waitFor(`window.__veloxP18.getFoldedKeys().length === 0`, 8000)
  check('gutter click unfolds Beta again', unfolded, JSON.stringify(await getKeys()))
  check('unfold restores body in place', await contentHas('gamma body'))
  check('placeholder gone after unfold', (await placeholderFor(KEY_BETA)) === null)

  // ---- ② nested folds: H3 keeps folded across H2 fold/unfold ------------------
  await evaluate(`window.__veloxP18.toggleKey(${JSON.stringify(KEY_GAMMA)})`)
  await evaluate(`window.__veloxP18.toggleKey(${JSON.stringify(KEY_BETA)})`)
  const both = await waitFor(
    `(() => { const k = window.__veloxP18.getFoldedKeys(); return k.includes(${JSON.stringify(KEY_GAMMA)}) && k.includes(${JSON.stringify(KEY_BETA)}) })()`,
    8000
  )
  check('nested: Gamma + Beta both folded', both, JSON.stringify(await getKeys()))
  const outerRanges = await evaluate(`window.__veloxP18.getRanges()`)
  check(
    'nested: ranges report outermost only',
    outerRanges.length === 1 && outerRanges[0].key === KEY_BETA,
    JSON.stringify(outerRanges)
  )
  check('nested: Beta fold hides Gamma body', await contentLacks('gamma body'))

  await evaluate(`window.__veloxP18.toggleKey(${JSON.stringify(KEY_BETA)})`)
  const gammaKept = await waitFor(
    `(() => { const k = window.__veloxP18.getFoldedKeys(); return k.includes(${JSON.stringify(KEY_GAMMA)}) && !k.includes(${JSON.stringify(KEY_BETA)}) })()`,
    8000
  )
  check('nested: unfold Beta keeps Gamma folded', gammaKept, JSON.stringify(await getKeys()))
  check('nested: Gamma heading visible again', await contentHas('H3 Gamma'))
  check('nested: Gamma body still hidden', await contentLacks('gamma body'))
  const gammaPh = await waitFor(`window.__veloxP18 && ${JSON.stringify(KEY_GAMMA)} && document.querySelectorAll('.cm-md-fold-placeholder').length === 1`, 5000)
  check('nested: Gamma placeholder present', gammaPh && (await placeholderFor(KEY_GAMMA)) !== null)

  await evaluate(`window.__veloxP18.toggleKey(${JSON.stringify(KEY_GAMMA)})`)
  await waitFor(`window.__veloxP18.getFoldedKeys().length === 0`, 8000)
  check('nested: unfold Gamma restores body', await contentHas('gamma body'))

  // ---- ③ auto-expand on jumps into folded sections -----------------------------
  await evaluate(`window.__veloxP18.toggleKey(${JSON.stringify(KEY_BETA)})`)
  await waitFor(`window.__veloxP18.getFoldedKeys().includes(${JSON.stringify(KEY_BETA)})`, 8000)
  // Search-hit jump path: P13 openAt → openSearchResult → selection dispatch.
  await evaluate(`window.__veloxP13.openAt(${JSON.stringify(FOLD_PATH)}, 13, 0)`)
  const searchExpand = await waitFor(`!window.__veloxP18.getFoldedKeys().includes(${JSON.stringify(KEY_BETA)})`, 8000)
  check('search jump into folded section auto-expands', searchExpand, JSON.stringify(await getKeys()))
  check('auto-expanded body visible', await contentHas('gamma body'))

  // Direct selection dispatch (outline-style jump) also auto-expands.
  await evaluate(`window.__veloxP18.restoreKeys(${JSON.stringify([KEY_BETA])})`)
  await waitFor(`window.__veloxP18.getFoldedKeys().includes(${JSON.stringify(KEY_BETA)})`, 8000)
  await evaluate(`(() => {
    const v = window.__veloxEditor.view
    const pos = v.state.doc.toString().indexOf('delta body') + 3
    v.dispatch({ selection: { anchor: pos } })
    return true
  })()`)
  const selExpand = await waitFor(`!window.__veloxP18.getFoldedKeys().includes(${JSON.stringify(KEY_BETA)})`, 8000)
  check('selection into folded range auto-expands', selExpand, JSON.stringify(await getKeys()))

  // ---- ④ outline triangle + title jumps ---------------------------------------
  await wait(200)
  const triCount = await evaluate(`document.querySelectorAll('.outline-fold').length`)
  check('outline triangles rendered for all headings', triCount === 6, String(triCount))

  const selPreTri = await selHead()
  const triClick = await clickOutline('H2 Beta', 'fold')
  check('outline triangle click dispatched', triClick === true, String(triClick))
  const triFolded = await waitFor(`window.__veloxP18.getFoldedKeys().includes(${JSON.stringify(KEY_BETA)})`, 8000)
  check('outline triangle folds editor section', triFolded, JSON.stringify(await getKeys()))
  const selPostTri = await selHead()
  check('cursor unmoved by outline triangle', selPreTri === selPostTri, `${selPreTri} → ${selPostTri}`)
  const triCls = await waitFor(`document.querySelectorAll('.outline-fold.is-folded').length >= 1`, 5000)
  check('outline triangle shows folded state', triCls === true)

  const titleClick = await clickOutline('H2 Beta', 'title')
  check('outline title click dispatched', titleClick === true, String(titleClick))
  const titleUnfolded = await waitFor(`!window.__veloxP18.getFoldedKeys().includes(${JSON.stringify(KEY_BETA)})`, 8000)
  check('outline jump unfolds the folded target', titleUnfolded, JSON.stringify(await getKeys()))
  const onBeta = await evaluate(`(() => {
    const v = window.__veloxEditor.view
    return v.state.doc.lineAt(v.state.selection.main.head).text.includes('H2 Beta')
  })()`)
  check('cursor sits on the H2 Beta heading line', onBeta === true)

  // Jump into a folded parent auto-expands the parent.
  const tri2 = await clickOutline('H2 Beta', 'fold')
  check('outline triangle folds Beta again', tri2 === true, String(tri2))
  await waitFor(`window.__veloxP18.getFoldedKeys().includes(${JSON.stringify(KEY_BETA)})`, 8000)
  await clickOutline('H3 Gamma', 'title')
  const parentExpanded = await waitFor(`!window.__veloxP18.getFoldedKeys().includes(${JSON.stringify(KEY_BETA)})`, 8000)
  check('outline jump into folded parent auto-expands parent', parentExpanded, JSON.stringify(await getKeys()))
  const onGamma = await evaluate(`(() => {
    const v = window.__veloxEditor.view
    return v.state.doc.lineAt(v.state.selection.main.head).text.includes('H3 Gamma')
  })()`)
  check('cursor sits on the H3 Gamma heading line', onGamma === true)

  // ---- placeholder click + session persistence --------------------------------
  await evaluate(`window.__veloxP18.toggleKey(${JSON.stringify(KEY_BETA)})`)
  const phReady = await waitFor(`document.querySelectorAll('.cm-md-fold-placeholder').length === 1`, 8000)
  check('placeholder present before click', phReady === true)
  const phClick = await clickPlaceholder(KEY_BETA)
  check('placeholder mousedown dispatched', phClick === true, String(phClick))
  const phExpanded = await waitFor(`!window.__veloxP18.getFoldedKeys().includes(${JSON.stringify(KEY_BETA)})`, 8000)
  check('placeholder click expands the section', phExpanded, JSON.stringify(await getKeys()))

  // Fold again, then simulate a restart: full renderer reload wipes in-memory
  // foldField state; localStorage session survives; reopening the path must
  // re-apply headingFolds (requirement ④ 重启后恢复).
  await evaluate(`window.__veloxP18.toggleKey(${JSON.stringify(KEY_BETA)})`)
  await evaluate(`window.__veloxP18.toggleKey(${JSON.stringify(KEY_GAMMA)})`)
  const sessBoth = await waitFor(
    `(() => { const s = window.__veloxP18.getSessionFolds(); return s.includes(${JSON.stringify(KEY_BETA)}) && s.includes(${JSON.stringify(KEY_GAMMA)}) })()`,
    8000
  )
  check('session holds both fold keys', sessBoth, JSON.stringify(await evaluate(`window.__veloxP18.getSessionFolds()`)))

  await evaluate(`location.reload()`)
  await wait(1500)
  const hookBack = await waitFor(
    `typeof window.__veloxP18 === 'object' && window.__veloxP18 !== null && typeof window.__veloxP12 === 'object' && window.__veloxP12 !== null`,
    30000
  )
  check('__veloxP18 hook ready after reload', hookBack === true)
  const sessSurvived = await waitFor(
    `(() => { const s = (window.__veloxPrefs.getSession().headingFolds || {})[${JSON.stringify(FOLD_PATH)}] || []; return s.includes(${JSON.stringify(KEY_BETA)}) && s.includes(${JSON.stringify(KEY_GAMMA)}) })()`,
    8000
  )
  check('session folds survive renderer reload', sessSurvived, JSON.stringify(await evaluate(`window.__veloxPrefs.getSession().headingFolds`)))

  await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify(DOC)}, ${JSON.stringify(FOLD_PATH)})`)
  await waitFor(`window.__veloxP13.getFilePath() === ${JSON.stringify(FOLD_PATH)}`, 8000)
  const restartRestored = await waitFor(
    `(() => { const k = window.__veloxP18.getFoldedKeys(); return k.includes(${JSON.stringify(KEY_BETA)}) && k.includes(${JSON.stringify(KEY_GAMMA)}) })()`,
    8000
  )
  check('reopened file restores session folds', restartRestored, JSON.stringify(await getKeys()))
  check('restored fold still hides nested body', await contentLacks('gamma body'))
  await evaluate(`window.__veloxP18.restoreFromSession()`)
  await wait(300)
  const idemKeys = await getKeys()
  check(
    'restoreFromSession is idempotent re-apply',
    idemKeys.includes(KEY_BETA) && idemKeys.includes(KEY_GAMMA),
    JSON.stringify(idemKeys)
  )

  // File round-trip: other doc starts clean; returning re-applies session folds.
  await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify(OTHER_DOC)}, ${JSON.stringify(OTHER_PATH)})`)
  await waitFor(`window.__veloxP13.getFilePath() === ${JSON.stringify(OTHER_PATH)}`, 8000)
  const clearedOnSwitch = await waitFor(`window.__veloxP18.getFoldedKeys().length === 0`, 8000)
  check('file switch starts with no folds', clearedOnSwitch, JSON.stringify(await getKeys()))
  await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify(DOC)}, ${JSON.stringify(FOLD_PATH)})`)
  await waitFor(`window.__veloxP13.getFilePath() === ${JSON.stringify(FOLD_PATH)}`, 8000)
  const backRestored = await waitFor(
    `(() => { const k = window.__veloxP18.getFoldedKeys(); return k.includes(${JSON.stringify(KEY_BETA)}) && k.includes(${JSON.stringify(KEY_GAMMA)}) })()`,
    8000
  )
  check('returning to fold.md restores session folds', backRestored, JSON.stringify(await getKeys()))

  // ---- ⑤ source mode keeps keys, shows everything ------------------------------
  await evaluate(`window.__veloxPrefs.setPreferences({ sourceMode: true })`)
  const sourceVisible = await waitFor(`(() => (document.querySelector('.cm-content')?.textContent || '').includes('gamma body'))()`, 8000)
  check('source mode shows folded body again', sourceVisible === true)
  const sourceKeys = await getKeys()
  check(
    'source mode retains fold keys',
    sourceKeys.includes(KEY_BETA) && sourceKeys.includes(KEY_GAMMA),
    JSON.stringify(sourceKeys)
  )
  const sourceArrows = await evaluate(`document.querySelectorAll('.cm-md-fold-arrow').length`)
  check('source mode hides fold gutter arrows', sourceArrows === 0, String(sourceArrows))

  await evaluate(`window.__veloxPrefs.setPreferences({ sourceMode: false })`)
  const liveBack = await waitFor(
    `(() => {
      const k = window.__veloxP18.getFoldedKeys()
      const txt = document.querySelector('.cm-content')?.textContent || ''
      return k.includes(${JSON.stringify(KEY_BETA)}) && !txt.includes('gamma body')
    })()`,
    8000
  )
  check('live mode restores the fold without re-toggle', liveBack, JSON.stringify(await getKeys()))
  check('live mode placeholder back', (await placeholderFor(KEY_BETA)) !== null)

  // ---- ⑥ perf: ~5k-line document ----------------------------------------------
  const BIG = (() => {
    const seg = []
    for (let i = 0; i < 100; i++) {
      seg.push(`## Section ${i}`, '')
      for (let j = 0; j < 48; j++) seg.push(`line ${i}-${j}`)
      seg.push('')
    }
    return seg.join('\n')
  })()
  await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify(BIG)}, ${JSON.stringify(BENCH_PATH)})`)
  await waitFor(`window.__veloxP13.getFilePath() === ${JSON.stringify(BENCH_PATH)}`, 8000)
  const bigHeads = await waitFor(`window.__veloxP18.getHeadingKeys().length === 100`, 10000)
  check('5k-line doc: 100 H2 sections parsed', bigHeads, String(await evaluate(`window.__veloxP18.getHeadingKeys().length`)))

  const bench = await evaluate(`window.__veloxP18.benchToggle('2:Section 50', 20)`)
  check(
    `5k-line fold toggle avg ${typeof bench?.avg === 'number' ? bench.avg.toFixed(2) : '?'}ms < 50ms`,
    bench && typeof bench.avg === 'number' && bench.avg < 50,
    JSON.stringify(bench)
  )
  // benchToggle toggled an even number of times → unfolded; fold once more.
  await evaluate(`window.__veloxP18.toggleKey('2:Section 50')`)
  const bigFolded = await waitFor(`window.__veloxP18.getFoldedKeys().includes('2:Section 50')`, 8000)
  const bigRange = await evaluate(`window.__veloxP18.getRanges()`)
  check(
    '5k-line fold range computed (50 hidden lines)',
    bigFolded && bigRange.length === 1 && bigRange[0].key === '2:Section 50' && bigRange[0].lines === 50,
    JSON.stringify(bigRange)
  )

  console.log('')
  if (failures.length === 0) {
    console.log('P18 e2e: ALL PASS')
  } else {
    console.log(`P18 e2e: ${failures.length} FAILURES`)
    for (const f of failures) console.log('  - ' + f)
  }

  try {
    ws?.close()
  } catch {}
  app?.kill('SIGKILL')
  process.exit(failures.length === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('FATAL', err)
  try {
    ws?.close()
  } catch {}
  app?.kill('SIGKILL')
  process.exit(1)
})
