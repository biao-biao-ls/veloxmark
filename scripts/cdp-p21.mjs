// CDP e2e test for P21 (Callout 提示块). Port 9238.
//   npm run build && node scripts/cdp-p21.mjs
//
// Acceptance coverage (docs/requirements/P21-callouts.md)
//   ① `> [!WARNING] 磁盘不足` → warning card + hidden marker; cursor into the
//      first line reveals `[!WARNING]` (P09) and stamps cm-md-callout-src
//   ② `> [!NOTE]-` default-collapsed: body hidden + `⋯ N 行` chip; chip/head
//      click expands
//   ③ `> [!FOO] x` → NOTE styling + title "x"
//   ④ export HTML → `export-callout export-callout-warning` div; WeChat copy
//      (P20) carries the inline color bar; folded bodies export expanded
//   ⑤ plain `> 引用` decoration classes unchanged (cm-md-quote, no callout)
//   ⑥ dark theme: all 8 type classes present + dark palette on the cards
// Plus: zh default title widget, quote continuation on Enter, outline keys,
// Insert-menu callout template dialog (low-pri item).
import { existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9238
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))
const TMP = join(ROOT, 'scripts', 'tmp-p21')
mkdirSync(TMP, { recursive: true })

const DOC_PATH = join(TMP, 'callouts.md')

const DOC = [
  '> 普通引用行，无 marker。',
  '> 第二行普通引用。',
  '',
  '> [!WARNING] 磁盘不足',
  '> 请尽快清理**磁盘**空间。',
  '> - item-a',
  '',
  '分隔段落 A',
  '',
  '> [!NOTE]-',
  '> 折叠正文第一行',
  '> 折叠正文第二行',
  '',
  '分隔段落 B',
  '',
  '> [!FOO] x',
  '> foo 的正文',
  '',
  '分隔段落 C',
  '',
  '> [!NOTE]',
  '> 默认标题正文',
  '',
  '分隔段落 D',
  '',
  '> [!TIP] 带标题',
  '> ## 块内标题',
  '> 块内内容',
  '',
  'sep-heading',
  '',
  '> [!NOTE] n-body',
  '',
  'sep-n',
  '',
  '> [!TIP] t-body',
  '',
  'sep-t',
  '',
  '> [!IMPORTANT] i-body',
  '',
  'sep-i',
  '',
  '> [!WARNING] w-body',
  '',
  'sep-w',
  '',
  '> [!CAUTION] c-body',
  '',
  'sep-c',
  '',
  '> [!INFO] info-body',
  '',
  'sep-info',
  '',
  '> [!SUCCESS] s-body',
  '',
  'sep-s',
  '',
  '> [!DANGER] d-body',
  '',
  '停车段落：光标停在这里。',
  ''
].join('\n')

