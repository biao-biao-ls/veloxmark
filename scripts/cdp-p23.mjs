// CDP e2e test for P23 (文档格式化). Port 9240.
//   npm run build && node scripts/cdp-p23.mjs
//
// Acceptance coverage (docs/requirements/P23-format-document.md)
//   ① dirty fixture → every v1 rule asserted on the output; Ctrl+Z one step
//   ② fence-internal dirty table + trailing spaces preserved
//   ③ ordered 3/7/1 → 1/2/3; nested lists numbered independently
//   ④ hard break exactly-2 kept, 3+ compressed to 2
//   ⑤ format-on-save: on → Ctrl+S disk content formatted; off → raw write
//   ⑥ unclosed fence: other rules apply + warning toast
// Plus: silent on clean doc; Shift+Alt+F global shortcut fires the command.
import { existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9240
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))
const TMP = join(ROOT, 'scripts', 'tmp-p23')
mkdirSync(TMP, { recursive: true })

const DOC_PATH = join(TMP, 'dirty.md')
const DOC_ONSAVE = join(TMP, 'onsave.md')

// NOTE: trailing spaces are significant in this fixture (hard-break rules).
const DIRTY_LINES = [
  '#标题',
  '前段文本   ', // 3 spaces → compressed to 2
  '* a',
  '+ b',
  '3. 三',
  '7. 七',
  '1. 一',
  '',
  '1. 外层',
  '   9. 内层一',
  '   3. 内层二',
  '2. 外层二',
  '>引用行',
  '|名称|数量|',
  '|---|---:|',
  '|苹果|3|',
  '正文段落',
  '```md',
  '|脏|表|',
  '|a|b|',
  '|1|2|   ',
  'fence 内容 *   ',
  '```',
  '硬换行行  ', // exactly 2 → kept
  '三空格行   ', // 3 → 2
  '#最终标题',
  ''
]
const DIRTY = DIRTY_LINES.join('\n')

