// CDP smoke test for P03 (preferences + session persistence).
// Phase A mutates state through the real UI; Phase B (after app restart)
// asserts everything survived the restart. Run against a live instance:
//   npx electron . --remote-debugging-port=9223
//   node scripts/cdp-p03.mjs a && (restart electron) && node scripts/cdp-p03.mjs b
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PHASE = process.argv[2] ?? 'a'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9223
const CDP = `http://127.0.0.1:${CDP_PORT}`
// Point straight at dist/electron.exe: the .bin/electron.cmd shim is a batch
// file, and Node's spawn rejects it with EINVAL on this platform.
const ELECTRON_BIN = join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
const OUT = 'D:/code/typora/scripts'
const TMP = 'D:/code/typora/scripts/tmp-p03'
const GEOM_PROBE_PATH = join(TMP, 'window-state-path.json')

// The geometry file lives in the OS userData dir under a profile folder whose
// name embeds the app name. Walk the candidates looking for window-state.json.
function geometryCandidates() {
  const roots = [
    process.env.APPDATA,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Roaming'),
    join(process.env.HOME ?? '', 'AppData', 'Roaming'),
    join(process.env.HOME ?? '', '.config')
  ].filter(Boolean)
  const out = []
  for (const root of roots) {
    try {
      for (const entry of readdirSync(root)) {
        const p = join(root, entry, 'window-state.json')
        if (existsSync(p)) out.push(p)
      }
    } catch {}
  }
  return [...new Set(out)]
}

function readGeometry() {
  for (const path of geometryCandidates()) {
    try {
      const data = JSON.parse(readFileSync(path, 'utf-8'))
      // Only consider files main is actively maintaining for this run.
      if (typeof data.x === 'number' && typeof data.width === 'number') {
        return { path, data }
      }
    } catch {}
  }
  return null
}

// Read the renderer's localStorage straight off Chromium's LevelDB log. The
// store only writes on a real unload, and navigating back re-populates it, so
// the in-page value cannot tell a successful commit from a default. The log
// can — it is exactly what the next process will load.
function leveldbLogText() {
  const roots = [
    process.env.APPDATA,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Roaming'),
    join(process.env.HOME ?? '', 'AppData', 'Roaming'),
    join(process.env.HOME ?? '', '.config')
  ].filter(Boolean)
  for (const root of roots) {
    let entries = []
    try {
      entries = readdirSync(root)
    } catch {
      continue
    }
    for (const entry of entries) {
      const dir = join(root, entry, 'Local Storage', 'leveldb')
      let files = []
      try {
        files = readdirSync(dir).filter((f) => f.endsWith('.log') || f.endsWith('.ldb'))
      } catch {
        continue
      }
      // Reading the .ldb tables too: a small store can be compacted out of the
      // .log between the flush and this check.
      const text = files.map((f) => readFileSync(join(dir, f), 'latin1')).join('')
      if (text.includes('veloxmark.')) return text
    }
  }
  return ''
}

function leveldbHasKey(key) {
  return leveldbLogText().includes(key)
}

function leveldbHasPrefsValue(fontSize, theme) {
  const text = leveldbLogText()
  // LevelDB stores length-prefixed strings, so match on the JSON body rather
  // than an exact framing. Any one committed record carrying both is enough.
  const records = text.split('veloxmark.preferences')
  return records.some((r) => {
    const start = r.indexOf('{')
    if (start < 0) return false
    const body = r.slice(start, start + 2000)
    const sizeAt = body.indexOf(`"editorFontSize":${fontSize}`)
    const themeAt = body.indexOf(`"theme":"${theme}"`)
    return sizeAt >= 0 && themeAt >= 0 && themeAt < sizeAt + 200
  })
}

async function getTarget(timeoutMs = 15000) {
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

// Launch the app with a fresh remote-debugging port and wait for its page.
// Used to repopulate the store after a Phase A flush, and to recover if the
// app is not running when the script starts.
function startApp() {
  app = spawn(ELECTRON_BIN, ['.', `--remote-debugging-port=${CDP_PORT}`], {
    cwd: ROOT,
    stdio: 'ignore',
    windowsHide: true,
    shell: false
  })
  return getTarget(30000)
}

let target = await getTarget()
// Captured from the live target rather than hardcoded, so the flush helper can
// find the app again after it closes and relaunches the renderer.
let APP_URL = target.url
let ws = null
let id = 0
let pending = new Map()

// Attach a socket to `target` and route replies into the shared `pending` map.
// Reused by flushLocalStorage, which must reconnect after closing the target.
function wireSocket(socket) {
  ws = socket
  socket.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    }
  })
}

