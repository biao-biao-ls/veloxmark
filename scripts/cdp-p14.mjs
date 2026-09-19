// CDP e2e test for P14 (UI i18n + status bar).
// Runs against the *built* app (out/) with remote debugging enabled:
//   npm run build
//   node scripts/cdp-p14.mjs
//
// Coverage
//   i18n hooks     — __veloxP14.setLanguage zh↔en flips menus + welcome instantly
//   native menu    — userData/ui-language.json tracks the resolved language
//   word count     — 100 CJK chars + 50 western tokens = 150 words (Typora口径)
//   status bar     — line:col live, selection chars, stat readouts, lamps
//   prefs          — showStatusBar hides/shows the bar; native menu zh/en strings
import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9231
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))
const TMP = join(ROOT, 'scripts', 'tmp-p14')
const UI_LANG_FILE =
  process.platform === 'darwin'
    ? join(homedir(), 'Library', 'Application Support', 'VeloxMark', 'ui-language.json')
    : process.platform === 'win32'
      ? join(process.env.APPDATA || '', 'VeloxMark', 'ui-language.json')
      : join(homedir(), '.config', 'VeloxMark', 'ui-language.json')

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

  async function connect() {
    const target = await getTarget(30000)
    ws = new WebSocket(target.webSocketDebuggerUrl)
    const localPending = new Map()
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

  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  const menuLabels = () =>
    evaluate(`[...document.querySelectorAll('.menubar-label')].map((b) => b.textContent.trim())`)

  const getDoc = () =>
    evaluate(`window.__veloxEditor?.view?.state?.doc?.toString?.() ?? null`)

  const nativeLangFile = () => {
    try {
      return JSON.parse(readFileSync(UI_LANG_FILE, 'utf8'))
    } catch {
      return null
    }
  }

  // ---- boot -----------------------------------------------------------------
  app = launch()
  await connect()
  await waitFor(`typeof window.__veloxPrefs === 'object' && typeof window.__veloxP14 === 'object'`, 30000)

  // Pin deterministic English boot; wipe drafts so no recovery dialog covers the UI.
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
      sourceMode: false
    }))
    try {
      const drafts = await window.api.draftList()
      for (const d of drafts ?? []) await window.api.draftDiscard(d.path)
    } catch {}
    return true
  })()`)
  await evaluate(`location.reload()`)
  await wait(1500)
  await waitFor(`typeof window.__veloxP14 === 'object' && window.__veloxP14.getLang() === 'en'`, 30000)
  await waitFor(`document.querySelector('.status-bar') !== null`)

  // ---- boot state (English pin) ---------------------------------------------
  check('__veloxP14 hook exposed', (await evaluate(`typeof window.__veloxP14`)) === 'object')
  const bootLabels = await menuLabels()
  check(
    'boot menus are English',
    bootLabels.includes('File') && bootLabels.includes('Edit') && bootLabels.includes('View') && bootLabels.includes('Help'),
    JSON.stringify(bootLabels)
  )
  const bootDoc = await getDoc()
  check('welcome doc is English at boot', !!bootDoc && bootDoc.includes('Welcome to VeloxMark'), (bootDoc || '').slice(0, 60))

  // ---- language switch to zh -------------------------------------------------
  await evaluate(`window.__veloxP14.setLanguage('zh')`)
  await wait(400)
  const zhLabels = await menuLabels()
  check(
    'zh switch flips menu labels',
    zhLabels.includes('文件') && zhLabels.includes('编辑') && zhLabels.includes('视图') && zhLabels.includes('帮助'),
    JSON.stringify(zhLabels)
  )
  check('__veloxP14.getLang() === zh', (await evaluate(`window.__veloxP14.getLang()`)) === 'zh')
  const zhDoc = await getDoc()
  check('welcome doc swaps to Chinese', !!zhDoc && zhDoc.includes('欢迎使用 VeloxMark'), (zhDoc || '').slice(0, 60))
  check(
    't() resolves zh strings',
    (await evaluate(`window.__veloxP14.t('cmd.newFile')`)) === '新建' &&
      (await evaluate(`window.__veloxP14.t('menu.file')`)) === '文件'
  )
  await wait(200)
  const nativeZh = nativeLangFile()
  check(
    'native menu language file persisted zh',
    !!nativeZh && nativeZh.lang === 'zh',
    JSON.stringify(nativeZh) + ` (path ${UI_LANG_FILE})`
  )

  // ---- language switch back to en --------------------------------------------
  await evaluate(`window.__veloxP14.setLanguage('en')`)
  await wait(400)
  const enLabels = await menuLabels()
  check(
    'en switch restores English menus',
    enLabels.includes('File') && enLabels.includes('Edit') && enLabels.includes('View') && enLabels.includes('Help'),
    JSON.stringify(enLabels)
  )
  const enDoc = await getDoc()
  check('welcome doc swaps back to English', !!enDoc && enDoc.includes('Welcome to VeloxMark'), (enDoc || '').slice(0, 60))
  const nativeEn = nativeLangFile()
  check('native menu language file persisted en', !!nativeEn && nativeEn.lang === 'en', JSON.stringify(nativeEn))

  // ---- word count口径 (Typora-aligned: CJK char = 1 word, western tokens split) ----
  // 100 × 汉 + 50 western tokens => words = 150 exactly; chars = full length.
  const doc = '汉'.repeat(100) + ' ' + Array.from({ length: 50 }, (_, i) => `w${i + 1}`).join(' ')
  await evaluate(`window.__veloxP14.loadDoc(${JSON.stringify(doc)}, 'Count.md')`)
  await wait(700) // doc stats debounce is 300ms
  const stats = await evaluate(`window.__veloxP14.getStats()`)
  check('words = 150 (100 CJK + 50 western tokens)', stats?.words === 150, JSON.stringify(stats))
  check('chars = doc.length', stats?.chars === doc.length, `got ${stats?.chars} want ${doc.length}`)
  const statusBarText = await evaluate(`document.querySelector('.status-bar')?.textContent ?? ''`)
  check('status bar shows word count 150', statusBarText.includes('150'), statusBarText.slice(0, 120))

  // ---- cursor line:col is live ------------------------------------------------
  const setCursor = (pos) => evaluate(`(() => {
    const view = window.__veloxEditor?.view
    if (!view) return false
    view.dispatch({ selection: { anchor: ${pos} }, scrollIntoView: true })
    return true
  })()`)
  // doc is: 100 汉 + ' ' + w1..w50 joined by ' ' → position of first 'w' token char
  const w1Start = 101
  await setCursor(w1Start + 1) // inside "w1"
  await wait(200)
  let st = await evaluate(`window.__veloxP14.getStats()`)
  check('cursor line = 1', st?.line === 1, JSON.stringify(st))
  check('cursor col = 103 (1-based, inside w1)', st?.col === 103, JSON.stringify(st))
  const sbCursor = await evaluate(`document.querySelector('.sb-cursor')?.textContent ?? null`)
  // status.lineCol is the compact "{line}:{col}" form in both dictionaries.
  check('status bar shows cursor 1:103', sbCursor === '1:103', sbCursor)

  // ---- selection char count -----------------------------------------------------
  await evaluate(`(() => {
    const view = window.__veloxEditor?.view
    view.dispatch({ selection: { anchor: 0, head: 25 } })
    return true
  })()`)
  await wait(200)
  st = await evaluate(`window.__veloxP14.getStats()`)
  check('selection reports 25 chars', st?.selChars === 25, JSON.stringify(st))
  const sbSel = await evaluate(`document.querySelector('.sb-sel')?.textContent ?? null`)
  check('status bar shows selection readout', !!sbSel && sbSel.includes('25'), sbSel)

  // ---- mode lamps ----------------------------------------------------------------
  await evaluate(`window.__veloxPrefs.setPreferences({ focusMode: true, typewriterMode: true, sourceMode: true })`)
  await wait(300)
  const lamps = await evaluate(`[...document.querySelectorAll('.sb-lamp')].map((l) => l.textContent)`)
  check(
    'lamps show Focus/Typewriter/Source',
    lamps.includes('Focus') && lamps.includes('Typewriter') && lamps.includes('Source'),
    JSON.stringify(lamps)
  )
  await evaluate(`window.__veloxPrefs.setPreferences({ focusMode: false, typewriterMode: false, sourceMode: false })`)
  await wait(300)
  const lampsOff = await evaluate(`[...document.querySelectorAll('.sb-lamp')].length`)
  check('lamps hidden when all modes off', lampsOff === 0, `got ${lampsOff}`)

  // ---- status bar visibility preference ------------------------------------------
  await evaluate(`window.__veloxPrefs.setPreferences({ showStatusBar: false })`)
  await wait(300)
  check(
    'showStatusBar:false hides the bar',
    (await evaluate(`document.querySelector('.status-bar') === null`)) === true
  )
  await evaluate(`window.__veloxPrefs.setPreferences({ showStatusBar: true })`)
  await wait(300)
  check(
    'showStatusBar:true shows the bar again',
    (await evaluate(`document.querySelector('.status-bar') !== null`)) === true
  )

  // ---- dialogs follow the language too --------------------------------------------
  await evaluate(`window.__veloxP14.setLanguage('zh')`)
  await wait(200)
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true }))`)
  await waitFor(`document.querySelector('.prefs-dialog') !== null`)
  const prefsTitleZh = await evaluate(`document.querySelector('.prefs-dialog .dialog-title')?.textContent ?? null`)
  check('preferences dialog title is Chinese', prefsTitleZh === '偏好设置', prefsTitleZh)
  const langLabelZh = await evaluate(`(() => {
    const labels = [...document.querySelectorAll('.prefs-dialog .prefs-label')].map((l) => l.textContent)
    return labels
  })()`)
  check('preferences Language label is Chinese', langLabelZh.includes('语言'), JSON.stringify(langLabelZh.slice(0, 8)))
  // Close the dialog with the Chinese button
  await evaluate(`(() => {
    const btns = [...document.querySelectorAll('.prefs-dialog .dialog-btn')]
    const b = btns.find((x) => x.textContent.trim() === '关闭')
    if (!b) return false
    b.click()
    return true
  })()`)
  await wait(300)
  check('preferences dialog closed via 关闭', (await evaluate(`document.querySelector('.prefs-dialog') === null`)) === true)
  await evaluate(`window.__veloxP14.setLanguage('en')`)
  await wait(200)

  // ---- autosave labels (P12 interplay; both surfaces follow the language) ----------
  await evaluate(`window.__veloxP14.setLanguage('zh')`)
  await wait(200)
  await evaluate(`window.__veloxPrefs.setPreferences({ autoSaveMode: 'debounce', autoSaveDelaySec: 1 })`)
  await evaluate(`(() => {
    const view = window.__veloxEditor.view
    const len = view.state.doc.length
    view.dispatch({ changes: { from: len, insert: '\\nautosave tick' } })
    return true
  })()`)
  const autosaveShown = await waitFor(`document.querySelector('.sb-autosave') !== null`, 10000)
  check('debounce autosave fills the status-bar slot', autosaveShown === true)
  const sbAutosaveText = await evaluate(`document.querySelector('.sb-autosave')?.textContent ?? ''`)
  check('status bar autosave label is Chinese', sbAutosaveText.includes('已保存'), sbAutosaveText)
  const tbAutosaveText = await evaluate(`document.querySelector('.tb-autosave')?.textContent ?? ''`)
  check('titlebar autosave label is Chinese', tbAutosaveText.includes('已自动保存'), tbAutosaveText)
  await evaluate(`window.__veloxPrefs.setPreferences({ autoSaveMode: 'off' })`)

  console.log('')
  if (failures.length) {
    console.error(`P14 e2e: ${failures.length} FAILURE(S)`)
  } else {
    console.log('P14 e2e: ALL PASS')
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
process.on('SIGINT', () => process.exit(130))
process.on('SIGTERM', () => process.exit(143))

main()
  .catch((err) => {
    console.error('P14 e2e harness error:', err)
    process.exitCode = 1
  })
  .finally(cleanup)
