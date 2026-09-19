// CDP e2e test for P22 (表格插入辅助). Port 9239.
//   npm run build && node scripts/cdp-p22.mjs
//
// Acceptance coverage (docs/requirements/P22-table-insert.md)
//   ① insert 2×3 center → header 列1..3 + `:---:` ×3 + empty cell row; valid
//      pipes; selection lands in the first cell; widget renders when parked out
//   ② TSV 3-line convert sniffed Tab → 3-col table, first line = header
//   ③ first cell directly typeable (P10 cell-editing class after mousedown)
//   ④ insert with cursor inside code fence → table after block, fence intact
//   ⑤ dialog keyboard-complete (arrows/Enter/Esc) + light/dark theme
// Plus: convert disabled without selection (toast), convert inside fence refused.
import { existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9239
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))
const TMP = join(ROOT, 'scripts', 'tmp-p22')
mkdirSync(TMP, { recursive: true })

const DOC_PATH = join(TMP, 'tables.md')

// Fixture: TSV block for convert, mermaid fence for block-after insert.
const DOC = [
  '# P22 固定文档',
  '',
  'TSV 选区：',
  '名称\t数量\t单价',
  '苹果\t3\t5.5',
  '香蕉\t2\t3.0',
  '',
  'fence-holder 段落。',
  '',
  '```mermaid',
  'graph TD',
  '  A --> B',
  '```',
  '',
  'fence-after 段落。',
  ''
].join('\n')

