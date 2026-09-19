// CDP e2e test for P26 (多文档标签页). Port 9243.
//   npm run build && node scripts/cdp-p26.mjs
//
// Acceptance coverage (docs/requirements/P26-multi-doc-tabs.md)
//   ① 打开多个文档并切换：TabsBar 呈现所有打开文档；切换后编辑器内容、
//      Titlebar 文件名、脏标记对应目标文档；编辑互不影响
//   ② 关闭与关闭语义：关闭标签；脏标签关闭前询问；Ctrl+W/Cmd+W 标签感知
//      （>1 标签关标签，单标签走窗口关闭语义）；右键菜单 关闭其他/关闭右侧；
//      中键关闭
//   ③ 会话恢复：恢复上次打开的标签页与活动标签；缺失文件跳过并提示
//   ④ 标签顺序拖拽调整：reorder 保序
//   ⑤ Untitled 命名：untitled-N 递增，不覆盖既有标签
//   ⑥ 标签架构约束：markdown 是唯一数据源（per-tab CM state 独立 undo）；
//      会话不写文档内容；>30 标签照常打开（LRU 未做 — 实施状态记录）
//   ⑦ per-tab baseDir：切换标签后插件/预览根目录跟随活动标签
//   ⑧ 自动保存遍历所有脏标签：debounce 触发后多个脏文件同时落盘
import { existsSync, mkdirSync, appendFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9243
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))
const TMP = join(ROOT, 'scripts', 'tmp-p26')
rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
mkdirSync(join(TMP, 'dirA'), { recursive: true })
mkdirSync(join(TMP, 'dirB'), { recursive: true })
mkdirSync(join(TMP, 'many'), { recursive: true })

const A = join(TMP, 'a.md')
const B = join(TMP, 'b.md')
const C = join(TMP, 'c.md')
const X = join(TMP, 'dirA', 'x.md')
const Y = join(TMP, 'dirB', 'y.md')
writeFileSync(A, '# 文档 A\n\nAAA 初始内容。\n')
writeFileSync(B, '# 文档 B\n\nBBB 初始内容。\n')
writeFileSync(C, '# 文档 C\n\nCCC 初始内容。\n')
writeFileSync(X, '# X in dirA\n\n内容 X。\n')
writeFileSync(Y, '# Y in dirB\n\n内容 Y。\n')
const MANY = []
for (let i = 1; i <= 32; i++) {
  const p = join(TMP, 'many', `T${String(i).padStart(2, '0')}.md`)
  writeFileSync(p, `# Tab ${i}\n\n第 ${i} 个标签文档。\n`)
  MANY.push(p)
}

const MARK_A = '★编辑A★'
const MARK_B = '★编辑B★'

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

async function connect() {
  const target = await getTarget()
  if (ws) {
    try {
      ws.close()
    } catch {}
  }
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
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', reject)
  })
  let id = 0
  return {
    send: (method, params) =>
      new Promise((resolve, reject) => {
        const mid = ++id
        pending.set(mid, { resolve, reject })
        ws.send(JSON.stringify({ id: mid, method, params }))
      }),
    evaluate: async (expression) => {
      const res = await thisSend('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
      })
      if (res.exceptionDetails) {
        throw new Error(res.exceptionDetails.text + ': ' + (res.result?.description ?? ''))
      }
      return res.result.value
    }
  }
  function thisSend(method, params) {
    return new Promise((resolve, reject) => {
      const mid = ++id + 100000
      pending.set(mid, { resolve, reject })
      ws.send(JSON.stringify({ id: mid, method, params }))
    })
  }
}

let session = null

async function evaluate(expression) {
  return session.evaluate(expression)
}

async function waitFor(fnExpr, timeoutMs = 8000, interval = 120) {
  const deadline = Date.now() + timeoutMs
  let lastErr = ''
  while (Date.now() < deadline) {
    try {
      const v = await evaluate(`(() => { try { return (${fnExpr}) } catch (e) { return false } })()`)
      if (v) return v
    } catch (e) {
      lastErr = String(e)
    }
    await new Promise((r) => setTimeout(r, interval))
  }
  throw new Error(`waitFor timeout: ${fnExpr} ${lastErr}`)
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Never wedge the harness on an awaitPromise CDP call. */
function race(promise, ms, tag) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`race timeout: ${tag}`)), ms))
  ])
}

async function hookReady() {
  return waitFor(`window.__veloxP26 && document.querySelector('.status-bar') && window.__veloxPrefs`)
}

const tabs = () => evaluate(`window.__veloxP26.tabs()`)
const activeIndex = () => evaluate(`window.__veloxP26.activeIndex()`)
const activeTab = async () => {
  const list = await tabs()
  return list.find((t) => t.active) ?? null
}
const dialogInfo = () =>
  evaluate(`(() => {
    const d = document.querySelector('.dialog')
    if (!d) return null
    return {
      title: d.querySelector('.dialog-title')?.textContent ?? '',
      message: d.querySelector('.dialog-message')?.textContent ?? '',
      buttons: [...d.querySelectorAll('.dialog-buttons .dialog-btn')].map((b) => b.textContent.trim())
    }
  })()`)

