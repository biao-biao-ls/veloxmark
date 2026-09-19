// CDP e2e test for P24 (代码块显示增强). Port 9241.
//   npm run build && node scripts/cdp-p24.mjs
//
// Acceptance coverage (docs/requirements/P24-code-block-display.md)
//   ① 50-line block collapses at default 20 + expander "展开 30 行"; click
//      expands to full render; toolbar Copy on a collapsed block still
//      copies the FULL code
//   ② expanded state survives a theme switch (content-hash memory); editing
//      the code content re-keys → collapse default reapplies
//   ③ line numbers 1..N when the pref is on; gone when off
//   ④ wrap off → horizontal scroll on long lines; wrap on → soft-wrap class
//   ⑤ collapse/expand toggles keep click→cursor mapping below the block
//      correct (heightmap: posAtCoords on a below-paragraph line)
//   ⑥ codeBlockCollapseLines = 0 → never collapses
import { existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9241
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))
const TMP = join(ROOT, 'scripts', 'tmp-p24')
mkdirSync(TMP, { recursive: true })

const DOC_PATH = join(TMP, 'codeblocks.md')

// 50-line js fence + a marker paragraph after it (heightmap probe target).
function makeCodeLines(n, prefix = 'const v') {
  return Array.from({ length: n }, (_, i) => `${prefix}${i + 1} = ${i + 1}`)
}
const CODE50 = makeCodeLines(50)
const DOC = [
  '# P24 固定文档',
  '',
  '```js',
  ...CODE50,
  '```',
  '',
  'below-marker-para',
  ''
].join('\n')

// Wrap probe: one very long line inside a fence.
const LONG_LINE = `const long = "${'x'.repeat(400)}"`
const DOC_WRAP = ['# wrap probe', '', '```js', LONG_LINE, '```', ''].join('\n')

