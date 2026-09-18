// CDP smoke test for P08 (focus / typewriter / source modes).
// Runs against the *built* app (out/) with remote debugging enabled:
//   npm run build
//   node scripts/cdp-p08.mjs
// Launches Electron itself if no target is listening. Drives the real editor
// (window.__veloxEditor) against scripts/tmp-p08/.
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9225
const CDP = `http://127.0.0.1:${CDP_PORT}`
const ELECTRON_BIN = join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
const TMP = join(ROOT, 'scripts', 'tmp-p08')
const FIXTURE_PATH = join(TMP, 'fixture.md')

// Long enough to need scrolling; bold marker lets us spot raw source mode.
const PARA = (n) => `Paragraph **${n}** with some *emphasis* text.`
const FIXTURE = [
  '# P08 Fixture',
  '',
  ...Array.from({ length: 12 }, (_, i) => [PARA(i + 1), ''].join('\n'))
].join('\n')

mkdirSync(TMP, { recursive: true })
writeFileSync(FIXTURE_PATH, FIXTURE)

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
  let target
  try {
    target = await getTarget(3000)
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

  // Boot, seed the session so restore opens the fixture, reload.
  check('boot: window.api', await waitFor(`!!window.api`))
  check('boot: editor', await waitFor(`!!window.__veloxEditor?.view`))
  // Wait for the startup restore to settle before seeding. The restore effect
  // loads lastFilePath asynchronously and then patchSession writes the
  // in-memory session (still holding the *previous* run's path) back to
  // localStorage — seeding before that lands gets the seed clobbered.
  await waitFor(
    `(async () => {
      const prefs = JSON.parse(localStorage.getItem('veloxmark.preferences') ?? '{}')
      const s = JSON.parse(localStorage.getItem('veloxmark.session') ?? '{}')
      if (prefs.restoreLastSession === false || !s.lastFilePath) return true
      try {
        const c = await window.api.readFile(s.lastFilePath)
        return !!window.__veloxEditor?.view &&
          window.__veloxEditor.view.state.doc.toString() === c
      } catch { return true }
    })()`,
    20000
  )
  // Grace period for the sessionSynced write-backs (sidebar fields merged
  // with the stale in-memory lastFilePath) that fire right after restore.
  await new Promise((r) => setTimeout(r, 600))
  // Start from a known-clean mode state regardless of what the previous run left.
  await evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') ?? '{}')
    localStorage.setItem('veloxmark.preferences', JSON.stringify({
      ...raw, focusMode: false, typewriterMode: false, crashRecoveryEnabled: false, autoSaveMode: 'off', sourceMode: false
    }))
    localStorage.setItem('veloxmark.session', JSON.stringify({
      lastFilePath: ${JSON.stringify(FIXTURE_PATH)},
      lastFolderPath: ${JSON.stringify(TMP)}
    }))
  })()`)
  await send('Page.reload')
  check('restore: fixture loaded', await waitFor(
    `window.__veloxEditor?.view?.state.doc.toString().includes('P08 Fixture') ?? false`,
    15000
  ))

  // ---- View menu shows the three mode items ------------------------------------
  const openViewMenu = async () => {
    // Click the "View" top-level label, then read the dropdown.
    const rect = await evaluate(`(() => {
      const btns = [...document.querySelectorAll('.menubar-label')]
      const view = btns.find((b) => b.textContent.trim() === 'View')
      if (!view) return null
      const r = view.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })()`)
    if (!rect) return false
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', buttons: 1, clickCount: 1
    })
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', buttons: 1, clickCount: 1
    })
    return waitFor(`!!document.querySelector('.menu-dropdown')`, 2000)
  }
  const clickMenuItem = async (label) => {
    const rect = await evaluate(`(() => {
      const items = [...document.querySelectorAll('.menu-dropdown .menu-item')]
      const item = items.find((b) => b.querySelector('.menu-item-label')?.textContent.trim() === ${JSON.stringify(label)})
      if (!item) return null
      const r = item.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })()`)
    if (!rect) return false
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', buttons: 1, clickCount: 1
    })
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', buttons: 1, clickCount: 1
    })
    return true
  }
  const menuItemChecked = (label) => evaluate(`(() => {
    const items = [...document.querySelectorAll('.menu-dropdown .menu-item')]
    const item = items.find((b) => b.querySelector('.menu-item-label')?.textContent.trim() === ${JSON.stringify(label)})
    return item ? item.querySelector('.menu-item-check')?.textContent === '✓' : null
  })()`)

  check('View menu opens', await openViewMenu())
  const menuHasModes = await evaluate(`(() => {
    const labels = [...document.querySelectorAll('.menu-dropdown .menu-item-label')].map((e) => e.textContent.trim())
    return ['Focus Mode', 'Typewriter Mode', 'Source Mode'].every((l) => labels.includes(l))
  })()`)
  check('View menu lists Focus/Typewriter/Source Mode', menuHasModes)

  // ---- menu toggle: source mode --------------------------------------------------
  check('Source Mode click', await clickMenuItem('Source Mode'))
  check('source mode on: raw ** visible in DOM text', await waitFor(`(() => {
    const text = document.querySelector('.cm-content')?.textContent ?? ''
    return text.includes('**')
  })()`), await evaluate(`document.querySelector('.cm-content')?.textContent?.slice(0, 80)`))
  check('source mode on: decorations off (no .cm-md-*)', await waitFor(`
    document.querySelectorAll('.cm-content [class*="cm-md-"]').length === 0
  `))
  check('source mode pref persisted', await evaluate(`
    JSON.parse(localStorage.getItem('veloxmark.preferences') ?? '{}').sourceMode === true
  `))
  check('source mode class on editor root', await evaluate(`
    !!document.querySelector('.cm-editor.cm-source-mode')
  `))

  // Switch back via Ctrl+/ — dispatch through the window keydown path.
  await evaluate(`(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', ctrlKey: true, bubbles: true }))
  })()`)
  check('Ctrl+/ returns to live mode', await waitFor(`
    !document.querySelector('.cm-editor.cm-source-mode')
  `))
  check('live mode decorations back', await waitFor(`
    document.querySelectorAll('.cm-content .cm-md-strong, .cm-content .cm-md-em').length > 0
  `, 5000))

  // ---- F8: focus mode ------------------------------------------------------------
  await evaluate(`(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F8', bubbles: true }))
  })()`)
  check('F8 enables focus mode', await waitFor(`!!document.querySelector('.cm-editor.cm-focus-mode')`))
  check('focus active line marked', await waitFor(`
    document.querySelectorAll('.cm-line.cm-focus-active').length > 0
  `))
  const dimmed = await waitFor(`(() => {
    const dim = [...document.querySelectorAll('.cm-editor.cm-focus-mode .cm-line:not(.cm-focus-active)')]
    return dim.length > 0 && dim.every((el) => getComputedStyle(el).opacity === '0.45')
  })()`, 3000) // transition is 0.25s — computed style settles after it
  check('non-active lines dimmed to 0.45', dimmed)
  await evaluate(`(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F8', bubbles: true }))
  })()`)
  check('F8 disables focus mode', await waitFor(`!document.querySelector('.cm-editor.cm-focus-mode')`))

  // ---- typewriter mode (menu) ----------------------------------------------------
  await openViewMenu()
  check('Typewriter Mode click', await clickMenuItem('Typewriter Mode'))
  check('typewriter class on', await waitFor(`!!document.querySelector('.cm-editor.cm-typewriter')`))
  // Type a newline at the end of the doc and confirm the cursor line lands mid-viewport.
  const centered = await evaluate(`(async () => {
    const view = window.__veloxEditor.view
    view.focus()
    view.dispatch({ selection: { anchor: view.state.doc.length } })
    // simulate pressing Enter a few times
    for (let i = 0; i < 3; i++) {
      view.dispatch(view.state.replaceSelection('\\n'), { scrollIntoView: true })
      await new Promise((r) => requestAnimationFrame(r))
    }
    await new Promise((r) => setTimeout(r, 100))
    const head = view.state.selection.main.head
    const coords = view.coordsAtPos(head)
    const sc = view.scrollDOM.getBoundingClientRect()
    const mid = sc.top + sc.height / 2
    return { offset: Math.abs((coords.top + coords.bottom) / 2 - mid), docLen: view.state.doc.length }
  })()`)
  check('cursor line near viewport center after Enter', centered.offset < 40,
    `offset=${centered.offset}`)

  // ---- restart persistence ---------------------------------------------------------
  await send('Page.reload')
  check('modes persist across reload', await waitFor(`(() => {
    if (!window.__veloxEditor?.view) return false
    const p = JSON.parse(localStorage.getItem('veloxmark.preferences') ?? '{}')
    return p.typewriterMode === true && p.sourceMode === false && p.focusMode === false
  })()`, 15000))
  check('typewriter class restored from prefs', await waitFor(
    `!!document.querySelector('.cm-editor.cm-typewriter')`, 5000))

  // Screenshot for visual QA.
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(ROOT, 'scripts', 'p08-typewriter.png'), Buffer.from(shot.data, 'base64'))
  console.log('saved scripts/p08-typewriter.png')

  // Reset modes so the fixture folder is left clean.
  await evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') ?? '{}')
    localStorage.setItem('veloxmark.preferences', JSON.stringify({
      ...raw, focusMode: false, typewriterMode: false, crashRecoveryEnabled: false, autoSaveMode: 'off', sourceMode: false
    }))
  })()`)

  ws.close()
  if (app) app.kill()
  console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nall checks passed')
  process.exit(failures.length ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  if (app) app.kill()
  process.exit(1)
})