const UNCLOSED = ['#标题A', '', '```', '* x', '正文   ', ''].join('\n')

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
  await waitFor(`typeof window.__veloxPrefs === 'object' && typeof window.__veloxEditor === 'object'`, 30000)
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
      formatOnSave: false
    }))
    const sess = JSON.parse(localStorage.getItem('veloxmark.session') || '{}')
    localStorage.setItem('veloxmark.session', JSON.stringify({ ...sess, sidebarVisible: false }))
    try {
      const drafts = await window.api.draftList()
      for (const d of drafts ?? []) await window.api.draftDiscard(d.path)
    } catch {}
    return true
  })()`)
  await evaluate(`location.reload()`)
  await wait(1500)
  const hookReady = await waitFor(`typeof window.__veloxP23 === 'object' && window.__veloxP23 !== null`, 30000)
  await waitFor(`document.querySelector('.status-bar') !== null`)
  check('__veloxP23 hook ready', hookReady, String(await evaluate(`typeof window.__veloxP23`)))

  // ---- ①②③④ dirty document → format -----------------------------------------
  await evaluate(`window.__veloxP23.loadDoc(${JSON.stringify(DIRTY)}, ${JSON.stringify(DOC_PATH)})`)
  await wait(400)
  const beforeDoc = await evaluate(`window.__veloxP23.getDoc()`)
  const fmtResult = await evaluate(`window.__veloxP23.format()`)
  await wait(300)
  const afterDoc = await evaluate(`window.__veloxP23.getDoc()`)
  const toast1 = await evaluate(`window.__veloxP23.getToast()`)
  check(
    '① format produced changes + toast 已格式化 N 处',
    afterDoc !== beforeDoc && fmtResult.changed > 0 && /已格式化 \d+ 处/.test(toast1 || ''),
    JSON.stringify({ changed: fmtResult.changed, toast: toast1 })
  )

  const ruleChecks = await evaluate(`(() => {
    const doc = window.__veloxP23.getDoc()
    const lines = doc.split('\\n')
    return {
      atxSpace: doc.includes('# 标题') && !doc.includes('#标题'),
      atxFinal: doc.includes('# 最终标题'),
      ulUnified: lines.includes('- a') && lines.includes('- b'),
      hrGone: !lines.includes('* a') && !lines.includes('+ b'),
      ordRenumber: lines.includes('1. 三') && lines.includes('2. 七') && lines.includes('3. 一'),
      nested: lines.includes('4. 外层') && lines.includes('   1. 内层一') && lines.includes('   2. 内层二') && lines.includes('5. 外层二'),
      quoteSpaced: lines.includes('> 引用行'),
      tableRebuilt: /\\|\\s*名称\\s*\\|\\s*数量\\s*\\|/.test(doc) && doc.includes('---:') && /\\|\\s*苹果\\s*\\|\\s*3\\s*\\|/.test(doc),
      hardBreak2: lines.includes('硬换行行  '),
      hardBreak3to2: lines.includes('三空格行  ') && !lines.includes('三空格行   '),
      blankBeforeHeading: doc.includes('三空格行  \\n\\n# 最终标题'),
      fenceDirtyTable: lines.includes('|脏|表|') && lines.includes('|a|b|') && lines.includes('|1|2|   '),
      fenceBodyUntouched: lines.includes('fence 内容 *   '),
      fenceLang: lines.includes('\`\`\`md'),
      eofSingleNl: doc.endsWith('\\n') && !doc.endsWith('\\n\\n')
    }
  })()`)
  const failedRules = Object.entries(ruleChecks).filter(([, v]) => !v).map(([k]) => k)
  check('①②③④ all v1 rules applied on output', failedRules.length === 0, JSON.stringify(ruleChecks))
  check(
    '② fence-internal dirty table + trailing spaces preserved',
    ruleChecks.fenceDirtyTable && ruleChecks.fenceBodyUntouched,
    JSON.stringify(ruleChecks)
  )
  check('③ ordered renumber + nested independent', ruleChecks.ordRenumber && ruleChecks.nested)
  check(
    '④ hard break: exactly-2 kept, 3+ compressed to 2',
    ruleChecks.hardBreak2 && ruleChecks.hardBreak3to2,
    JSON.stringify(ruleChecks)
  )

  // ---- ① undo one step back ---------------------------------------------------
  const undoOk = await evaluate(`window.__veloxP23.undo()`)
  await wait(300)
  const undoneDoc = await evaluate(`window.__veloxP23.getDoc()`)
  check('① single Ctrl+Z restores original doc', undoOk === true && undoneDoc === beforeDoc, `undo=${undoOk} same=${undoneDoc === beforeDoc}`)

  // ---- silent on clean document ----------------------------------------------
  const CLEAN = ['干净标题', '', '段落内容。', ''].join('\n')
  await evaluate(`window.__veloxP23.loadDoc(${JSON.stringify(CLEAN)}, null)`)
  await wait(2800) // toast auto-clears after 2500ms
  const toastBefore = await evaluate(`window.__veloxP23.getToast()`)
  const cleanRes = await evaluate(`window.__veloxP23.format()`)
  await wait(200)
  const toastAfter = await evaluate(`window.__veloxP23.getToast()`)
  const cleanDoc = await evaluate(`window.__veloxP23.getDoc()`)
  check(
    'clean doc: format silent, content unchanged',
    cleanRes.changed === 0 && toastAfter === toastBefore && cleanDoc === CLEAN,
    JSON.stringify({ changed: cleanRes.changed, toastBefore, toastAfter, cleanDoc })
  )

  // ---- Shift+Alt+F global shortcut -------------------------------------------
  await evaluate(`window.__veloxP23.loadDoc(${JSON.stringify(DIRTY)}, null)`)
  await wait(400)
  const preKb = await evaluate(`window.__veloxP23.getDoc()`)
  await evaluate(`(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'F', code: 'KeyF', altKey: true, shiftKey: true, bubbles: true, cancelable: true
    }))
    return true
  })()`)
  await wait(300)
  const postKb = await evaluate(`window.__veloxP23.getDoc()`)
  check(
    'Shift+Alt+F triggers formatDocument',
    postKb !== preKb && postKb.includes('# 标题') && postKb.includes('- a'),
    postKb.slice(0, 80)
  )

  // ---- ⑥ unclosed fence: rules apply + warning toast -------------------------
  await evaluate(`window.__veloxP23.loadDoc(${JSON.stringify(UNCLOSED)}, null)`)
  await wait(300)
  const unclosedRes = await evaluate(`window.__veloxP23.format()`)
  await wait(300)
  const unclosedDoc = await evaluate(`window.__veloxP23.getDoc()`)
  const unclosedToast = await evaluate(`window.__veloxP23.getToast()`)
  check(
    '⑥ unclosed fence: warnings reported + other rules still applied',
    unclosedRes.warnings.length >= 0 &&
      String(unclosedRes.warnings[0] || '').includes('unclosed') &&
      unclosedDoc.includes('# 标题A') &&
      unclosedDoc.includes('* x') && // fence body untouched
      /警告/.test(unclosedToast || ''),
    JSON.stringify({ warnings: unclosedRes.warnings, toast: unclosedToast, doc: unclosedDoc })
  )

  // ---- ⑤ format-on-save -------------------------------------------------------
  await evaluate(`window.__veloxP23.setFormatOnSave(true)`)
  const prefOn = await evaluate(`window.__veloxP23.getFormatOnSave()`)
  check('⑤ formatOnSave pref on', prefOn === true)
  await evaluate(`window.__veloxP23.loadDoc(${JSON.stringify(DIRTY)}, ${JSON.stringify(DOC_ONSAVE)})`)
  await wait(400)
  const saved1 = await evaluate(`(async () => {
    const ok = await window.__veloxP23.saveFile()
    const disk = await window.api.readFile(${JSON.stringify(DOC_ONSAVE)})
    return { ok, disk }
  })()`)
  check(
    '⑤ format-on-save ON: Ctrl+S writes formatted content to disk',
    saved1.ok === true && saved1.disk.includes('# 标题') && saved1.disk.includes('- a') && saved1.disk.includes('1. 三'),
    String(saved1.disk).slice(0, 120)
  )

  await evaluate(`window.__veloxP23.setFormatOnSave(false)`)
  const DIRTY2 = '#新脏标题\\n* 未格式化项\\n'
  await evaluate(`window.__veloxP23.loadDoc(${JSON.stringify(DIRTY2)}, ${JSON.stringify(DOC_ONSAVE)})`)
  await wait(400)
  const saved2 = await evaluate(`(async () => {
    const ok = await window.__veloxP23.saveFile()
    const disk = await window.api.readFile(${JSON.stringify(DOC_ONSAVE)})
    return { ok, disk }
  })()`)
  check(
    '⑤ format-on-save OFF: save writes raw content unchanged',
    saved2.ok === true && saved2.disk.includes('#新脏标题') && saved2.disk.includes('* 未格式化项'),
    String(saved2.disk)
  )

  // ---- summary ----------------------------------------------------------------
  console.log('----------------------------------------')
  if (failures.length === 0) {
    console.log('ALL PASS')
  } else {
    console.log(`FAILURES: ${failures.length}`)
    for (const f of failures) console.log(' -', f)
  }

  try {
    if (ws) ws.close()
  } catch {}
  try {
    if (app) app.kill('SIGKILL')
  } catch {}
  process.exit(failures.length === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('FATAL', err)
  try {
    if (ws) ws.close()
  } catch {}
  try {
    if (app) app.kill('SIGKILL')
  } catch {}
  process.exit(1)
})
