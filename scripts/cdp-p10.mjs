// CDP smoke test for P10 (table cell-level editing).
// Runs against the *built* app (out/) with remote debugging enabled:
//   npm run build
//   node scripts/cdp-p10.mjs
// Launches Electron itself if no target is listening. Drives the real editor
// via window.__veloxEditor.view + window.__veloxTable (test hooks installed by
// editor/table/widget.ts).
//
// UI row numbering (model): row 0 = header, row 1..n = body. The delimiter
// line is alignment metadata and is NOT a UI row.
import { existsSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9227
const CDP = `http://127.0.0.1:${CDP_PORT}`
const TMP = join(ROOT, 'scripts', 'tmp-p10')

const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))

mkdirSync(TMP, { recursive: true })

// ---- fixture -----------------------------------------------------------------

const TABLE = [
  '| Name | Desc | Note |',
  '| --- | :---: | ---: |',
  '| a | **b** | c1 |',
  '| d | `code` | e2 |'
].join('\n')
const FIXTURE = `# P10 Table\n\n${TABLE}\n\nAfter paragraph.`
const TABLE_FROM = FIXTURE.indexOf('| Name')

let app = null

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

async function main() {
  if (!ELECTRON_BIN) throw new Error('electron binary not found under node_modules/electron/dist')

  let target
  try {
    target = await getTarget(2000)
  } catch {
    console.log('no app on port', CDP_PORT, '- launching electron…')
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

  // Boot: wait for editor, pin prefs so session restore can't clobber the doc.
  check('boot: editor', await waitFor(`!!window.__veloxEditor?.view`, 20000))
  await evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') ?? '{}')
    localStorage.setItem('veloxmark.preferences', JSON.stringify({
      ...raw, language: 'en', restoreLastSession: false, focusMode: false, typewriterMode: false, crashRecoveryEnabled: false, autoSaveMode: 'off', sourceMode: false
    }))
    localStorage.setItem('veloxmark.session', JSON.stringify({ lastFilePath: null, lastFolderPath: null }))
  })()`)
  await send('Page.reload')
  check('reboot: editor back', await waitFor(`!!window.__veloxEditor?.view`, 20000))
  check('boot: table hook', await waitFor(`!!window.__veloxTable`, 10000))

  /** Replace the doc AND clear any stale table-edit state. */
  const setDoc = async (text, cursor = 0) => {
    await evaluate(`window.__veloxTable.clearEdit(window.__veloxEditor.view)`)
    await evaluate(`(() => {
      const view = window.__veloxEditor.view
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: ${JSON.stringify(text)} },
        selection: { anchor: ${cursor} },
        scrollIntoView: false
      })
      return view.state.doc.length
    })()`)
  }

  const docText = () => evaluate(`window.__veloxEditor.view.state.doc.toString()`)

  const getActive = () =>
    evaluate(`(() => {
      const t = document.querySelector('.cm-md-table-cell-editing')
      if (!t) return null
      return { row: Number(t.dataset.row), col: Number(t.dataset.col) }
    })()`)

  const settle = async () => {
    await waitFor(`!!window.__veloxEditor?.view`)
    await evaluate(`(() => {
      const view = window.__veloxEditor.view
      const head = view.state.selection.main.head
      for (let i = 0; i < 8; i++) view.dispatch({ selection: { anchor: head }, scrollIntoView: false })
    })()`)
    await new Promise((r) => setTimeout(r, 350))
  }

  const activate = async (row, col) => {
    const found = await evaluate(`(() => {
      const cell = document.querySelector('.cm-md-table [data-row="${row}"][data-col="${col}"]')
      if (!cell) return false
      cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
      return true
    })()`)
    await new Promise((r) => setTimeout(r, 200))
    return found
  }

  const move = (dir) => evaluate(`window.__veloxTable.move(window.__veloxEditor.view, ${JSON.stringify(dir)})`)
  const setCellDoc = (text) => evaluate(`window.__veloxTable.setCellDoc(${JSON.stringify(text)})`)
  const runOp = (kind, arg = 0) =>
    evaluate(`window.__veloxTable.op(window.__veloxEditor.view, ${TABLE_FROM}, ${JSON.stringify(kind)}, ${arg})`)
  const pasteTsv = (tsv) =>
    evaluate(`window.__veloxTable.pasteTsv(window.__veloxEditor.view, ${JSON.stringify(tsv)})`)
  const fireNestedKey = (key, opts = {}) =>
    evaluate(`(() => {
      const v = window.__veloxTable.nested
      if (!v) return false
      v.contentDOM.dispatchEvent(new KeyboardEvent('keydown', {
        key: ${JSON.stringify(key)}, bubbles: true, cancelable: true, ...${JSON.stringify(opts)}
      }))
      return true
    })()`)
  const fireMainKey = (key, opts = {}) =>
    evaluate(`(() => {
      const v = window.__veloxEditor.view
      v.contentDOM.dispatchEvent(new KeyboardEvent('keydown', {
        key: ${JSON.stringify(key)}, bubbles: true, cancelable: true, ...${JSON.stringify(opts)}
      }))
      return true
    })()`)
  const tableLines = (src) => src.split('\n').filter((l) => l.trim().startsWith('|'))
  const cellsOf = (l) => (l ?? '').split('|').slice(1, -1).map((s) => s.trim())

  // ---- rendered state ----------------------------------------------------------

  await setDoc(FIXTURE, 0)
  await settle()
  check('render: table widget present', await waitFor(`!!document.querySelector('.cm-md-table')`, 6000))
  const renderedText = await evaluate(`document.querySelector('.cm-md-table')?.textContent ?? ''`)
  check('render: no delimiter row leaked into body', !renderedText.includes('---'), renderedText.slice(0, 100))
  check('render: **b** rendered as bold', !renderedText.includes('**') && renderedText.includes('b'), renderedText.slice(0, 80))
  check('render: strong element exists', await evaluate(`!!document.querySelector('.cm-md-table strong')`))
  const bodyRowCount = await evaluate(`document.querySelectorAll('.cm-md-table tbody tr').length`)
  check('render: 2 body rows', bodyRowCount === 2, `got ${bodyRowCount}`)

  // ---- acceptance 1: click cell → edit; leave → bold in source + DOM ----------

  const clicked = await activate(1, 1)
  check('acc1: mousedown activates cell editing', clicked === true)
  check('acc1: active cell editing DOM mounted', await waitFor(`!!document.querySelector('.cm-md-table-cell-editing')`, 4000))
  const nestedDoc1 = await evaluate(`window.__veloxTable.nested?.state.doc.toString() ?? null`)
  check('acc1: nested cell doc = cell source', nestedDoc1 === '**b**', String(nestedDoc1))
  const active1 = await getActive()
  check('acc1: active coords = body row1 / col1', active1 && active1.row === 1 && active1.col === 1, JSON.stringify(active1))

  // In-cell live preview: nested view shows rendered strong while typing.
  check('acc1: setCellDoc **bold!**', await setCellDoc('**bold!**'))
  const nestedStrong = await evaluate(`!!window.__veloxTable.nested?.dom.querySelector('.cm-md-strong')`)
  check('acc1: nested live preview renders .cm-md-strong', nestedStrong)
  check('acc1: Tab moves to next cell', await move('next'))
  const src1 = await docText()
  check('acc1: source committed **bold!**', src1.includes('**bold!**'), tableLines(src1)[2] ?? '')
  const active1b = await getActive()
  check('acc1: active moved to col2', active1b && active1b.row === 1 && active1b.col === 2, JSON.stringify(active1b))
  await settle()
  const strongText = await evaluate(`document.querySelector('.cm-md-table tbody tr:nth-child(1) strong')?.textContent ?? ''`)
  check('acc1: rendered strong shows bold!', strongText === 'bold!', strongText)

  // ---- acceptance 2: Tab walk + last-cell Tab appends a row --------------------

  await setDoc(FIXTURE, 0)
  await settle()
  check('acc2: activate (1,0)', await activate(1, 0))
  const walk = []
  for (let i = 0; i < 6; i++) {
    await move('next')
    walk.push(await getActive())
  }
  // (1,0)→(1,1)→(1,2)→(2,0)→(2,1)→(2,2)→append (3,0)
  const walkOk =
    walk[0]?.row === 1 && walk[0]?.col === 1 &&
    walk[1]?.row === 1 && walk[1]?.col === 2 &&
    walk[2]?.row === 2 && walk[2]?.col === 0 &&
    walk[3]?.row === 2 && walk[3]?.col === 1 &&
    walk[4]?.row === 2 && walk[4]?.col === 2 &&
    walk[5]?.row === 3 && walk[5]?.col === 0
  check('acc2: Tab walks row then wraps to next row', walkOk, JSON.stringify(walk))
  const src2 = await docText()
  const lines2 = tableLines(src2)
  const pipesOk = lines2.every((l) => l.trim().startsWith('|') && l.trim().endsWith('|'))
  check('acc2: last-cell Tab appended a row (4 → 5 lines)', lines2.length === 5, `got ${lines2.length}`)
  check('acc2: appended source pipes legal', pipesOk, lines2.join(' // '))
  check('acc2: appended row aligned with header colCount', cellsOf(lines2[4]).length === cellsOf(lines2[0]).length, lines2[4] ?? '')

  // ---- Enter / Shift+Enter / arrows / Esc --------------------------------------

  await setDoc(FIXTURE, 0)
  await settle()
  await activate(1, 0)
  check('keys: setCellDoc l1', await setCellDoc('l1'))
  check('keys: Shift-Enter key event', await fireNestedKey('Enter', { shiftKey: true }))
  const nestedAfterBr = await evaluate(`window.__veloxTable.nested?.state.doc.toString() ?? null`)
  check('keys: nested doc has <br>', nestedAfterBr === 'l1<br>', String(nestedAfterBr))
  check('keys: Enter key event', await fireNestedKey('Enter'))
  const activeEnter = await getActive()
  check('keys: active after Enter = row below', activeEnter && activeEnter.row === 2 && activeEnter.col === 0, JSON.stringify(activeEnter))
  const srcBr = await docText()
  check('keys: committed cell has l1<br>', srcBr.includes('l1<br>'), tableLines(srcBr)[2] ?? '')
  check('keys: ArrowUp key event', await fireNestedKey('ArrowUp'))
  const activeUp = await getActive()
  check('keys: active after ArrowUp', activeUp && activeUp.row === 1 && activeUp.col === 0, JSON.stringify(activeUp))
  check('keys: Escape key event', await fireNestedKey('Escape'))
  await new Promise((r) => setTimeout(r, 200))
  check('keys: no cell editing DOM after Esc', !(await evaluate(`!!document.querySelector('.cm-md-table-cell-editing')`)))
  check('keys: table still rendered after Esc', await evaluate(`!!document.querySelector('.cm-md-table')`))

  // ---- acceptance 3: delete row + doc-level undo -------------------------------

  await setDoc(FIXTURE, 0)
  await settle()
  const bodyRowsBefore = await evaluate(`document.querySelectorAll('.cm-md-table tbody tr').length`)
  const srcLinesBefore = tableLines(await docText()).length
  await evaluate(`window.__veloxTable.activate(window.__veloxEditor.view, ${TABLE_FROM}, 2, 0)`)
  await new Promise((r) => setTimeout(r, 150))
  check('acc3: delete body row 2', await runOp('deleteRow', 2))
  await settle()
  const srcAfterDel = await docText()
  const srcLinesAfter = tableLines(srcAfterDel).length
  const bodyRowsAfter = await evaluate(`document.querySelectorAll('.cm-md-table tbody tr').length`)
  check('acc3: source table lines -1', srcLinesAfter === srcLinesBefore - 1, `${srcLinesBefore} → ${srcLinesAfter}`)
  check('acc3: DOM body rows -1 (no ghost)', bodyRowsAfter === bodyRowsBefore - 1, `${bodyRowsBefore} → ${bodyRowsAfter}`)
  check('acc3: deleted row gone from source', !srcAfterDel.includes('`code`'), tableLines(srcAfterDel).join(' // '))
  // Doc-level undo (historyKeymap Mod-z on the main editor).
  await fireMainKey('z', { metaKey: true })
  await new Promise((r) => setTimeout(r, 250))
  const srcAfterUndo = await docText()
  check(
    'acc3: undo restores source exactly',
    srcAfterUndo.includes('`code`') && tableLines(srcAfterUndo).length === srcLinesBefore,
    tableLines(srcAfterUndo).join(' // ')
  )

  // ---- acceptance 4: alignment switch updates delimiter + format ---------------

  await setDoc(FIXTURE, 0)
  await settle()
  await evaluate(`window.__veloxTable.activate(window.__veloxEditor.view, ${TABLE_FROM}, 1, 0)`)
  await new Promise((r) => setTimeout(r, 150))
  check('acc4: align center col0', await runOp('alignCenter', 0))
  await settle()
  const src4 = await docText()
  const lines4 = tableLines(src4)
  const delim4 = lines4[1]
  check('acc4: delimiter col0 = :---:', ((delim4 ?? '').split('|')[1] ?? '').includes(':'), delim4)
  check('acc4: col1 keeps :---:', ((delim4 ?? '').split('|')[2] ?? '').includes(':'), delim4)
  check('acc4: rendered th center', await evaluate(`(() => {
    const th = document.querySelector('.cm-md-table thead th[data-col="0"]')
    return th ? getComputedStyle(th).textAlign === 'center' : false
  })()`))
  check('acc4: format table — header/delimiter same width', (lines4[0] ?? '').length === (delim4 ?? '').length, `${lines4[0]?.length} vs ${delim4?.length}`)

  // ---- acceptance 5: TSV paste spreads across cells -----------------------------

  await setDoc(FIXTURE, 0)
  await settle()
  await evaluate(`window.__veloxTable.activate(window.__veloxEditor.view, ${TABLE_FROM}, 1, 1)`)
  await new Promise((r) => setTimeout(r, 150))
  await pasteTsv('x1\ty1\nx2\ty2')
  await settle()
  const lines5 = tableLines(await docText())
  const row1 = cellsOf(lines5[2])
  const row2 = cellsOf(lines5[3])
  check('acc5: TSV body1 = x1,y1', row1[1] === 'x1' && row1[2] === 'y1', JSON.stringify(row1))
  check('acc5: TSV body2 = x2,y2', row2[1] === 'x2' && row2[2] === 'y2', JSON.stringify(row2))
  check('acc5: col0 untouched by paste', row1[0] === 'a' && row2[0] === 'd', JSON.stringify([row1[0], row2[0]]))

  // Growing paste: 3×3 from (1,0) — one extra body row must appear.
  await setDoc(FIXTURE, 0)
  await settle()
  await evaluate(`window.__veloxTable.activate(window.__veloxEditor.view, ${TABLE_FROM}, 1, 0)`)
  await new Promise((r) => setTimeout(r, 150))
  await pasteTsv('p\tq\tr\ns\tt\tu\nv\tw\tx')
  await settle()
  const lines5b = tableLines(await docText())
  check('acc5: 3-row TSV grows table to 5 source lines', lines5b.length === 5, `got ${lines5b.length}`)
  const last = cellsOf(lines5b[4])
  check('acc5: appended body carries v,w,x', last[0] === 'v' && last[1] === 'w' && last[2] === 'x', JSON.stringify(last))

  // ---- handles + context menu ---------------------------------------------------

  await setDoc(FIXTURE, 0)
  await settle()
  check('handles: activate (1,0)', await activate(1, 0))
  const handleCount = await evaluate(`document.querySelectorAll('.cm-md-table .cm-md-table-handle-btn').length`)
  check('handles: row/col handles shown while editing', handleCount >= 10, `got ${handleCount}`)
  const rowsBeforeH = await evaluate(`document.querySelectorAll('.cm-md-table tbody tr').length`)
  const clickedHandle = await evaluate(`(() => {
    const tr = document.querySelector('.cm-md-table tbody tr')
    const btn = tr?.querySelector('.cm-md-row-handle-cell .cm-md-table-handle-btn')
    btn?.click()
    return !!btn
  })()`)
  check('handles: row + button found', clickedHandle === true)
  await settle()
  const rowsAfterH = await evaluate(`document.querySelectorAll('.cm-md-table tbody tr').length`)
  check('handles: +row inserts a body row', rowsAfterH === rowsBeforeH + 1, `${rowsBeforeH} → ${rowsAfterH}`)

  await setDoc(FIXTURE, 0)
  await settle()
  await evaluate(`(() => {
    const cell = document.querySelector('.cm-md-table tbody td[data-row="1"][data-col="0"]')
    cell?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 200 }))
  })()`)
  await new Promise((r) => setTimeout(r, 200))
  const menuItems = await evaluate(`[...document.querySelectorAll('.cm-md-table-menu .tree-menu-item')].map(b => b.textContent)`)
  check('menu: context menu opens with ops', (menuItems ?? []).length >= 10, JSON.stringify(menuItems))
  check('menu: has align + row/col ops', (menuItems ?? []).includes('Align center') && (menuItems ?? []).includes('Delete row'), '')
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll('.cm-md-table-menu .tree-menu-item')].find(b => b.textContent === 'Align right')
    btn?.click()
  })()`)
  await new Promise((r) => setTimeout(r, 250))
  const delimMenu = tableLines(await docText())[1]
  check('menu: Align right updates delimiter col0', ((delimMenu ?? '').split('|')[1] ?? '').trim().endsWith(':'), delimMenu)
  check('menu: closed after action', !(await evaluate(`!!document.querySelector('.cm-md-table-menu')`)))

  // ---- escape hatch: CM cursor inside table reveals source ----------------------

  await setDoc(FIXTURE, 0)
  await settle()
  await evaluate(`(() => {
    const view = window.__veloxEditor.view
    view.dispatch({ selection: { anchor: ${TABLE_FROM} + 3 }, scrollIntoView: false })
  })()`)
  await settle()
  check('escape: cursor in table → widget gone (source shown)', !(await evaluate(`!!document.querySelector('.cm-md-table')`)))

  // ---- summary ------------------------------------------------------------------

  console.log('')
  if (failures.length === 0) {
    console.log('ALL PASS')
  } else {
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