wireSocket(new WebSocket(target.webSocketDebuggerUrl))

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id
    pending.set(msgId, { resolve, reject })
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })
}

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
  return r.result.value
}

async function screenshot(path) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(path, Buffer.from(r.data, 'base64'))
  console.log('saved', path)
}

async function hover(selector) {
  const rect = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  if (!rect) throw new Error(`hover target not found: ${selector}`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y })
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function drag(selector, dx, dy) {
  const rect = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  if (!rect) throw new Error(`drag target not found: ${selector}`)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x + dx, y: rect.y + dy, button: 'left' })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x + dx, y: rect.y + dy, button: 'left', clickCount: 1 })
}

async function waitFor(selector, timeout = 15000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const found = await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)
    if (found) return
    await wait(250)
  }
  throw new Error(`timed out waiting for ${selector}`)
}

// The OS window's real outer bounds, readable from the page itself.
async function windowBounds() {
  return evaluate(`({
    x: window.screenX,
    y: window.screenY,
    width: window.outerWidth,
    height: window.outerHeight
  })`)
}

// OS window geometry (titlebar drag to move, edge drag to resize) is handled by
// the non-client hit-test path and does not respond to CDP-synthesized mouse
// events at any edge inset — verified in scripts/dragprobe.mjs and
// scripts/resizeborder.mjs. Driving a bounds *change* from a smoke test is
// therefore not possible; geometry is asserted on main's persisted output
// instead, which Phase B restores from.

// Commit renderer localStorage to disk, then reconnect to the freshly started
// renderer. Measured behaviour in this Electron build:
//   - page.reload() does NOT commit (LevelDB log keeps its previous size)
//   - Page.navigate to about:blank commits only sometimes — the write races
//     main relaunching the renderer, which opens a second LevelDB writer
//   - a graceful target close commits reliably, because the renderer tears
//     down and its storage flush runs to completion
// So close the target and wait for main to bring up a new one. The caller must
// re-`waitFor` its selectors afterwards; the old DOM is gone.
let app = null

async function flushLocalStorage() {
  // The only teardown that reliably commits renderer localStorage is a normal
  // process exit — a graceful CDP close was measured to land the write, while
  // `taskkill /F` and page.reload() both drop it. Quitting the app means there
  // is nothing left to reconnect to, so relaunch it here.
  await fetch(`${CDP}/json/close/${target.id}`).catch(() => {})
  if (app) {
    await app.kill().catch(() => {})
    app = null
  }
  pending = new Map() // replies from the dead socket are abandoned on purpose
  await startApp()

  target = await getTarget(30000)
  const nextWs = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve) => nextWs.addEventListener('open', resolve))
  wireSocket(nextWs)
  await send('Page.enable')
  await send('Runtime.enable')
  await waitFor('.cm-content')
  APP_URL = target.url
}

function assert(cond, label, detail) {
  if (!cond) {
    console.error(`FAIL: ${label}`, detail ?? '')
    process.exitCode = 1
  } else {
    console.log(`ok: ${label}`)
  }
}

await new Promise((resolve) => ws.addEventListener('open', resolve))
await send('Page.enable')
await send('Runtime.enable')
await wait(2500)
await waitFor('.cm-content')

