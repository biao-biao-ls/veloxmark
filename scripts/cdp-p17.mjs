// CDP e2e test for P17 (Link navigation). Port 9234.
//   npm run build && node scripts/cdp-p17.mjs
//
// Acceptance coverage (docs/requirements/P17-link-navigation.md)
//   ① modifier-click relative .md  → opens target (dirty gate intact)
//   ② #anchor in-doc jump; path.md#anchor open + scroll
//   ③ plain click = cursor only
//   ④ deleted target → cm-md-link-broken + hover tip; restore → cleared
//   ⑤ http(s) confirm dialog → seam-captured openExternal; pref off = direct;
//      cancel aborts; mailto: tips only (never opens)
import { existsSync, mkdirSync, appendFileSync, writeFileSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9234
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))
const TMP = join(ROOT, 'scripts', 'tmp-p17')
mkdirSync(TMP, { recursive: true })

// Distinctive visible labels — P09 hides the URL half of a rendered link, so
// e2e must hit spans by their label text, not by href.
const A_MD = [
  '# Doc A',
  '',
  '[goB](./b.md)',
  '',
  '[jump安装](#安装步骤)',
  '',
  '[bcfg跳转](./b.md#配置)',
  '',
  '[extSite](https://example.com)',
  '',
  '[mailMe](mailto:x@example.com)',
  '',
  '## 安装步骤',
  '',
  'body text',
  ''
].join('\n')
const B_MD = ['# Doc B', '', '## 配置', '', 'config body', ''].join('\n')
const A_PATH = join(TMP, 'a.md')
const B_PATH = join(TMP, 'b.md')

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

  writeFileSync(A_PATH, A_MD)
  writeFileSync(B_PATH, B_MD)

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

  /** Dispatch mousedown on the rendered link span whose text contains label. */
  const clickLink = (label, opts = {}) => {
    const metaKey = opts.metaKey ?? true
    const ctrlKey = opts.ctrlKey ?? true
    return evaluate(`(() => {
      const spans = [...document.querySelectorAll('span.cm-md-link')]
      const span = spans.find((s) => (s.textContent || '').includes(${JSON.stringify(label)}))
      if (!span) return 'no-span:' + spans.map((s) => s.textContent).join('|')
      const r = span.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return 'zero-rect:' + span.textContent
      span.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true, cancelable: true,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
        metaKey: ${metaKey}, ctrlKey: ${ctrlKey}
      }))
      return true
    })()`)
  }

  const hoverLink = (label) =>
    evaluate(`(() => {
      const spans = [...document.querySelectorAll('span.cm-md-link')]
      const span = spans.find((s) => (s.textContent || '').includes(${JSON.stringify(label)}))
      if (!span) return 'no-span'
      const r = span.getBoundingClientRect()
      span.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2
      }))
      return true
    })()`)

  const clickDialogBtn = (label) =>
    evaluate(`(() => {
      const btns = [...document.querySelectorAll('.dialog .dialog-btn')]
      const b = btns.find((x) => (x.textContent || '').trim() === ${JSON.stringify(label)})
      if (!b) return 'no-btn:' + btns.map((x) => x.textContent.trim()).join('|')
      b.click()
      return true
    })()`)

  const dialogMessage = () => evaluate(`document.querySelector('.dialog-message')?.textContent ?? ''`)

  const openA = async () => {
    await evaluate(`window.__veloxP13.openAt(${JSON.stringify(A_PATH)}, 1, 0)`)
    const ok = await waitFor(
      `window.__veloxP13.getFilePath() === ${JSON.stringify(A_PATH)}`,
      8000
    )
    check('opened a.md', ok, String(await evaluate(`window.__veloxP13.getFilePath()`)))
  }

  const revalidate = async () => {
    await evaluate(`window.__veloxP17.revalidate()`)
    await wait(300)
  }

  // ---- boot: English pin + draft wipe + reload -------------------------------
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
    try {
      const drafts = await window.api.draftList()
      for (const d of drafts ?? []) await window.api.draftDiscard(d.path)
    } catch {}
    return true
  })()`)
  await evaluate(`location.reload()`)
  await wait(1500)
  await waitFor(`typeof window.__veloxP17 === 'object' && window.__veloxP17 !== null`, 30000)
  await waitFor(`document.querySelector('.status-bar') !== null`)
  check('__veloxP17 hook ready', (await evaluate(`typeof window.__veloxP17`)) === 'object')

  // openExternal capture seam — NEVER call the real shell open.
  // Capture lives on a standalone global: App re-renders re-assign
  // window.__veloxP17 itself (useEffect rebuild), wiping hook-attached state.
  await evaluate(`(() => {
    window.__veloxP17Capture = []
    window.__veloxP17.setOpenExternalImpl(async (url) => {
      window.__veloxP17Capture.push(url)
      return true
    })
    return true
  })()`)

  // ---- open workspace + document ---------------------------------------------
  console.log('\n--- open folder workspace + a.md ---')
  await evaluate(`window.__veloxP13.openFolder(${JSON.stringify(TMP)})`)
  await wait(600)
  await openA()
  await revalidate()
  const brokenAtStart = await evaluate(`window.__veloxP17.getBrokenHrefs()`)
  check(
    'existing targets not marked broken after revalidate',
    Array.isArray(brokenAtStart) && brokenAtStart.length === 0,
    JSON.stringify(brokenAtStart)
  )

  // ---- resolve classification (IPC unit-level) --------------------------------
  console.log('\n--- resolveLink classification ---')
  const resFile = await evaluate(`window.__veloxP17.resolve('./b.md')`)
  check(
    'resolve ./b.md → file/exists',
    resFile?.kind === 'file' && resFile.exists === true && String(resFile.absPath).endsWith('b.md'),
    JSON.stringify(resFile)
  )
  const resAnchor = await evaluate(`window.__veloxP17.resolve('#安装步骤')`)
  check(
    'resolve #安装步骤 → anchor',
    resAnchor?.kind === 'anchor' && resAnchor.anchor === '安装步骤',
    JSON.stringify(resAnchor)
  )
  const resBoth = await evaluate(`window.__veloxP17.resolve('./b.md#配置')`)
  check(
    'resolve ./b.md#配置 → file + anchor',
    resBoth?.kind === 'file' && resBoth.anchor === '配置',
    JSON.stringify(resBoth)
  )
  const resBroken = await evaluate(`window.__veloxP17.resolve('./nope.md')`)
  check('resolve ./nope.md → broken', resBroken?.kind === 'broken', JSON.stringify(resBroken))
  const resExt = await evaluate(`window.__veloxP17.resolve('https://example.com')`)
  check(
    'resolve https → external',
    resExt?.kind === 'external' && resExt.absPath === 'https://example.com',
    JSON.stringify(resExt)
  )

  // ---- in-doc anchor jump -----------------------------------------------------
  console.log('\n--- Cmd+click in-doc #anchor ---')
  const anchorClick = await clickLink('jump安装')
  check('anchor link mousedown delivered', anchorClick === true, String(anchorClick))
  const anchorLanded = await waitFor(`(() => {
    const v = window.__veloxEditor.view
    const text = v.state.doc.toString()
    const idx = text.indexOf('## 安装步骤')
    if (idx < 0) return false
    const head = v.state.selection.main.head
    return head >= idx && head <= idx + '## 安装步骤'.length
  })()`, 8000)
  check('in-doc anchor jumps to 安装步骤 heading', anchorLanded)
  check('still on a.md after anchor jump', (await evaluate(`window.__veloxP13.getFilePath()`)) === A_PATH)

  // ---- plain click = cursor only ---------------------------------------------
  console.log('\n--- plain click does not navigate ---')
  await openA()
  await wait(300)
  const plainClick = await clickLink('goB', { metaKey: false, ctrlKey: false })
  check('plain-click mousedown delivered', plainClick === true, String(plainClick))
  await wait(250)
  const plainPath = await evaluate(`window.__veloxP13.getFilePath()`)
  check('plain click keeps current file', plainPath === A_PATH, String(plainPath))
  const plainCursor = await evaluate(`(() => {
    const v = window.__veloxEditor.view
    const text = v.state.doc.toString()
    const idx = text.indexOf('[goB](./b.md)')
    const head = v.state.selection.main.head
    // P09 hides brackets/URL of untouched links, so CM may resolve the click
    // to the end of the logical span — accept the link range ± one char.
    return { head, idx, inside: idx >= 0 && head >= idx - 1 && head <= idx + '[goB](./b.md)'.length + 1 }
  })()`)
  check('plain click places cursor in the link', plainCursor?.inside === true, JSON.stringify(plainCursor))

  // ---- cross-file + anchor navigation ----------------------------------------
  console.log('\n--- Cmd+click cross-file navigation ---')
  await openA()
  await wait(300)
  await clickLink('goB')
  const wentB = await waitFor(
    `window.__veloxP13.getFilePath() !== null && window.__veloxP13.getFilePath().endsWith('b.md')`,
    8000
  )
  check('Cmd+click [goB](./b.md) opens b.md', wentB, String(await evaluate(`window.__veloxP13.getFilePath()`)))

  await openA()
  await wait(300)
  await clickLink('bcfg跳转')
  const wentBcfg = await waitFor(
    `window.__veloxP13.getFilePath() !== null && window.__veloxP13.getFilePath().endsWith('b.md')`,
    8000
  )
  const cfgLanded = await waitFor(`(() => {
    const v = window.__veloxEditor.view
    const text = v.state.doc.toString()
    const idx = text.indexOf('## 配置')
    if (idx < 0) return false
    const head = v.state.selection.main.head
    return head >= idx && head <= idx + '## 配置'.length
  })()`, 8000)
  check('Cmd+click ./b.md#配置 opens b.md at 配置', wentBcfg && cfgLanded, `file=${wentBcfg} pos=${cfgLanded}`)

  // ---- external link confirm / pref-off / cancel / mailto ---------------------
  console.log('\n--- external links (seam-captured, never real browser) ---')
  await openA()
  await revalidate()
  await evaluate(`window.__veloxP17.setExternalConfirm(true)`)

  await clickLink('extSite')
  const extDialogUp = await waitFor(`document.querySelector('.dialog') !== null`, 8000)
  const extMsg = await dialogMessage()
  check(
    'external confirm dialog shows the URL',
    extDialogUp === true && extMsg.includes('https://example.com'),
    extMsg
  )
  const cancelClicked = await clickDialogBtn('Cancel')
  check('cancel clicked on external confirm', cancelClicked === true, String(cancelClicked))
  await waitFor(`document.querySelector('.dialog') === null`, 8000)
  const openedAfterCancel = await evaluate(`window.__veloxP17Capture.length`)
  check('cancel aborts external open', openedAfterCancel === 0, String(openedAfterCancel))

  await clickLink('extSite')
  await waitFor(`document.querySelector('.dialog') !== null`, 8000)
  check('OK clicked on external confirm', (await clickDialogBtn('OK')) === true)
  const openedAfterOk = await waitFor(`window.__veloxP17Capture.length === 1`, 8000)
  const openedUrls = await evaluate(`window.__veloxP17Capture`)
  check(
    'confirm opens https URL via seam',
    openedAfterOk === true && openedUrls?.[0] === 'https://example.com',
    JSON.stringify(openedUrls)
  )

  // mailto: tip-only alert, seam untouched
  await clickLink('mailMe')
  const mailDialogUp = await waitFor(`document.querySelector('.dialog') !== null`, 8000)
  const mailMsg = await dialogMessage()
  check(
    'mailto: shows protocol tip, does not open',
    mailDialogUp === true && mailMsg.includes('Only http(s)') && (await evaluate(`window.__veloxP17Capture.length`)) === 1,
    mailMsg
  )
  await clickDialogBtn('OK')
  await waitFor(`document.querySelector('.dialog') === null`)

  // pref off → direct open, no dialog
  await evaluate(`window.__veloxP17.setExternalConfirm(false)`)
  await clickLink('extSite')
  const directOpen = await waitFor(`window.__veloxP17Capture.length === 2`, 8000)
  const directDialog = await evaluate(`document.querySelector('.dialog') !== null`)
  const openedUrls2 = await evaluate(`window.__veloxP17Capture`)
  check(
    'pref off opens directly without dialog',
    directOpen === true && directDialog === false && openedUrls2?.[1] === 'https://example.com',
    JSON.stringify({ directDialog, openedUrls2 })
  )

  // ---- broken link detection + tooltip + restore ------------------------------
  console.log('\n--- broken link detection ---')
  await openA()
  await revalidate()
  rmSync(B_PATH)
  await revalidate()
  await revalidate()
  const brokenList = await evaluate(`window.__veloxP17.getBrokenHrefs()`)
  check(
    'deleted target recorded broken',
    Array.isArray(brokenList) && brokenList.includes('./b.md'),
    JSON.stringify(brokenList)
  )
  const brokenDom = await waitFor(
    `document.querySelectorAll('.cm-md-link-broken').length >= 1`,
    8000
  )
  const brokenSpans = await evaluate(
    `[...document.querySelectorAll('.cm-md-link-broken')].map((s) => s.textContent)`
  )
  check(
    'rendered links go dashed (.cm-md-link-broken)',
    brokenDom === true && brokenSpans.some((t) => t.includes('goB')),
    JSON.stringify(brokenSpans)
  )
  const hoverBroken = await hoverLink('goB')
  check('broken hover mousemove delivered', hoverBroken === true, String(hoverBroken))
  await wait(200)
  const brokenTip = await evaluate(`(() => {
    const el = document.querySelector('.vm-link-tooltip')
    if (!el || el.hidden) return null
    return el.textContent
  })()`)
  check('broken hover tip = "Target does not exist"', brokenTip === 'Target does not exist', String(brokenTip))

  // modifier-click on a broken link alerts instead of navigating
  await clickLink('goB')
  const brokenAlertUp = await waitFor(`document.querySelector('.dialog') !== null`, 8000)
  const brokenAlertMsg = await dialogMessage()
  check(
    'broken link click alerts target-missing',
    brokenAlertUp === true && brokenAlertMsg.includes('Target does not exist'),
    brokenAlertMsg
  )
  await clickDialogBtn('OK')
  await waitFor(`document.querySelector('.dialog') === null`)

  // restore + revalidate → decoration cleared, tooltip healthy again
  writeFileSync(B_PATH, B_MD)
  await revalidate()
  await revalidate()
  const cleared = await waitFor(`document.querySelectorAll('.cm-md-link-broken').length === 0`, 8000)
  const brokenAfter = await evaluate(`window.__veloxP17.getBrokenHrefs()`)
  check(
    'restored target clears broken decoration',
    cleared === true && Array.isArray(brokenAfter) && brokenAfter.length === 0,
    JSON.stringify(brokenAfter)
  )
  await hoverLink('goB')
  const healthyTipShown = await waitFor(`(() => {
    const el = document.querySelector('.vm-link-tooltip')
    return !!el && !el.hidden && (el.textContent || '').includes('b.md')
  })()`, 8000)
  check('healthy hover tip shows resolved path (…b.md)', healthyTipShown)

  // ---- dirty gate -------------------------------------------------------------
  console.log('\n--- dirty gate on link navigation ---')
  await openA()
  await revalidate()
  await evaluate(`(() => {
    const v = window.__veloxEditor.view
    v.dispatch({ changes: { from: v.state.doc.length, insert: 'P17 dirty marker\\n' } })
    return true
  })()`)
  await waitFor(`window.__veloxP12.getDirty() === true`)
  check('doc dirty before link click', (await evaluate(`window.__veloxP12.getDirty()`)) === true)
  // P26 multi-doc semantics: navigation away from a dirty doc must NOT gate —
  // the dirty doc stays open in its own tab; the link target becomes active.
  // (Pre-P26 single-doc flow prompted "Save changes" here — obsolete.)
  await clickLink('goB')
  const dirtyDialog = await waitFor(`document.querySelector('.dialog') !== null`, 2500)
  check('P26: dirty navigation shows NO unsaved-changes gate', dirtyDialog === false,
    dirtyDialog ? (await dialogMessage()) : '')
  const dirtyNavOk = await waitFor(
    `window.__veloxP13.getFilePath() !== null && window.__veloxP13.getFilePath().endsWith('b.md')`,
    8000
  )
  check('link navigation proceeds without a dialog', dirtyNavOk,
    String(await evaluate(`window.__veloxP13.getFilePath()`)))
  const dirtyPreserved = await waitFor(`(() => {
    if (!window.__veloxP26) return false
    const tabs = window.__veloxP26.tabs()
    return tabs.some((t) => t.path && t.path.endsWith('a.md') && t.dirty === true)
  })()`, 5000)
  check('dirty a.md preserved in its own tab after navigation', dirtyPreserved,
    JSON.stringify(await evaluate(`window.__veloxP26 ? window.__veloxP26.tabs().map(t=>({n:t.name,d:t.dirty})) : 'no-p26-hook'`)))

  // ---- summary ----------------------------------------------------------------
  console.log(`\n${failures.length === 0 ? 'ALL PASS' : `${failures.length} FAILURE(S)`}`)
  if (failures.length) console.log(failures.map((f) => ` - ${f}`).join('\n'))
  try {
    ws?.close()
  } catch {}
  if (app) app.kill('SIGKILL')
  process.exit(failures.length ? 1 : 0)
}

main()
  .catch((err) => {
    console.error('FATAL', err)
    process.exitCode = 1
  })
  .finally(() => {
    try {
      ws?.close()
    } catch {}
    if (app) app.kill('SIGKILL')
  })
