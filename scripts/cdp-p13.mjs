// CDP e2e test for P13 (folder-wide search/replace).
// Runs against the *built* app (out/) with remote debugging enabled:
//   npm run build
//   node scripts/cdp-p13.mjs
//
// Coverage
//   IPC search:run  — counts, ignore rules (node_modules / hidden / ext filter)
//   panel UI        — open folder → Ctrl+Shift+F focus → type → count line
//   per-file cap    — big.md shows 10, expand to 12, collapse back
//   toggles         — Aa (case), W (whole word), .* (regex foo\d+ + invalid)
//   jump            — click match opens file with cursor on the hit line
//   replace one     — disk updated; open clean editor reloads in sync
//   replace file    — only that file rewritten
//   replace all     — dirty open file skipped + alert; clean open file syncs
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9230
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))
const TMP = join(ROOT, 'scripts', 'tmp-p13')

// ---- fixture tree ----------------------------------------------------------
// needle ci totals (default exts, default ignores):
//   docs/alpha.md      3   (needle here / Needle capital / needle again)
//   docs/sub/bravo.md  2   (needle in bravo / needles plural)
//   docs/big.md        12  (needle line 1..12 — exercises the 10-visible cap)
//   notes/todos.txt    1
//   replace-me.md      3
//   = 21 matches in 5 files
// Ignored / filtered (must never appear): node_modules/, .hidden/, data.csv
function buildFixture() {
  const put = (rel, content) => {
    const p = join(TMP, rel)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, content)
  }
  put('docs/alpha.md', '# Alpha\n\nneedle here\nnothing to see\nNeedle capital\nneedle again\nfoo42 bar\n')
  put('docs/sub/bravo.md', '# Bravo\nneedle in bravo\nneedles plural\nfoo42 and foo99\n')
  put(
    'docs/big.md',
    Array.from({ length: 12 }, (_, i) => `needle line ${i + 1}`).join('\n') + '\n'
  )
  put('docs/regex-target.md', 'foo42 first\nfooXYZ no\nfoo7 second\n')
  put('notes/todos.txt', 'todo: needle in txt file\n')
  put(
    'replace-me.md',
    '# Replace\nneedle one\nmiddle\nneedle two\nneedle three\n'
  )
  put('node_modules/pkg/index.md', 'needle in node_modules\n')
  put('.hidden/secret.md', 'needle hidden\n')
  put('data.csv', 'needle,csv\n')
  // Hundred-file folder: timing criterion + realistic walk depth.
  for (let i = 1; i <= 100; i++) {
    put(`bloat/f${String(i).padStart(3, '0')}.md`, `# File ${i}\n\njust padding content ${i}\n`)
  }
}

const ALPHA = join(TMP, 'docs', 'alpha.md')
const BRAVO = join(TMP, 'docs', 'sub', 'bravo.md')
const BIG = join(TMP, 'docs', 'big.md')
const TODOS = join(TMP, 'notes', 'todos.txt')
const REPLACE_ME = join(TMP, 'replace-me.md')

mkdirSync(TMP, { recursive: true })
buildFixture()

let app = null
let ws = null

async function getTarget(timeoutMs = 20000) {
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

const failures = []
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) failures.push(name)
}

