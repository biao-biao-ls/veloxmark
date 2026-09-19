// CDP e2e test for P19 (paste HTML → Markdown). Port 9236.
//   npm run build && node scripts/cdp-p19.mjs
//
// Acceptance coverage (docs/requirements/P19-paste-html-to-md.md)
//   ① browser fragment (h1/bold/italic/link/nested lists) → structured MD,
//      no tag residue
//   ② HTML table → GFM (pipe rows, align delimiters, escaped pipes) and the
//      TableWidget renders (.cm-md-table-wrap)
//   ③ pasteHtmlToMd off → plain-text flavor inserted, no MD conversion
//   ④ Edit-menu Paste path (writeClipboardHtml + runMenuPaste) yields the
//      same output as the DOM paste of the same HTML
//   ⑤ script/style content never appears in the converted doc
//   ⑥ <img src="file://…"> imports via P05 (doc dir → relative src);
//      remote URL kept when downloadRemoteImages is off
//   ⑦ malformed HTML still yields clean text (no raw tag garbage)
import { existsSync, mkdirSync, appendFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9236
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))
const TMP = join(ROOT, 'scripts', 'tmp-p19')
mkdirSync(TMP, { recursive: true })

const PNG_RED =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
writeFileSync(join(TMP, 'local.png'), Buffer.from(PNG_RED, 'base64'))

const DOC_PATH = join(TMP, 'paste.md')
const IMG_PATH = join(TMP, 'img.md')

const BROWSER_HTML = [
  '<html><body><!--StartFragment-->',
  '<h1>Quarterly Report</h1>',
  '<p>Hello <strong>bold</strong> and <em>italic</em> and <del>gone</del> text</p>',
  '<p><a href="https://example.com/docs">site link</a></p>',
  '<ul><li>alpha</li><li>beta<ol><li>beta-1</li><li>beta-2</li></ol></li></ul>',
  '<!--EndFragment--></body></html>'
].join('')
const BROWSER_PLAIN =
  'Quarterly Report\nHello bold and italic and gone text\nsite link\n• alpha\n• beta\n1. beta-1\n2. beta-2'

const TABLE_HTML =
  '<table><thead><tr><th>Name</th><th align="right">Qty</th></tr></thead>' +
  '<tbody><tr><td>Ann</td><td>3</td></tr><tr><td>Bob|X</td><td>5</td></tr></tbody></table>'
const TABLE_PLAIN = 'Name\tQty\nAnn\t3\nBob|X\t5'

const SCRIPT_HTML =
  '<p>safe part</p><script>window.__pwned = true<' +
  '/script><style>body{color:red}</style><iframe src="evil"></iframe><p>after script</p>'

const IMG_LOCAL_HTML = `<p>see image:</p><p><img src="file://${TMP}/local.png" alt="local pic"></p>`
const IMG_REMOTE_HTML =
  '<p><img src="https://example.invalid/img/shot.png" alt="remote pic"></p>'

