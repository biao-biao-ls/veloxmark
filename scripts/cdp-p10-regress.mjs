// P10 regression: multi-table isolation, P08 mode toggles, P09 outside tables.
// Companion to cdp-p10.mjs — same launch/CDP harness, focused on neighbors.
import { existsSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9227
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))

mkdirSync(join(ROOT, 'scripts', 'tmp-p10'), { recursive: true })

const DOC = [
  '# Regression',
  '',
  'Intro **strong** and `code` here.',
  '',
  '| A1 | B1 |',
  '| --- | --- |',
  '| a2 | b2 |',
  '',
  'Middle paragraph with **mark**.',
  '',
  '| X1 | Y1 |',
  '| --- | --- |',
  '| x2 | y2 |',
  '',
  'Tail text.'
].join('\n')
const T1 = DOC.indexOf('| A1')
const T2 = DOC.indexOf('| X1')

let app = null

async function getTarget(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const list = await (await fetch(`${CDP}/json`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('no CDP page target')
}

async function main() {
  if (!ELECTRON_BIN) throw new Error('electron binary not found')

  let target
  try {
    target = await getTarget(2000)
  } catch {
    console.log('launching electron on', CDP_PORT)
    app = spawn(ELECTRON_BIN, ['.', `--remote-debugging-port=${CDP_PORT}`], {
      cwd: ROOT,
      stdio: 'ignore',
      windowsHide: true,
      shell: false
    })
    target = await getTarget(30000)
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', reject)
  })
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id
      pending.set(msgId, { resolve, reject })
      ws.send(JSON.stringify({ id: msgId, method, params }))
    })
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
  const waitFor = async (expr, ms = 8000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (await evaluate(expr)) return true
      await new Promise((r) => setTimeout(r, 150))
    }
    return false
  }
  const failures = []
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`)
    if (!ok) failures.push(name)
  }

  check('boot: editor', await waitFor(`!!window.__veloxEditor?.view`, 20000))
  await evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') ?? '{}')
    localStorage.setItem('veloxmark.preferences', JSON.stringify({
      ...raw, restoreLastSession: false, focusMode: false, typewriterMode: false, sourceMode: false
    }))
    localStorage.setItem('veloxmark.session', JSON.stringify({ lastFilePath: null, lastFolderPath: null }))
  })()`)
  await send('Page.reload')
  check('reboot: editor back', await waitFor(`!!window.__veloxEditor?.view`, 20000))
  check('boot: has applyLivePreviewConfig', await waitFor(`typeof window.__veloxEditor?.applyLivePreviewConfig === 'function'`, 8000))

  const setDoc = async (text) => {
    await evaluate(`window.__veloxTable.clearEdit(window.__veloxEditor.view)`)
    await evaluate(`(() => {
      const view = window.__veloxEditor.view
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: ${JSON.stringify(text)} },
        selection: { anchor: 0 },
        scrollIntoView: false
      })
    })()`)
  }
  const settle = async () => {
    await waitFor(`!!window.__veloxEditor?.view`)
    await evaluate(`(() => {
      const view = window.__veloxEditor.view
      const head = view.state.selection.main.head
      for (let i = 0; i < 8; i++) view.dispatch({ selection: { anchor: head }, scrollIntoView: false })
    })()`)
    await new Promise((r) => setTimeout(r, 350))
  }
  const docText = () => evaluate(`window.__veloxEditor.view.state.doc.toString()`)
  const applyCfg = (patch) =>
    evaluate(`window.__veloxEditor.applyLivePreviewConfig(window.__veloxEditor.view, ${JSON.stringify(patch)})`)

  // ---- multi-table isolation ----------------------------------------------------

  await setDoc(DOC)
  await settle()
  check('multi: both tables render', await evaluate(`document.querySelectorAll('.cm-md-table').length`) === 2)

  await evaluate(`window.__veloxTable.activate(window.__veloxEditor.view, ${T2}, 1, 0)`)
  await new Promise((r) => setTimeout(r, 200))
  const active = await evaluate(`(() => {
    const t = document.querySelector('.cm-md-table-cell-editing')
    return t ? { row: Number(t.dataset.row), col: Number(t.dataset.col) } : null
  })()`)
  check('multi: activate cell in table 2', active && active.row === 1 && active.col === 0, JSON.stringify(active))
  check('multi: nested doc = x2', await evaluate(`window.__veloxTable.nested?.state.doc.toString() ?? null`) === 'x2')
  check('multi: insertRow on table 2', await evaluate(`window.__veloxTable.op(window.__veloxEditor.view, ${T2}, 'insertRow', 1)`))
  await settle()
  const srcM = await docText()
  const t1Lines = srcM.slice(srcM.indexOf('| A1'), srcM.indexOf('Middle')).trim().split('\n')
  const t2Part = srcM.slice(srcM.indexOf('| X1'))
  const t2Lines = t2Part.trim().split('\n').filter((l) => l.startsWith('|'))
  check('multi: table 1 source untouched', t1Lines.length === 3 && t1Lines[2] === '| a2 | b2 |', t1Lines.join(' // '))
  check('multi: table 2 gained a row', t2Lines.length === 4, `got ${t2Lines.length}`)
  check('multi: table 2 new body row has empty cells', t2Lines[3].includes('|') && t2Lines[3].replace(/[|\s:-]/g, '') === '', t2Lines[3])
  check('multi: paragraph sources intact', srcM.includes('Intro **strong**') && srcM.includes('Middle paragraph with **mark**.'))

  // ---- P09: marks outside tables still live-preview -----------------------------

  await setDoc(DOC)
  await settle()
  // Unfocused paragraphs render inline marks (marks hidden); table widgets render too.
  const introText = await evaluate(`(() => {
    const els = [...document.querySelectorAll('.cm-line')]
    const line = els.find((el) => el.textContent.includes('Intro'))
    return line ? line.textContent : null
  })()`)
  check('p09: intro paragraph rendered without raw **', introText != null && !introText.includes('**'), String(introText))
  // Cursor in paragraph → mark-granularity reveal (P09): raw marks reappear in that span.
  await evaluate(`(() => {
    const view = window.__veloxEditor.view
    const pos = view.state.doc.toString().indexOf('strong') + 2
    view.dispatch({ selection: { anchor: pos }, scrollIntoView: false })
  })()`)
  await new Promise((r) => setTimeout(r, 300))
  const introRevealed = await evaluate(`(() => {
    const els = [...document.querySelectorAll('.cm-line')]
    const line = els.find((el) => el.textContent.includes('Intro'))
    return line ? line.textContent : null
  })()`)
  check('p09: cursor in paragraph reveals marks per-span', introRevealed != null && introRevealed.includes('**'), String(introRevealed))
  check('p09: tables still rendered beside revealed paragraph', await evaluate(`document.querySelectorAll('.cm-md-table').length`) === 2)

  // ---- P08: source mode with table edit state -----------------------------------

  await setDoc(DOC)
  await settle()
  await evaluate(`window.__veloxTable.activate(window.__veloxEditor.view, ${T1}, 1, 0)`)
  await new Promise((r) => setTimeout(r, 200))
  check('p08: cell active before source toggle', await evaluate(`!!document.querySelector('.cm-md-table-cell-editing')`))
  await applyCfg({ mode: 'source' })
  await new Promise((r) => setTimeout(r, 350))
  check('p08: source mode hides table widgets', await evaluate(`document.querySelectorAll('.cm-md-table').length`) === 0)
  const srcVisible = await evaluate(`(() => {
    const view = window.__veloxEditor.view
    return view.contentDOM.textContent.includes('| A1 | B1 |')
  })()`)
  check('p08: raw table source visible in source mode', srcVisible)
  check('p08: no nested cell view in source mode', await evaluate(`!window.__veloxTable.nested`))
  check('p08: no cell-editing DOM in source mode', await evaluate(`!document.querySelector('.cm-md-table-cell-editing')`))
  await applyCfg({ mode: 'live' })
  await settle()
  check('p08: live mode restores table widgets', await evaluate(`document.querySelectorAll('.cm-md-table').length`) === 2)
  check('p08: doc text unchanged by mode round-trip', (await docText()) === DOC)

  // ---- P08: focus / typewriter toggles with active cell -------------------------

  await setDoc(DOC)
  await settle()
  await evaluate(`window.__veloxTable.activate(window.__veloxEditor.view, ${T1}, 1, 1)`)
  await new Promise((r) => setTimeout(r, 200))
  await applyCfg({ focusMode: true })
  await new Promise((r) => setTimeout(r, 250))
  check('p08: focusMode toggle keeps table widget', await evaluate(`!!document.querySelector('.cm-md-table')`))
  const nestedAfterFocus = await evaluate(`window.__veloxTable.nested?.state.doc.toString() ?? null`)
  check('p08: nested cell survives focusMode (b2)', nestedAfterFocus === 'b2', String(nestedAfterFocus))
  check('p08: can still type after focusMode', await evaluate(`window.__veloxTable.setCellDoc('b2x')`))
  await evaluate(`window.__veloxTable.move(window.__veloxEditor.view, 'out')`)
  await settle()
  check('p08: commit after focusMode wrote source', (await docText()).includes('b2x'))
  await applyCfg({ focusMode: false, typewriterMode: true })
  await new Promise((r) => setTimeout(r, 250))
  check('p08: typewriter toggle keeps table widget', await evaluate(`!!document.querySelector('.cm-md-table')`))
  await applyCfg({ typewriterMode: false })
  await settle()

  // ---- toolbar/menu HTML parity sanity (no crash on repeated open) --------------

  await setDoc(DOC)
  await settle()
  await evaluate(`window.__veloxTable.activate(window.__veloxEditor.view, ${T1}, 1, 0)`)
  await new Promise((r) => setTimeout(r, 150))
  for (let i = 0; i < 3; i++) {
    await evaluate(`(() => {
      const cell = document.querySelector('.cm-md-table tbody td[data-row="1"][data-col="0"]')
      cell?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 220, clientY: 220 }))
    })()`)
    await new Promise((r) => setTimeout(r, 80))
  }
  check('menu: exactly one menu after repeat opens', await evaluate(`document.querySelectorAll('.cm-md-table-menu').length`) === 1)
  await evaluate(`document.querySelector('.cm-md-table-menu .tree-menu-item')?.click()`)
  await new Promise((r) => setTimeout(r, 200))
  check('menu: menu closes after op', await evaluate(`!document.querySelector('.cm-md-table-menu')`))

  console.log('')
  if (failures.length === 0) console.log('ALL PASS (regression)')
  else {
    console.log(`FAILURES (${failures.length}):`)
    for (const f of failures) console.log(' -', f)
  }
  ws.close()
  if (app) app.kill()
  process.exit(failures.length === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  if (app) app.kill()
  process.exit(1)
})
