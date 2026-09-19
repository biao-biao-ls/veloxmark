// CDP e2e test for P20 (Copy as Rich Text). Port 9237.
//   npm run build && node scripts/cdp-p20.mjs
//
// Acceptance coverage (docs/requirements/P20-copy-rich-text.md)
//   ① selection (heading/bold/list/table) → html flavor carries inline
//      styles (strong font-weight, h1 size, table borders, theme colors)
//   ② plain flavor == the Markdown source that was rendered
//   ③ dark theme copy uses dark tokens (#1e1e1e / #58a6ff)
//   ④ full-doc path embeds local images as data URLs
//   ⑤ command feedback chip appears (status-bar toast) via Ctrl+Shift+C
//   ⑥ Copy as HTML writes classes + <style> block, not per-tag inlines
//   ⑦ Export Selection as HTML writes a standalone .html through P04 IPC
import { existsSync, mkdirSync, appendFileSync, writeFileSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9237
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))
const TMP = join(ROOT, 'scripts', 'tmp-p20')
mkdirSync(TMP, { recursive: true })

const PNG_RED =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
writeFileSync(join(TMP, 'local.png'), Buffer.from(PNG_RED, 'base64'))

const DOC_PATH = join(TMP, 'rich.md')
const SEL_HTML_PATH = join(TMP, 'selection-out.html')

