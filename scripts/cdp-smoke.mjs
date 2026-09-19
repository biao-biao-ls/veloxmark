// CDP smoke suite for P15 (`npm run test:smoke`).
// Runs against the *built* app (out/) with remote debugging enabled:
//   npm run build && node scripts/cdp-smoke.mjs
//
// Five core scenarios + screenshots into scripts/tmp-p15/:
//   1. welcome page renders (welcome md + status bar present)
//   2. typing an ATX heading produces live-preview decorations
//   3. theme toggle light ↔ dark flips the .app theme class
//   4. opening a fixture folder populates the file tree
//   5. source mode strips decorations; live mode restores them
import { existsSync, mkdirSync, appendFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9232
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))
const TMP = join(ROOT, 'scripts', 'tmp-p15')
const FIXTURE = join(TMP, 'fixture')

mkdirSync(TMP, { recursive: true })
mkdirSync(FIXTURE, { recursive: true })
writeFileSync(join(FIXTURE, 'a.md'), '# Fixture A\n\nalpha body\n')
writeFileSync(join(FIXTURE, 'b.md'), '# Fixture B\n\nbravo body\n')
writeFileSync(join(FIXTURE, 'notes.txt'), 'not markdown\n')

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
  const logPath = join(TMP, 'smoke-main.log')
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
  let evaluate
  let screenshot

  app = launch()
  const target = await getTarget(30000)
  ws = new WebSocket(target.webSocketDebuggerUrl)
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    } else if (msg.method === 'Inspector.targetCrashed') {
      for (const { reject } of pending.values()) reject(new Error('target crashed'))
      pending.clear()
    }
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
  const send = (method, params = {}) => {
    const msgId = ++id
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        pending.delete(msgId)
        reject(new Error(`CDP timeout: ${method}`))
      }, 30000)
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
      ws.send(JSON.stringify({ id: msgId, method, params }))
    })
  }
  evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
  screenshot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(TMP, name), Buffer.from(r.data, 'base64'))
    console.log(`      screenshot → scripts/tmp-p15/${name}`)
  }
  await send('Page.enable')
  await send('Runtime.enable')

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

  // ---- boot -----------------------------------------------------------------
  await waitFor(`typeof window.__veloxPrefs === 'object' && typeof window.__veloxP13 === 'object'`, 30000)
  await evaluate(`(async () => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') || '{}')
    localStorage.setItem('veloxmark.preferences', JSON.stringify({
      ...raw,
      language: 'en',
      theme: 'light',
      crashRecoveryEnabled: false,
      autoSaveMode: 'off',
      restoreLastSession: false,
      showStatusBar: true,
      sourceMode: false,
      focusMode: false,
      typewriterMode: false
    }))
    try {
      const drafts = await window.api.draftList()
      for (const d of drafts ?? []) await window.api.draftDiscard(d.path)
    } catch {}
    return true
  })()`)
  await evaluate(`location.reload()`)
  await wait(1500)
  await waitFor(`document.querySelector('.cm-content') !== null && window.__veloxEditor?.view`)

  // ---- 1. welcome page --------------------------------------------------------
  const welcomeText = await evaluate(`window.__veloxEditor.view.state.doc.toString()`)
  check('welcome: welcome markdown rendered', welcomeText.includes('Welcome to VeloxMark'), welcomeText.slice(0, 60))
  check('welcome: status bar present', (await evaluate(`document.querySelector('.status-bar') !== null`)) === true)
  await screenshot('smoke-01-welcome.png')

  // ---- 2. ATX heading decorations ---------------------------------------------
  await evaluate(`(() => {
    const view = window.__veloxEditor.view
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '# Smoke Title\\n\\nbody paragraph\\n' } })
    view.dispatch({ selection: { anchor: view.state.doc.length - 1 } })
    return true
  })()`)
  await wait(500)
  check(
    'heading: .cm-md-heading decoration appears',
    (await evaluate(`document.querySelectorAll('.cm-md-heading').length > 0`)) === true,
    await evaluate(`document.querySelector('.cm-content')?.textContent?.slice(0, 40) ?? ''`)
  )
  check(
    'heading: level class cm-md-h1 present',
    (await evaluate(`document.querySelectorAll('.cm-md-h1').length > 0`)) === true
  )
  await screenshot('smoke-02-heading.png')

  // ---- 3. theme toggle ---------------------------------------------------------
  check('theme: boots on light', (await evaluate(`!!document.querySelector('.app.theme-light')`)) === true)
  await evaluate(`window.__veloxPrefs.setPreferences({ theme: 'dark' })`)
  await waitFor(`document.querySelector('.app.theme-dark') !== null`)
  check('theme: dark class applied', (await evaluate(`!!document.querySelector('.app.theme-dark')`)) === true)
  await screenshot('smoke-03-dark.png')
  await evaluate(`window.__veloxPrefs.setPreferences({ theme: 'light' })`)
  await waitFor(`document.querySelector('.app.theme-light') !== null`)
  check('theme: back to light', (await evaluate(`!!document.querySelector('.app.theme-light')`)) === true)

  // ---- 4. open fixture folder → file tree ---------------------------------------
  await evaluate(`window.__veloxP13.openFolder(${JSON.stringify(FIXTURE)})`)
  const treeReady = await waitFor(
    `[...document.querySelectorAll('.filetree-item')].some((e) => e.textContent?.includes('a.md'))`
  )
  const treeNames = await evaluate(
    `[...document.querySelectorAll('.filetree-item')].map((e) => e.textContent?.trim()).filter(Boolean)`
  )
  check('folder: markdown files listed', treeReady === true, JSON.stringify(treeNames))
  // MD_EXT in electron/ipc/folder.ts intentionally includes .txt (notes are
  // first-class editable docs in this editor) — assert it IS listed.
  check(
    'folder: .txt notes listed alongside .md (MD_EXT口径)',
    treeNames.some((n) => n.includes('notes.txt')),
    JSON.stringify(treeNames)
  )
  await screenshot('smoke-04-filetree.png')

  // ---- 5. source mode roundtrip --------------------------------------------------
  await evaluate(`window.__veloxPrefs.setPreferences({ sourceMode: true })`)
  await wait(500)
  check(
    'source mode: live decorations gone',
    (await evaluate(`document.querySelectorAll('.cm-md-heading').length`)) === 0
  )
  const srcText = await evaluate(`document.querySelector('.cm-content')?.textContent ?? ''`)
  check('source mode: raw # marker visible', srcText.includes('# Smoke Title'), srcText.slice(0, 60))
  await screenshot('smoke-05-source.png')
  await evaluate(`window.__veloxPrefs.setPreferences({ sourceMode: false })`)
  await wait(500)
  check(
    'live mode: decorations restored',
    (await evaluate(`document.querySelectorAll('.cm-md-heading').length > 0`)) === true
  )

  console.log('')
  if (failures.length) {
    console.error(`P15 smoke: ${failures.length} FAILURE(S)`)
  } else {
    console.log('P15 smoke: ALL PASS (5 scenarios)')
  }
  process.exit(failures.length ? 1 : 0)
}

const cleanup = () => {
  try {
    if (ws && ws.readyState === 1) ws.close()
  } catch {}
  if (app) {
    try {
      app.kill('SIGKILL')
    } catch {}
    app = null
  }
}
process.on('exit', cleanup)

main()
  .catch((err) => {
    console.error('P15 smoke harness error:', err)
    process.exitCode = 1
  })
  .finally(() => {
    cleanup()
    process.exit(process.exitCode ?? 0)
  })
