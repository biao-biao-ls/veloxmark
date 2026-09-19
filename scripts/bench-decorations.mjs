// P15 benchmark: buildDecorations rebuild timing on synthetic documents.
// Runs against the *built* app via CDP — the exact bundle the editor uses.
//   npm run build
//   node scripts/bench-decorations.mjs
//
// For each doc size (1k/5k/10k lines, with 10/20/40 $$-formulas), types 100
// single-character inserts on a trailing scratch line and times one
// buildDecorations call per insert. Prints avg/p95/max per scenario; the
// P15-benchmarks.md doc records these numbers.
import { existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9244
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))
const TMP = join(ROOT, 'scripts', 'tmp-p15')
mkdirSync(TMP, { recursive: true })

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
  const logPath = join(TMP, 'bench-main.log')
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

async function main() {
  if (!ELECTRON_BIN) throw new Error('electron binary not found under node_modules/electron/dist')

  let id = 0
  let evaluate
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
      }, 120000)
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
  await send('Page.enable')
  await send('Runtime.enable')

  // Wait for hooks + pin a light deterministic profile.
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    try {
      if ((await evaluate(`typeof window.__veloxP15?.bench`)) === 'function') break
    } catch {}
    await new Promise((r) => setTimeout(r, 300))
  }
  await evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') || '{}')
    localStorage.setItem('veloxmark.preferences', JSON.stringify({
      ...raw, language: 'en', crashRecoveryEnabled: false,
      autoSaveMode: 'off', restoreLastSession: false
    }))
    return true
  })()`)

  const scenarios = [
    { lines: 1000, formulas: 10 },
    { lines: 5000, formulas: 20 },
    { lines: 10000, formulas: 40 }
  ]
  const results = []
  for (const s of scenarios) {
    process.stdout.write(`bench ${s.lines} lines / ${s.formulas} formulas … `)
    const r = await evaluate(`window.__veloxP15.bench(${s.lines}, ${s.formulas}, 100)`)
    results.push(r)
    console.log(`avg ${r.avg.toFixed(2)}ms  p95 ${r.p95.toFixed(2)}ms  max ${r.max.toFixed(2)}ms`)
  }

  console.log('\n---- bench summary (JSON) ----')
  console.log(JSON.stringify(results, null, 2))
  const gate = results.find((r) => r.lines === 5000)
  if (gate) {
    const ok = gate.p95 < 16
    console.log(
      `\nacceptance gate: 5k lines / 20 formulas p95 ${gate.p95.toFixed(2)}ms ${ok ? '<' : '>='} 16ms → ${ok ? 'PASS' : 'FAIL'}`
    )
    if (!ok) process.exitCode = 1
  }
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
    console.error('bench harness error:', err)
    process.exitCode = 1
  })
  .finally(() => {
    cleanup()
    process.exit(process.exitCode ?? 0)
  })