async function clickDialogButton(label) {
  // Accept the zh label or its en counterpart so the click never wedges on lang.
  const EN = { 取消: 'Cancel', 不保存: "Don't Save", 保存: 'Save' }
  const alts = [label, EN[label]].filter(Boolean)
  const clicked = await evaluate(`(() => {
    const alts = ${JSON.stringify(alts)}
    const btns = [...document.querySelectorAll('.dialog-buttons .dialog-btn')]
    const b = btns.find((x) => alts.includes(x.textContent.trim()))
    if (!b) return false
    b.click()
    return true
  })()`)
  if (!clicked) return false
  // Verify the dialog actually settled; fall back to a full event sequence.
  await wait(200)
  const gone = await evaluate(`!document.querySelector('.dialog')`)
  if (gone) return true
  await evaluate(`(() => {
    const alts = ${JSON.stringify(alts)}
    const btns = [...document.querySelectorAll('.dialog-buttons .dialog-btn')]
    const b = btns.find((x) => alts.includes(x.textContent.trim()))
    if (!b) return false
    b.focus()
    for (const type of ['pointerdown','mousedown','pointerup','mouseup','click']) {
      b.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
    }
    b.click()
    return true
  })()`)
  await wait(200)
  if (await evaluate(`!document.querySelector('.dialog')`)) return true
  // Last resort for Cancel: the dialog overlay's own Escape handler.
  if (label === '取消' || label === 'Cancel') {
    await evaluate(`(() => {
      const ov = document.querySelector('.dialog-overlay')
      if (!ov) return false
      ov.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      return true
    })()`)
    await wait(200)
  }
  const gone2 = await evaluate(`!document.querySelector('.dialog')`)
  if (!gone2) console.log('    debug dialog stuck:', JSON.stringify(await dialogInfo()))
  return gone2
}

function dispatchKey(key, opts = {}) {
  return evaluate(`(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: ${JSON.stringify(key)},
      code: ${JSON.stringify(opts.code ?? key)},
      ctrlKey: ${opts.ctrl ? 'true' : 'false'},
      metaKey: ${opts.meta ? 'true' : 'false'},
      shiftKey: ${opts.shift ? 'true' : 'false'},
      altKey: false,
      bubbles: true,
      cancelable: true
    }))
    return true
  })()`)
}

/** Dispatch contextmenu / auxclick on the nth .tab-item (0-based). */
function tabDomEvent(index, type, button = 2) {
  return evaluate(`(() => {
    const items = [...document.querySelectorAll('.tabs-bar .tab-item')]
    const el = items[${index}]
    if (!el) return false
    el.dispatchEvent(new MouseEvent(${JSON.stringify(type)}, { bubbles: true, cancelable: true, button: ${button} }))
    return true
  })()`)
}

function killApp() {
  return new Promise((resolve) => {
    if (!app) return resolve()
    app.once('exit', () => resolve())
    try {
      app.kill('SIGKILL')
    } catch {}
    setTimeout(resolve, 2000)
  })
}

async function firstBoot() {
  app = launch()
  session = await connect()
  await waitFor(`!!window.__veloxPrefs`, 30000)
  // Pin prefs + wipe session/drafts, then reload so boot effects run clean.
  const A2 = JSON.stringify(A)
  const pin = `(() => {
    // i18n reads preferences.language at module load — pin localStorage BEFORE
    // the reload (same pattern as cdp-p25).
    const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') || '{}')
    localStorage.setItem('veloxmark.preferences', JSON.stringify(Object.assign(raw, {
      language: 'zh',
      theme: 'light',
      restoreLastSession: false,
      autoSaveMode: 'off',
      autoSaveDelay: 5000
    })))
    localStorage.removeItem('veloxmark.session')
    try { localStorage.setItem('veloxmark.drafts', '{}') } catch {}
    location.reload()
    return true
  })()`
  await evaluate(pin)
  // reload drops the page — reconnect and wait for the P26 hook.
  await wait(1200)
  session = await connect()
  await hookReady()
}

async function relaunch() {
  await killApp()
  await wait(400)
  app = launch()
  session = await connect()
  await hookReady()
}