// Edit probe: same shape, first line changed → different content hash.
const DOC_EDIT = [
  '# P24 固定文档',
  '',
  '```js',
  `const v1 = 999 // edited`,
  ...CODE50.slice(1),
  '```',
  '',
  'below-marker-para',
  ''
].join('\n')

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

  // ---- boot -------------------------------------------------------------------
  app = launch()
  await connect()
  await waitFor(
    `typeof window.__veloxPrefs === 'object' && typeof window.__veloxEditor === 'object'`,
    30000
  )
  await evaluate(`(async () => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') || '{}')
    localStorage.setItem('veloxmark.preferences', JSON.stringify({
      ...raw,
      language: 'zh',
      crashRecoveryEnabled: false,
      autoSaveMode: 'off',
      restoreLastSession: false,
      showStatusBar: true,
      theme: 'light',
      typingAssistsEnabled: true,
      codeBlockCollapseLines: 20,
      codeBlockShowLineNumbers: false,
      codeBlockWrap: true
    }))
    const sess = JSON.parse(localStorage.getItem('veloxmark.session') || '{}')
    localStorage.setItem('veloxmark.session', JSON.stringify({ ...sess, sidebarVisible: false }))
    try {
      const drafts = await window.api.draftList()
      for (const d of drafts) await window.api.draftRemove(d.path)
    } catch {}
  })()`)
  await evaluate(`location.reload()`)
  await waitFor(`typeof window.__veloxP24 === 'object' && window.__veloxP24 !== null`, 30000)
  await waitFor(`document.querySelector('.status-bar')`, 10000)
  await wait(300)

  const loadDoc = async (text, path) => {
    await evaluate(`window.__veloxP24.loadDoc(${JSON.stringify(text)}, ${JSON.stringify(path)})`)
    await wait(350)
  }
  const info = () => evaluate(`window.__veloxP24.codeBlockInfo()`)
  const getPrefs = () => evaluate(`window.__veloxP24.getPrefs()`)
  const setPrefs = async (patch) => {
    await evaluate(`window.__veloxP24.setPrefs(${JSON.stringify(patch)})`)
    await wait(400)
  }

  await loadDoc(DOC, DOC_PATH)

  // ---- ① default collapse + expander text ------------------------------------
  let i = await info()
  check('default collapse: collapsed class present', !!i && i.hasCollapsedClass === true, JSON.stringify(i))
  check(
    'default collapse: expander reads 展开 30 行',
    !!i && i.expanderText === '展开 30 行',
    `got ${i && i.expanderText}`
  )
  check(
    'default collapse: only ~20 lines rendered',
    !!i && i.renderedCodeLines > 15 && i.renderedCodeLines <= 21,
    `rendered=${i && i.renderedCodeLines}`
  )
  const prefs0 = await getPrefs()
  check(
    'prefs defaults round-trip (20 / false / true)',
    prefs0.codeBlockCollapseLines === 20 &&
      prefs0.codeBlockShowLineNumbers === false &&
      prefs0.codeBlockWrap === true,
    JSON.stringify(prefs0)
  )

  // ---- ① expand via chip + Copy copies FULL code while collapsed --------------
  const clicked = await evaluate(`window.__veloxP24.clickExpander()`)
  check('expander click dispatched', clicked === true)
  await wait(400)
  i = await info()
  check('expanded: collapsed class gone', !!i && i.hasCollapsedClass === false, JSON.stringify(i))
  check('expanded: expander chip gone', !!i && i.expanderText === null)
  check('expanded: full 50 lines rendered', !!i && i.renderedCodeLines === 50, `rendered=${i && i.renderedCodeLines}`)
  check('expanded: fold button on toolbar', !!i && i.hasFoldBtn === true)
  const expandedKeys = await evaluate(`window.__veloxP24.getExpandedKeys()`)
  check('expanded: memory key recorded', Array.isArray(expandedKeys) && expandedKeys.length === 1, JSON.stringify(expandedKeys))

  // Fold back, then Copy on the collapsed block must yield the full code.
  const folded = await evaluate(`window.__veloxP24.clickFold()`)
  check('fold button dispatched', folded === true)
  await wait(400)
  i = await info()
  check('folded: collapsed again', !!i && i.hasCollapsedClass === true)
  const copied = await evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll('.cm-md-block-toolbar-btn'))
    const copy = btns.find((b) => b.textContent === 'Copy')
    if (!copy) return false
    copy.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return true
  })()`)
  check('copy button found on collapsed block', copied === true)
  await wait(300)
  const clip = await evaluate(`window.api.clipboardRead()`)
  const clipLines = typeof clip === 'string' ? clip.split('\n') : []
  check(
    'collapsed copy: FULL 50-line code on clipboard',
    clipLines.length === 50 && clipLines[0] === 'const v1 = 1' && clipLines[49] === 'const v50 = 50',
    `lines=${clipLines.length} head=${clipLines[0]} tail=${clipLines[clipLines.length - 1]}`
  )

  // ---- ② expand survives theme switch; edit re-decides -----------------------
  await evaluate(`window.__veloxP24.clickExpander()`)
  await wait(400)
  await setPrefs({ theme: 'dark' })
  await wait(500)
  i = await info()
  const keysAfterTheme = await evaluate(`window.__veloxP24.getExpandedKeys()`)
  check(
    'theme switch keeps expansion (hash memory)',
    !!i && i.hasCollapsedClass === false && keysAfterTheme.length === 1,
    JSON.stringify({ cls: i && i.hasCollapsedClass, keys: keysAfterTheme })
  )
  await setPrefs({ theme: 'light' })
  await wait(400)

  await loadDoc(DOC_EDIT, DOC_PATH) // content hash changes
  i = await info()
  check(
    'content edit re-decides → collapsed again',
    !!i && i.hasCollapsedClass === true && i.expanderText === '展开 30 行',
    JSON.stringify(i)
  )
  await loadDoc(DOC, DOC_PATH)

  // ---- ③ line numbers on/off -------------------------------------------------
  // Reset expand memory: re-loading the original DOC would otherwise keep the
  // content-hash key from step ② expanded.
  await evaluate(`window.__veloxP24.clearExpanded()`)
  await wait(400)
  await setPrefs({ codeBlockShowLineNumbers: true, codeBlockCollapseLines: 0 })
  i = await info()
  check(
    'line numbers on + never-collapse: 50 numbered lines',
    !!i && i.lineNoCount === 50 && i.expanderText === null && i.renderedCodeLines === 50,
    JSON.stringify(i)
  )
  const noFirstLast = await evaluate(`(() => {
    const nos = Array.from(document.querySelectorAll('.cm-md-code-line-no'))
    return nos.length ? { first: nos[0].textContent, last: nos[nos.length - 1].textContent } : null
  })()`)
  check(
    'line numbers read 1..50',
    !!noFirstLast && noFirstLast.first === '1' && noFirstLast.last === '50',
    JSON.stringify(noFirstLast)
  )
  await setPrefs({ codeBlockCollapseLines: 20 })
  i = await info()
  check(
    'numbers + collapse: numbered visible range only (20)',
    !!i && i.hasCollapsedClass === true && i.lineNoCount === 20,
    JSON.stringify(i)
  )
  await setPrefs({ codeBlockShowLineNumbers: false })
  i = await info()
  check('line numbers off: column gone', !!i && i.lineNoCount === 0, JSON.stringify(i))

  // ---- ④ wrap off/on ---------------------------------------------------------
  await loadDoc(DOC_WRAP, DOC_PATH)
  await setPrefs({ codeBlockWrap: false })
  i = await info()
  check('wrap off: wrap class absent', !!i && i.wrapCount === 0, JSON.stringify(i))
  const scrolls = await evaluate(`(() => {
    const pre = document.querySelector('.cm-md-code-block pre')
    if (!pre) return null
    return pre.scrollWidth > pre.clientWidth + 5
  })()`)
  check('wrap off: long line scrolls horizontally', scrolls === true, String(scrolls))
  await setPrefs({ codeBlockWrap: true })
  i = await info()
  check('wrap on: wrap class present', !!i && i.wrapCount === 1, JSON.stringify(i))

  // ---- ⑤ heightmap: click→cursor below the block, collapsed & expanded -------
  await evaluate(`window.__veloxP24.clearExpanded()`)
  await wait(200)
  await loadDoc(DOC, DOC_PATH)
  await evaluate(`window.__veloxP24.clearExpanded()`)
  await wait(400)
  const posBelow = () => evaluate(`(() => {
    const view = window.__veloxEditor.view
    const lines = Array.from(document.querySelectorAll('.cm-line'))
    const target = lines.find((el) => (el.textContent || '').includes('below-marker-para'))
    if (!target) return { ok: false, reason: 'no-line' }
    const r = target.getBoundingClientRect()
    const pos = view.posAtCoords({ x: r.left + 8, y: r.top + r.height / 2 })
    if (pos == null) return { ok: false, reason: 'no-pos' }
    return { ok: true, text: view.state.doc.lineAt(pos).text }
  })()`)
  i = await info()
  check('heightmap setup: collapsed', !!i && i.hasCollapsedClass === true)
  const belowCollapsed = await posBelow()
  check(
    'heightmap collapsed: click below → marker line',
    !!belowCollapsed && belowCollapsed.ok && belowCollapsed.text === 'below-marker-para',
    JSON.stringify(belowCollapsed)
  )
  await evaluate(`window.__veloxP24.clickExpander()`)
  await wait(400)
  i = await info()
  check('heightmap setup: expanded', !!i && i.hasCollapsedClass === false)
  const belowExpanded = await posBelow()
  check(
    'heightmap expanded: click below → marker line',
    !!belowExpanded && belowExpanded.ok && belowExpanded.text === 'below-marker-para',
    JSON.stringify(belowExpanded)
  )

  // ---- ⑥ threshold 0 never collapses -----------------------------------------
  await setPrefs({ codeBlockCollapseLines: 0 })
  i = await info()
  check(
    'threshold 0: no expander on a 50-line block',
    !!i && i.expanderText === null && i.hasCollapsedClass === false && i.renderedCodeLines === 50,
    JSON.stringify(i)
  )

  console.log(
    failures.length === 0
      ? '\nP24 e2e: ALL PASS'
      : `\nP24 e2e: ${failures.length} FAIL — ${failures.join(' | ')}`
  )
}

main()
  .catch((e) => {
    console.error('P24 e2e harness error:', e)
    process.exitCode = 1
  })
  .finally(() => {
    try {
      if (ws) ws.close()
    } catch {}
    try {
      if (app) app.kill('SIGKILL')
    } catch {}
    setTimeout(() => process.exit(process.exitCode ?? (failures.length ? 1 : 0)), 250)
  })