const TYPES8 = ['note', 'tip', 'important', 'warning', 'caution', 'info', 'success', 'danger']

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

  const parkCursorAtEnd = () =>
    evaluate(`(() => {
      const v = window.__veloxEditor.view
      v.dispatch({ selection: { anchor: v.state.doc.length } })
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
      language: 'zh',
      crashRecoveryEnabled: false,
      autoSaveMode: 'off',
      restoreLastSession: false,
      showStatusBar: true,
      theme: 'light',
      typingAssistsEnabled: true
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
  const hookReady = await waitFor(`typeof window.__veloxP21 === 'object' && window.__veloxP21 !== null`, 30000)
  await waitFor(`document.querySelector('.status-bar') !== null`)
  check('__veloxP21 hook ready', hookReady, String(await evaluate(`typeof window.__veloxP21`)))

  await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify(DOC)}, ${JSON.stringify(DOC_PATH)})`)
  const loaded = await waitFor(`window.__veloxP12.getFilePath() === ${JSON.stringify(DOC_PATH)}`, 8000)
  check('fixture doc loaded', loaded)
  await parkCursorAtEnd()
  await wait(400)

  // ---- ⑤ plain quote decoration unchanged -------------------------------------
  const plainQuote = await evaluate(`(() => {
    const lines = [...document.querySelectorAll('.cm-line')].filter((l) =>
      l.textContent.includes('普通引用行')
    )
    return {
      count: lines.length,
      allQuote: lines.every((l) => l.classList.contains('cm-md-quote')),
      anyCallout: lines.some((l) => l.classList.contains('cm-md-callout')),
      texts: lines.map((l) => l.textContent)
    }
  })()`)
  check(
    '⑤ plain quote keeps cm-md-quote, no callout class',
    plainQuote.count >= 1 && plainQuote.allQuote && !plainQuote.anyCallout,
    JSON.stringify(plainQuote)
  )

  // ---- ① WARNING card: classes + hidden marker + P09 reveal -------------------
  const warnCard = await evaluate(`(() => {
    const head = document.querySelector('.cm-md-callout-warning.cm-md-callout-head')
    const bodyLines = [...document.querySelectorAll('.cm-md-callout-warning')].map((l) => l.textContent)
    return {
      headFound: !!head,
      headText: head ? head.textContent : null,
      headHasIconClass: head ? head.classList.contains('cm-md-callout') : false,
      bodyTexts: bodyLines,
      strongSeen: [...document.querySelectorAll('.cm-line.cm-md-callout')].some((l) =>
        l.querySelector('.cm-md-strong')
      ),
      listSeen: [...document.querySelectorAll('.cm-line')].some(
        (l) => l.classList.contains('cm-md-list') && l.textContent.includes('item-a')
      )
    }
  })()`)
  check(
    '① WARNING head line rendered with callout classes',
    warnCard.headFound && warnCard.headHasIconClass,
    JSON.stringify(warnCard).slice(0, 200)
  )
  check(
    '① marker hidden; custom title visible',
    warnCard.headText != null && !warnCard.headText.includes('[!WARNING]') && warnCard.headText.includes('磁盘不足'),
    String(warnCard.headText)
  )
  check(
    'nested content live preview inside callout (bold + list)',
    warnCard.strongSeen && warnCard.listSeen,
    JSON.stringify(warnCard).slice(0, 240)
  )

  // Move cursor into the marker → source shows (P09), then park → hidden again.
  const reveal = await evaluate(`(() => {
    const v = window.__veloxEditor.view
    const doc = v.state.doc.toString()
    const idx = doc.indexOf('> [!WARNING] 磁盘不足')
    v.dispatch({ selection: { anchor: idx + 5 } })
    const head = document.querySelector('.cm-md-callout-warning.cm-md-callout-head')
    return {
      idx,
      text: head ? head.textContent : null,
      srcClass: head ? head.classList.contains('cm-md-callout-src') : false
    }
  })()`)
  check(
    '① cursor in first line reveals [!WARNING] + cm-md-callout-src',
    reveal.idx >= 0 && reveal.srcClass && (reveal.text || '').includes('[!WARNING]'),
    JSON.stringify(reveal)
  )
  await parkCursorAtEnd()
  await wait(200)
  const reHidden = await evaluate(
    `(() => { const h = document.querySelector('.cm-md-callout-warning.cm-md-callout-head'); return h ? h.textContent : null })()`
  )
  check(
    '① marker hidden again after leaving first line',
    reHidden != null && !reHidden.includes('[!WARNING]'),
    String(reHidden)
  )

  // ---- ② NOTE- default fold: hidden body, chip click expands ------------------
  const foldedBefore = await evaluate(`(() => {
    const bodySeen = [...document.querySelectorAll('.cm-line')].some((l) =>
      l.textContent.includes('折叠正文第一行')
    )
    const chip = document.querySelector('.cm-md-callout-fold-text')
    return { bodySeen, chipText: chip ? chip.textContent : null }
  })()`)
  check(
    '② [!NOTE]- default-collapsed: body hidden, ⋯ chip shown',
    !foldedBefore.bodySeen && (foldedBefore.chipText || '').includes('行'),
    JSON.stringify(foldedBefore)
  )

  const clicked = await evaluate(`(() => {
    const el = document.querySelector('.cm-md-callout-fold-text')
    if (!el) return { ok: false, why: 'no chip' }
    const r = el.getBoundingClientRect()
    el.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true, cancelable: true,
      clientX: r.x + r.width / 2, clientY: r.y + r.height / 2
    }))
    return { ok: true, x: r.x, y: r.y }
  })()`)
  check('② fold chip mousedown dispatched', clicked.ok === true, JSON.stringify(clicked))
  const expanded = await waitFor(`[...document.querySelectorAll('.cm-line')].some((l) => l.textContent.includes('折叠正文第一行'))`, 5000)
  await wait(200)
  const foldedAfter = await evaluate(`(() => {
    const texts = [...document.querySelectorAll('.cm-line')].map((l) => l.textContent)
    const chip = document.querySelector('.cm-md-callout-fold-text')
    const overrides = window.__veloxP21.getCalloutFoldOverrides()
    return {
      body1: texts.some((t) => t.includes('折叠正文第一行')),
      body2: texts.some((t) => t.includes('折叠正文第二行')),
      chipGone: !chip,
      overrides
    }
  })()`)
  check(
    '② click expands folded callout (body visible, chip gone)',
    expanded && foldedAfter.body1 && foldedAfter.body2 && foldedAfter.chipGone,
    JSON.stringify(foldedAfter)
  )
  check(
    '② user override recorded (folded=false)',
    foldedAfter.overrides.some((e) => e[1] === false),
    JSON.stringify(foldedAfter.overrides)
  )

  // ---- ③ unknown TYPE → NOTE style + title "x" --------------------------------
  const fooCard = await evaluate(`(() => {
    const heads = [...document.querySelectorAll('.cm-line.cm-md-callout-head')]
    const foo = heads.find((h) => h.classList.contains('cm-md-callout-note') && h.textContent.trim() === 'x')
    return {
      found: !!foo,
      noteClass: foo ? foo.classList.contains('cm-md-callout-note') : false,
      text: foo ? foo.textContent : null,
      anyUnknownClass: document.querySelectorAll('[class*="cm-md-callout-foo"]').length
    }
  })()`)
  check(
    '③ [!FOO] x → note styling + title "x"',
    fooCard.found && fooCard.noteClass && fooCard.text.trim() === 'x' && fooCard.anyUnknownClass === 0,
    JSON.stringify(fooCard)
  )

  // ---- zh default title widget on bare [!NOTE] ---------------------------------
  const defaultTitle = await evaluate(`(() => {
    const heads = [...document.querySelectorAll('.cm-line.cm-md-callout-head')]
    const bare = heads.find((h) => h.textContent.includes('注意') && !h.textContent.includes('[!'))
    return { found: !!bare, text: bare ? bare.textContent : null }
  })()`)
  check(
    'bare [!NOTE] shows zh default title 注意 (marker replaced)',
    defaultTitle.found,
    JSON.stringify(defaultTitle)
  )

  // ---- nested heading participates in outline; callout titles do not -----------
  const headingKeys = await evaluate(`window.__veloxP18.getHeadingKeys()`)
  const keys = Array.isArray(headingKeys) ? headingKeys : []
  check(
    'outline/fold keys include heading inside callout',
    keys.some((k) => String(k).includes('块内标题')),
    JSON.stringify(keys)
  )
  check(
    'callout titles produce no outline keys',
    !keys.some((k) => /带标题|磁盘不足|注意/.test(String(k))),
    JSON.stringify(keys)
  )

  // ---- ④ export HTML div + WeChat inline color bar -----------------------------
  await parkCursorAtEnd()
  const exportHtml = await evaluate(`window.__veloxP21.renderExportHtml()`)
  const eh = typeof exportHtml === 'string' ? exportHtml : ''
  check('④ export: warning callout div structure', eh.includes('export-callout export-callout-warning'), eh.slice(0, 160))
  check('④ export: head + body elements with title/body text',
    eh.includes('export-callout-head') && eh.includes('磁盘不足') && eh.includes('export-callout-body') && eh.includes('请尽快清理'),
    ''
  )
  check('④ export: [!WARNING] marker stripped', !eh.includes('[!WARNING]'), '')
  check('④ export: folded callout body exported expanded',
    eh.includes('折叠正文第一行') && eh.includes('折叠正文第二行') && !eh.includes('[!NOTE]-'),
    ''
  )
  check('④ export: plain quote still blockquote',
    eh.includes('<blockquote>') && eh.includes('第二行普通引用'),
    ''
  )
  check('④ export: 8 type classes present',
    TYPES8.every((tp) => eh.includes(`export-callout export-callout-${tp}`) || eh.includes(`export-callout-${tp}`)),
    ''
  )

  const copyOk = await evaluate(`window.__veloxP20.copyRichText()`)
  await wait(400)
  const clip = await evaluate(`window.__veloxP20.getClipboard()`)
  const clipHtml = clip?.html ?? ''
  check(
    '④ WeChat copy carries callout class + inline color bar',
    copyOk === true &&
      clipHtml.includes('export-callout-warning') &&
      clipHtml.includes('border-left-color:#9a6700') &&
      clipHtml.includes('border-left:4px solid'),
    `copyOk=${copyOk} ` +
      clipHtml.slice(clipHtml.indexOf('export-callout'), clipHtml.indexOf('export-callout') + 220)
  )

  // ---- ⑥ dark theme: 8 type classes + dark palette -----------------------------
  await evaluate(`window.__veloxP20.setThemePref('dark')`)
  const darkApplied = await waitFor(`!!document.querySelector('.app.theme-dark')`, 8000)
  await wait(300)
  const darkCheck = await evaluate(`(() => {
    const missing = ${JSON.stringify(TYPES8)}.filter(
      (tp) => !document.querySelector('.cm-md-callout-' + tp)
    )
    const warn = document.querySelector('.cm-md-callout-warning')
    const note = document.querySelector('.cm-md-callout-note')
    return {
      missing,
      warnBg: warn ? getComputedStyle(warn).backgroundColor : null,
      noteBg: note ? getComputedStyle(note).backgroundColor : null,
      appClass: document.querySelector('.app')?.className ?? ''
    }
  })()`)
  check('⑥ theme flipped dark', darkApplied, darkCheck.appClass)
  check('⑥ all 8 callout type classes present', darkCheck.missing.length === 0, JSON.stringify(darkCheck.missing))
  check(
    '⑥ dark palette on cards (warning #3a2e12 / note #1c2b3a)',
    darkCheck.warnBg === 'rgb(58, 46, 18)' && darkCheck.noteBg === 'rgb(28, 43, 58)',
    JSON.stringify(darkCheck)
  )
  await evaluate(`window.__veloxP20.setThemePref('light')`)
  await waitFor(`!document.querySelector('.app.theme-dark')`, 8000)
  await wait(300)
  const lightWarnBg = await evaluate(
    `(() => { const w = document.querySelector('.cm-md-callout-warning'); return w ? getComputedStyle(w).backgroundColor : null })()`
  )
  check('light palette restored (warning #fff6e0)', lightWarnBg === 'rgb(255, 246, 224)', String(lightWarnBg))

  // ---- quote continuation on Enter (input acceptance) ---------------------------
  const cont = await evaluate(`(() => {
    const v = window.__veloxEditor.view
    const doc = v.state.doc.toString()
    const idx = doc.indexOf('> [!NOTE]\\n> 默认标题正文')
    if (idx < 0) return { ok: false, why: 'marker line not found' }
    const pos = idx + '> [!NOTE]'.length
    v.dispatch({ selection: { anchor: pos } })
    const ok = window.__veloxP21.pressEnter()
    const after = v.state.doc.toString()
    return { ok, continued: after.includes('> [!NOTE]\\n> \\n') || after.includes('> [!NOTE]\\n> \\n> 默认标题正文') }
  })()`)
  check('Enter after callout head continues with > prefix', cont.ok === true && cont.continued === true, JSON.stringify(cont))

  // ---- Insert menu: callout template dialog (low-pri delivered) -----------------
  await evaluate(`window.__veloxP21.setSelection(window.__veloxEditor.view.state.doc.length)`)
  await evaluate(`window.__veloxP21.openCalloutInsert()`)
  const dialogOpen = await waitFor(`window.__veloxP21.getCalloutDialogOpen() && !!document.querySelector('.list-pick-dialog')`, 5000)
  const dialogTitle = await evaluate(`document.querySelector('.list-pick-dialog .dialog-title')?.textContent ?? null`)
  check('Insert Callout dialog opens (ListPickDialog)', dialogOpen && dialogTitle === '插入 Callout', String(dialogTitle))
  await evaluate(`window.__veloxP21.insertCallout('tip')`)
  await wait(300)
  const afterInsert = await evaluate(`(() => ({
    dialogClosed: !window.__veloxP21.getCalloutDialogOpen(),
    doc: window.__veloxP21.getDoc()
  }))()`)
  check(
    'insertCallout template lands with [!TIP] + body line',
    afterInsert.dialogClosed && afterInsert.doc.includes('> [!TIP] \n> \n'),
    afterInsert.doc.slice(-60)
  )

  console.log('')
  if (failures.length === 0) {
    console.log('P21 e2e: ALL PASS')
  } else {
    console.log(`P21 e2e: ${failures.length} FAILURES`)
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