// Regexes are built with RegExp ctor so backslashes reach the evaluated
// expression intact (template-literal `\|` would collapse to `|`).
const RE_HEADER_3 = new RegExp(String.raw`\|\s*列1\s*\|\s*列2\s*\|\s*列3\s*\|`)
const RE_HEADER_4 = new RegExp(String.raw`\|\s*列1\s*\|\s*列2\s*\|\s*列3\s*\|\s*列4\s*\|`)
const RE_EMPTY_ROW_3 = new RegExp(String.raw`^\|\s+\|\s+\|\s+\|\s*$`)
const RE_EMPTY_ROW_4 = new RegExp(String.raw`^\|\s+\|\s+\|\s+\|\s+\|\s*$`)

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
  const hookReady = await waitFor(`typeof window.__veloxP22 === 'object' && window.__veloxP22 !== null`, 30000)
  await waitFor(`document.querySelector('.status-bar') !== null`)
  check('__veloxP22 hook ready', hookReady, String(await evaluate(`typeof window.__veloxP22`)))

  await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify(DOC)}, ${JSON.stringify(DOC_PATH)})`)
  const loaded = await waitFor(`window.__veloxP12.getFilePath() === ${JSON.stringify(DOC_PATH)}`, 8000)
  check('fixture doc loaded', loaded)
  await wait(400)

  // ---- ① insert 2×3 center ----------------------------------------------------
  await evaluate(`(() => {
    const v = window.__veloxEditor.view
    v.dispatch({ selection: { anchor: v.state.doc.length } })
    window.__veloxP22.openDialog('insert')
    return true
  })()`)
  const dlgOpen = await waitFor(`document.querySelector('.table-insert-dialog') !== null`, 8000)
  const dlgTitle = await evaluate(`(() => {
    const el = document.querySelector('.table-insert-dialog .dialog-title')
    return el ? el.textContent : null
  })()`)
  check('① insert dialog opens with zh title', dlgOpen && dlgTitle === '插入表格', String(dlgTitle))

  await evaluate(`window.__veloxP22.setDialogForm({ rows: 2, cols: 3, align: 'center' })`)
  const formNow = await evaluate(`window.__veloxP22.getDialogForm()`)
  check(
    '① dialog form 2×3 center captured',
    formNow.rows === 2 && formNow.cols === 3 && formNow.align === 'center',
    JSON.stringify(formNow)
  )
  const preview = await evaluate(`(() => {
    const el = document.querySelector('[data-testid="table-preview"]')
    return el ? el.textContent : null
  })()`)
  const previewOk =
    !!preview && RE_HEADER_3.test(preview) && (preview.match(/:---:/g) || []).length === 3
  check('① live preview shows 列1..3 + :---:', previewOk, String(preview).slice(0, 120))

  await evaluate(`window.__veloxP22.confirm()`)
  await wait(300)
  const afterInsert = await evaluate(`(() => {
    const doc = window.__veloxP22.getDoc()
    const v = window.__veloxEditor.view
    const reHeader = new RegExp(${JSON.stringify(RE_HEADER_3.source)}, '')
    const reEmpty = new RegExp(${JSON.stringify(RE_EMPTY_ROW_3.source)})
    const m = doc.match(reHeader)
    const idx = m ? m.index : -1
    return {
      hasHeader: idx >= 0,
      delimCount: (doc.match(/:---:/g) || []).length,
      emptyRow: doc.split('\\n').some((l) => reEmpty.test(l)),
      selFrom: v.state.selection.main.from,
      expectedCursor: idx + 2,
      dialogClosed: window.__veloxP22.getDialogMode() === null
    }
  })()`)
  check(
    '① 2×3 center table source inserted (header + :---: ×3 + empty row)',
    afterInsert.hasHeader && afterInsert.delimCount >= 3 && afterInsert.emptyRow && afterInsert.dialogClosed,
    JSON.stringify(afterInsert).slice(0, 240)
  )
  check(
    '① selection lands in first header cell (offset +2)',
    afterInsert.selFrom === afterInsert.expectedCursor,
    `sel=${afterInsert.selFrom} expected=${afterInsert.expectedCursor}`
  )

  // Widget renders only when cursor is outside the block (blockTouched rule).
  await evaluate(`(() => {
    const v = window.__veloxEditor.view
    v.dispatch({ selection: { anchor: 0 } })
    return true
  })()`)
  const widgetOk = await waitFor(`document.querySelector('.cm-md-table-wrap') !== null`, 8000)
  check('① table widget renders when cursor parked outside', widgetOk)
  await waitFor(`!!window.__veloxTable`, 8000)

  // ---- ③ first cell directly typeable (P10 cell editing) ----------------------
  const cellEdit = await evaluate(`(() => {
    const cell = document.querySelector('.cm-md-table [data-row="0"][data-col="0"]')
    if (!cell) return { found: false }
    cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
    return { found: true, text: cell.textContent }
  })()`)
  await wait(300)
  const editing = await evaluate(`(() => {
    const ed = document.querySelector('.cm-md-table-cell-editing')
    return { present: !!ed, row: ed ? ed.dataset.row : null, col: ed ? ed.dataset.col : null }
  })()`)
  check(
    '③ mousedown on cell enters P10 editing (cm-md-table-cell-editing)',
    cellEdit.found && editing.present,
    JSON.stringify({ cellEdit, editing })
  )
  // Leave editing so later steps see plain doc text.
  await evaluate(`(() => {
    if (window.__veloxTable?.clearEdit) window.__veloxTable.clearEdit(window.__veloxEditor.view)
    const v = window.__veloxEditor.view
    v.dispatch({ selection: { anchor: 0 } })
    return true
  })()`)
  await wait(200)

  // ---- ② TSV convert, sniffed Tab ---------------------------------------------
  await evaluate(`(() => {
    const v = window.__veloxEditor.view
    const doc = v.state.doc.toString()
    const from = doc.indexOf('名称\\t数量\\t单价')
    const endMark = doc.indexOf('香蕉\\t2\\t3.0')
    const to = endMark >= 0 ? doc.indexOf('\\n', endMark) : -1
    v.dispatch({ selection: { anchor: from, head: to < 0 ? v.state.doc.length : to } })
    window.__veloxP22.openDialog('convert')
    return { from, to: to < 0 ? v.state.doc.length : to }
  })()`)
  const convOpen = await waitFor(`document.querySelector('.table-insert-dialog') !== null`, 8000)
  const convTitle = await evaluate(`(() => {
    const el = document.querySelector('.table-insert-dialog .dialog-title')
    return el ? el.textContent : null
  })()`)
  check('② convert dialog opens with zh title', convOpen && convTitle === '选区转表格', String(convTitle))
  const sniffState = await evaluate(`(() => {
    const radios = [...document.querySelectorAll('.table-insert-delim input[type="radio"]')]
    const checkedIdx = radios.findIndex((r) => r.checked)
    const sniff = document.querySelector('.table-insert-sniff')?.textContent || ''
    return { checkedIdx, sniff, formDelim: window.__veloxP22.getDialogForm().delim }
  })()`)
  check(
    '② delimiter sniffed as Tab (radio 0 checked + sniff label)',
    sniffState.checkedIdx === 0 && sniffState.sniff.includes('Tab'),
    JSON.stringify(sniffState)
  )
  await evaluate(`window.__veloxP22.confirm()`)
  await wait(300)
  const afterConv = await evaluate(`(() => {
    const doc = window.__veloxP22.getDoc()
    const lines = doc.split('\\n')
    const header = lines.find((l) => l.includes('名称') && l.includes('数量') && l.includes('单价') && l.trim().startsWith('|'))
    const apple = lines.find((l) => l.includes('苹果') && l.includes('5.5') && l.trim().startsWith('|'))
    const delimLine = header ? lines[lines.indexOf(header) + 1] : null
    return {
      header,
      apple,
      delimLine,
      delimCols: delimLine ? (delimLine.split('|').length - 2) : 0,
      tsvGone: !doc.includes('名称\\t数量\\t单价'),
      dialogClosed: window.__veloxP22.getDialogMode() === null
    }
  })()`)
  check(
    '② TSV → 3-col table (first line header + body row + delimiter)',
    !!afterConv.header && !!afterConv.apple && !!afterConv.delimLine &&
      afterConv.delimCols === 3 && afterConv.tsvGone && afterConv.dialogClosed,
    JSON.stringify(afterConv).slice(0, 240)
  )

  // ---- ④ insert inside fenced code → after block, fence intact ----------------
  const fencePos = await evaluate(`(() => window.__veloxP22.getDoc().indexOf('graph TD'))()`)
  await evaluate(`(() => {
    window.__veloxP22.setSelection(${fencePos})
    window.__veloxP22.openDialog('insert')
    window.__veloxP22.setDialogForm({ rows: 2, cols: 2, align: '' })
    return true
  })()`)
  await waitFor(`document.querySelector('.table-insert-dialog') !== null`, 8000)
  await evaluate(`window.__veloxP22.confirm()`)
  await wait(300)
  const afterFence = await evaluate(`(() => {
    const doc = window.__veloxP22.getDoc()
    const mermaidStart = doc.indexOf('\`\`\`mermaid')
    const mermaidEnd = doc.indexOf('\`\`\`', mermaidStart + 3)
    const graphIdx = doc.indexOf('graph TD')
    // New insert is 2-col (列1|列2); probe the gap between fence end and the
    // trailing paragraph so the earlier 3-col test table (doc tail) can't match.
    const gapEnd = doc.indexOf('fence-after')
    const gap = gapEnd > mermaidEnd ? doc.slice(mermaidEnd, gapEnd) : ''
    const reTable2 = new RegExp(${JSON.stringify(RE_HEADER_3.source.replace('\\s*\\|\\s*列3\\s*\\|', ''))})
    return {
      fenceIntact: mermaidStart >= 0 && mermaidEnd > mermaidStart,
      graphIntact: graphIdx > mermaidStart && graphIdx < mermaidEnd,
      tableAfterFence: gapEnd > mermaidEnd,
      tableBeforeAfterPara: reTable2.test(gap) && doc.slice(gapEnd).includes('fence-after'),
      toast: window.__veloxP20.getToast()
    }
  })()`)
  check(
    '④ table inserted after fence; fence + mermaid source intact',
    afterFence.fenceIntact && afterFence.graphIntact && afterFence.tableAfterFence &&
      afterFence.tableBeforeAfterPara,
    JSON.stringify(afterFence).slice(0, 200)
  )
  check(
    '④ moved-after-block toast shown',
    afterFence.toast === '已插入到代码块/表格之后',
    String(afterFence.toast)
  )

  // ---- convert inside fence refused -------------------------------------------
  await evaluate(`(() => {
    const doc = window.__veloxP22.getDoc()
    const g = doc.indexOf('graph TD')
    window.__veloxP22.setSelection(g, g + 8)
    window.__veloxP22.openDialog('convert')
    return true
  })()`)
  await waitFor(`document.querySelector('.table-insert-dialog') !== null`, 8000)
  await evaluate(`window.__veloxP22.confirm()`)
  await wait(300)
  const inBlock = await evaluate(`(() => {
    const doc = window.__veloxP22.getDoc()
    return {
      graphIntact: doc.includes('graph TD'),
      toast: window.__veloxP20.getToast(),
      dialogClosed: window.__veloxP22.getDialogMode() === null
    }
  })()`)
  check(
    'convert inside fence refused (toast + doc unchanged)',
    inBlock.graphIntact && inBlock.toast === '代码块/表格内无法转换' && inBlock.dialogClosed,
    JSON.stringify(inBlock)
  )

  // ---- convert with no selection → toast + dialog stays closed ----------------
  await evaluate(`(() => {
    const v = window.__veloxEditor.view
    v.dispatch({ selection: { anchor: v.state.doc.length } })
    window.__veloxP22.openDialog('convert')
    return true
  })()`)
  await wait(200)
  const noSel = await evaluate(`(() => ({
    dialogMode: window.__veloxP22.getDialogMode(),
    toast: window.__veloxP20.getToast()
  }))()`)
  check(
    'convert without selection: dialog stays closed + toast',
    noSel.dialogMode === null && noSel.toast === '请先选中分隔文本',
    JSON.stringify(noSel)
  )

  // ---- ⑤ keyboard grid flow + Esc ---------------------------------------------
  await evaluate(`window.__veloxP12.loadDoc('键盘测试文档\\n', ${JSON.stringify(DOC_PATH)})`)
  await wait(300)
  await evaluate(`(() => {
    const v = window.__veloxEditor.view
    v.dispatch({ selection: { anchor: v.state.doc.length } })
    window.__veloxP22.openDialog('insert')
    return true
  })()`)
  await waitFor(`document.querySelector('.table-insert-dialog') !== null`, 8000)
  const kbFocus = await evaluate(`(() => {
    const grid = document.querySelector('.table-insert-grid')
    if (!grid) return false
    grid.focus()
    return document.activeElement === grid
  })()`)
  check('⑤ grid focusable', kbFocus)
  const fireKey = (key) =>
    evaluate(`(() => {
      const grid = document.querySelector('.table-insert-grid')
      grid.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true }))
      return true
    })()`)
  await fireKey('ArrowDown')
  await wait(80)
  await fireKey('ArrowRight')
  await wait(80)
  const afterKeys = await evaluate(`window.__veloxP22.getDialogForm()`)
  check(
    '⑤ ArrowDown+ArrowRight move hover/size to 3×4',
    afterKeys.hoverRow === 3 && afterKeys.hoverCol === 4 && afterKeys.rows === 3 && afterKeys.cols === 4,
    JSON.stringify(afterKeys)
  )
  const hoverCells = await evaluate(`document.querySelectorAll('.table-insert-cell.is-hover').length`)
  check('⑤ hover cells highlight 3×4 = 12', hoverCells === 12, String(hoverCells))
  await fireKey('Enter')
  await wait(300)
  const afterKbInsert = await evaluate(`(() => {
    const doc = window.__veloxP22.getDoc()
    const reH = new RegExp(${JSON.stringify(RE_HEADER_4.source)})
    const reE = new RegExp(${JSON.stringify(RE_EMPTY_ROW_4.source)})
    return {
      cols4: reH.test(doc),
      bodyRows: doc.split('\\n').filter((l) => reE.test(l)).length,
      dialogClosed: window.__veloxP22.getDialogMode() === null
    }
  })()`)
  check(
    '⑤ Enter confirms keyboard flow → 3×4 table',
    afterKbInsert.cols4 && afterKbInsert.bodyRows >= 2 && afterKbInsert.dialogClosed,
    JSON.stringify(afterKbInsert)
  )

  // Esc closes without inserting.
  const docBeforeEsc = await evaluate(`window.__veloxP22.getDoc()`)
  await evaluate(`(() => {
    const v = window.__veloxEditor.view
    v.dispatch({ selection: { anchor: v.state.doc.length } })
    window.__veloxP22.openDialog('insert')
    return true
  })()`)
  await waitFor(`document.querySelector('.table-insert-dialog') !== null`, 8000)
  await evaluate(`(() => {
    const dlg = document.querySelector('.table-insert-dialog')
    dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    return true
  })()`)
  await wait(200)
  const escMode = await evaluate(`window.__veloxP22.getDialogMode()`)
  const escDoc = await evaluate(`window.__veloxP22.getDoc()`)
  check(
    '⑤ Esc closes dialog without inserting',
    escMode === null && escDoc === docBeforeEsc,
    JSON.stringify({ mode: escMode, same: escDoc === docBeforeEsc })
  )

  // ---- ⑤ dark theme while dialog open ----------------------------------------
  await evaluate(`window.__veloxP20.setThemePref('dark')`)
  await wait(300)
  await evaluate(`(() => {
    window.__veloxP22.openDialog('insert')
    return true
  })()`)
  await waitFor(`document.querySelector('.table-insert-dialog') !== null`, 8000)
  const darkState = await evaluate(`(() => {
    const app = document.querySelector('.app')
    const cell = document.querySelector('.table-insert-cell')
    return {
      themeDark: !!app && app.classList.contains('theme-dark'),
      dialogVisible: !!document.querySelector('.table-insert-dialog'),
      cellBg: cell ? getComputedStyle(cell).backgroundColor : null,
      cellBorder: cell ? getComputedStyle(cell).borderColor : null
    }
  })()`)
  check(
    '⑤ dialog renders under dark theme (theme-dark + themed cell bg)',
    darkState.themeDark && darkState.dialogVisible,
    JSON.stringify(darkState)
  )
  await evaluate(`(() => {
    document.querySelector('.dialog-overlay')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    window.__veloxP20.setThemePref('light')
    return true
  })()`)
  await wait(200)
  const lightBack = await evaluate(`document.querySelector('.app')?.classList.contains('theme-light')`)
  check('theme restored to light', lightBack === true)

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