const DOC = [
  '# Title P20',
  '',
  'Some **bold** text and *italic* here.',
  '',
  '- item one',
  '- item two',
  '',
  '| Name | Qty |',
  '| --- | --- |',
  '| Ann | 3 |',
  '| Bob | 5 |',
  '',
  '![pic](local.png)',
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

  const getClipboard = () => evaluate(`window.__veloxP20.getClipboard()`)
  const setSelection = (from, to) =>
    evaluate(`window.__veloxEditor.view.dispatch({ selection: { anchor: ${from}, head: ${to} } })`)
  const docLength = () => evaluate(`window.__veloxEditor.view.state.doc.length`)
  const sliceDoc = (from, to) =>
    evaluate(`window.__veloxEditor.view.state.sliceDoc(${from}, ${to})`)
  /** Fire the bindGlobal shortcut — exercises the same path as the Edit menu. */
  const pressCopyRich = () =>
    evaluate(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'C', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true
      }))
      return true
    })()`)

  // ---- boot -------------------------------------------------------------------
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
      theme: 'light'
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
  const hookReady = await waitFor(`typeof window.__veloxP20 === 'object' && window.__veloxP20 !== null`, 30000)
  await waitFor(`document.querySelector('.status-bar') !== null`)
  check('__veloxP20 hook ready', hookReady, String(await evaluate(`typeof window.__veloxP20`)))

  await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify(DOC)}, ${JSON.stringify(DOC_PATH)})`)
  const loaded = await waitFor(`window.__veloxP12.getFilePath() === ${JSON.stringify(DOC_PATH)}`, 8000)
  check('fixture doc loaded', loaded)

  // ---- ① + ② selection copy: inline styles + markdown plain flavor ------------
  // Selection covers heading → table end (image below stays unselected).
  const tableEnd = DOC.indexOf('![pic]')
  await setSelection(0, tableEnd)
  const expectedSel = await sliceDoc(0, tableEnd)
  await pressCopyRich()
  await wait(500)
  const clip1 = await getClipboard()
  const html1 = clip1?.html ?? ''
  const text1 = clip1?.text ?? ''
  check('html flavor written', html1.includes('<div style="background:'), html1.slice(0, 120))
  check('h1 carries inline heading style', html1.includes('<h1 style="') && html1.includes('font-size:2em'), html1.slice(0, 200))
  check('strong carries inline bold style', html1.includes('<strong style="') && html1.includes('font-weight:700'), '')
  check('table cells carry inline borders', html1.includes('border:1px solid #e5e5e5') && html1.includes('<th style="'), '')
  check('list items rendered as ul/li (no raw markdown dashes)', html1.includes('<ul style="') && html1.includes('item one') && !html1.includes('- item one'), '')
  check('plain flavor == rendered Markdown source', text1 === expectedSel, `len=${text1.length} expected=${expectedSel.length}`)
  check('plain flavor holds Markdown, html flavor no tags leaked into text', text1.includes('**bold**') && !html1.includes('**bold**'), '')

  // ---- ⑤ feedback chip via the real shortcut path ------------------------------
  const toastText = await evaluate(`window.__veloxP20.getToast()`)
  check('toast feedback after Ctrl+Shift+C', toastText === 'Rich text copied', String(toastText))
  const toastDom = await waitFor(`(document.querySelector('.sb-toast')?.textContent || '') === 'Rich text copied'`, 5000)
  check('status-bar chip renders toast text', toastDom, String(await evaluate(`document.querySelector('.sb-toast')?.textContent ?? null`)))

  // ---- ③ dark theme tokens ----------------------------------------------------
  await evaluate(`window.__veloxP20.setThemePref('dark')`)
  const darkApplied = await waitFor(`document.querySelector('.app.theme-dark') !== null || (document.documentElement.classList.contains('theme-dark') || !!document.querySelector('.theme-dark'))`, 8000)
  check('theme flipped to dark in UI', darkApplied, String(await evaluate(`document.querySelector('.app')?.className ?? ''`)))
  await wait(300)
  await evaluate(`window.__veloxP20.copyRichText()`)
  await wait(400)
  const clipDark = await getClipboard()
  const htmlDark = clipDark?.html ?? ''
  check(
    'dark copy uses dark tokens',
    htmlDark.includes('#1e1e1e') && (htmlDark.includes('#58a6ff') || htmlDark.includes('#d4d4d4')),
    htmlDark.slice(0, 200)
  )
  check('dark copy no longer uses light bg', !htmlDark.includes('background:#ffffff'), '')
  // back to light
  await evaluate(`window.__veloxP20.setThemePref('light')`)
  await waitFor(`!document.querySelector('.app.theme-dark')`, 8000)
  await wait(300)

  // ---- ④ full doc path embeds local image as data URL -------------------------
  const fullLen = await docLength()
  await setSelection(fullLen, fullLen) // empty selection → whole doc
  await evaluate(`window.__veloxP20.copyRichText()`)
  await wait(600)
  const clipFull = await getClipboard()
  const htmlFull = clipFull?.html ?? ''
  check('full-doc copy text == whole document', clipFull?.text === DOC, `len=${clipFull?.text?.length} doc=${DOC.length}`)
  check('local image embedded as data URL', htmlFull.includes('data:image/png;base64,'), htmlFull.includes('![pic]') ? 'raw markdown leaked' : htmlFull.slice(0, 160))

  // ---- ⑥ Copy as HTML: classes + <style>, not inline tag styles ---------------
  await setSelection(0, tableEnd)
  await evaluate(`window.__veloxP20.copyAsHtml()`)
  await wait(400)
  const clipHtmlOnly = await getClipboard()
  const html6 = clipHtmlOnly?.html ?? ''
  check('copyAsHtml ships export classes + stylesheet', html6.includes('<article class="export-doc') && html6.includes('.export-doc h1'), html6.slice(0, 160))
  check('copyAsHtml does not inline tag styles', !html6.includes('<strong style="'), '')
  check('copyAsHtml plain flavor still Markdown source', clipHtmlOnly?.text === expectedSel, '')

  // ---- ⑦ Export Selection as HTML → standalone file ---------------------------
  if (existsSync(SEL_HTML_PATH)) {
    try { await import('node:fs').then((fs) => fs.promises.unlink(SEL_HTML_PATH)) } catch {}
  }
  const exported = await evaluate(`window.__veloxP20.exportSelectionTo(${JSON.stringify(SEL_HTML_PATH)})`)
  await wait(400)
  check('exportSelectionTo IPC write returned true', exported === true, String(exported))
  const fileOk = existsSync(SEL_HTML_PATH)
  let fileHtml = ''
  if (fileOk) fileHtml = readFileSync(SEL_HTML_PATH, 'utf8')
  check(
    'selection HTML file on disk with export shell',
    fileOk && fileHtml.includes('<!DOCTYPE html>') && fileHtml.includes('export-doc') && fileHtml.includes('bold'),
    fileOk ? fileHtml.slice(0, 120) : 'missing file'
  )

  console.log('')
  if (failures.length === 0) {
    console.log('P20 e2e: ALL PASS')
  } else {
    console.log(`P20 e2e: ${failures.length} FAILURES`)
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