const MALFORMED_HTML = '<<<>>><p>still text</p><strong>open bold'
const SCRIPT_ONLY_HTML = '<script>alert(1)</script>'

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

  const getDoc = () => evaluate(`window.__veloxP19.getDoc()`)
  const docHas = (text) =>
    evaluate(`window.__veloxP19.getDoc().includes(${JSON.stringify(text)})`)
  const docLacks = (text) =>
    evaluate(`!window.__veloxP19.getDoc().includes(${JSON.stringify(text)})`)
  const transform = (html) => evaluate(`window.__veloxP19.transform(${JSON.stringify(html)})`)
  const pasteEvent = (html, plain) =>
    evaluate(
      `window.__veloxP19.pasteHtmlEvent(${JSON.stringify(html)}, ${JSON.stringify(plain)})`
    )
  const loadDoc = async (content, path) => {
    await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify(content)}, ${JSON.stringify(path)})`)
    await waitFor(`window.__veloxP12.getFilePath() === ${JSON.stringify(path)}`, 8000)
    await wait(200)
  }
  /** Paste HTML through the DOM ClipboardEvent path onto an empty doc; returns doc. */
  const pasteOnEmpty = async (html, plain) => {
    await loadDoc('', DOC_PATH)
    await pasteEvent(html, plain)
    await wait(400)
    return getDoc()
  }

  // ---- boot: prefs pin + reload ------------------------------------------------
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
      typingAssistsEnabled: true,
      wrapBareUrlOnPaste: true,
      pasteHtmlToMd: true,
      downloadRemoteImages: false,
      sourceMode: false
    }))
    const sess = JSON.parse(localStorage.getItem('veloxmark.session') || '{}')
    localStorage.setItem('veloxmark.session', JSON.stringify({
      ...sess,
      sidebarVisible: false,
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
  const hookReady = await waitFor(`typeof window.__veloxP19 === 'object' && window.__veloxP19 !== null`, 30000)
  await waitFor(`document.querySelector('.status-bar') !== null`)
  check('__veloxP19 hook ready', hookReady, String(await evaluate(`typeof window.__veloxP19`)))
  const prefsOk = await evaluate(`(() => {
    const p = window.__veloxPrefs.getPreferences()
    return p.pasteHtmlToMd === true && p.typingAssistsEnabled === true && p.downloadRemoteImages === false
  })()`)
  check('prefs pinned (pasteHtmlToMd on, remote download off)', prefsOk === true, JSON.stringify(await evaluate(`window.__veloxPrefs.getPreferences()`)))

  // ---- ① transform: browser fragment → structured MD, no tag residue -----------
  const tBrowser = await transform(BROWSER_HTML)
  check(
    'transform: h1 → # heading',
    typeof tBrowser === 'string' && tBrowser.includes('# Quarterly Report'),
    String(tBrowser)
  )
  check(
    'transform: strong/em/del → **/*/~~',
    tBrowser.includes('**bold**') && tBrowser.includes('*italic*') && tBrowser.includes('~~gone~~'),
    String(tBrowser)
  )
  check(
    'transform: anchor → [text](href)',
    tBrowser.includes('[site link](https://example.com/docs)'),
    String(tBrowser)
  )
  check(
    'transform: nested ol under ul indented',
    tBrowser.includes('- alpha') && tBrowser.includes('- beta') &&
      /\n {2,}1\. beta-1/.test(tBrowser) && /\n {2,}2\. beta-2/.test(tBrowser),
    String(tBrowser)
  )
  check(
    'transform: no tag residue',
    !/<[a-z!/]/i.test(tBrowser) && !tBrowser.includes('StartFragment'),
    String(tBrowser)
  )

  // DOM-event paste of the same fragment
  const browserDoc = await pasteOnEmpty(BROWSER_HTML, BROWSER_PLAIN)
  check(
    'DOM paste: doc holds converted MD structure',
    browserDoc.includes('# Quarterly Report') && browserDoc.includes('**bold**') &&
      browserDoc.includes('[site link](https://example.com/docs)') && browserDoc.includes('- alpha'),
    browserDoc
  )
  check(
    'DOM paste: no HTML tags in doc',
    !browserDoc.includes('<strong') && !browserDoc.includes('<h1') && !browserDoc.includes('</'),
    browserDoc
  )

  // ---- ② table → GFM + TableWidget --------------------------------------------
  const tTable = await transform(TABLE_HTML)
  check(
    'transform: table → GFM header + delimiter',
    typeof tTable === 'string' && /^\| Name\s+\| Qty\s+\|$/m.test(tTable) && /\| -+\s+\| -+:?\s+\|/.test(tTable),
    String(tTable)
  )
  check('transform: right-align delimiter kept', tTable.includes('---:'), String(tTable))
  check('transform: pipe in cell escaped', tTable.includes('Bob\\|X'), String(tTable))

  const tableDoc = await pasteOnEmpty(TABLE_HTML, TABLE_PLAIN)
  check('DOM paste table: GFM pipe rows in doc', tableDoc.includes('| Name') && tableDoc.includes('Ann'), tableDoc)
  // TableWidget hides raw source when the cursor touches the table range
  // (blockTouched, inclusive) — append outside content and park the cursor there.
  await evaluate(`(() => {
    const v = window.__veloxEditor.view
    const len = v.state.doc.length
    v.dispatch({ changes: { from: len, insert: '\\n\\noutside paragraph' } })
    v.dispatch({ selection: { anchor: v.state.doc.length } })
    return true
  })()`)
  await wait(300)
  const widgetOk = await waitFor(`document.querySelectorAll('.cm-md-table-wrap').length > 0`, 8000)
  check('DOM paste table: TableWidget rendered (cursor outside range)', widgetOk, String(await evaluate(`document.querySelectorAll('.cm-md-table-wrap').length`)))

  // ---- ③ pref off → plain text, no conversion ---------------------------------
  await evaluate(`window.__veloxP19.setPasteHtmlToMd(false)`)
  const prefOff = await waitFor(`window.__veloxPrefs.getPreferences().pasteHtmlToMd === false`, 8000)
  check('setPasteHtmlToMd(false) flips store', prefOff)
  await wait(400) // let the updateEditingAssists effect reconfigure the facet
  const plainDoc = await pasteOnEmpty(BROWSER_HTML, BROWSER_PLAIN)
  check(
    'pref off: DOM paste inserts plain flavor',
    plainDoc.includes('Quarterly Report') && plainDoc.includes('bold'),
    plainDoc
  )
  check(
    'pref off: no MD conversion applied',
    !plainDoc.includes('# Quarterly Report') && !plainDoc.includes('**bold**') && !plainDoc.includes('[site link]'),
    plainDoc
  )
  // Script-only HTML must not claim the paste even when pref is on again later —
  // also verify the fall-through with pref off: empty result + plain fallback.
  const fallbackDoc = await pasteOnEmpty(SCRIPT_ONLY_HTML, 'fallback plain')
  check(
    'script-only HTML falls through to plain text',
    fallbackDoc.includes('fallback plain') && !fallbackDoc.includes('alert'),
    fallbackDoc
  )
  await evaluate(`window.__veloxP19.setPasteHtmlToMd(true)`)
  const prefOn = await waitFor(`window.__veloxPrefs.getPreferences().pasteHtmlToMd === true`, 8000)
  check('setPasteHtmlToMd(true) restores pref', prefOn)
  await wait(400)

  // ---- ④ menu path (Edit>Paste) == DOM path -----------------------------------
  await evaluate(`window.__veloxP19.writeClipboardHtml(${JSON.stringify(TABLE_HTML)}, ${JSON.stringify(TABLE_PLAIN)})`)
  await loadDoc('', DOC_PATH)
  const menuChanged = await evaluate(`window.__veloxP19.pasteFromClipboard()`)
  await wait(400)
  const menuDoc = await getDoc()
  check('menu paste: clipboard HTML path claims the paste', menuChanged === true, String(menuChanged))
  check(
    'menu paste output == DOM paste output',
    menuDoc === tableDoc && menuDoc.includes('| Name') && menuDoc.includes('Bob\\|X'),
    `menu=${JSON.stringify(menuDoc)} dom=${JSON.stringify(tableDoc)}`
  )
  // Same converter unit on both paths
  const tAgain = await transform(TABLE_HTML)
  check('menu paste doc == transform(html) (modulo selection wrapper)', menuDoc.trim() === String(tAgain).trim(), `menu=${JSON.stringify(menuDoc)} t=${JSON.stringify(tAgain)}`)

  // ---- ⑤ script/style content absent ------------------------------------------
  const scriptDoc = await pasteOnEmpty(SCRIPT_HTML, SCRIPT_HTML)
  check(
    'script/style/iframe content dropped',
    scriptDoc.includes('safe part') && scriptDoc.includes('after script') &&
      !scriptDoc.includes('__pwned') && !scriptDoc.includes('color:red') && !scriptDoc.includes('iframe'),
    scriptDoc
  )
  const tScript = await transform(SCRIPT_HTML)
  check(
    'transform: script payload absent',
    tScript != null && !tScript.includes('__pwned') && !tScript.includes('alert') && !tScript.includes('color'),
    String(tScript)
  )

  // ---- ⑥ images: file:// imports via P05; remote URL kept when pref off -------
  await loadDoc('', IMG_PATH)
  await pasteEvent(IMG_LOCAL_HTML, 'see image')
  const localImgOk = await waitFor(`window.__veloxP19.getDoc().includes('(local.png)')`, 10000)
  const localImgDoc = await getDoc()
  check('file:// image rewritten to relative src (P05 import)', localImgOk && !localImgDoc.includes('file://'), localImgDoc)
  const imgWidget = await waitFor(`document.querySelectorAll('.cm-md-image').length > 0 || document.querySelectorAll('.cm-md-image-placeholder').length > 0`, 8000)
  check('local image widget rendered', imgWidget, String(await evaluate(`document.querySelectorAll('.cm-md-image').length`)))

  await loadDoc('', IMG_PATH)
  await pasteEvent(IMG_REMOTE_HTML, 'remote pic')
  await wait(600)
  const remoteDoc = await getDoc()
  check(
    'remote image URL kept when downloadRemoteImages off',
    remoteDoc.includes('![remote pic](https://example.invalid/img/shot.png)'),
    remoteDoc
  )
  const remoteWidget = await waitFor(`document.querySelectorAll('.cm-md-image-wrap').length > 0 || document.querySelectorAll('.cm-md-image-placeholder').length > 0 || document.querySelectorAll('.cm-md-image-broken').length > 0`, 8000)
  check('remote image placeholder/widget attempted', remoteWidget)

  // ---- ⑦ malformed HTML → clean text, no garbage ------------------------------
  const tMal = await transform(MALFORMED_HTML)
  check(
    'transform: malformed HTML still yields text',
    tMal != null && tMal.includes('still text') && tMal.includes('open bold'),
    String(tMal)
  )
  const malDoc = await pasteOnEmpty(MALFORMED_HTML, 'still text')
  check(
    'malformed paste: text present, no parsed-tag garbage',
    malDoc.includes('still text') && malDoc.includes('**open bold**') &&
      !malDoc.includes('<strong') && !malDoc.includes('</p>'),
    malDoc
  )

  console.log('')
  if (failures.length === 0) {
    console.log('P19 e2e: ALL PASS')
  } else {
    console.log(`P19 e2e: ${failures.length} FAILURES`)
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