async function main() {
  if (!ELECTRON_BIN) throw new Error('electron binary not found under node_modules/electron/dist')

  let id = 0
  let pending = new Map()

  async function connect() {
    const target = await getTarget(30000)
    ws = new WebSocket(target.webSocketDebuggerUrl)
    const localPending = new Map()
    pending = localPending
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && localPending.has(msg.id)) {
        const { resolve, reject } = localPending.get(msg.id)
        localPending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      } else if (msg.method === 'Inspector.targetCrashed') {
        console.error('CDP event: target crashed')
        for (const { reject } of localPending.values()) reject(new Error('target crashed'))
        localPending.clear()
      }
    })
    ws.addEventListener('close', () => {
      for (const { reject } of localPending.values()) reject(new Error('CDP websocket closed'))
      localPending.clear()
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
    const send = (method, params = {}) => {
      const msgId = ++id
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          localPending.delete(msgId)
          reject(new Error(`CDP timeout: ${method}`))
        }, 15000)
        localPending.set(msgId, {
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
          clearTimeout(t)
          localPending.delete(msgId)
          reject(e)
        }
      })
    }
    session.send = send
    session.evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      })
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
      return r.result.value
    }
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Inspector.enable').catch(() => {})
  }

  const session = { send: null, evaluate: null }
  const evaluate = (expr) => session.evaluate(expr)

  const waitFor = async (expr, ms = 12000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      try {
        if (await evaluate(expr)) return true
      } catch {}
      await new Promise((r) => setTimeout(r, 150))
    }
    return false
  }

  const clickDialogBtn = (label) => evaluate(`(() => {
    const btns = [...document.querySelectorAll('.dialog-buttons .dialog-btn')]
    const b = btns.find((x) => x.textContent.trim() === ${JSON.stringify(label)})
    if (!b) return false
    b.click()
    return true
  })()`)

  const dialogTitle = () =>
    evaluate(`document.querySelector('.dialog-title')?.textContent?.trim() ?? null`)

  const setInput = (selector, value) => evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)

  const toggle = (label) => evaluate(`(() => {
    const btns = [...document.querySelectorAll('.search-toggle')]
    const map = { case: 0, word: 1, regex: 2 }
    const b = btns[map[${JSON.stringify(label)}]]
    if (!b) return false
    b.click()
    return b.classList.contains('active')
  })()`)

  const toggleActive = (label) => evaluate(`(() => {
    const btns = [...document.querySelectorAll('.search-toggle')]
    const map = { case: 0, word: 1, regex: 2 }
    return btns[map[${JSON.stringify(label)}]]?.classList.contains('active') ?? null
  })()`)

  const countText = () =>
    evaluate(`document.querySelector('.search-count')?.textContent?.trim() ?? null`)
  const errorText = () =>
    evaluate(`document.querySelector('.search-error')?.textContent?.trim() ?? null`)
  const emptyText = () =>
    evaluate(`document.querySelector('.search-empty')?.textContent?.trim() ?? null`)

  const waitCount = (text, ms = 10000) =>
    waitFor(
      `document.querySelector('.search-count')?.textContent?.trim() === ${JSON.stringify(text)}`,
      ms
    )

  const fileNames = () =>
    evaluate(`[...document.querySelectorAll('.search-file-name')].map((e) => e.textContent)`)

  const fileSection = (relPath) => evaluate(`(() => {
    const f = [...document.querySelectorAll('.search-file')].find(
      (el) => el.querySelector('.search-file-name')?.textContent === ${JSON.stringify(relPath)}
    )
    if (!f) return null
    return {
      count: f.querySelector('.search-file-count')?.textContent ?? '',
      matches: f.querySelectorAll('.search-match').length,
      texts: [...f.querySelectorAll('.search-match-text')].map((e) => e.textContent),
      more: f.querySelector('.search-more')?.textContent ?? null
    }
  })()`)

  const clickMore = (relPath) => evaluate(`(() => {
    const f = [...document.querySelectorAll('.search-file')].find(
      (el) => el.querySelector('.search-file-name')?.textContent === ${JSON.stringify(relPath)}
    )
    const b = f?.querySelector('.search-more')
    if (!b) return false
    b.click()
    return true
  })()`)

  const clickMatchInFile = (relPath, index = 0) => evaluate(`(() => {
    const f = [...document.querySelectorAll('.search-file')].find(
      (el) => el.querySelector('.search-file-name')?.textContent === ${JSON.stringify(relPath)}
    )
    if (!f) return null
    const m = [...f.querySelectorAll('.search-match')][${index}]
    if (!m) return null
    m.click()
    return { line: m.querySelector('.search-match-line')?.textContent ?? '' }
  })()`)

  const clickMatchReplace = (relPath, index = 0) => evaluate(`(() => {
    const f = [...document.querySelectorAll('.search-file')].find(
      (el) => el.querySelector('.search-file-name')?.textContent === ${JSON.stringify(relPath)}
    )
    if (!f) return false
    const m = [...f.querySelectorAll('.search-match-replace')][${index}]
    if (!m) return false
    m.click()
    return true
  })()`)

  const clickFileReplace = (relPath) => evaluate(`(() => {
    const f = [...document.querySelectorAll('.search-file')].find(
      (el) => el.querySelector('.search-file-name')?.textContent === ${JSON.stringify(relPath)}
    )
    if (!f) return false
    f.querySelector('.search-file-replace')?.click()
    return true
  })()`)

  const clickReplaceAll = () => evaluate(`(() => {
    const b = document.querySelector('.search-replace-all')
    if (!b || b.disabled) return false
    b.click()
    return true
  })()`)

  const editorInfo = () => evaluate(`(() => {
    const v = window.__veloxEditor?.view
    if (!v) return null
    const head = v.state.selection.main.head
    return {
      path: window.__veloxP13.getFilePath(),
      doc: v.state.doc.toString(),
      lineNo: v.state.doc.lineAt(head).number,
      col: head - v.state.doc.lineAt(head).from,
      dirty: window.__veloxP12.getDirty()
    }
  })()`)

  const countInFile = (path, needle) => {
    const text = readFileSync(path, 'utf8')
    return text.split(needle).length - 1
  }

  // Disk writes land asynchronously after the DOM click → poll, don't race.
  const pollDisk = async (path, pred, ms = 8000) => {
    const end = Date.now() + ms
    let text = readFileSync(path, 'utf8')
    while (Date.now() < end) {
      text = readFileSync(path, 'utf8')
      if (pred(text)) return text
      await new Promise((r) => setTimeout(r, 150))
    }
    return text
  }

  // ---- boot ------------------------------------------------------------------
  app = await (async () => {
    try {
      await getTarget(3000)
      return null
    } catch {
      return launch()
    }
  })()
  await connect()

  const hooked = await waitFor(
    `!!window.__veloxEditor?.view && !!window.__veloxP13 && !!window.__veloxP12 && !!window.__veloxPrefs?.setPreferences`,
    25000
  )
  check('boot: hooks ready', hooked)
  if (!hooked) throw new Error('hooks never appeared')

  // Hygiene pins: no autosave / crash-recovery interference from other suites.
  await evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') ?? '{}')
    localStorage.setItem('veloxmark.preferences', JSON.stringify({
      ...raw, restoreLastSession: false, autoSaveMode: 'off', crashRecoveryEnabled: false
    }))
    return true
  })()`)
  try {
    const drafts = await evaluate(`window.__veloxP12.draftList()`)
    for (const d of drafts ?? []) {
      await evaluate(`window.__veloxP12.draftDiscard(${JSON.stringify(d.path)})`)
    }
  } catch {}
  await evaluate(`window.__veloxPrefs.setPreferences(JSON.parse(localStorage.getItem('veloxmark.preferences') ?? '{}'))`)
    .catch(() => {})

  // Re-install the collector (reload wipes page state — we didn't reload, but pins
  // may have raced; reinstall cheaply after hooks confirmed).
  await evaluate(`(() => {
    window.__p13Bus = { byId: new Map(), subbed: false }
    window.api.onSearchResults((p) => {
      const bus = window.__p13Bus
      const entry = bus.byId.get(p.searchId) ?? { files: new Map(), total: null, error: null, done: false }
      for (const f of p.files ?? []) entry.files.set(f.path, f)
      if (p.done) { entry.total = p.totalMatches ?? null; entry.done = true }
      if (p.error) entry.error = p.error
      bus.byId.set(p.searchId, entry)
    })
    window.__p13Bus.subbed = true
    window.__p13SearchOnce = async (root, pattern, options) => {
      const res = await window.__veloxP13.searchRun(root, pattern, options)
      if (res.error) return { files: [], total: 0, error: res.error }
      const end = Date.now() + 8000
      while (Date.now() < end) {
        const entry = window.__p13Bus.byId.get(res.searchId)
        if (entry?.done) {
          return {
            error: entry.error ?? null,
            total: entry.total,
            files: [...entry.files.values()].map((f) => ({
              relPath: f.relPath,
              matchCount: f.matchCount,
              matches: f.matches.map((m) => ({ line: m.line, col: m.col, lineText: m.lineText }))
            }))
          }
        }
        await new Promise((r) => setTimeout(r, 40))
      }
      return { files: [], total: 0, error: 'timeout waiting for search results' }
    }
    return true
  })()`)

  // ---- API-level: counts + ignore rules --------------------------------------
  console.log('\n--- search:run IPC ---')
  const api = await evaluate(
    `window.__p13SearchOnce(${JSON.stringify(TMP)}, 'needle', { caseSensitive: false, wholeWord: false, regex: false })`
  )
  const apiPaths = (api.files ?? []).map((f) => f.relPath).sort()
  const expectedPaths = [
    'docs/alpha.md',
    'docs/big.md',
    'docs/sub/bravo.md',
    'notes/todos.txt',
    'replace-me.md'
  ].sort()
  check('api: needle → 21 matches', api.total === 21, `got ${api.total} (${api.error ?? ''})`)
  check(
    'api: exactly the 5 expected files',
    JSON.stringify(apiPaths) === JSON.stringify(expectedPaths),
    apiPaths.join(', ')
  )
  check(
    'api: node_modules / hidden / csv excluded',
    !apiPaths.some((p) => p.includes('node_modules') || p.includes('.hidden') || p.endsWith('.csv')),
    apiPaths.join(', ')
  )
  const apiBig = (api.files ?? []).find((f) => f.relPath === 'docs/big.md')
  check('api: big.md reports 12 matches', apiBig?.matchCount === 12, `got ${apiBig?.matchCount}`)
  const apiAlpha = (api.files ?? []).find((f) => f.relPath === 'docs/alpha.md')
  check(
    'api: alpha first hit on line 3 "needle here"',
    apiAlpha?.matches?.[0]?.line === 3 && apiAlpha.matches[0].lineText.includes('needle here'),
    JSON.stringify(apiAlpha?.matches?.[0])
  )

  const apiRegex = await evaluate(
    `window.__p13SearchOnce(${JSON.stringify(TMP)}, 'foo\\\\d+', { caseSensitive: false, wholeWord: false, regex: true })`
  )
  check(
    'api: regex foo\\d+ → 5 matches in 3 files',
    apiRegex.total === 5 && (apiRegex.files ?? []).length === 3,
    `total=${apiRegex.total} files=${(apiRegex.files ?? []).length}`
  )

  const apiBad = await evaluate(
    `window.__p13SearchOnce(${JSON.stringify(TMP)}, 'foo[', { caseSensitive: false, wholeWord: false, regex: true })`
  )
  check('api: invalid regex → error, no crash', typeof apiBad.error === 'string' && apiBad.error.length > 0, JSON.stringify(apiBad.error))
  const stillAlive = await evaluate(`!!window.__veloxP13.getSidebarMode`)
  check('api: renderer alive after invalid regex', stillAlive === true)

  // ---- panel UI --------------------------------------------------------------
  console.log('\n--- search panel UI ---')
  const folderOk = await evaluate(`window.__veloxP13.openFolder(${JSON.stringify(TMP)})`)
  check('ui: folder opened', folderOk !== false, JSON.stringify(folderOk))
  const modeAfterFolder = await evaluate(`window.__veloxP13.getSidebarMode()`)
  check('ui: sidebar mode files after openFolder', modeAfterFolder === 'files', modeAfterFolder)

  await evaluate(`window.__veloxP13.openSearch()`)
  const modeAfterSearch = await evaluate(`window.__veloxP13.getSidebarMode()`)
  check('ui: sidebar mode search after openSearch', modeAfterSearch === 'search', modeAfterSearch)
  const panelExists = await evaluate(`!!document.querySelector('.search-panel .search-input')`)
  check('ui: search panel rendered', panelExists)
  const focused = await evaluate(`document.activeElement?.classList?.contains('search-input') ?? false`)
  check('ui: query box focused (Ctrl+Shift+F path)', focused === true)

  // First search after openFolder includes folder-scan warm-up — assert correctness only.
  await setInput('.search-input', 'needle')
  const gotCount = await waitCount('21 match(es) in 5 file(s)', 10000)
  check('ui: count line "21 match(es) in 5 file(s)"', gotCount, `count=${await countText()}`)
  // Steady-state timing (criterion: results fast enough to feel instant while typing).
  await setInput('.search-input', '')
  await new Promise((r) => setTimeout(r, 400))
  const t0 = Date.now()
  await setInput('.search-input', 'needle')
  const gotCountWarm = await waitCount('21 match(es) in 5 file(s)', 10000)
  const elapsed = Date.now() - t0
  check('ui: warm re-search returns same count', gotCountWarm)
  check(`ui: steady-state results within 1.5s (took ${elapsed}ms)`, elapsed < 1500, `${elapsed}ms`)

  const names = (await fileNames()) ?? []
  check(
    'ui: 5 result files, ignores respected',
    names.length === 5 &&
      !names.some((n) => n.includes('node_modules') || n.includes('.hidden') || n.endsWith('.csv')),
    names.join(', ')
  )

  const bigSec = await fileSection('docs/big.md')
  check('ui: big.md capped at 10 visible', bigSec?.matches === 10, `got ${bigSec?.matches}`)
  check('ui: big.md "+2 more" affordance', bigSec?.more === '+2 more', bigSec?.more)
  await clickMore('docs/big.md')
  const bigExpanded = await fileSection('docs/big.md')
  check('ui: expand shows all 12', bigExpanded?.matches === 12 && bigExpanded?.more === 'Show less',
    JSON.stringify(bigExpanded))

  const alphaSec = await fileSection('docs/alpha.md')
  check(
    'ui: alpha snippets mark the hit text',
    (alphaSec?.texts ?? []).some((t) => t.includes('needle here')),
    JSON.stringify(alphaSec?.texts)
  )

  // ---- toggles ---------------------------------------------------------------
  console.log('\n--- toggles ---')
  await setInput('.search-input', 'Needle')
  await toggle('case')
  const caseOn = await toggleActive('case')
  const caseCount = await waitCount('1 match(es) in 1 file(s)', 8000)
  check('ui: caseSensitive "Needle" → 1 in alpha', caseOn === true && caseCount, `count=${await countText()}`)
  const caseNames = await fileNames()
  check('ui: case hit file is docs/alpha.md', caseNames?.length === 1 && caseNames[0] === 'docs/alpha.md',
    JSON.stringify(caseNames))
  await toggle('case')

  await setInput('.search-input', 'needle')
  await toggle('word')
  const wordCount = await waitCount('20 match(es) in 5 file(s)', 8000)
  check('ui: wholeWord "needle" → 20 (excludes "needles")', wordCount, `count=${await countText()}`)
  const bravoSec = await fileSection('docs/sub/bravo.md')
  check(
    'ui: wholeWord bravo shows only the standalone hit',
    (bravoSec?.texts ?? []).every((t) => !t.includes('needles plural')) &&
      (bravoSec?.texts ?? []).some((t) => t.includes('needle in bravo')),
    JSON.stringify(bravoSec?.texts)
  )
  await toggle('word')

  await toggle('regex')
  await setInput('.search-input', 'foo\\d+')
  const reCount = await waitCount('5 match(es) in 3 file(s)', 8000)
  check('ui: regex foo\\d+ → 5 in 3 files', reCount, `count=${await countText()}`)
  const reTexts = await evaluate(`[...document.querySelectorAll('.search-match-text')].map((e) => e.textContent)`)
  check(
    'ui: regex matches exclude fooXYZ',
    reTexts.length > 0 && !reTexts.some((t) => t.includes('fooXYZ')),
    JSON.stringify(reTexts)
  )

  await setInput('.search-input', 'foo[')
  const errShown = await waitFor(`(document.querySelector('.search-error')?.textContent ?? '').length > 0`, 8000)
  check('ui: invalid regex shows .search-error', errShown, await errorText())
  const aliveAfterErr = await evaluate(`window.__veloxP13.getSidebarMode()`)
  check('ui: app alive after invalid regex', aliveAfterErr === 'search', aliveAfterErr)

  await setInput('.search-input', 'foo\\d+')
  const reCount2 = await waitCount('5 match(es) in 3 file(s)', 8000)
  check('ui: recovers from invalid regex', reCount2)
  await toggle('regex')

  // ---- jump to hit -----------------------------------------------------------
  console.log('\n--- jump ---')
  await setInput('.search-input', 'needle again')
  const jumpCount = await waitCount('1 match(es) in 1 file(s)', 8000)
  check('ui: "needle again" → 1 match', jumpCount, `count=${await countText()}`)
  const clicked = await clickMatchInFile('docs/alpha.md', 0)
  check('ui: clicked the match row', clicked?.line === '6', JSON.stringify(clicked))
  const jumped = await waitFor(
    `window.__veloxP13.getFilePath()?.endsWith('docs/alpha.md') ?? false`,
    8000
  )
  const jumpInfo = await editorInfo()
  check('ui: jump opened alpha.md', jumped, jumpInfo?.path)
  check(
    'ui: cursor on line 6 "needle again"',
    jumpInfo?.lineNo === 6 && jumpInfo?.doc.includes('needle again'),
    `line=${jumpInfo?.lineNo} col=${jumpInfo?.col}`
  )

  // ---- replace one (open clean file reloads) ---------------------------------
  console.log('\n--- replace one / file / all ---')
  await evaluate(`window.__veloxP13.openAt(${JSON.stringify(REPLACE_ME)}, 2, 0)`)
  const openedRM = await waitFor(
    `window.__veloxP13.getFilePath() === ${JSON.stringify(REPLACE_ME)}`,
    8000
  )
  check('replace: opened replace-me.md clean', openedRM && !(await evaluate('window.__veloxP12.getDirty()')))

  await setInput('.search-input', 'needle')
  await setInput('.search-replace-input', 'REPLACED')
  const rmCount = await waitCount('21 match(es) in 5 file(s)', 8000)
  check('replace: search "needle" → 21 in 5', rmCount, `count=${await countText()}`)

  const oneClicked = await clickMatchReplace('replace-me.md', 0)
  check('replace: clicked single-match replace', oneClicked)
  const rmDisk1 = await pollDisk(REPLACE_ME, (t) => t.includes('REPLACED one'))
  check(
    'replace: disk replace-me has REPLACED one + 2 needles left',
    rmDisk1.includes('REPLACED one') && rmDisk1.split('needle').length - 1 === 2,
    JSON.stringify(rmDisk1)
  )
  const afterOne = await waitCount('20 match(es) in 5 file(s)', 8000)
  check('replace: count drops to 20 after one', afterOne, `count=${await countText()}`)
  const syncedInfo = await editorInfo()
  check(
    'replace: open clean editor reloaded with disk',
    syncedInfo?.path === REPLACE_ME && syncedInfo?.doc.includes('REPLACED one') && !syncedInfo.dirty,
    `path=${syncedInfo?.path} dirty=${syncedInfo?.dirty}`
  )

  // ---- replace in one file ---------------------------------------------------
  const snapAlpha = readFileSync(ALPHA, 'utf8')
  const snapBig = readFileSync(BIG, 'utf8')
  const snapBravo = readFileSync(BRAVO, 'utf8')
  await setInput('.search-replace-input', 'NURPLE')
  const fileClicked = await clickFileReplace('notes/todos.txt')
  check('replace: clicked file-scope replace on todos.txt', fileClicked)
  const todosDisk = await pollDisk(TODOS, (t) => t.includes('NURPLE') && !t.includes('needle'))
  check(
    'replace: todos.txt rewritten (NURPLE, no needle)',
    todosDisk.includes('NURPLE') && !todosDisk.includes('needle'),
    JSON.stringify(todosDisk)
  )
  const afterFile = await waitCount('19 match(es) in 4 file(s)', 8000)
  check('replace: count 19 in 4 after file-scope', afterFile, `count=${await countText()}`)
  check(
    'replace: other files untouched by file-scope',
    readFileSync(ALPHA, 'utf8') === snapAlpha &&
      readFileSync(BIG, 'utf8') === snapBig &&
      readFileSync(BRAVO, 'utf8') === snapBravo,
    `alphaChanged=${readFileSync(ALPHA, 'utf8') !== snapAlpha} bigChanged=${readFileSync(BIG, 'utf8') !== snapBig}`
  )

  // ---- replace all with dirty open file → skip -------------------------------
  await evaluate(`window.__veloxP13.openAt(${JSON.stringify(REPLACE_ME)}, 2, 0)`)
  await waitFor(`window.__veloxP13.getFilePath() === ${JSON.stringify(REPLACE_ME)}`, 8000)
  await evaluate(`(() => {
    const v = window.__veloxEditor.view
    const pos = v.state.doc.length
    const insert = '\\nDIRTY MARK\\n'
    v.dispatch({ changes: { from: pos, insert } })
    return true
  })()`)
  const dirtyNow = await waitFor(`window.__veloxP12.getDirty() === true`, 4000)
  check('replace-all: editor dirty before replace-all', dirtyNow)

  await setInput('.search-replace-input', 'GONE')
  await setInput('.search-input', 'needle')
  await waitCount('19 match(es) in 4 file(s)', 8000) // alpha 3 + bravo 2 + big 12 + replace-me 2
  const allClicked = await clickReplaceAll()
  check('replace-all: Replace All button clickable', allClicked)
  const confirmShown = await waitFor(`document.querySelector('.dialog-title')?.textContent === 'Replace All'`, 8000)
  check('replace-all: confirm dialog shown', confirmShown, await dialogTitle())
  await clickDialogBtn('Replace All')
  const skipShown = await waitFor(`document.querySelector('.dialog-title')?.textContent === 'Replace Skipped'`, 8000)
  check('replace-all: dirty file skipped + alert', skipShown, await dialogTitle())
  const skipMsg = await evaluate(`document.querySelector('.dialog-message')?.textContent ?? ''`)
  check(
    'replace-all: skip alert names replace-me.md',
    skipMsg.includes('replace-me.md'),
    skipMsg.replace(/\n/g, ' | ')
  )
  await clickDialogBtn('OK')

  const rmDisk2 = readFileSync(REPLACE_ME, 'utf8')
  check(
    'replace-all: dirty open file NOT rewritten on disk',
    rmDisk2.includes('REPLACED one') && countInFile(REPLACE_ME, 'needle') === 2,
    JSON.stringify(rmDisk2)
  )
  check(
    'replace-all: other dirty-free files rewritten (GONE)',
    readFileSync(ALPHA, 'utf8').includes('GONE') &&
      !readFileSync(ALPHA, 'utf8').includes('needle') &&
      !readFileSync(BIG, 'utf8').includes('needle') &&
      !readFileSync(BRAVO, 'utf8').includes('needle'),
    `alpha=${JSON.stringify(readFileSync(ALPHA, 'utf8').slice(0, 60))}`
  )
  const afterAll = await waitCount('2 match(es) in 1 file(s)', 8000)
  check('replace-all: recount → only replace-me remains (2 in 1)', afterAll, `count=${await countText()}`)
  const stillDirty = await evaluate(`window.__veloxP12.getDirty()`)
  check('replace-all: dirty buffer preserved', stillDirty === true && (await editorInfo())?.doc.includes('DIRTY MARK'))

  // ---- clean open file + replace all → editor sync ---------------------------
  const saved = await evaluate(`window.__veloxP12.saveFile()`)
  check('sync: saved dirty replace-me (now clean)', saved !== false && !(await evaluate('window.__veloxP12.getDirty()')))

  await setInput('.search-replace-input', 'SYNCED')
  await setInput('.search-input', 'needle')
  await waitCount('2 match(es) in 1 file(s)', 8000)
  await clickReplaceAll()
  const confirm2 = await waitFor(`document.querySelector('.dialog-title')?.textContent === 'Replace All'`, 8000)
  check('sync: confirm dialog for final replace-all', confirm2)
  await clickDialogBtn('Replace All')
  // No skip alert this time — file is clean. Wait for search to re-run empty.
  const noResults = await waitFor(
    `(document.querySelector('.search-empty')?.textContent ?? '') === 'No results'`,
    8000
  )
  check('sync: "No results" after final replace-all', noResults, await emptyText())
  const rmDisk3 = readFileSync(REPLACE_ME, 'utf8')
  check(
    'sync: disk replace-me fully replaced (SYNCED×2, no needle)',
    countInFile(REPLACE_ME, 'SYNCED') === 2 && countInFile(REPLACE_ME, 'needle') === 0,
    JSON.stringify(rmDisk3)
  )
  const finalInfo = await editorInfo()
  check(
    'sync: open editor matches disk byte-for-byte',
    finalInfo?.path === REPLACE_ME && finalInfo?.doc === rmDisk3 && !finalInfo.dirty,
    `dirty=${finalInfo?.dirty} docLen=${finalInfo?.doc?.length} diskLen=${rmDisk3.length}`
  )

  // ---- cleanup ---------------------------------------------------------------
  try {
    const drafts = await evaluate(`window.__veloxP12.draftList()`)
    for (const d of drafts ?? []) {
      await evaluate(`window.__veloxP12.draftDiscard(${JSON.stringify(d.path)})`)
    }
    check('cleanup: drafts cleared', true)
  } catch (e) {
    check('cleanup: drafts cleared', false, String(e))
  }

  console.log('\n---- P13 summary ----')
  if (failures.length === 0) {
    console.log('ALL PASS')
  } else {
    console.log(`FAILURES (${failures.length}):`)
    for (const f of failures) console.log(` - ${f}`)
    process.exitCode = 1
  }
}

main()
  .catch((e) => {
    console.error('FATAL', e)
    process.exitCode = 1
  })
  .finally(() => {
    if (app) {
      try {
        app.kill('SIGKILL')
      } catch {}
    }
    if (ws) {
      try {
        ws.close()
      } catch {}
    }
    setTimeout(() => process.exit(process.exitCode ?? 0), 500)
  })