if (PHASE === 'a') {
  // Wipe profile state and reload so defaults are actually tested.
  await evaluate(`(() => {
    localStorage.removeItem('veloxmark.preferences')
    localStorage.removeItem('veloxmark.session')
    localStorage.removeItem('theme')
    localStorage.removeItem('enabled')
    localStorage.removeItem('wrapBareUrlOnPaste')
    location.reload()
  })()`)
  await wait(3000)
  await waitFor('.cm-content')

  // --- defaults on a clean profile ------------------------------------------
  const initial = await evaluate(`(() => ({
    fontSizeVar: getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size').trim(),
    contentFont: getComputedStyle(document.querySelector('.cm-content')).fontSize,
    gutters: !!document.querySelector('.cm-gutters'),
    sidebar: !!document.querySelector('.sidebar')
  }))()`)
  assert(initial.fontSizeVar === '16px', 'default --editor-font-size is 16px', initial)
  assert(initial.contentFont === '16px', 'cm-content default font 16px', initial)
  assert(initial.gutters, 'line numbers visible by default')
  assert(initial.sidebar, 'sidebar visible by default')

  // --- File menu contains Preferences… and Open Recent -----------------------
  await evaluate(`document.querySelectorAll('.menubar-label')[0].click()`)
  await wait(300)
  const fileMenu = await evaluate(`(() => ({
    labels: [...document.querySelectorAll('.menu-dropdown > .menu-item, .menu-dropdown > .menu-sub-host > .menu-item')].map(b => b.textContent),
  }))()`)
  assert(fileMenu.labels.some((l) => l.includes('Preferences')), 'File menu has Preferences…', fileMenu)
  assert(fileMenu.labels.some((l) => l.includes('Open Recent')), 'File menu has Open Recent', fileMenu)
  await hover('.menu-sub-host')
  await wait(200)
  const emptyRecent = await evaluate(`document.querySelector('.menu-sub')?.textContent`)
  assert(emptyRecent?.includes('No Recent Files'), 'empty Open Recent shows placeholder', emptyRecent)
  await screenshot(`${OUT}/p03-file-menu.png`)
  await evaluate(`document.body.click()`)

  // --- Ctrl+, opens the preferences panel ------------------------------------
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true }))`)
  await wait(300)
  const panel = await evaluate(`(() => ({
    open: !!document.querySelector('.prefs-dialog'),
    sections: [...document.querySelectorAll('.prefs-section-title')].map(s => s.textContent)
  }))()`)
  assert(panel.open, 'Ctrl+, opens the preferences panel', panel)
  assert(
    JSON.stringify(panel.sections) === JSON.stringify(['Appearance', 'Editing', 'Behavior']),
    'panel groups are Appearance/Editing/Behavior',
    panel
  )
  await screenshot(`${OUT}/p03-prefs-panel.png`)

  // --- live preview: font size 18 applies immediately ------------------------
  await evaluate(`(() => {
    const input = document.querySelectorAll('.prefs-input-num')[0]
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, '18')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await wait(300)
  const afterFontSize = await evaluate(`(() => ({
    contentFont: getComputedStyle(document.querySelector('.cm-content')).fontSize,
    stored: window.__veloxPrefs.getPreferences().editorFontSize
  }))()`)
  assert(afterFontSize.contentFont === '18px', 'font size 18px live-applies', afterFontSize)
  assert(afterFontSize.stored === 18, 'font size 18 written to store', afterFontSize)

  // --- line-number toggle reconfigures the editor ----------------------------
  await evaluate(`(() => {
    const boxes = [...document.querySelectorAll('.prefs-dialog input[type=checkbox]')]
    boxes[2].click() // Show line numbers
  })()`)
  await wait(300)
  const guttersOff = await evaluate(`!document.querySelector('.cm-gutters')`)
  assert(guttersOff, 'line numbers toggle removes gutters')
  await evaluate(`(() => {
    const boxes = [...document.querySelectorAll('.prefs-dialog input[type=checkbox]')]
    boxes[2].click()
  })()`)
  await wait(200)

  // --- theme: dark, persisted as preference ----------------------------------
  await evaluate(`(() => {
    const sel = document.querySelector('.prefs-dialog select')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    setter.call(sel, 'dark')
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await wait(400)
  const dark = await evaluate(`(() => ({
    appClass: document.querySelector('.app').className,
    stored: window.__veloxPrefs.getPreferences().theme
  }))()`)
  assert(dark.appClass.includes('theme-dark'), 'selecting Dark switches the app', dark)
  assert(dark.stored === 'dark', 'theme mode written to store', dark)
  await screenshot(`${OUT}/p03-prefs-dark.png`)

  // close panel
  await evaluate(`[...document.querySelectorAll('.prefs-dialog .dialog-btn')].find(b => b.textContent === 'Close').click()`)
  await wait(200)

  // --- recording: openRecentFile path records via addRecentFile (loadContent) -
  // Drive a real open through the session-restore code path is restart-only;
  // here we assert the store helper directly, then verify sidebar persistence.
  await evaluate(`window.__veloxPrefs.addRecentFile('D:/code/typora/scripts/tmp-p03/seed.md')`)
  const recents = await evaluate(`window.__veloxPrefs.getSession().recentFiles`)
  assert(recents.length === 1 && recents[0].endsWith('seed.md'), 'addRecentFile records', recents)

  // --- sidebar width is recorded when the user drags the resizer -------------
  await drag('.sidebar-resizer', 90, 0)
  await wait(400)
  const dragged = await evaluate(`(() => {
    const el = document.querySelector('.sidebar')
    return {
      styleWidth: el?.style.width ?? null,
      stored: window.__veloxPrefs.getSession().sidebarWidth
    }
  })()`)
  assert(dragged.stored === 330, 'dragging the resizer stores 330px', dragged)
  assert(dragged.styleWidth === '330px', 'sidebar resizes live to 330px', dragged)

  // --- sidebar visibility persists -------------------------------------------
  await evaluate(`document.querySelector('.tb-btn[title="Toggle outline"]').click()`)
  await wait(300)
  const sidebarState = await evaluate(`(() => ({
    hasSidebar: !!document.querySelector('.sidebar'),
    sessionVisible: window.__veloxPrefs.getSession().sidebarVisible
  }))()`)
  assert(!sidebarState.hasSidebar, 'sidebar toggled off')
  assert(sidebarState.sessionVisible === false, 'sidebar visibility written to session', sidebarState)

  // --- seed session for the restart phase ------------------------------------
  mkdirSync(TMP, { recursive: true })
  writeFileSync(`${TMP}/a.md`, '# Session file\n\nrestored by P03\n', 'utf-8')
  writeFileSync(`${TMP}/b.md`, '# Second\n', 'utf-8')
  const seeded = await evaluate(`(() => {
    const s = window.__veloxPrefs.getSession()
    const files = [
      'D:/code/typora/scripts/tmp-p03/a.md',
      'D:/code/typora/scripts/tmp-p03/missing-1.md',
      'D:/code/typora/scripts/tmp-p03/missing-2.md',
      'D:/code/typora/scripts/tmp-p03/b.md',
      'D:/code/typora/scripts/tmp-p03/missing-3.md',
      'D:/code/typora/scripts/tmp-p03/missing-4.md',
      'D:/code/typora/scripts/tmp-p03/missing-5.md',
      'D:/code/typora/scripts/tmp-p03/missing-6.md',
      'D:/code/typora/scripts/tmp-p03/missing-7.md',
      'D:/code/typora/scripts/tmp-p03/missing-8.md',
      'D:/code/typora/scripts/tmp-p03/missing-9.md',
      'D:/code/typora/scripts/tmp-p03/missing-10.md'
    ]
    const next = {
      ...s,
      recentFiles: files,
      lastFilePath: files[0],
      // Acceptance criterion 2: an opened folder comes back in files mode.
      lastFolderPath: 'D:/code/typora/scripts/tmp-p03',
      sidebarMode: 'files'
    }
    localStorage.setItem('veloxmark.session', JSON.stringify(next))
    return next
  })()`)
  assert(seeded.recentFiles.length === 12, 'seeded 12 recent files (cap tested after flush)')

  // --- flush renderer storage before the restart ------------------------------
  // Every preference and session mutation above is still only in the renderer's
  // memory; Chromium commits localStorage to disk on unload. Reloading forces
  // that commit, so Phase B is measuring persistence and not just this process.
  // Without this the font-size and theme asserts read the store they just
  // wrote, pass, and then come back at defaults after a restart.
  await flushLocalStorage()
  const flushedPrefs = await evaluate(`window.__veloxPrefs.getPreferences()`)
  assert(flushedPrefs.editorFontSize === 18, 'font size 18 survived a storage flush', flushedPrefs)
  assert(flushedPrefs.theme === 'dark', 'dark theme survived a storage flush', flushedPrefs)
  // The two asserts above read the *reloaded* store, so they also pass when the
  // commit was lost and the page came back at defaults. Check the LevelDB log
  // itself — that is the only thing Phase B actually loads from.
  assert(leveldbHasKey('veloxmark.preferences'), 'preferences key committed to the LevelDB log')
  assert(leveldbHasPrefsValue(18, 'dark'), 'LevelDB log holds font size 18 + dark theme')
  const flushedSession = await evaluate(`window.__veloxPrefs.getSession()`)
  // Seeded 12, but RECENT_FILES_MAX is 10 — the store caps on write, so the
  // flushed list must already be 10. This is the same cap the File menu shows.
  assert(
    flushedSession.recentFiles?.length === 10,
    'recents capped at 10 by the store on write',
    flushedSession.recentFiles
  )
  assert(
    !flushedSession.recentFiles.some((p) => p.includes('missing-10')),
    'oldest recent entries dropped by the cap',
    flushedSession.recentFiles
  )

  // --- window geometry is saved by the main process ---------------------------
  // OS non-client geometry (titlebar drag to move, edge drag to resize) is not
  // reachable from CDP-synthesized input at any edge inset, so no bounds
  // *change* can be driven from a smoke test. What is assertable is that main
  // persists well-formed geometry on its own — the write path Phase B restores.
  const savedGeom = readGeometry()
  const geom = savedGeom?.data
  const geomOk = !!geom &&
    typeof geom.x === 'number' && typeof geom.y === 'number' &&
    typeof geom.width === 'number' && typeof geom.height === 'number' &&
    geom.width >= 400 && geom.height >= 300 &&
    typeof geom.maximized === 'boolean'
  assert(geomOk, 'main persists well-formed window geometry', geom)
  // Record the file main wrote so Phase B can compare against it after restart.
  writeFileSync(GEOM_PROBE_PATH, JSON.stringify({ ...savedGeom, expected: geom }, null, 2), 'utf-8')
  console.log('PHASE A done — restart electron, then run: node scripts/cdp-p03.mjs b')
}

if (PHASE === 'b') {
  // --- self-cleaning guard ----------------------------------------------------
  // Phase B ends by opening a recent file, which rewrites the session. Running
  // Phase B twice therefore legitimately restores that later state — b.md open,
  // sidebar back in outline — and the restore assertions fail on run 2+. They
  // assert Phase A's seeded state (a.md / '# Session file'), so detect that
  // state shift and point at the real cause instead of reporting a product bug.
  const bootTitle = await evaluate(`document.querySelector('.tb-title')?.textContent ?? ''`)
  if (bootTitle.includes('b.md')) {
    console.log(
      'SKIP: this profile was already exercised by a previous Phase B run\n' +
        '      (last file is b.md, which Phase B opens at the end). The restore\n' +
        '      assertions below check Phase A\'s seeded a.md state, so they would\n' +
        '      fail on state a prior run created — not on a product defect.\n' +
        '      Re-run the full cycle for a clean proof:\n' +
        '        rm -rf "$APPDATA/veloxmark"  # or delete the veloxmark userData dir\n' +
        '        npx electron . --remote-debugging-port=9223   # then: node scripts/cdp-p03.mjs a\n' +
        '        # restart electron\n' +
        '        node scripts/cdp-p03.mjs b'
    )
    process.exit(0)
  }

  // --- window geometry restored by the main process ---------------------------
  // Phase A recorded the bounds main persisted; on a cold start main must hand
  // those exact bounds back to BrowserWindow rather than the default size.
  const expected = JSON.parse(readFileSync(GEOM_PROBE_PATH, 'utf-8'))
  assert(!!expected.expected, 'Phase A recorded expected window bounds', expected.expected)
  if (expected.expected) {
    const geom = await windowBounds()
    const restoredOk =
      Math.abs(geom.x - expected.expected.x) <= 2 &&
      Math.abs(geom.y - expected.expected.y) <= 2 &&
      Math.abs(geom.width - expected.expected.width) <= 2 &&
      Math.abs(geom.height - expected.expected.height) <= 2
    assert(restoredOk, 'restart restores the saved window geometry', { geom, expected: expected.expected })
  }
  // --- preferences survived the restart --------------------------------------
  const restored = await evaluate(`(() => ({
    fontSizeVar: getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size').trim(),
    contentFont: getComputedStyle(document.querySelector('.cm-content')).fontSize,
    appClass: document.querySelector('.app').className,
    prefs: window.__veloxPrefs.getPreferences()
  }))()`)
  assert(restored.contentFont === '18px', 'font size 18px survives restart', restored)
  assert(restored.appClass.includes('theme-dark'), 'dark theme survives restart', restored)
  assert(restored.prefs.editorFontSize === 18, 'store still has 18', restored.prefs)

  // --- session restore opened the last file ----------------------------------
  await wait(1500)
  const sessionOpen = await evaluate(`(() => ({
    title: document.querySelector('.tb-title')?.textContent ?? '',
    body: document.querySelector('.cm-content')?.textContent ?? ''
  }))()`)
  assert(sessionOpen.title.includes('a.md'), 'last file restored into the editor', sessionOpen)
  assert(sessionOpen.body.includes('restored by P03'), 'restored content loaded', sessionOpen)

  // --- folder workspace restores into files mode ------------------------------
  // Acceptance criterion 2: an opened folder must come back in files mode, not
  // outline, even though a file was restored at the same time.
  const filesMode = await evaluate(`(() => ({
    hasTree: !!document.querySelector('.filetree'),
    hasOutline: !!document.querySelector('.outline'),
    storedMode: window.__veloxPrefs.getSession().sidebarMode,
    storedFolder: window.__veloxPrefs.getSession().lastFolderPath
  }))()`)
  assert(filesMode.storedFolder?.endsWith('tmp-p03'), 'folder workspace recorded', filesMode)
  assert(filesMode.storedMode === 'files', 'folder workspace restores into files mode', filesMode)
  assert(filesMode.hasTree, 'file tree is rendered after restart', filesMode)
  assert(!filesMode.hasOutline, 'outline is not shown instead of the file tree', filesMode)
  await screenshot(`${OUT}/p03-files-mode.png`)

  // --- sidebar width survived the restart ------------------------------------
  // Phase A dragged the resizer to 330px; the folder workspace restored the
  // sidebar, so its width must come back from the session blob.
  const sidebarWidth = await evaluate(`(() => {
    const el = document.querySelector('.sidebar')
    return {
      present: !!el,
      styleWidth: el ? el.style.width : null,
      computedWidth: el ? getComputedStyle(el).width : null,
      stored: window.__veloxPrefs.getSession().sidebarWidth
    }
  })()`)
  assert(sidebarWidth.present, 'sidebar is visible in files mode', sidebarWidth)
  assert(sidebarWidth.stored === 330, 'session stored the dragged width', sidebarWidth)
  assert(sidebarWidth.styleWidth === '330px', 'sidebar style reapplies 330px', sidebarWidth)
  assert(sidebarWidth.computedWidth === '330px', 'sidebar renders 330px wide', sidebarWidth)
  await screenshot(`${OUT}/p03-sidebar-width.png`)

  // --- Open Recent: capped at 10, missing paths greyed ------------------------
  await evaluate(`document.querySelectorAll('.menubar-label')[0].click()`)
  await wait(300)
  await hover('.menu-sub-host')
  await wait(300)
  const recentMenu = await evaluate(`(() => {
    const sub = document.querySelector('.menu-sub')
    if (!sub) return null
    const items = [...sub.querySelectorAll('.menu-item')]
    return {
      count: items.length,
      labels: items.map(b => b.textContent),
      disabled: items.filter(b => b.disabled).map(b => b.textContent)
    }
  })()`)
  assert(recentMenu, 'Open Recent submenu rendered')
  // 10 recents + Clear Menu
  assert(recentMenu.count === 11, 'recent list capped at 10 (+ Clear Menu)', recentMenu)
  assert(recentMenu.disabled.length === 8, 'missing paths are greyed out', recentMenu)
  assert(recentMenu.labels[recentMenu.labels.length - 1] === 'Clear Menu', 'Clear Menu present', recentMenu)
  await screenshot(`${OUT}/p03-recent-menu.png`)

  // --- clicking a valid recent opens the file --------------------------------
  await evaluate(`(() => {
    const sub = document.querySelector('.menu-sub')
    const item = [...sub.querySelectorAll('.menu-item')].find(b => b.textContent.endsWith('b.md') && !b.disabled)
    item.click()
  })()`)
  await wait(1000)
  const opened = await evaluate(`document.querySelector('.tb-title')?.textContent ?? ''`)
  assert(opened.includes('b.md'), 'clicking a recent file opens it', opened)

  // --- window geometry file written by main ----------------------------------
  console.log('PHASE B done')
}

ws.close()
process.exit(process.exitCode ?? 0)