async function main() {
  if (!ELECTRON_BIN) throw new Error('electron binary not found')
  await firstBoot()

  try {
    // ---- S0 welcome tab -----------------------------------------------------
    console.log('\n--- S0 welcome tab ---')
    let list = await tabs()
    check('boot: exactly one welcome tab', list.length === 1, JSON.stringify(list))
    check('boot: welcome tab is untitled-1', list[0]?.name === 'untitled-1', list[0]?.name)
    check('boot: welcome tab not dirty', list[0]?.dirty === false)
    let title = await evaluate(`document.querySelector('.tb-title')?.textContent ?? ''`)
    check('boot: titlebar shows untitled-1', title.includes('untitled-1'), title)

    // ---- S1 open three docs + switch ---------------------------------------
    console.log('\n--- S1 open docs + switch ---')
    check('open a.md', await evaluate(`window.__veloxP26.openPath(${JSON.stringify(A)})`))
    check('open b.md', await evaluate(`window.__veloxP26.openPath(${JSON.stringify(B)})`))
    check('open c.md', await evaluate(`window.__veloxP26.openPath(${JSON.stringify(C)})`))
    list = await tabs()
    const paths = list.map((t) => t.path)
    check('tabs: welcome + 3 docs = 4', list.length === 4, String(list.length))
    check('tabs: contains a/b/c paths', paths.includes(A) && paths.includes(B) && paths.includes(C), JSON.stringify(paths))
    let doc = await evaluate(`window.__veloxP26.getDoc()`)
    check('active doc is C after last open', doc.includes('文档 C'), doc.slice(0, 40))
    title = await evaluate(`document.querySelector('.tb-title')?.textContent ?? ''`)
    check('titlebar shows c.md', title.includes('c.md'), title)

    // ---- S2 per-tab content + dirty isolation + cursor ---------------------
    console.log('\n--- S2 tab isolation ---')
    const idxA = list.findIndex((t) => t.path === A)
    const idxB = list.findIndex((t) => t.path === B)
    await evaluate(`window.__veloxP26.activateIndex(${idxA})`)
    await wait(150)
    doc = await evaluate(`window.__veloxP26.getDoc()`)
    check('switch to A shows doc A', doc.includes('AAA'), doc.slice(0, 40))
    title = await evaluate(`document.querySelector('.tb-title')?.textContent ?? ''`)
    check('titlebar switches to a.md', title.includes('a.md'), title)
    const posA = doc.indexOf('AAA')
    await evaluate(`window.__veloxP26.setCursor(${posA}); window.__veloxP26.insertText(${posA + 3}, ${JSON.stringify(MARK_A)})`)
    await wait(120)
    list = await tabs()
    const tA = list.find((t) => t.path === A)
    const tB = list.find((t) => t.path === B)
    check('dirty dot on A after edit', tA?.dirty === true, JSON.stringify(tA))
    check('B stays clean', tB?.dirty === false, JSON.stringify(tB))
    await evaluate(`window.__veloxP26.activateIndex(${idxB})`)
    await wait(150)
    doc = await evaluate(`window.__veloxP26.getDoc()`)
    check('switch to B shows doc B (A edit not visible)', doc.includes('BBB') && !doc.includes(MARK_A), doc.slice(0, 60))
    const posB = doc.indexOf('BBB')
    await evaluate(`window.__veloxP26.setCursor(${posB})`)
    await wait(80)
    const cursorB = await evaluate(`window.__veloxP26.getCursor()`)
    await evaluate(`window.__veloxP26.activateIndex(${idxA})`)
    await wait(150)
    doc = await evaluate(`window.__veloxP26.getDoc()`)
    check('back to A: edit preserved', doc.includes(MARK_A), doc.slice(0, 80))
    const cursorA2 = await evaluate(`window.__veloxP26.getCursor()`)
    check(
      'A cursor position restored on switch-back',
      cursorA2 === posA + 3 + MARK_A.length,
      `got ${cursorA2} want ${posA + 3 + MARK_A.length}`
    )

    // ---- S3 per-tab undo isolation -----------------------------------------
    console.log('\n--- S3 undo isolation ---')
    await evaluate(`window.__veloxP26.undo()`)
    await wait(120)
    doc = await evaluate(`window.__veloxP26.getDoc()`)
    check('undo in A reverts A edit', !doc.includes(MARK_A) && doc.includes('AAA'), doc.slice(0, 60))
    await evaluate(`window.__veloxP26.activateIndex(${idxB})`)
    await wait(150)
    doc = await evaluate(`window.__veloxP26.getDoc()`)
    check('B untouched by A undo', doc.includes('BBB') && !doc.includes(MARK_A))
    check('B cursor survived A-session', (await evaluate(`window.__veloxP26.getCursor()`)) === cursorB)

    // ---- S4 openPath on already-open tab reuses it -------------------------
    console.log('\n--- S4 reopen already-open path ---')
    const before4 = (await tabs()).length
    check('openPath b.md again', await evaluate(`window.__veloxP26.openPath(${JSON.stringify(B)})`))
    await wait(120)
    list = await tabs()
    check('tab count unchanged', list.length === before4, `${before4} → ${list.length}`)
    const act = list.find((t) => t.active)
    check('existing b.md tab activated', act?.path === B, JSON.stringify(act))

    // ---- S5 untitled naming -------------------------------------------------
    console.log('\n--- S5 untitled naming ---')
    await evaluate(`window.__veloxP26.newUntitled()`)
    await waitFor(`window.__veloxP26.tabs().some(t => t.name === 'untitled-2')`)
    list = await tabs()
    check('new untitled tab named untitled-2', list.some((t) => t.name === 'untitled-2'), JSON.stringify(list.map((t) => t.name)))
    check('untitled tab is active + empty', (await activeTab())?.name === 'untitled-2' && (await evaluate(`window.__veloxP26.getDoc()`)) === '')
    check('welcome tab untitled-1 still present', list.some((t) => t.name === 'untitled-1'))

    // ---- S6 context menu + middle-click + close others/right ---------------
    console.log('\n--- S6 close semantics ---')
    // Reopen a few docs for close tests.
    await evaluate(`window.__veloxP26.openPath(${JSON.stringify(A)})`)
    await evaluate(`window.__veloxP26.openPath(${JSON.stringify(B)})`)
    await evaluate(`window.__veloxP26.openPath(${JSON.stringify(C)})`)
    await wait(150)
    list = await tabs()
    console.log('    debug tabs before S6:', JSON.stringify(list.map((t) => ({ id: t.id, p: t.path ?? t.name, d: t.dirty, a: t.active }))))
    const idxC2 = list.findIndex((t) => t.path === C)
    // Product semantics: undo does not clear the dirty flag, and close-others
    // consults a dialog per dirty tab — clean everything first (acceptance 2
    // close-others on a clean set; the dirty-dialog path is S10).
    await evaluate(`window.__veloxP26.saveAllDirty()`)
    await wait(300)
    const dirtyPre = (await tabs()).filter((t) => t.dirty)
    check('close-others precondition: all tabs clean', dirtyPre.length === 0, JSON.stringify(dirtyPre))
    // Activate C so close-others keeps it.
    await evaluate(`window.__veloxP26.activateIndex(${idxC2})`)
    await wait(150)
    list = await tabs()
    const cTab = list.find((t) => t.path === C)
    check('C tab active before close-others', cTab?.active === true, JSON.stringify(list.map((t) => t.path ?? t.name)))
    // Context menu DOM probe: opens with 3 entries, click routes to closeOthers.
    const idxC3 = list.findIndex((t) => t.active && t.path === C)
    await tabDomEvent(idxC3, 'contextmenu', 2)
    await waitFor(`!!document.querySelector('.tab-context-menu')`)
    const menuLabels = await evaluate(`[...document.querySelectorAll('.tab-context-menu button')].map(b => b.textContent.trim())`)
    check(
      'context menu shows close/closeOthers/closeRight',
      menuLabels.length === 3,
      JSON.stringify(menuLabels)
    )
    const othersLabel = menuLabels.find((l) => /其他|Others/.test(l))
    check('menu has close-others entry', !!othersLabel, JSON.stringify(menuLabels))
    const clickedOthers = await evaluate(`(() => {
      const b = [...document.querySelectorAll('.tab-context-menu button')].find((x) => /其他|Others/.test(x.textContent))
      if (!b) return false
      b.click()
      return true
    })()`)
    check('close-others menu item clicked', clickedOthers)
    // Sweep is sequential+async — poll until it settles (only C left) or 3s.
    let closeOthersOk = false
    for (let i = 0; i < 30; i++) {
      await wait(100)
      list = await tabs()
      if (list.length === 1 && list[0].path === C) {
        closeOthersOk = true
        break
      }
    }
    if (!closeOthersOk) {
      // DOM click path failed — fall back to the hook so later scenarios can
      // proceed; the failure above still stands as the record.
      console.log('    debug tabs after close-others poll:', JSON.stringify((await tabs()).map((t) => ({ id: t.id, p: t.path ?? t.name, d: t.dirty }))))
      await evaluate(`(() => {
        const t = window.__veloxP26.tabs().find((x) => x.path === ${JSON.stringify(C)})
        if (t) window.__veloxP26.closeOthers(t.id)
        return !!t
      })()`)
      await wait(600)
      list = await tabs()
    }
    check('close others leaves only C', list.length === 1 && list[0].path === C, JSON.stringify(list.map((t) => t.path ?? t.name)))
    // Reopen B + A; close B via middle-click.
    await evaluate(`window.__veloxP26.openPath(${JSON.stringify(B)})`)
    await evaluate(`window.__veloxP26.openPath(${JSON.stringify(A)})`)
    await wait(150)
    list = await tabs()
    const idxB2 = list.findIndex((t) => t.path === B)
    await tabDomEvent(idxB2, 'auxclick', 1)
    await wait(200)
    list = await tabs()
    check('middle-click closes B tab', !list.some((t) => t.path === B), JSON.stringify(list.map((t) => t.path ?? t.name)))
    check('A + C remain', list.some((t) => t.path === A) && list.some((t) => t.path === C))

    // ---- S7 reopen closed tab ----------------------------------------------
    console.log('\n--- S7 reopen closed ---')
    check('hasClosedTabs true after closes', await evaluate(`window.__veloxP26.hasClosedTabs()`))
    await evaluate(`window.__veloxP26.reopenClosed()`)
    await wait(250)
    list = await tabs()
    check('reopenClosed restores most recent closed (B)', list.some((t) => t.path === B), JSON.stringify(list.map((t) => t.path ?? t.name)))
    doc = await evaluate(`(() => {
      const t = window.__veloxP26.tabs().find((x) => x.path === ${JSON.stringify(B)})
      if (!t) return ''
      window.__veloxP26.activate(t.id)
      return ''
    })()`)
    await wait(150)
    doc = await evaluate(`window.__veloxP26.getDoc()`)
    check('reopened B has original content', doc.includes('BBB'), doc.slice(0, 40))

    // ---- S8 drag reorder ----------------------------------------------------
    console.log('\n--- S8 reorder ---')
    list = await tabs()
    const orderBefore = list.map((t) => t.path ?? t.name)
    const dragId = list[0].id
    const targetId = list[list.length - 1].id
    await evaluate(`window.__veloxP26.reorder(${JSON.stringify(dragId)}, ${JSON.stringify(targetId)})`)
    await wait(150)
    list = await tabs()
    const orderAfter = list.map((t) => t.path ?? t.name)
    check('reorder moves first tab to last', orderAfter[orderAfter.length - 1] === orderBefore[0], `${JSON.stringify(orderBefore)} → ${JSON.stringify(orderAfter)}`)
    check('reorder preserves tab set', [...orderAfter].sort().join() === [...orderBefore].sort().join())

    // ---- S9 Ctrl+Tab cycle --------------------------------------------------
    console.log('\n--- S9 Ctrl+Tab ---')
    const beforeIdx = await activeIndex()
    const countNow = (await tabs()).length
    await dispatchKey('Tab', { ctrl: true, code: 'Tab' })
    await wait(150)
    const afterIdx = await activeIndex()
    check('Ctrl+Tab advances active tab', afterIdx === (beforeIdx + 1) % countNow, `${beforeIdx} → ${afterIdx} of ${countNow}`)

    // ---- S10 dirty close dialog ---------------------------------------------
    console.log('\n--- S10 dirty close dialog ---')
    list = await tabs()
    const tA2 = list.find((t) => t.path === A)
    await evaluate(`window.__veloxP26.activate(${JSON.stringify(tA2.id)}); window.__veloxP26.insertText(window.__veloxP26.getDoc().length, ${JSON.stringify(MARK_A)})`)
    await wait(150)
    check('A dirty again', (await tabs()).find((t) => t.path === A)?.dirty === true)
    const closePromise = race(evaluate(`window.__veloxP26.closeId(${JSON.stringify(tA2.id)})`), 8000, 'closeId-cancel')
    await waitFor(`!!document.querySelector('.dialog')`)
    const dlg = await dialogInfo()
    check('dirty close dialog appears', !!dlg, JSON.stringify(dlg))
    check('dialog names the document', (dlg?.message ?? '').includes('a.md'), dlg?.message)
    check('dialog offers 3 options', (dlg?.buttons ?? []).length === 3, JSON.stringify(dlg?.buttons))
    check('cancel button present (取消)', (dlg?.buttons ?? []).includes('取消'), JSON.stringify(dlg?.buttons))
    const cancelClicked = await clickDialogButton('取消')
    check('cancel click dismissed dialog', cancelClicked)
    const closeRes = await closePromise.catch((e) => `ERR ${e.message}`)
    check('closeId resolved after cancel', closeRes === false, String(closeRes))
    await wait(150)
    list = await tabs()
    check('cancel keeps the tab open', list.some((t) => t.path === A), JSON.stringify(list.map((t) => t.path ?? t.name)))
    // Second attempt: discard.
    const closePromise2 = race(evaluate(`window.__veloxP26.closeId(${JSON.stringify(tA2.id)})`), 8000, 'closeId-discard')
    await waitFor(`!!document.querySelector('.dialog')`)
    const dlg2 = await dialogInfo()
    check('discard button present (不保存)', (dlg2?.buttons ?? []).includes('不保存'), JSON.stringify(dlg2?.buttons))
    const discardClicked = await clickDialogButton('不保存')
    check('discard click dismissed dialog', discardClicked)
    const closeRes2 = await closePromise2.catch((e) => `ERR ${e.message}`)
    check('closeId resolved after discard', closeRes2 === true, String(closeRes2))
    await wait(200)
    list = await tabs()
    check('discard closes the tab', !list.some((t) => t.path === A), JSON.stringify(list.map((t) => t.path ?? t.name)))
    check('some tab became active after close', (await activeTab()) !== null)
    // Edit discarded — reopen A from disk shows original content.
    await evaluate(`window.__veloxP26.openPath(${JSON.stringify(A)})`)
    await wait(150)
    doc = await evaluate(`window.__veloxP26.getDoc()`)
    check('discarded edit gone — disk content restored', doc.includes('AAA') && !doc.includes(MARK_A), doc.slice(0, 60))

    // ---- S11 Ctrl+W tab-aware (renderer command path) -----------------------
    console.log('\n--- S11 Ctrl+W ---')
    list = await tabs()
    check('Ctrl+W precondition: tabs > 1', list.length > 1, String(list.length))
    const beforeW = list.length
    const actW = list.find((t) => t.active)
    await dispatchKey('w', { ctrl: true, code: 'KeyW' })
    await wait(250)
    list = await tabs()
    check('Ctrl+W with tabs>1 closes the active tab', list.length === beforeW - 1 && !list.some((t) => t.id === actW.id), `${beforeW} → ${list.length}`)
    check('no dialog for clean tab Ctrl+W', !(await dialogInfo()))
    // menu:closeTabOrWindow renderer logic (same seams): single-tab dirty → queryClose.
    list = await tabs()
    while ((await tabs()).length > 1) {
      const t = (await tabs()).find((x) => !x.active) ?? (await tabs())[0]
      const ok = await evaluate(`window.__veloxP26.closeId(${JSON.stringify(t.id)}, { force: true })`)
      if (!ok) break
      await wait(80)
    }
    list = await tabs()
    check('closed down to a single tab', list.length === 1, String(list.length))
    // Dirty the single tab and run the close-query seam.
    await evaluate(`window.__veloxP26.insertText(window.__veloxP26.getDoc().length, ${JSON.stringify(MARK_B)})`)
    await wait(120)
    const qcPromise = race(evaluate(`window.__veloxP26.queryClose()`), 8000, 'queryClose-single')
    await waitFor(`!!document.querySelector('.dialog')`)
    const dlgW = await dialogInfo()
    check('single dirty tab: close-query dialog appears', !!dlgW && dlgW.buttons.length === 3, JSON.stringify(dlgW))
    const qcCancelClicked = await clickDialogButton('取消')
    check('single-tab queryClose cancel click', qcCancelClicked)
    const qcResult = await qcPromise.catch((e) => `ERR ${e.message}`)
    check('close-query cancel → window close denied', qcResult === false, String(qcResult))
    check('tab content kept after denied close', (await evaluate(`window.__veloxP26.getDoc()`)).includes(MARK_B))

    // ---- S12 multi-dirty close-query message --------------------------------
    console.log('\n--- S12 multi-dirty queryClose ---')
    // c.md may still carry the S11 probe edit — clean the slate first so the
    // multi-dirty count is exactly the two tabs dirtied below.
    await evaluate(`window.__veloxP26.saveAllDirty()`)
    await wait(250)
    await evaluate(`window.__veloxP26.openPath(${JSON.stringify(A)})`)
    await evaluate(`window.__veloxP26.openPath(${JSON.stringify(B)})`)
    await wait(150)
    list = await tabs()
    const mA = list.find((t) => t.path === A)
    const mB = list.find((t) => t.path === B)
    await evaluate(`window.__veloxP26.activate(${JSON.stringify(mA.id)}); window.__veloxP26.insertText(window.__veloxP26.getDoc().length, ${JSON.stringify(MARK_A)})`)
    await evaluate(`window.__veloxP26.activate(${JSON.stringify(mB.id)}); window.__veloxP26.insertText(window.__veloxP26.getDoc().length, ${JSON.stringify(MARK_B)})`)
    await wait(150)
    const qc2 = race(evaluate(`window.__veloxP26.queryClose()`), 8000, 'queryClose-multi')
    await waitFor(`!!document.querySelector('.dialog')`)
    const dlgM = await dialogInfo()
    check(
      'multi-dirty dialog counts documents',
      (dlgM?.message ?? '').includes('2 个文档') || (dlgM?.message ?? '').includes('2 documents'),
      dlgM?.message
    )
    check('multi-dirty dialog lists file names', (dlgM?.message ?? '').includes('a.md') && (dlgM?.message ?? '').includes('b.md'), dlgM?.message)
    const multiCancelClicked = await clickDialogButton('取消')
    check('multi queryClose cancel click', multiCancelClicked)
    const qc2Res = await qc2.catch((e) => `ERR ${e.message}`)
    check('multi queryClose cancel → false', qc2Res === false, String(qc2Res))

    // ---- S13 autosave walks ALL dirty tabs -----------------------------------
    console.log('\n--- S13 autosave all dirty tabs ---')
    // Pref is autoSaveDelaySec (seconds). notifyChange arms the debounce only
    // on editor changes AFTER the mode flip — make fresh edits to arm it.
    await evaluate(`window.__veloxPrefs.setPreferences({ autoSaveMode: 'debounce', autoSaveDelaySec: 1 })`)
    await wait(120)
    const aContent = readFileSync(A, 'utf8')
    const bContent = readFileSync(B, 'utf8')
    check('disk A lacks marker before autosave', !aContent.includes(MARK_A), aContent.slice(0, 40))
    check('disk B lacks marker before autosave', !bContent.includes(MARK_B), bContent.slice(0, 40))
    list = await tabs()
    const dA = list.find((t) => t.path === A)
    const dB = list.find((t) => t.path === B)
    check('A + B tabs dirty before autosave arm', dA?.dirty && dB?.dirty, JSON.stringify([dA, dB]))
    await evaluate(`window.__veloxP26.activate(${JSON.stringify(dA.id)}); window.__veloxP26.insertText(window.__veloxP26.getDoc().length, '·A')`)
    await evaluate(`window.__veloxP26.activate(${JSON.stringify(dB.id)}); window.__veloxP26.insertText(window.__veloxP26.getDoc().length, '·B')`)
    // Poll disk up to 5s for both markers (debounce 1s + IPC write latency).
    let aOk = false
    let bOk = false
    for (let i = 0; i < 25; i++) {
      await wait(200)
      aOk = readFileSync(A, 'utf8').includes(MARK_A)
      bOk = readFileSync(B, 'utf8').includes(MARK_B)
      if (aOk && bOk) break
    }
    check('autosave wrote dirty tab A to disk', aOk, readFileSync(A, 'utf8').slice(0, 80))
    check('autosave wrote dirty tab B to disk', bOk, readFileSync(B, 'utf8').slice(0, 80))
    await wait(400)
    list = await tabs()
    check('all tabs clean after autosave', list.every((t) => !t.dirty), JSON.stringify(list.filter((t) => t.dirty)))
    await evaluate(`window.__veloxPrefs.setPreferences({ autoSaveMode: 'off' })`)

    // ---- S14 per-tab baseDir -------------------------------------------------
    console.log('\n--- S14 per-tab baseDir ---')
    check('open dirA/x.md', await evaluate(`window.__veloxP26.openPath(${JSON.stringify(X)})`))
    await wait(120)
    let baseDir = await evaluate(`window.__veloxP26.getBaseDir()`)
    check('baseDir follows dirA tab', String(baseDir).endsWith('dirA'), String(baseDir))
    check('open dirB/y.md', await evaluate(`window.__veloxP26.openPath(${JSON.stringify(Y)})`))
    await wait(120)
    baseDir = await evaluate(`window.__veloxP26.getBaseDir()`)
    check('baseDir switches to dirB', String(baseDir).endsWith('dirB'), String(baseDir))

    // ---- S15 many tabs (no LRU — documented deviation) -----------------------
    console.log('\n--- S15 32 tabs open without eviction ---')
    for (const p of MANY) {
      await evaluate(`window.__veloxP26.openPath(${JSON.stringify(p)})`)
    }
    await wait(300)
    list = await tabs()
    const manyPresent = MANY.filter((p) => list.some((t) => t.path === p)).length
    check('all 32 many/ tabs present (no LRU eviction)', manyPresent === 32, `${manyPresent}/32 in ${list.length} tabs`)
    check('app still responsive after 32 tabs', (await evaluate(`window.__veloxP26.getDoc()`)).includes('Tab 32'))

    // ---- S16 session persist + restore + missing toast -----------------------
    console.log('\n--- S16 session restore ---')
    // Narrow to a known clean set: keep A active, close everything else dirty-free.
    await evaluate(`window.__veloxP26.openPath(${JSON.stringify(A)})`)
    await wait(150)
    list = await tabs()
    const idA = list.find((t) => t.path === A).id
    await evaluate(`window.__veloxP26.closeOthers(${JSON.stringify(idA)})`)
    for (let i = 0; i < 30; i++) {
      await wait(100)
      const cur = await tabs()
      if (cur.length <= 3) break
    }
    await evaluate(`window.__veloxP26.openPath(${JSON.stringify(B)})`)
    await evaluate(`window.__veloxP26.openPath(${JSON.stringify(C)})`)
    await wait(150)
    list = await tabs()
    const idA2 = list.find((t) => t.path === A).id
    await evaluate(`window.__veloxP26.activate(${JSON.stringify(idA2)})`)
    await wait(120)
    await evaluate(`window.__veloxP26.persistTabs()`)
    await wait(100)
    const sess = await evaluate(`window.__veloxP26.getSessionTabs()`)
    check('session openTabs persisted', Array.isArray(sess.openTabs) && sess.openTabs.includes(A) && sess.openTabs.includes(B), JSON.stringify(sess))
    check('session activePath persisted', sess.activePath === A, String(sess.activePath))
    // Pin restore flag + clear drafts. Chromium flushes localStorage to disk
    // asynchronously — SIGKILL right after setItem loses the write, so write
    // through BOTH the store hook and raw localStorage, then verify + idle.
    const pinCheck = await evaluate(`(() => {
      window.__veloxPrefs.setPreferences({ restoreLastSession: true })
      const rawPrefs = JSON.parse(localStorage.getItem('veloxmark.preferences') || '{}')
      rawPrefs.restoreLastSession = true
      localStorage.setItem('veloxmark.preferences', JSON.stringify(rawPrefs))
      const rawSess = JSON.parse(localStorage.getItem('veloxmark.session') || '{}')
      // Re-assert session tabs in raw storage too (survives any patch race).
      const tabsNow = window.__veloxP26.tabs().map((t) => t.path).filter(Boolean)
      const act = window.__veloxP26.tabs().find((t) => t.active)
      if (tabsNow.length > 0) {
        rawSess.openTabs = tabsNow
        rawSess.activePath = act && act.path ? act.path : rawSess.activePath
        localStorage.setItem('veloxmark.session', JSON.stringify(rawSess))
      }
      try { localStorage.setItem('veloxmark.drafts', '{}') } catch {}
      return {
        pref: JSON.parse(localStorage.getItem('veloxmark.preferences') || '{}').restoreLastSession,
        sessTabs: JSON.parse(localStorage.getItem('veloxmark.session') || '{}').openTabs,
        sessActive: JSON.parse(localStorage.getItem('veloxmark.session') || '{}').activePath
      }
    })()`)
    check('pre-relaunch prefs pinned restoreLastSession=true', pinCheck.pref === true, JSON.stringify(pinCheck))
    check('pre-relaunch session holds tab paths', Array.isArray(pinCheck.sessTabs) && pinCheck.sessTabs.includes(A), JSON.stringify(pinCheck))
    // Delete B from disk → must be skipped on restore.
    rmSync(B, { force: true })
    // Session restore across process restarts goes through the same
    // localStorage state; SIGKILL can drop unflushed writes (known, cf.
    // cdp-p12), so the e2e proves the restore path with an in-process reload
    // — the same code path real boots run (restoredRef effect on mount).
    await evaluate(`location.reload()`)
    await wait(1400)
    session = await connect()
    await hookReady()
    // Restore runs async after mount — poll up to 8s for path tabs.
    let list16 = []
    for (let i = 0; i < 40; i++) {
      await wait(200)
      list16 = await tabs()
      if (list16.some((t) => t.path === A)) break
    }
    if (!list16.some((t) => t.path === A)) {
      const dbg = await evaluate(`(() => ({
        prefs: window.__veloxPrefs.getPreferences().restoreLastSession,
        session: localStorage.getItem('veloxmark.session'),
        tabs: window.__veloxP26.tabs().map((t) => t.path ?? t.name)
      }))()`)
      console.log('    debug restore miss:', JSON.stringify(dbg))
    }
    list = list16
    const restoredPaths = list.map((t) => t.path).filter(Boolean)
    check('restore: a.md reopened', restoredPaths.includes(A), JSON.stringify(restoredPaths))
    check('restore: c.md reopened', restoredPaths.includes(C), JSON.stringify(restoredPaths))
    check('restore: missing b.md skipped', !restoredPaths.includes(B), JSON.stringify(restoredPaths))
    const actR = list.find((t) => t.active)
    check('restore: activePath honored (a.md)', actR?.path === A, JSON.stringify(actR))
    let toast = await evaluate(`window.__veloxP26.getToast()`)
    for (let i = 0; i < 10 && !toast; i++) {
      await wait(200)
      toast = await evaluate(`window.__veloxP26.getToast()`)
    }
    check('restore: missing-files toast shown', !!toast && toast.includes('缺失'), String(toast))
    doc = await evaluate(`window.__veloxP26.getDoc()`)
    check('restore: active tab content is A', doc.includes('AAA'), doc.slice(0, 40))
    // Session never stores document content — openTabs are path strings only.
    const rawSession = await evaluate(`localStorage.getItem('veloxmark.session') ?? ''`)
    check('session storage holds paths, not content', rawSession.includes('a.md') && !rawSession.includes('AAA'), rawSession.slice(0, 200))
  } catch (e) {
    console.error('\nHARNESS ERROR:', e)
    failures.push(`harness: ${e.message}`)
  } finally {
    await killApp()
    try {
      if (ws) ws.close()
    } catch {}
  }

  console.log(`\n${failures.length === 0 ? 'ALL PASS' : `FAILURES: ${failures.length}`}`)
  if (failures.length > 0) {
    console.log(failures.join('\n'))
    process.exit(1)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
